import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../core/theme.dart';
import '../blocs/auth_bloc.dart';
import '../widgets/ui.dart';
import 'announcements_screen.dart';
import 'handover_screen.dart';
import 'incidents_screen.dart';
import 'schedule_screen.dart';
import 'vehicles_screen.dart';
import 'visitors_screen.dart';

class _Layanan {
  final IconData icon;
  final String nama;
  final String ket;
  final Color warna;
  final Widget Function() buka;
  const _Layanan(this.icon, this.nama, this.ket, this.warna, this.buka);
}

class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthBloc>().state.user;

    final kelompok = <String, List<_Layanan>>{
      'Pos Jaga': [
        _Layanan(Icons.person_add_alt_1_outlined, 'Buku Tamu', 'Catat tamu masuk & keluar area',
            P.cyan, () => const VisitorsScreen()),
        _Layanan(Icons.local_shipping_outlined, 'Lalu Lintas Kendaraan', 'Kendaraan masuk, muatan, dan jam keluar',
            P.violet, () => const VehiclesScreen()),
        _Layanan(Icons.assignment_turned_in_outlined, 'Serah Terima Shift', 'Berita acara pergantian jaga',
            P.emerald, () => const HandoverScreen()),
      ],
      'Tugas Saya': [
        _Layanan(Icons.calendar_month_outlined, 'Jadwal & Presensi', 'Roster mingguan dan riwayat kehadiran',
            P.amber, () => const ScheduleScreen()),
        _Layanan(Icons.history, 'Riwayat Patroli', 'Putaran patroli yang sudah Anda jalani',
            P.cyan, () => const ScheduleScreen(tabAwal: 1)),
      ],
      'Pelaporan': [
        _Layanan(Icons.report_gmailerrorred_outlined, 'Lapor Insiden', 'Kirim laporan kejadian berfoto',
            P.danger, () => const IncidentFormScreen()),
        _Layanan(Icons.campaign_outlined, 'Pengumuman Satuan', 'Instruksi dan informasi resmi',
            P.emerald, () => const AnnouncementsScreen()),
      ],
    };

    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          GradientHeader(
            title: 'Semua Layanan',
            subtitle: 'Perangkat tugas ${me?.rank ?? 'anggota'} dalam satu tempat',
            accent: P.cyan,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 120),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final entry in kelompok.entries) ...[
                  SectionTitle(entry.key),
                  ...entry.value.asMap().entries.map(
                        (e) => FadeInUp(
                          index: e.key,
                          child: _KartuLayanan(layanan: e.value),
                        ),
                      ),
                  const SizedBox(height: 22),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KartuLayanan extends StatelessWidget {
  final _Layanan layanan;
  const _KartuLayanan({required this.layanan});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: P.panel.withOpacity(.7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: P.line),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => layanan.buka())),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: layanan.warna.withOpacity(.13),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(color: layanan.warna.withOpacity(.3)),
                  ),
                  child: Icon(layanan.icon, color: layanan.warna, size: 21),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(layanan.nama,
                          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 3),
                      Text(layanan.ket,
                          style: const TextStyle(color: P.muted, fontSize: 11.5, height: 1.35)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: P.muted, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
