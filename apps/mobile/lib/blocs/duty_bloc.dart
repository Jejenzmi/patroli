import 'dart:async';
import 'dart:io';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../core/api.dart';
import '../core/geo.dart';
import '../core/sinkron.dart';
import '../models/models.dart';

/* ── Peristiwa ── */

abstract class DutyEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

/// Muat jadwal hari ini, status presensi, dan sesi patroli berjalan.
class DutyRefreshed extends DutyEvent {}

class DutyCheckedIn extends DutyEvent {
  final String siteId;
  final String? scheduleId;
  final String? photoUrl;

  /// Berkas swafoto yang belum sempat diunggah karena jaringan mati.
  final File? foto;
  DutyCheckedIn({required this.siteId, this.scheduleId, this.photoUrl, this.foto});
}

class DutyCheckedOut extends DutyEvent {
  final String? photoUrl;
  final File? foto;
  DutyCheckedOut({this.photoUrl, this.foto});
}

class DutyPatrolStarted extends DutyEvent {
  final String routeId;
  final String? scheduleId;
  DutyPatrolStarted(this.routeId, {this.scheduleId});
}

class DutyCheckpointScanned extends DutyEvent {
  final String sessionId;
  final String? code;
  final String? checkpointId;
  final String method;
  final String? note;
  final String? photoUrl;

  /// Foto bukti yang belum sempat diunggah karena jaringan mati.
  final File? foto;

  /// AMAN, PERLU_PERHATIAN, atau BERMASALAH (BRULE-002).
  final String condition;
  DutyCheckpointScanned({
    required this.sessionId,
    this.code,
    this.checkpointId,
    this.method = 'QR',
    this.note,
    this.photoUrl,
    this.foto,
    this.condition = 'AMAN',
  });
}

class DutyPatrolFinished extends DutyEvent {
  final String sessionId;
  DutyPatrolFinished(this.sessionId);
}

class DutyPanicTriggered extends DutyEvent {
  final String siteId;
  final String? message;

  /// UMUM, KEBAKARAN, KECELAKAAN, MEDIS, KRIMINAL, atau BENCANA.
  final String type;
  DutyPanicTriggered(this.siteId, {this.message, this.type = 'UMUM'});
}

/* ── Keadaan ── */

class DutyState extends Equatable {
  final bool loading;
  final List<ScheduleModel> today;
  final Map<String, dynamic>? attendance; // presensi yang masih terbuka
  final PatrolSessionModel? session;
  final String? error;
  final String? flash; // pesan sukses sekali tampil

  /// Titik yang sudah dipindai petugas tetapi catatannya masih menunggu
  /// jaringan. Ditampilkan sebagai kemajuan agar petugas tidak memindai ulang.
  final Set<String> tertunda;

  const DutyState({
    this.loading = false,
    this.today = const [],
    this.attendance,
    this.session,
    this.error,
    this.flash,
    this.tertunda = const {},
  });

  /// Seluruh titik yang dianggap selesai: yang tercatat server ditambah
  /// yang masih mengantre di perangkat.
  Set<String> get titikSelesai => {...?session?.scannedIds, ...tertunda};

  bool get onDuty => attendance != null;

  DutyState copyWith({
    bool? loading,
    List<ScheduleModel>? today,
    Object? attendance = _keep,
    Object? session = _keep,
    String? error,
    String? flash,
    Set<String>? tertunda,
  }) =>
      DutyState(
        loading: loading ?? this.loading,
        today: today ?? this.today,
        attendance: attendance == _keep ? this.attendance : attendance as Map<String, dynamic>?,
        session: session == _keep ? this.session : session as PatrolSessionModel?,
        error: error,
        flash: flash,
        tertunda: tertunda ?? this.tertunda,
      );

  static const _keep = Object();

  @override
  List<Object?> get props =>
      [loading, today.length, attendance, session?.id, session?.scannedIds.length, tertunda.length, error, flash];
}

/* ── Bloc ── */

