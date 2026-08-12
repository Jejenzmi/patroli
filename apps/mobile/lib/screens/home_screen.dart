import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../blocs/auth_bloc.dart';
import '../blocs/duty_bloc.dart';
import '../models/models.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';
import 'announcements_screen.dart';
import 'handover_screen.dart';
import 'incidents_screen.dart';
import 'schedule_screen.dart';
import 'services_screen.dart';
import 'vehicles_screen.dart';
import 'visitors_screen.dart';

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
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              children: [
                _Header(me: me, state: state),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FadeInUp(index: 0, child: _AttendanceCard(state: state)),
                      const SizedBox(height: 18),
                      FadeInUp(index: 1, child: const _QuickActions()),
                      if (state.session != null) ...[
                        const SizedBox(height: 18),
                        FadeInUp(index: 2, child: _ActivePatrolCard(session: state.session!)),
                      ],
                      const SizedBox(height: 18),
                      FadeInUp(index: 3, child: _TodaySchedule(state: state)),
                      const SizedBox(height: 18),
                      FadeInUp(index: 4, child: const _AnnouncementStrip()),
                      const SizedBox(height: 18),
                      FadeInUp(index: 5, child: _PanicCard(state: state)),
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

/* ── Kepala: sapaan + status tugas ── */

class _Header extends StatelessWidget {
  final MeUser? me;
  final DutyState state;
  const _Header({required this.me, required this.state});

  String get _sapaan {
    final h = DateTime.now().hour;
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  @override
  Widget build(BuildContext context) {
    final onDuty = state.onDuty;
    return Container(
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 16, 20, 22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            (onDuty ? P.emerald : P.amber).withOpacity(.18),
            P.abyss,
            P.voidBg,
          ],
        ),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
        border: const Border(bottom: BorderSide(color: P.line)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: P.amber.withOpacity(.13),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: P.amber.withOpacity(.35)),
                ),
                child: Center(
                  child: Text(
                    _inisial(me?.name ?? '?'),
                    style: const TextStyle(color: P.amber, fontSize: 16, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$_sapaan,',
                        style: const TextStyle(color: P.muted, fontSize: 12.5)),
                    const SizedBox(height: 2),
                    Text(
                      me?.name ?? 'Anggota',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                    ),
                  ],
                ),
              ),
              StatusPill(
                onDuty ? 'Bertugas' : 'Luar dinas',
                color: onDuty ? P.emerald : P.muted,
                icon: onDuty ? Icons.radar : Icons.bedtime_outlined,
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              StatTile(
                icon: Icons.event_available_outlined,
                label: 'Jadwal hari ini',
                value: '${state.today.length}',
                color: P.cyan,
              ),
              const SizedBox(width: 10),
              StatTile(
                icon: Icons.route_outlined,
                label: 'Titik dipindai',
                value: '${state.session?.scannedIds.length ?? 0}',
                color: P.amber,
              ),
              const SizedBox(width: 10),
              StatTile(
                icon: Icons.access_time,
                label: 'Waktu sekarang',
                value: DateFormat('HH:mm').format(DateTime.now()),
                color: P.violet,
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _inisial(String n) =>
      n.split(' ').where((w) => w.isNotEmpty).take(2).map((w) => w[0]).join().toUpperCase();
}

/* ── Kisi pintasan layanan ── */

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    final items = <(IconData, String, Color, Widget)>[
      (Icons.person_add_alt_1_outlined, 'Buku Tamu', P.cyan, const VisitorsScreen()),
      (Icons.local_shipping_outlined, 'Kendaraan', P.violet, const VehiclesScreen()),
      (Icons.assignment_turned_in_outlined, 'Serah Terima', P.emerald, const HandoverScreen()),
      (Icons.calendar_month_outlined, 'Jadwal Saya', P.amber, const ScheduleScreen()),
      (Icons.report_gmailerrorred_outlined, 'Lapor Insiden', P.danger, const IncidentFormScreen()),
      (Icons.campaign_outlined, 'Pengumuman', P.cyan, const AnnouncementsScreen()),
      (Icons.history, 'Riwayat Patroli', P.violet, const ScheduleScreen(tabAwal: 1)),
      (Icons.apps_rounded, 'Semua', P.muted, const ServicesScreen()),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
      decoration: BoxDecoration(
        color: P.panel.withOpacity(.7),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: P.line),
      ),
      // Tinggi baris dikunci agar tidak menyisakan ruang kosong di bawah kisi.
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: items.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          mainAxisSpacing: 16,
          crossAxisSpacing: 6,
          mainAxisExtent: 96,
        ),
        itemBuilder: (_, i) => QuickAction(
          icon: items[i].$1,
          label: items[i].$2,
          color: items[i].$3,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => items[i].$4),
          ),
        ),
      ),
    );
  }
}

