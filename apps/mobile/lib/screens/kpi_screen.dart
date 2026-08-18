import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../blocs/auth_bloc.dart';
import '../widgets/ui.dart';

/// Nilai kinerja pribadi anggota (FR-KPI-001..004).
class KpiScreen extends StatefulWidget {
  const KpiScreen({super.key});

  @override
  State<KpiScreen> createState() => _KpiScreenState();
}

class _KpiScreenState extends State<KpiScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _galat;

  static const _komponen = [
    ('kehadiran', 'Kehadiran & ketepatan', P.emerald),
    ('patroli', 'Penyelesaian patroli', P.cyan),
    ('ronde', 'Ronde tuntas 100%', P.amber),
    ('pelaporan', 'Aktivitas pelaporan', P.violet),
    ('penilaian', 'Penilaian Danru & Klien', Color(0xFFFB923C)),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final me = context.read<AuthBloc>().state.user;
    if (me == null) {
      return;
    }
    try {
      final r = await Api.i.get('/kpi/${me.id}');
      if (!mounted) return;
      setState(() {
        _data = r as Map<String, dynamic>;
        _loading = false;
        _galat = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _galat = '$e';
      });
    }
  }

  Color _warnaPredikat(String p) => switch (p) {
        'A' => P.emerald,
        'B' => P.cyan,
        'C' => P.amber,
        'D' => const Color(0xFFFB923C),
        _ => P.danger,
      };

  @override
  Widget build(BuildContext context) {
    final kpi = _data?['kpi'] as Map<String, dynamic>?;
    final bobot = (_data?['bobot'] ?? {}) as Map<String, dynamic>;
    final tren = (_data?['tren'] ?? []) as List;

    return Scaffold(
      body: RefreshIndicator(
        color: P.amber,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            GradientHeader(
              title: 'Nilai Kinerja Saya',
              subtitle: _data != null ? 'Periode ${_data!['periode']}' : 'Memuat…',
              accent: P.amber,
              showBack: true,
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Column(children: [Shimmer(height: 160), SizedBox(height: 12), Shimmer(height: 200)]),
              )
            else if (_galat != null || kpi == null)
              EmptyState(
                icon: Icons.insights_outlined,
                title: 'Nilai belum tersedia',
                hint: _galat ?? 'Nilai muncul setelah ada aktivitas presensi dan patroli pada periode ini.',
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
                child: IsiTerpusat(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Nilai utama
                      FadeInUp(
                        index: 0,
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(22),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                _warnaPredikat(kpi['predikat']).withOpacity(.16),
                                P.panel.withOpacity(.9),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: _warnaPredikat(kpi['predikat']).withOpacity(.4)),
                          ),
                          child: Column(
                            children: [
                              const Kicker('Nilai KPI Periode Ini'),
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '${kpi['nilai']}',
                                    style: TextStyle(
                                      fontSize: 52,
                                      height: 1,
                                      fontWeight: FontWeight.w900,
                                      color: _warnaPredikat(kpi['predikat']),
                                    ),
                                  ),
                                  const Padding(
                                    padding: EdgeInsets.only(bottom: 8, left: 4),
                                    child: Text('/100', style: TextStyle(color: P.muted, fontSize: 14)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                                decoration: BoxDecoration(
                                  color: _warnaPredikat(kpi['predikat']).withOpacity(.14),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: _warnaPredikat(kpi['predikat']).withOpacity(.5)),
                                ),
                                child: Text(
                                  'PREDIKAT ${kpi['predikat']}',
                                  style: TextStyle(
                                    color: _warnaPredikat(kpi['predikat']),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.4,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                'Peringkat ${_data!['peringkat']} dari ${_data!['dari']} personel',
                                style: const TextStyle(color: P.muted, fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),
                      const SectionTitle('Rincian Komponen', icon: Icons.donut_small_outlined),
                      FadeInUp(
                        index: 1,
                        child: Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: P.panel.withOpacity(.7),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: P.line),
                          ),
                          child: Column(
                            children: _komponen.map((k) {
                              final nilai = (kpi['komponen'][k.$1] as num).toDouble();
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(k.$2,
                                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                                        ),
                                        Text('bobot ${bobot[k.$1] ?? 0}%',
                                            style: const TextStyle(color: P.muted, fontSize: 10.5)),
                                        const SizedBox(width: 10),
                                        Text(nilai.toStringAsFixed(1),
                                            style: TextStyle(
                                                color: k.$3, fontSize: 13, fontWeight: FontWeight.w900)),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(999),
                                      child: LinearProgressIndicator(
                                        value: nilai / 100,
                                        minHeight: 6,
                                        backgroundColor: Colors.white10,
                                        valueColor: AlwaysStoppedAnimation(k.$3),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),
                      const SectionTitle('Tren Enam Bulan', icon: Icons.show_chart),
                      FadeInUp(
                        index: 2,
                        child: Container(
                          height: 190,
                          padding: const EdgeInsets.fromLTRB(14, 18, 14, 10),
                          decoration: BoxDecoration(
                            color: P.panel.withOpacity(.7),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: P.line),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: tren.map<Widget>((t) {
                              final nilai = (t['nilai'] as num).toDouble();
                              return Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 5),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      Text(nilai.toStringAsFixed(0),
                                          style: const TextStyle(fontSize: 10.5, color: P.ink)),
                                      const SizedBox(height: 4),
                                      Container(
                                        height: max(4, nilai * 1.05),
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              _warnaPredikat(t['predikat']).withOpacity(.9),
                                              _warnaPredikat(t['predikat']).withOpacity(.35),
                                            ],
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                          ),
                                          borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        DateFormat('MMM', 'id_ID')
                                            .format(DateTime.parse('${t['periode']}-01')),
                                        style: const TextStyle(color: P.muted, fontSize: 9.5),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),

                      const SizedBox(height: 20),
                      const SectionTitle('Dasar Perhitungan', icon: Icons.fact_check_outlined),
                      FadeInUp(
                        index: 3,
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: P.panel.withOpacity(.7),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: P.line),
                          ),
                          child: Column(
                            children: [
                              _baris('Presensi tepat waktu',
                                  '${kpi['rincian']['presensiTepat']} dari ${kpi['rincian']['presensiTotal']}'),
                              _baris('Presensi ditolak', '${kpi['rincian']['presensiGagal']}'),
                              _baris('Sesi patroli', '${kpi['rincian']['sesiPatroli']}'),
                              _baris('Ronde tuntas 100%', '${kpi['rincian']['rondeTuntas']}'),
                              _baris('Laporan insiden', '${kpi['rincian']['laporanInsiden']}'),
                              _baris('Jumlah penilai', '${kpi['rincian']['jumlahPenilai']}', akhir: true),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _baris(String label, String nilai, {bool akhir = false}) => Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: akhir ? null : const Border(bottom: BorderSide(color: P.line)),
        ),
        child: Row(
          children: [
            Expanded(child: Text(label, style: const TextStyle(color: P.muted, fontSize: 12.5))),
            Text(nilai, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800)),
          ],
        ),
      );
}