class DutyBloc extends Bloc<DutyEvent, DutyState> {
  DutyBloc() : super(const DutyState()) {
    on<DutyRefreshed>(_refresh);
    on<DutyCheckedIn>(_checkIn);
    on<DutyCheckedOut>(_checkOut);
    on<DutyPatrolStarted>(_startPatrol);
    on<DutyCheckpointScanned>(_scan);
    on<DutyPatrolFinished>(_finish);
    on<DutyPanicTriggered>(_panic);
    _mulaiJejak();
  }

  Timer? _jejak;

  /// FR-GPS-004: selama berstatus masuk, posisi dikirim berkala agar pusat
  /// kendali dapat memantau sebaran personel tanpa perlu menunggu pemindaian.
  void _mulaiJejak() {
    _jejak = Timer.periodic(const Duration(minutes: 3), (_) => kirimJejak());
  }

  Future<void> kirimJejak() async {
    if (!state.onDuty) return;
    try {
      final pos = await Geo.current();
      await Api.i.post('/patrols/tracking/ping', {
        'lat': pos.latitude,
        'lng': pos.longitude,
        'accuracyM': pos.accuracy,
        'speedKph': pos.speed * 3.6,
        'sessionId': state.session?.id,
      });
    } catch (_) {
      // Jejak bersifat pelengkap: kegagalan jaringan tidak mengganggu tugas.
    }
  }

  @override
  Future<void> close() {
    _jejak?.cancel();
    return super.close();
  }

