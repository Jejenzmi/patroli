import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'kpi_screen.dart';
import 'leaves_screen.dart';
import 'tasks_screen.dart';
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
                  padding: EdgeInsets.fromLTRB(16, 18, 16, bottomInset(context)),
                  child: IsiTerpusat(
                    child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FadeInUp(index: 0, child: _AttendanceCard(state: state)),
                      const SizedBox(height: 18),
                      FadeInUp(index: 1, child: const _QuickActions()),
                      if (state.session != null) ...[
                        const SizedBox(height: 18),
                        FadeInUp(index: 2, child: _ActivePatrolCard(state: state)),
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
      child: IsiTerpusat(
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
                value: '${state.titikSelesai.length}',
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
      (Icons.assignment_outlined, 'Tugas Saya', P.emerald, const TasksScreen()),
      (Icons.fact_check_outlined, 'Instruksi', P.cyan, const TasksScreen(tabAwal: 1)),
      (Icons.emoji_events_outlined, 'Nilai Kinerja', P.amber, const KpiScreen()),
      (Icons.event_available_outlined, 'Cuti & Lembur', P.violet, const LeavesScreen()),
      (Icons.apps_rounded, 'Semua Layanan', P.muted, const ServicesScreen()),
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
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          // Layar sempit memakai tiga kolom agar label tidak terpotong.
          crossAxisCount: layarSempit(context) ? 3 : 4,
          mainAxisSpacing: 16,
          crossAxisSpacing: 6,
          mainAxisExtent: 100,
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

  /// Mengambil swafoto presensi. Bila wajah personel sudah didaftarkan, foto
  /// menjadi syarat mutlak karena server mencocokkannya (BRULE-003).
  Future<String?> _swafoto(BuildContext context, {required bool wajib}) async {
    final shot = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 70,
      maxWidth: 1280,
    );
    if (shot == null) {
      if (wajib && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Swafoto wajib diambil karena presensi Anda diverifikasi wajah')),
        );
      }
      return null;
    }
    try {
      return await Api.i.upload(File(shot.path), folder: 'presensi');
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(wajib ? 'Foto gagal diunggah: $e' : 'Foto tidak terunggah, presensi tetap diproses')),
        );
      }
      return null;
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
    final wajib = context.read<AuthBloc>().state.user?.faceEnrolled ?? false;
    final photo = await _swafoto(context, wajib: wajib);
    if (wajib && photo == null) return;
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
    final photo = await _swafoto(context, wajib: false);
    if (!context.mounted) return;
    context.read<DutyBloc>().add(DutyCheckedOut(photoUrl: photo));
  }
}

/* ── Kartu patroli berjalan ── */

class _ActivePatrolCard extends StatelessWidget {
  final DutyState state;
  const _ActivePatrolCard({required this.state});

  @override
  Widget build(BuildContext context) {
    final session = state.session!;
    final done = state.titikSelesai.length;
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
                          if (s.notes != null) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: P.amber.withOpacity(.08),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: P.amber.withOpacity(.28)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.push_pin_outlined, size: 13, color: P.amber),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      s.notes!,
                                      style: const TextStyle(fontSize: 11.5, height: 1.45, color: P.ink),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
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
          height: 132,
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

/// Satu jenis keadaan darurat beserta divisi yang menanganinya.
class _JenisDarurat {
  final String kode, nama, keterangan;
  final IconData ikon;
  final Color warna;
  const _JenisDarurat(this.kode, this.nama, this.ikon, this.warna, this.keterangan);
}

const _jenisDarurat = <_JenisDarurat>[
  _JenisDarurat('KEBAKARAN', 'Kebakaran', Icons.local_fire_department_outlined, Color(0xFFFF6B35),
      'Diteruskan ke Pemadam Kebakaran, K3, dan Komando Sekuriti.'),
  _JenisDarurat('KECELAKAAN', 'Kecelakaan', Icons.car_crash_outlined, Color(0xFFFB923C),
      'Diteruskan ke K3, Klinik, dan Komando Sekuriti.'),
  _JenisDarurat('MEDIS', 'Gawat Medis', Icons.medical_services_outlined, Color(0xFF34D399),
      'Diteruskan ke Klinik dan K3.'),
  _JenisDarurat('KRIMINAL', 'Kriminal', Icons.gpp_maybe_outlined, Color(0xFFFF5A5A),
      'Diteruskan ke Komando Sekuriti.'),
  _JenisDarurat('BENCANA', 'Bencana', Icons.crisis_alert_outlined, Color(0xFFA78BFA),
      'Diteruskan ke Tim Tanggap Bencana, K3, dan Sekuriti.'),
  _JenisDarurat('UMUM', 'Bantuan Umum', Icons.campaign_outlined, Color(0xFF22D3EE),
      'Diteruskan ke Komando Sekuriti.'),
];

class _PanicCard extends StatefulWidget {
  final DutyState state;
  const _PanicCard({required this.state});

  @override
  State<_PanicCard> createState() => _PanicCardState();
}

class _PanicCardState extends State<_PanicCard> {
  String _dipilih = 'UMUM';

  _JenisDarurat get _terpilih =>
      _jenisDarurat.firstWhere((j) => j.kode == _dipilih, orElse: () => _jenisDarurat.last);

