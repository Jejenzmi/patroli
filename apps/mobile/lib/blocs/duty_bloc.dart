import 'dart:async';

import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../core/api.dart';
import '../core/geo.dart';
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
  DutyCheckedIn({required this.siteId, this.scheduleId, this.photoUrl});
}

class DutyCheckedOut extends DutyEvent {
  final String? photoUrl;
  DutyCheckedOut({this.photoUrl});
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

  /// AMAN, PERLU_PERHATIAN, atau BERMASALAH (BRULE-002).
  final String condition;
  DutyCheckpointScanned({
    required this.sessionId,
    this.code,
    this.checkpointId,
    this.method = 'QR',
    this.note,
    this.photoUrl,
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
  DutyPanicTriggered(this.siteId, {this.message});
}

/* ── Keadaan ── */

class DutyState extends Equatable {
  final bool loading;
  final List<ScheduleModel> today;
  final Map<String, dynamic>? attendance; // presensi yang masih terbuka
  final PatrolSessionModel? session;
  final String? error;
  final String? flash; // pesan sukses sekali tampil

  const DutyState({
    this.loading = false,
    this.today = const [],
    this.attendance,
    this.session,
    this.error,
    this.flash,
  });

  bool get onDuty => attendance != null;

  DutyState copyWith({
    bool? loading,
    List<ScheduleModel>? today,
    Object? attendance = _keep,
    Object? session = _keep,
    String? error,
    String? flash,
  }) =>
      DutyState(
        loading: loading ?? this.loading,
        today: today ?? this.today,
        attendance: attendance == _keep ? this.attendance : attendance as Map<String, dynamic>?,
        session: session == _keep ? this.session : session as PatrolSessionModel?,
        error: error,
        flash: flash,
      );

  static const _keep = Object();

  @override
  List<Object?> get props => [loading, today.length, attendance, session?.id, session?.scannedIds.length, error, flash];
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
      final results = await Future.wait([
        Api.i.get('/schedules/my/today'),
        Api.i.get('/schedules/attendance/current'),
        Api.i.get('/patrols/my/active'),
      ]);
      emit(DutyState(
        loading: false,
        today: (results[0] as List).map((e) => ScheduleModel.fromJson(e)).toList(),
        attendance: results[1] as Map<String, dynamic>?,
        session: results[2] == null ? null : PatrolSessionModel.fromJson(results[2]),
      ));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  Future<void> _checkIn(DutyCheckedIn e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final pos = await Geo.current();
      await Api.i.post('/schedules/attendance/check-in', {
        'siteId': e.siteId,
        'scheduleId': e.scheduleId,
        'lat': pos.latitude,
        'lng': pos.longitude,
        'photoUrl': e.photoUrl,
      });
      add(DutyRefreshed());
      emit(state.copyWith(loading: false, flash: 'Presensi masuk berhasil dicatat'));
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
      await Api.i.post('/schedules/attendance/check-out', {
        'lat': pos.latitude,
        'lng': pos.longitude,
        'photoUrl': e.photoUrl,
      });
      add(DutyRefreshed());
      emit(state.copyWith(loading: false, flash: 'Presensi pulang tercatat. Terima kasih.'));
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
      await Api.i.post('/patrols/${e.sessionId}/scan', {
        'code': e.code,
        'checkpointId': e.checkpointId,
        'method': e.method,
        'lat': lat,
        'lng': lng,
        'note': e.note,
        'photoUrl': e.photoUrl,
        'condition': e.condition,
      });
      final s = await Api.i.get('/patrols/my/active');
      emit(state.copyWith(
        loading: false,
        session: s == null ? null : PatrolSessionModel.fromJson(s),
        flash: 'Titik berhasil dipindai',
      ));
    } on ApiException catch (err) {
      emit(state.copyWith(loading: false, error: err.message));
    } catch (err) {
      emit(state.copyWith(loading: false, error: '$err'));
    }
  }

  Future<void> _finish(DutyPatrolFinished e, Emitter<DutyState> emit) async {
    emit(state.copyWith(loading: true, error: null));
    try {
      final r = await Api.i.post('/patrols/${e.sessionId}/finish', {});
      emit(state.copyWith(
        loading: false,
        session: null,
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
        final pos = await Geo.current(highAccuracy: false);
        lat = pos.latitude;
        lng = pos.longitude;
      } catch (_) {}
      await Api.i.post('/incidents/panic/trigger', {
        'siteId': e.siteId,
        'lat': lat,
        'lng': lng,
        'message': e.message,
      });
      emit(state.copyWith(flash: 'Sinyal darurat terkirim ke pusat komando'));
    } catch (err) {
      emit(state.copyWith(error: 'Gagal mengirim sinyal: $err'));
    }
  }
}
