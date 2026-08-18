import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/ui.dart';

/// Jadwal jaga, riwayat patroli, dan riwayat presensi milik anggota.
class ScheduleScreen extends StatefulWidget {
  final int tabAwal;
  const ScheduleScreen({super.key, this.tabAwal = 0});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> with SingleTickerProviderStateMixin {
  late final TabController _tab =
      TabController(length: 3, vsync: this, initialIndex: widget.tabAwal);

  List<dynamic> _jadwal = [];
  List<dynamic> _patroli = [];
  List<dynamic> _presensi = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final now = DateTime.now();
    final dari = DateFormat('yyyy-MM-dd').format(now.subtract(const Duration(days: 7)));
    final sampai = DateFormat('yyyy-MM-dd').format(now.add(const Duration(days: 14)));
    try {
      final hasil = await Future.wait([
        Api.i.get('/schedules', query: {'from': dari, 'to': sampai}),
        Api.i.get('/patrols', query: {'limit': 30}),
        Api.i.get('/schedules/attendance', query: {'limit': 30}),
      ]);
      if (!mounted) return;
      setState(() {
        _jadwal = hasil[0] as List;
        _patroli = hasil[1] as List;
        _presensi = hasil[2] as List;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          GradientHeader(
            title: 'Jadwal & Riwayat',
            subtitle: 'Roster jaga, patroli, dan kehadiran Anda',
            accent: P.amber,
            showBack: true,
            bottom: Container(
              decoration: BoxDecoration(
                color: P.abyss.withOpacity(.7),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: P.line),
              ),
              padding: const EdgeInsets.all(4),
              child: TabBar(
                controller: _tab,
                dividerColor: Colors.transparent,
                indicatorSize: TabBarIndicatorSize.tab,
                indicator: BoxDecoration(
                  color: P.amber.withOpacity(.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: P.amber.withOpacity(.4)),
                ),
                labelColor: P.amber,
                unselectedLabelColor: P.muted,
                labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                tabs: const [
                  Tab(text: 'Jadwal'),
                  Tab(text: 'Patroli'),
                  Tab(text: 'Presensi'),
                ],
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: Column(children: [Shimmer(height: 80), SizedBox(height: 10), Shimmer(height: 80)]),
                  )
                : TabBarView(
                    controller: _tab,
                    children: [_tabJadwal(), _tabPatroli(), _tabPresensi()],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _bungkus(List<Widget> anak, {required String kosong, required IconData ikon}) {
    if (anak.isEmpty) return EmptyState(icon: ikon, title: kosong);
    return RefreshIndicator(
      color: P.amber,
      backgroundColor: P.panel,
      onRefresh: _load,
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 18, 16, 40), children: anak),
    );
  }

  Widget _tabJadwal() => _bungkus(
        _jadwal.asMap().entries.map((e) {
          final s = e.value;
          final tgl = DateTime.parse(s['date']).toLocal();
          final hariIni = DateUtils.isSameDay(tgl, DateTime.now());
          return FadeInUp(
            index: e.key,
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: P.panel.withOpacity(.7),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: hariIni ? P.amber.withOpacity(.45) : P.line),
              ),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: (hariIni ? P.amber : P.muted).withOpacity(.12),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: Column(
                      children: [
                        Text(DateFormat('EEE', 'id_ID').format(tgl),
                            style: TextStyle(
                                fontSize: 10, color: hariIni ? P.amber : P.muted, fontWeight: FontWeight.w700)),
                        Text(DateFormat('dd').format(tgl),
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w900,
                                color: hariIni ? P.amber : P.ink)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${s['shift']?['name']} · ${s['shift']?['startTime']}–${s['shift']?['endTime']}',
                            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(s['site']?['name'] ?? '-',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: P.muted, fontSize: 11.5)),
                        if (s['route'] != null)
                          Text('Rute: ${s['route']['name']}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: P.cyan, fontSize: 11)),
                        // FR-PAT-002: instruksi khusus dari Danru untuk penugasan ini.
                        if ((s['notes'] as String?)?.trim().isNotEmpty ?? false) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(9),
                            decoration: BoxDecoration(
                              color: P.amber.withOpacity(.08),
                              borderRadius: BorderRadius.circular(11),
                              border: Border.all(color: P.amber.withOpacity(.28)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.push_pin_outlined, size: 12, color: P.amber),
                                const SizedBox(width: 7),
                                Expanded(
                                  child: Text(s['notes'],
                                      style: const TextStyle(fontSize: 11, height: 1.45)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  StatusPill(
                    switch (s['status']) {
                      'PLANNED' => 'Rencana',
                      'CONFIRMED' => 'Aktif',
                      'DONE' => 'Selesai',
                      'ABSENT' => 'Absen',
                      _ => '${s['status']}',
                    },
                    color: switch (s['status']) {
                      'DONE' => P.emerald,
                      'CONFIRMED' => P.cyan,
                      'ABSENT' => P.danger,
                      _ => P.muted,
                    },
                  ),
                ],
              ),
            ),
          );
        }).toList(),
        kosong: 'Belum ada jadwal jaga',
        ikon: Icons.event_busy_outlined,
      );

  Widget _tabPatroli() => _bungkus(
        _patroli.asMap().entries.map((e) {
          final p = e.value;
          final rate = (p['complianceRate'] as num?)?.toDouble() ?? 0;
          final warna = rate >= 90 ? P.emerald : (rate >= 70 ? P.amber : P.danger);
          return FadeInUp(
            index: e.key,
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: P.panel.withOpacity(.7),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: P.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(p['route']?['name'] ?? '-',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                      ),
                      StatusPill('${rate.toStringAsFixed(0)}%', color: warna),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${p['site']?['name'] ?? '-'} · ${DateFormat('d MMM · HH:mm', 'id_ID').format(DateTime.parse(p['startedAt']).toLocal())}',
                    style: const TextStyle(color: P.muted, fontSize: 11.5),
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: rate / 100,
                      minHeight: 5,
                      backgroundColor: Colors.white10,
                      valueColor: AlwaysStoppedAnimation(warna),
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    '${p['scannedCount']}/${p['totalCheckpoints']} titik dipindai'
                    '${(p['missedCount'] ?? 0) > 0 ? ' · ${p['missedCount']} terlewat' : ''}',
                    style: const TextStyle(color: P.muted, fontSize: 11),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
        kosong: 'Belum ada riwayat patroli',
        ikon: Icons.route_outlined,
      );

  Widget _tabPresensi() => _bungkus(
        _presensi.asMap().entries.map((e) {
          final a = e.value;
          final telat = a['status'] == 'LATE';
          return FadeInUp(
            index: e.key,
            child: Container(
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
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: (telat ? P.amber : P.emerald).withOpacity(.13),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(telat ? Icons.schedule : Icons.check_circle_outline,
                        color: telat ? P.amber : P.emerald, size: 19),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DateFormat('EEEE, d MMM yyyy', 'id_ID')
                              .format(DateTime.parse(a['checkInAt']).toLocal()),
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Masuk ${DateFormat('HH:mm').format(DateTime.parse(a['checkInAt']).toLocal())}'
                          '${a['checkOutAt'] != null ? ' · Pulang ${DateFormat('HH:mm').format(DateTime.parse(a['checkOutAt']).toLocal())}' : ' · masih bertugas'}',
                          style: const TextStyle(color: P.muted, fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),
                  StatusPill(
                    switch (a['status']) {
                      'ON_TIME' => 'Tepat waktu',
                      'LATE' => 'Telat ${a['lateMinutes']}m',
                      'EARLY_LEAVE' => 'Pulang awal',
                      _ => '${a['status']}',
                    },
                    color: telat ? P.amber : P.emerald,
                  ),
                ],
              ),
            ),
          );
        }).toList(),
        kosong: 'Belum ada riwayat presensi',
        ikon: Icons.fingerprint,
      );
}