  DutyState get state => widget.state;

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
            'Pilih jenis kejadian, lalu tekan dan tahan. Pusat komando, klien, divisi penanggap, dan sirene di tiang menerima sinyalnya bersamaan.',
            style: TextStyle(color: P.muted, fontSize: 12, height: 1.5),
          ),
          const SizedBox(height: 14),
          const Kicker('Pilih Jenis Kejadian'),
          const SizedBox(height: 8),
          // Tiap jenis diteruskan ke divisi penanggap yang berbeda, sehingga
          // yang datang adalah orang yang memang menangani kejadian itu.
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _jenisDarurat.map((j) {
              final aktif = _dipilih == j.kode;
              return GestureDetector(
                onTap: () => setState(() => _dipilih = j.kode),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: aktif ? j.warna.withOpacity(.18) : P.abyss,
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(color: aktif ? j.warna.withOpacity(.6) : P.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(j.ikon, size: 15, color: aktif ? j.warna : P.muted),
                      const SizedBox(width: 7),
                      Text(
                        j.nama,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          color: aktif ? j.warna : P.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 6),
          Text(
            _terpilih.keterangan,
            style: const TextStyle(color: P.muted, fontSize: 10.5, height: 1.4),
          ),
          const SizedBox(height: 14),
          // FR-PAN-001: sinyal dikirim setelah tombol ditekan dan ditahan,
          // sehingga tidak terpicu oleh sentuhan tak sengaja di dalam saku.
          _TombolTahan(
            aktif: siteId != null,
            warna: _terpilih.warna,
            label: 'TEKAN & TAHAN — ${_terpilih.nama.toUpperCase()}',
            onSelesai: () =>
                context.read<DutyBloc>().add(DutyPanicTriggered(siteId!, type: _dipilih)),
          ),
        ],
      ),
    );
  }
}

/* ── Tombol darurat tekan-tahan (FR-PAN-001) ── */

/// Sinyal darurat baru terkirim setelah tombol ditahan penuh. Cincin kemajuan
/// dan getaran memberi tahu petugas bahwa penekanan benar-benar terbaca,
/// sekaligus mencegah sinyal palsu dari sentuhan tak sengaja.
class _TombolTahan extends StatefulWidget {
  final bool aktif;
  final VoidCallback onSelesai;
  final Color warna;
  final String label;
  const _TombolTahan({
    required this.aktif,
    required this.onSelesai,
    this.warna = P.danger,
    this.label = 'TEKAN & TAHAN 2,5 DETIK',
  });

  @override
  State<_TombolTahan> createState() => _TombolTahanState();
}

class _TombolTahanState extends State<_TombolTahan> with SingleTickerProviderStateMixin {
  static const _durasi = Duration(milliseconds: 2500);
  late final AnimationController _c = AnimationController(vsync: this, duration: _durasi)
    ..addListener(() => setState(() {}))
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) _kirim();
    });

  bool _terkirim = false;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _mulai() {
    if (!widget.aktif || _terkirim) return;
    HapticFeedback.selectionClick();
    _c.forward(from: 0);
  }

  void _batal() {
    if (_c.isAnimating) _c.reverse();
  }

  Future<void> _kirim() async {
    if (_terkirim) return;
    _terkirim = true;
    HapticFeedback.heavyImpact();
    widget.onSelesai();
    await Future.delayed(const Duration(milliseconds: 1200));
    if (mounted) {
      _c.value = 0;
      setState(() => _terkirim = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = _c.value;
    final menahan = _c.isAnimating || v > 0;

    return Column(
      children: [
        // Petunjuk ditaruh di atas tombol: sebagai baris terakhir halaman ia
        // akan tertutup tombol pindai yang mengambang di tengah bilah bawah.
        Align(
          alignment: Alignment.centerLeft,
          child: Text(
            widget.aktif
                ? 'Lepas sebelum penuh untuk membatalkan.'
                : 'Tersedia setelah Anda punya jadwal atau presensi masuk hari ini.',
            style: const TextStyle(color: P.muted, fontSize: 10.5, height: 1.4),
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTapDown: (_) => _mulai(),
          onTapUp: (_) => _batal(),
          onTapCancel: _batal,
          child: SizedBox(
            width: double.infinity,
            height: 54,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Lapis dasar tombol
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: widget.aktif ? widget.warna.withOpacity(.22) : P.panel2,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: widget.aktif ? widget.warna.withOpacity(.55) : P.line,
                    ),
                  ),
                ),
                // Isian yang tumbuh selama tombol ditahan
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: FractionallySizedBox(
                      widthFactor: v.clamp(0.0, 1.0),
                      child: ColoredBox(color: widget.warna),
                    ),
                  ),
                ),
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        menahan ? Icons.campaign : Icons.campaign_outlined,
                        size: 19,
                        color: widget.aktif ? Colors.white : P.muted,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        _terkirim
                            ? 'SINYAL TERKIRIM'
                            : menahan
                                ? 'TAHAN TERUS… ${((1 - v) * 2.5).toStringAsFixed(1)} DETIK'
                                : widget.label,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          letterSpacing: .6,
                          color: widget.aktif ? Colors.white : P.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
