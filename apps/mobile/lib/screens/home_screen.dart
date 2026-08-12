import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../core/api.dart';
import '../blocs/auth_bloc.dart';
import '../blocs/duty_bloc.dart';
import '../models/models.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthBloc>().state.user;

    return Scaffold(
      body: RefreshIndicator(
        color: P.amber,
        backgroundColor: P.panel,
        onRefresh: () async => context.read<DutyBloc>().add(DutyRefreshed()),
        child: BlocBuilder<DutyBloc, DutyState>(
          builder: (context, state) {
            return CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 132,
                  backgroundColor: P.abyss,
                  flexibleSpace: FlexibleSpaceBar(
                    titlePadding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
                    title: Row(
                      children: [
                        Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                me?.name ?? 'Anggota',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                '${me?.employeeId ?? ''} · ${me?.rank ?? 'Anggota'}',
                                style: const TextStyle(fontSize: 11, color: P.muted, fontWeight: FontWeight.w500),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        StatusPill(
                          state.onDuty ? 'Bertugas' : 'Luar Dinas',
                          color: state.onDuty ? P.emerald : P.muted,
                          icon: state.onDuty ? Icons.radar : Icons.bedtime_outlined,
                        ),
                      ],
                    ),
                    background: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [P.amber.withOpacity(.14), P.abyss],
                        ),
                      ),
                      padding: const EdgeInsets.fromLTRB(20, 52, 20, 0),
                      child: Align(
                        alignment: Alignment.topLeft,
                        child: Text(
                          DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(DateTime.now()),
                          style: const TextStyle(color: P.muted, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ),
                ),

                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                  sliver: SliverList.list(
                    children: [
                      _AttendanceCard(state: state),
                      const SizedBox(height: 14),
                      if (state.session != null) ...[
                        _ActivePatrolCard(session: state.session!),
                        const SizedBox(height: 14),
                      ],
                      _TodaySchedule(state: state),
                      const SizedBox(height: 14),
                      _PanicCard(state: state),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/* ── Kartu presensi ── */

class _AttendanceCard extends StatelessWidget {
  final DutyState state;
  const _AttendanceCard({required this.state});

  Future<String?> _snapshot(BuildContext context) async {
    final picker = ImagePicker();
    final shot = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 70,
      maxWidth: 1280,
    );
    if (shot == null) return null;
    try {
      return await Api.i.upload(File(shot.path), folder: 'presensi');
    } catch (_) {
      return null; // Foto opsional: kegagalan unggah tidak menghalangi presensi.
    }
  }

  @override
  Widget build(BuildContext context) {
    final on = state.onDuty;
    final att = state.attendance;
    final schedule = state.today.isNotEmpty ? state.today.first : null;

    return GlassCard(
      border: on ? P.emerald.withOpacity(.35) : P.line,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(on ? Icons.how_to_reg : Icons.fingerprint, size: 18, color: on ? P.emerald : P.amber),
              const SizedBox(width: 8),
              const Kicker('Presensi Jaga'),
              const Spacer(),
              if (on && att?['checkInAt'] != null)
                Text(
                  'Masuk ${DateFormat('HH:mm').format(DateTime.parse(att!['checkInAt']).toLocal())}',
                  style: const TextStyle(color: P.emerald, fontSize: 11, fontWeight: FontWeight.w700),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            on
                ? 'Anda sedang bertugas di ${att?['site']?['name'] ?? 'lokasi penempatan'}.'
                : schedule != null
                    ? 'Jadwal Anda: shift ${schedule.shiftName} (${schedule.startTime}–${schedule.endTime}) di ${schedule.site.name}.'
                    : 'Belum ada jadwal jaga hari ini.',
            style: const TextStyle(fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: on
                ? OutlinedButton.icon(
                    onPressed: state.loading
                        ? null
                        : () async {
                            final photo = await _snapshot(context);
                            if (!context.mounted) return;
                            context.read<DutyBloc>().add(DutyCheckedOut(photoUrl: photo));
                          },
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('PRESENSI PULANG'),
                  )
                : FilledButton.icon(
                    onPressed: (state.loading || schedule == null)
                        ? null
                        : () async {
                            final photo = await _snapshot(context);
                            if (!context.mounted) return;
                            context.read<DutyBloc>().add(DutyCheckedIn(
                                  siteId: schedule.site.id,
                                  scheduleId: schedule.id,
                                  photoUrl: photo,
                                ));
                          },
                    icon: const Icon(Icons.login, size: 18),
                    label: const Text('PRESENSI MASUK'),
                  ),
          ),
          const SizedBox(height: 10),
          const Row(
            children: [
              Icon(Icons.my_location, size: 12, color: P.muted),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Presensi hanya diterima bila Anda berada di dalam radius pos jaga.',
                  style: TextStyle(color: P.muted, fontSize: 11, height: 1.4),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/* ── Kartu patroli berjalan ── */

class _ActivePatrolCard extends StatelessWidget {
  final PatrolSessionModel session;
  const _ActivePatrolCard({required this.session});

  @override
  Widget build(BuildContext context) {
    final done = session.scannedIds.length;
    final total = session.route.checkpoints.length;
    final pct = total == 0 ? 0.0 : done / total;

    return GlassCard(
      border: P.cyan.withOpacity(.4),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.route, size: 18, color: P.cyan),
              const SizedBox(width: 8),
              const Kicker('Patroli Berjalan', color: P.cyan),
              const Spacer(),
              Text('$done/$total titik',
                  style: const TextStyle(color: P.cyan, fontSize: 12, fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 12),
          Text(session.route.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          Text(session.site.name, style: const TextStyle(color: P.muted, fontSize: 12)),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 7,
              backgroundColor: Colors.white10,
              valueColor: const AlwaysStoppedAnimation(P.cyan),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Dimulai ${DateFormat('HH:mm').format(session.startedAt.toLocal())} · target ${session.route.expectedDurationMin} menit',
            style: const TextStyle(color: P.muted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

/* ── Jadwal hari ini ── */

class _TodaySchedule extends StatelessWidget {
  final DutyState state;
  const _TodaySchedule({required this.state});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.event_note_outlined, size: 18, color: P.amber),
              SizedBox(width: 8),
              Kicker('Jadwal Jaga Anda'),
            ],
          ),
          const SizedBox(height: 14),
          if (state.today.isEmpty)
            const Text('Tidak ada jadwal jaga untuk hari ini.',
                style: TextStyle(color: P.muted, fontSize: 13))
          else
            ...state.today.map((s) => Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: P.abyss.withOpacity(.6),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: P.line),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 4,
                        height: 40,
                        decoration: BoxDecoration(color: P.amber, borderRadius: BorderRadius.circular(4)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${s.shiftName} · ${s.startTime}–${s.endTime}',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                            const SizedBox(height: 2),
                            Text(s.site.name,
                                style: const TextStyle(color: P.muted, fontSize: 12),
                                overflow: TextOverflow.ellipsis),
                            if (s.route != null)
                              Text('Rute: ${s.route!.name}',
                                  style: const TextStyle(color: P.cyan, fontSize: 11)),
                          ],
                        ),
                      ),
                      StatusPill(
                        _statusLabel(s.status),
                        color: s.status == 'DONE'
                            ? P.emerald
                            : s.status == 'CONFIRMED'
                                ? P.cyan
                                : P.muted,
                      ),
                    ],
                  ),
                )),
        ],
      ),
    );
  }

  String _statusLabel(String s) => switch (s) {
        'PLANNED' => 'Rencana',
        'CONFIRMED' => 'Aktif',
        'DONE' => 'Selesai',
        'ABSENT' => 'Absen',
        _ => s,
      };
}

/* ── Tombol darurat ── */

class _PanicCard extends StatelessWidget {
  final DutyState state;
  const _PanicCard({required this.state});

  @override
  Widget build(BuildContext context) {
    final siteId = state.attendance?['site']?['id'] ??
        (state.today.isNotEmpty ? state.today.first.site.id : null);

    return GlassCard(
      border: P.danger.withOpacity(.35),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.emergency_share_outlined, size: 18, color: P.danger),
              SizedBox(width: 8),
              Kicker('Tombol Darurat', color: P.danger),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Tekan bila Anda menghadapi ancaman atau butuh bantuan segera. Posisi Anda langsung dikirim ke pusat komando.',
            style: TextStyle(color: P.muted, fontSize: 12, height: 1.5),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: P.danger, foregroundColor: Colors.white),
              onPressed: siteId == null
                  ? null
                  : () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (c) => AlertDialog(
                          title: const Text('Kirim sinyal darurat?'),
                          content: const Text(
                              'Pusat komando akan segera dihubungi dan posisi Anda dibagikan. Gunakan hanya untuk keadaan darurat.'),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Batal')),
                            FilledButton(
                              style: FilledButton.styleFrom(backgroundColor: P.danger),
                              onPressed: () => Navigator.pop(c, true),
                              child: const Text('KIRIM'),
                            ),
                          ],
                        ),
                      );
                      if (ok == true && context.mounted) {
                        context.read<DutyBloc>().add(DutyPanicTriggered(siteId));
                      }
                    },
              icon: const Icon(Icons.campaign_outlined),
              label: const Text('KIRIM SINYAL DARURAT'),
            ),
          ),
        ],
      ),
    );
  }
}
