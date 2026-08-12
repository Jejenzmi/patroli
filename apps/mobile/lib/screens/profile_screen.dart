import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../blocs/auth_bloc.dart';
import '../widgets/app_dialog.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _perf;
  List<dynamic> _announcements = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final me = context.read<AuthBloc>().state.user;
    if (me == null) return;
    try {
      final a = await Api.i.get('/frontdesk/announcements');
      if (mounted) setState(() => _announcements = a as List);
    } catch (_) {}
    try {
      final p = await Api.i.get('/users/${me.id}/performance');
      if (mounted) setState(() => _perf = p);
    } catch (_) {
      // Anggota tanpa hak lihat kinerja: bagian ini cukup disembunyikan.
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthBloc>().state.user;

    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: RefreshIndicator(
        color: P.amber,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
          children: [
            GlassCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Container(
                    width: 78,
                    height: 78,
                    decoration: BoxDecoration(
                      color: P.amber.withOpacity(.12),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: P.amber.withOpacity(.35)),
                    ),
                    child: Center(
                      child: Text(
                        _initials(me?.name ?? '?'),
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: P.amber),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(me?.name ?? '-',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 3),
                  Text('${me?.employeeId ?? ''} · ${me?.rank ?? 'Anggota'}',
                      style: const TextStyle(color: P.muted, fontSize: 12.5)),
                  const SizedBox(height: 12),
                  StatusPill(me?.homeSite?.name ?? 'Belum ada penempatan',
                      color: P.cyan, icon: Icons.location_on_outlined),
                ],
              ),
            ),

            if (_perf != null) ...[
              const SizedBox(height: 16),
              const Kicker('Kinerja 30 hari terakhir'),
              const SizedBox(height: 10),
              Row(
                children: [
                  _MiniStat(
                    label: 'Patroli',
                    value: '${_perf!['patrolTotal'] ?? 0}',
                    color: P.cyan,
                    icon: Icons.route_outlined,
                  ),
                  const SizedBox(width: 10),
                  _MiniStat(
                    label: 'Kepatuhan',
                    value: '${_perf!['avgCompliance'] ?? 0}%',
                    color: P.amber,
                    icon: Icons.verified_outlined,
                  ),
                  const SizedBox(width: 10),
                  _MiniStat(
                    label: 'Tepat waktu',
                    value: '${_perf!['punctuality'] ?? 0}%',
                    color: P.emerald,
                    icon: Icons.schedule,
                  ),
                ],
              ),
            ],

            const SizedBox(height: 20),
            const Kicker('Pengumuman satuan'),
            const SizedBox(height: 10),
            if (_announcements.isEmpty)
              const GlassCard(
                child: Text('Belum ada pengumuman', style: TextStyle(color: P.muted, fontSize: 13)),
              )
            else
              ..._announcements.take(5).map((a) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: GlassCard(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(a['title'] ?? '',
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                              ),
                              StatusPill(
                                switch (a['priority']) {
                                  'CRITICAL' => 'Kritis',
                                  'HIGH' => 'Tinggi',
                                  'MEDIUM' => 'Sedang',
                                  _ => 'Info',
                                },
                                color: switch (a['priority']) {
                                  'CRITICAL' => P.danger,
                                  'HIGH' => const Color(0xFFFB923C),
                                  'MEDIUM' => P.amber,
                                  _ => P.cyan,
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(a['body'] ?? '',
                              style: const TextStyle(color: P.muted, fontSize: 12.5, height: 1.5)),
                          const SizedBox(height: 8),
                          Text(
                            DateFormat('d MMM yyyy', 'id_ID')
                                .format(DateTime.parse(a['publishedAt']).toLocal()),
                            style: const TextStyle(color: P.muted, fontSize: 10.5),
                          ),
                        ],
                      ),
                    ),
                  )),

            const SizedBox(height: 20),
            GlassCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: P.cyan.withOpacity(.13),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: P.cyan.withOpacity(.3)),
                    ),
                    child: const Icon(Icons.menu_book_outlined, color: P.cyan, size: 20),
                  ),
                  const SizedBox(width: 13),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Panduan Penggunaan',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                        SizedBox(height: 2),
                        Text('Buka di peramban: patroli.gokar.id',
                            style: TextStyle(color: P.muted, fontSize: 11.5)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: P.danger,
                side: BorderSide(color: P.danger.withOpacity(.4)),
              ),
              onPressed: () async {
                final ok = await askConfirm(
                  context,
                  title: 'Keluar dari aplikasi?',
                  message: 'Sesi Anda diakhiri di perangkat ini. Pastikan tidak ada patroli atau presensi yang belum ditutup.',
                  confirmLabel: 'Ya, keluar',
                  tone: DialogTone.logout,
                );
                if (ok && context.mounted) {
                  context.read<AuthBloc>().add(AuthLoggedOut());
                }
              },
              icon: const Icon(Icons.logout, size: 18),
              label: const Text('KELUAR'),
            ),
            const SizedBox(height: 20),
            const Center(
              child: Text('PATROLI Field App · v1.0.0',
                  style: TextStyle(color: P.muted, fontSize: 11)),
            ),
          ],
        ),
      ),
    );
  }

  String _initials(String n) => n
      .split(' ')
      .where((w) => w.isNotEmpty)
      .take(2)
      .map((w) => w[0])
      .join()
      .toUpperCase();
}

class _MiniStat extends StatelessWidget {
  final String label, value;
  final Color color;
  final IconData icon;
  const _MiniStat({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GlassCard(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        child: Column(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 3),
            Text(label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: P.muted, fontSize: 10.5)),
          ],
        ),
      ),
    );
  }
}
