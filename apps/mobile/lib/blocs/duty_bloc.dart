import 'dart:async';
import 'dart:io';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../core/api.dart';
import '../core/geo.dart';
import '../core/perangkat.dart';
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

  /// Mengambil posisi beserta penilaian keasliannya.
  ///
  /// Koordinat tiruan tidak dibuang diam-diam: posisinya tetap diambil dan
  /// dikirim dengan tanda `mocked`, supaya percobaannya tercatat di pusat
  /// komando meski tindakannya sendiri ditolak.
  Future<({double? lat, double? lng, double? akurasi, bool palsu})> _posisi({
    bool wajib = true,
    bool highAccuracy = true,
  }) async {
    try {
      final pos = await Geo.current(highAccuracy: highAccuracy);
      return (lat: pos.latitude, lng: pos.longitude, akurasi: pos.accuracy, palsu: false);
    } on LokasiPalsu catch (e) {
      return (
        lat: e.posisi.latitude,
        lng: e.posisi.longitude,
        akurasi: e.posisi.accuracy,
        palsu: true
      );
    } catch (_) {
      if (wajib) rethrow;
      return (lat: null, lng: null, akurasi: null, palsu: false);
    }
  }

  /// Keterangan perangkat yang disertakan pada tiap tindakan lapangan.
  Future<Map<String, dynamic>> _bukti(
      ({double? lat, double? lng, double? akurasi, bool palsu}) p) async {
    return {
      'lat': p.lat,
      'lng': p.lng,
      'accuracyM': p.akurasi,
      'mocked': p.palsu,
      'isPhysical': await Perangkat.i.fisik(),
      'deviceId': await Perangkat.i.id(),
    };
  }

  static const _pesanPalsu =
      'Lokasi palsu terdeteksi. Matikan aplikasi pengubah lokasi lalu ulangi — '
      'percobaan ini dilaporkan ke pengawas.';

  /// FR-GPS-004: selama berstatus masuk, posisi dikirim berkala agar pusat
  /// kendali dapat memantau sebaran personel tanpa perlu menunggu pemindaian.
  void _mulaiJejak() {
    _jejak = Timer.periodic(const Duration(minutes: 3), (_) => kirimJejak());
  }

  Future<void> kirimJejak() async {
    if (!state.onDuty) return;
    try {
      final p = await _posisi(wajib: false, highAccuracy: false);
      if (p.lat == null) return;
      await Api.i.post('/patrols/tracking/ping', {
        ...await _bukti(p),
        'sessionId': state.session?.id,
      });
    } catch (_) {
      // Jejak bersifat pelengkap: kegagalan jaringan tidak mengganggu tugas.
      // Jejak yang ditolak karena lokasi palsu sudah tercatat di server.
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
      final p = await _posisi();
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/schedules/attendance/check-in',
        label: 'Presensi masuk',
        berkas: e.foto,
        folderBerkas: 'presensi',
        kolomBerkas: e.foto != null ? 'photoUrl' : null,
        isi: {
          ...await _bukti(p),
          'siteId': e.siteId,
          'scheduleId': e.scheduleId,
          if (e.photoUrl != null) 'photoUrl': e.photoUrl,
        },
      );
      if (p.palsu && !terkirim) {
        return emit(state.copyWith(loading: false, error: _pesanPalsu));
      }
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
      final p = await _posisi();
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/schedules/attendance/check-out',
        label: 'Presensi pulang',
        berkas: e.foto,
        folderBerkas: 'presensi',
        kolomBerkas: e.foto != null ? 'photoUrl' : null,
        isi: {
          ...await _bukti(p),
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
      // Titik tetap bisa dipindai lewat QR walau GPS lambat mengunci.
      final p = await _posisi(wajib: false);
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/patrols/${e.sessionId}/scan',
        label: 'Pemindaian titik',
        berkas: e.foto,
        folderBerkas: 'patroli',
        kolomBerkas: e.foto != null ? 'photoUrl' : null,
        isi: {
          ...await _bukti(p),
          'code': e.code,
          'checkpointId': e.checkpointId,
          'method': e.method,
          'note': e.note,
          if (e.photoUrl != null) 'photoUrl': e.photoUrl,
          'condition': e.condition,
        },
      );
      if (p.palsu && !terkirim) {
        return emit(state.copyWith(loading: false, error: _pesanPalsu));
      }

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
    // Stiker cetakan lama masih berawalan PATROLI:CP:, cetakan baru
    // DHARMAPATI:CP: — keduanya diterima agar penggantian stiker tidak
    // harus serentak.
    final bersih = kode.replaceFirst('DHARMAPATI:CP:', '').replaceFirst('PATROLI:CP:', '').trim();
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
      // Sinyal darurat tidak boleh menunggu GPS. Bila posisi belum terkunci
      // dalam lima detik, sinyal tetap dikirim tanpa koordinat — pusat kendali
      // masih tahu siapa yang meminta bantuan dan di site mana. Koordinat
      // tiruan pun tidak menghalangi sinyal: nyawa didahulukan, penyimpangan
      // datanya cukup ditandai untuk ditinjau kemudian.
      ({double? lat, double? lng, double? akurasi, bool palsu}) p;
      try {
        p = await _posisi(wajib: false, highAccuracy: false)
            .timeout(const Duration(seconds: 5));
      } catch (_) {
        p = (lat: null, lng: null, akurasi: null, palsu: false);
      }
      final terkirim = await Api.i.kirimAtauAntre(
        jalur: '/incidents/panic/trigger',
        label: 'Sinyal darurat',
        isi: {
          'lat': p.lat,
          'lng': p.lng,
          'siteId': e.siteId,
          'message': e.message,
          'type': e.type,
          'deviceId': await Perangkat.i.id(),
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