/* ── Kartu presensi ── */

class _AttendanceCard extends StatelessWidget {
  final DutyState state;
  const _AttendanceCard({required this.state});

  Future<String?> _swafoto(BuildContext context) async {
    final shot = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 70,
      maxWidth: 1280,
    );
    if (shot == null) return null;
    try {
      return await Api.i.upload(File(shot.path), folder: 'presensi');
    } catch (_) {
      return null; // Foto bersifat pelengkap; kegagalan unggah tidak menghalangi presensi.
    }
  }

  @override
  Widget build(BuildContext context) {
    final on = state.onDuty;
    final att = state.attendance;
    final schedule = state.today.isNotEmpty ? state.today.first : null;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            (on ? P.emerald : P.amber).withOpacity(.10),
            P.panel.withOpacity(.85),
          ],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: (on ? P.emerald : P.amber).withOpacity(.32)),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(on ? Icons.how_to_reg : Icons.fingerprint,
                  size: 17, color: on ? P.emerald : P.amber),
              const SizedBox(width: 8),
              Kicker('Presensi Jaga', color: on ? P.emerald : P.amber),
              const Spacer(),
              if (on && att?['checkInAt'] != null)
                Text(
                  'Masuk ${DateFormat('HH:mm').format(DateTime.parse(att!['checkInAt']).toLocal())}',
                  style: const TextStyle(color: P.emerald, fontSize: 11.5, fontWeight: FontWeight.w800),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            on
                ? 'Anda sedang bertugas di ${att?['site']?['name'] ?? 'lokasi penempatan'}.'
                : schedule != null
                    ? 'Shift ${schedule.shiftName} (${schedule.startTime}–${schedule.endTime}) di ${schedule.site.name}.'
                    : 'Belum ada jadwal jaga hari ini.',
            style: const TextStyle(fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: on
                ? OutlinedButton.icon(
                    onPressed: state.loading ? null : () => _pulang(context),
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('PRESENSI PULANG'),
                  )
                : FilledButton.icon(
                    onPressed: (state.loading || schedule == null) ? null : () => _masuk(context, schedule),
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
                child: Text('Presensi hanya diterima di dalam radius pos jaga.',
                    style: TextStyle(color: P.muted, fontSize: 11, height: 1.4)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _masuk(BuildContext context, ScheduleModel schedule) async {
    final ok = await askConfirm(
      context,
      title: 'Mulai presensi masuk?',
      message: 'Lokasi dan waktu Anda akan dicatat sebagai bukti kehadiran. Pastikan Anda sudah berada di pos jaga.',
      detail: '${schedule.site.name} · shift ${schedule.shiftName} ${schedule.startTime}–${schedule.endTime}',
      confirmLabel: 'Ya, presensi',
      tone: DialogTone.info,
    );
    if (!ok || !context.mounted) return;
    final photo = await _swafoto(context);
    if (!context.mounted) return;
    context.read<DutyBloc>().add(
          DutyCheckedIn(siteId: schedule.site.id, scheduleId: schedule.id, photoUrl: photo),
        );
  }

  Future<void> _pulang(BuildContext context) async {
    final ok = await askConfirm(
      context,
      title: 'Akhiri tugas dan presensi pulang?',
      message: 'Pastikan serah terima shift sudah dilakukan dan tidak ada patroli yang masih berjalan.',
      confirmLabel: 'Ya, pulang',
      tone: DialogTone.warn,
    );
    if (!ok || !context.mounted) return;
    final photo = await _swafoto(context);
    if (!context.mounted) return;
    context.read<DutyBloc>().add(DutyCheckedOut(photoUrl: photo));
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

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: P.panel.withOpacity(.8),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: P.cyan.withOpacity(.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.route, size: 17, color: P.cyan),
              const SizedBox(width: 8),
              const Kicker('Patroli Berjalan', color: P.cyan),
              const Spacer(),
              Text('$done/$total titik',
                  style: const TextStyle(color: P.cyan, fontSize: 12, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 12),
          Text(session.route.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          'Jadwal Jaga Anda',
          icon: Icons.event_note_outlined,
          action: 'Lihat semua',
          onAction: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ScheduleScreen()),
          ),
        ),
        if (state.loading && state.today.isEmpty)
          const Column(children: [Shimmer(height: 76), SizedBox(height: 10), Shimmer(height: 76)])
        else if (state.today.isEmpty)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: P.panel.withOpacity(.6),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: P.line),
            ),
            child: const Row(
              children: [
                Icon(Icons.event_busy_outlined, size: 18, color: P.muted),
                SizedBox(width: 12),
                Expanded(
                  child: Text('Tidak ada jadwal jaga untuk hari ini.',
                      style: TextStyle(color: P.muted, fontSize: 13)),
                ),
              ],
            ),
          )
        else
          ...state.today.map((s) => Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  color: P.panel.withOpacity(.7),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: P.line),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 42,
                      decoration: BoxDecoration(color: P.amber, borderRadius: BorderRadius.circular(4)),
                    ),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${s.shiftName} · ${s.startTime}–${s.endTime}',
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                          const SizedBox(height: 2),
                          Text(s.site.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: P.muted, fontSize: 12)),
                          if (s.route != null)
                            Text('Rute: ${s.route!.name}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: P.cyan, fontSize: 11)),
                        ],
                      ),
                    ),
                    StatusPill(
                      switch (s.status) {
                        'PLANNED' => 'Rencana',
                        'CONFIRMED' => 'Aktif',
                        'DONE' => 'Selesai',
                        'ABSENT' => 'Absen',
                        _ => s.status,
                      },
                      color: switch (s.status) {
                        'DONE' => P.emerald,
                        'CONFIRMED' => P.cyan,
                        'ABSENT' => P.danger,
                        _ => P.muted,
                      },
                    ),
                  ],
                ),
              )),
      ],
    );
  }
}