  Future<void> _refresh(DutyRefreshed e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      // Memakai singgahan agar jadwal, status presensi, dan patroli berjalan
      // tetap terbaca di area tanpa sinyal.
      final results = await Future.wait([
        Api.i.getSinggah('/schedules/my/today'),
        Api.i.getSinggah('/schedules/attendance/current'),
        Api.i.getSinggah('/patrols/my/active'),
      ]);
      emit(DutyState(
        loading: false,
        today: (results[0] as List).map((e) => ScheduleModel.fromJson(e)).toList(),
        attendance: results[1] as Map<String, dynamic>?,
        session: results[2] == null ? null : PatrolSessionModel.fromJson(results[2]),
        tertunda: state.tertunda,
      ));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  Future<void> _checkIn(DutyCheckedIn e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final pos = await Geo.current();
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/schedules/attendance/check-in',
        label: 'Presensi masuk',
        berkas: e.foto,
        folderBerkas: 'presensi',
        kolomBerkas: e.foto != null ? 'photoUrl' : null,
        isi: {
          'siteId': e.siteId,
          'scheduleId': e.scheduleId,
          'lat': pos.latitude,
          'lng': pos.longitude,
          if (e.photoUrl != null) 'photoUrl': e.photoUrl,
        },
      );
      add(DutyRefreshed());
      emit(state.copyWith(
        loading: false,
        flash: terkirim
            ? 'Presensi masuk berhasil dicatat'
            : 'Tidak ada jaringan — presensi tersimpan dan akan terkirim sendiri',
      ));
      kirimJejak();
    } on ApiException catch (err) {
      emit(state.copyWith(loading: false, error: err.message));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  Future<void> _checkOut(DutyCheckedOut e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final pos = await Geo.current();
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/schedules/attendance/check-out',
        label: 'Presensi pulang',
        berkas: e.foto,
        folderBerkas: 'presensi',
        kolomBerkas: e.foto != null ? 'photoUrl' : null,
        isi: {
          'lat': pos.latitude,
          'lng': pos.longitude,
          if (e.photoUrl != null) 'photoUrl': e.photoUrl,
        },
      );
      add(DutyRefreshed());
      emit(state.copyWith(
        loading: false,
        flash: terkirim
            ? 'Presensi pulang tercatat. Terima kasih.'
            : 'Tidak ada jaringan — presensi pulang tersimpan dan akan terkirim sendiri',
      ));
    } on ApiException catch (err) {
      emit(state.copyWith(loading: false, error: err.message));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  Future<void> _startPatrol(DutyPatrolStarted e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final r = await Api.i.post('/patrols/start', {'routeId': e.routeId, 'scheduleId': e.scheduleId});
      emit(state.copyWith(
        loading: false,
        session: PatrolSessionModel.fromJson(r),
        flash: 'Patroli dimulai. Selamat bertugas.',
      ));
    } on ApiException catch (err) {
      emit(state.copyWith(loading: false, error: err.message));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  Future<void> _scan(DutyCheckpointScanned e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      double? lat, lng;
      try {
        final pos = await Geo.current();
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (_) {
        // Titik tetap bisa dipindai lewat QR walau GPS lambat mengunci.
      }
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/patrols/${e.sessionId}/scan',
        label: 'Pemindaian titik',
        berkas: e.foto,
        folderBerkas: 'patroli',
        kolomBerkas: e.foto != null ? 'photoUrl' : null,
        isi: {
          'code': e.code,
          'checkpointId': e.checkpointId,
          'method': e.method,
          'lat': lat,
          'lng': lng,
          'note': e.note,
          if (e.photoUrl != null) 'photoUrl': e.photoUrl,
          'condition': e.condition,
        },
      );

      if (terkirim) {
        final s = await Api.i.getSinggah('/patrols/my/active');
        emit(state.copyWith(
          loading: false,
          session: s == null ? null : PatrolSessionModel.fromJson(s),
          flash: 'Titik berhasil dipindai',
        ));
      } else {
        // Tanpa jaringan, kemajuan tetap bertambah di layar supaya petugas
        // tidak memindai titik yang sama dua kali.
        final tandai = e.checkpointId ?? _idDariKode(e.code);
        emit(state.copyWith(
          loading: false,
          tertunda: tandai == null ? state.tertunda : {...state.tertunda, tandai},
          flash: 'Tidak ada jaringan — titik tercatat dan akan terkirim sendiri',
        ));
      }
    } on ApiException catch (err) {
      emit(state.copyWith(loading: false, error: err.message));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  /// Menerjemahkan isi stiker QR menjadi id titik memakai rute yang sudah
  /// tersimpan di perangkat, agar kemajuan tetap terbaca saat luring.
  String? _idDariKode(String? kode) {
    if (kode == null) return null;
    final bersih = kode.replaceFirst('PATROLI:CP:', '').trim();
    final titik = state.session?.route.checkpoints;
    if (titik == null) return null;
    for (final c in titik) {
      if (c.code == bersih || c.id == bersih) return c.id;
    }
    return null;
  }

  Future<void> _finish(DutyPatrolFinished e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      // Menyelesaikan patroli menunggu antrean pemindaian tuntas lebih dulu.
      await Sinkron.i.kirimSemua();
      final r = await Api.i.post('/patrols/${e.sessionId}/finish', {});
      emit(state.copyWith(
        loading: false,
        session: null,
        tertunda: const {},
        flash: 'Patroli selesai · kepatuhan ${r['complianceRate']}%',
      ));
    } on ApiException catch (err) {
      emit(state.copyWith(loading: false, error: err.message));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  Future<void> _panic(DutyPanicTriggered e, Emitter<DutyState> emit) async {
    try {
      double? lat, lng;
      try {
        // Sinyal darurat tidak boleh menunggu GPS. Bila posisi belum terkunci
        // dalam lima detik, sinyal tetap dikirim tanpa koordinat — pusat
        // kendali masih tahu siapa yang meminta bantuan dan di site mana.
        final pos = await Geo.current(highAccuracy: false)
            .timeout(const Duration(seconds: 5));
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (_) {}
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/incidents/panic/trigger',
        label: 'Sinyal darurat',
        isi: {
          'siteId': e.siteId,
          'lat': lat,
          'lng': lng,
          'message': e.message,
          'type': e.type,
        },
      );
      emit(state.copyWith(
        flash: terkirim
            ? 'Sinyal darurat terkirim ke pusat komando'
            : 'Tidak ada jaringan — sinyal tersimpan dan terkirim begitu sinyal pulih',
      ));
    } catch (err) {
      emit(state.copyWith(error: 'Gagal mengirim sinyal: $err'));
    }
  }
}