/* ── Cuplikan pengumuman ── */

class _AnnouncementStrip extends StatefulWidget {
  const _AnnouncementStrip();

  @override
  State<_AnnouncementStrip> createState() => _AnnouncementStripState();
}

class _AnnouncementStripState extends State<_AnnouncementStrip> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.i.get('/frontdesk/announcements');
      if (mounted) setState(() {
            _items = (r as List).take(5).toList();
            _loading = false;
          });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Shimmer(height: 96);
    if (_items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          'Pengumuman Satuan',
          icon: Icons.campaign_outlined,
          action: 'Semua',
          onAction: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AnnouncementsScreen()),
          ),
        ),
        SizedBox(
          height: 118,
          child: PageView.builder(
            controller: PageController(viewportFraction: .92),
            itemCount: _items.length,
            itemBuilder: (_, i) {
              final a = _items[i];
              final warna = switch (a['priority']) {
                'CRITICAL' => P.danger,
                'HIGH' => const Color(0xFFFB923C),
                'MEDIUM' => P.amber,
                _ => P.cyan,
              };
              return Container(
                margin: const EdgeInsets.only(right: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [warna.withOpacity(.14), P.panel.withOpacity(.85)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: warna.withOpacity(.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.campaign, size: 15, color: warna),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(a['title'] ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: Text(a['body'] ?? '',
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: P.muted, fontSize: 12, height: 1.45)),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/* ── Tombol darurat ── */

class _PanicCard extends StatelessWidget {
  final DutyState state;
  const _PanicCard({required this.state});

  @override
  Widget build(BuildContext context) {
    final siteId = state.attendance?['site']?['id'] ??
        (state.today.isNotEmpty ? state.today.first.site.id : null);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [P.danger.withOpacity(.14), P.panel.withOpacity(.85)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: P.danger.withOpacity(.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.emergency_share_outlined, size: 17, color: P.danger),
              SizedBox(width: 8),
              Kicker('Tombol Darurat', color: P.danger),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Tekan bila menghadapi ancaman atau butuh bantuan segera. Posisi Anda langsung dikirim ke pusat komando.',
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
                      final ok = await askConfirm(
                        context,
                        title: 'Kirim sinyal darurat?',
                        message: 'Pusat komando dan seluruh supervisor akan langsung dihubungi, dan posisi Anda dibagikan.',
                        detail: 'Gunakan hanya untuk keadaan darurat yang sungguh terjadi.',
                        confirmLabel: 'KIRIM SINYAL',
                        tone: DialogTone.danger,
                      );
                      if (ok && context.mounted) {
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
