import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

/// Pengajuan cuti, izin, dan lembur (FR-ADM-002).
class LeavesScreen extends StatefulWidget {
  const LeavesScreen({super.key});

  @override
  State<LeavesScreen> createState() => _LeavesScreenState();
}

class _LeavesScreenState extends State<LeavesScreen> {
  List<dynamic> _rows = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await Api.i.get('/tasks/leaves/list');
      if (!mounted) return;
      setState(() {
        _rows = r as List;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Color _warnaStatus(String s) => switch (s) {
        'DISETUJUI' => P.emerald,
        'DITOLAK' => P.danger,
        _ => P.amber,
      };

  /// Server memakai DIAJUKAN; di layar ditampilkan sebagai "Menunggu".
  String _labelStatus(String s) => switch (s) {
        'DISETUJUI' => 'Disetujui',
        'DITOLAK' => 'Ditolak',
        _ => 'Menunggu',
      };

  String _labelJenis(String t) => switch (t) {
        'CUTI' => 'Cuti',
        'IZIN' => 'Izin',
        _ => 'Lembur',
      };

  IconData _ikonJenis(String t) => switch (t) {
        'CUTI' => Icons.beach_access_outlined,
        'IZIN' => Icons.event_busy_outlined,
        _ => Icons.more_time,
      };

  @override
  Widget build(BuildContext context) {
    final menunggu = _rows.where((r) => r['status'] == 'DIAJUKAN').length;

    return Scaffold(
      body: Column(
        children: [
          GradientHeader(
            title: 'Cuti, Izin & Lembur',
            subtitle: menunggu > 0
                ? '$menunggu pengajuan menunggu keputusan'
                : 'Ajukan dan pantau status pengajuan Anda',
            accent: P.violet,
            showBack: true,
          ),
          Expanded(
            child: _loading
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: Column(children: [Shimmer(height: 110), SizedBox(height: 10), Shimmer(height: 110)]),
                  )
                : _rows.isEmpty
                    ? EmptyState(
                        icon: Icons.event_available_outlined,
                        title: 'Belum ada pengajuan',
                        hint: 'Ajukan cuti, izin, atau lembur agar tercatat resmi dan disetujui pengawas.',
                        action: FilledButton.icon(
                          onPressed: _ajukan,
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('AJUKAN SEKARANG'),
                        ),
                      )
                    : RefreshIndicator(
                        color: P.violet,
                        backgroundColor: P.panel,
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(16, 18, 16, 100),
                          children: _rows.asMap().entries.map((e) {
                            final r = e.value;
                            final warna = _warnaStatus(r['status']);
                            return FadeInUp(
                              index: e.key,
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: P.panel.withOpacity(.72),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: warna.withOpacity(.28)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 38,
                                          height: 38,
                                          decoration: BoxDecoration(
                                            color: P.violet.withOpacity(.13),
                                            borderRadius: BorderRadius.circular(13),
                                            border: Border.all(color: P.violet.withOpacity(.3)),
                                          ),
                                          child: Icon(_ikonJenis(r['type']), color: P.violet, size: 18),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(_labelJenis(r['type']),
                                                  style: const TextStyle(
                                                      fontSize: 14.5, fontWeight: FontWeight.w800)),
                                              const SizedBox(height: 2),
                                              Text(
                                                r['type'] == 'LEMBUR' && r['hours'] != null
                                                    ? '${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(r['startDate']).toLocal())} · ${r['hours']} jam'
                                                    : '${DateFormat('d MMM', 'id_ID').format(DateTime.parse(r['startDate']).toLocal())} – ${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(r['endDate']).toLocal())}',
                                                style: const TextStyle(color: P.muted, fontSize: 11.5),
                                              ),
                                            ],
                                          ),
                                        ),
                                        StatusPill(_labelStatus(r['status']), color: warna),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Text(r['reason'] ?? '',
                                        style: const TextStyle(fontSize: 12.5, height: 1.5)),
                                    if (r['decisionNote'] != null) ...[
                                      const SizedBox(height: 10),
                                      Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.all(11),
                                        decoration: BoxDecoration(
                                          color: P.abyss.withOpacity(.6),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(color: P.line),
                                        ),
                                        child: Text(
                                          'Catatan ${r['approver']?['name'] ?? 'pengawas'}: ${r['decisionNote']}',
                                          style: const TextStyle(fontSize: 11.5, height: 1.45, color: P.muted),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: _rows.isEmpty
          ? null
          : FloatingActionButton.extended(
              backgroundColor: P.violet,
              foregroundColor: Colors.white,
              onPressed: _ajukan,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('AJUKAN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12.5)),
            ),
    );
  }

  Future<void> _ajukan() async {
    var jenis = 'IZIN';
    var mulai = DateTime.now();
    var selesai = DateTime.now();
    final jam = TextEditingController(text: '2');
    final alasan = TextEditingController();

    await showAppSheet(
      context,
      title: 'Pengajuan Baru',
      subtitle: 'Pengawas akan menerima pemberitahuan begitu pengajuan terkirim.',
      builder: (ctx, setSheet) {
        Future<void> pilihTanggal(bool awal) async {
          final hasil = await showDatePicker(
            context: ctx,
            initialDate: awal ? mulai : selesai,
            firstDate: DateTime.now().subtract(const Duration(days: 30)),
            lastDate: DateTime.now().add(const Duration(days: 365)),
          );
          if (hasil == null) return;
          setSheet(() {
            if (awal) {
              mulai = hasil;
              if (selesai.isBefore(mulai)) selesai = mulai;
            } else {
              selesai = hasil;
            }
          });
        }

        Widget kotakTanggal(String label, DateTime nilai, VoidCallback onTap) => Expanded(
              child: GestureDetector(
                onTap: onTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  decoration: BoxDecoration(
                    color: P.abyss,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: P.line),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today_outlined, size: 14, color: P.muted),
                      const SizedBox(width: 9),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(label, style: const TextStyle(color: P.muted, fontSize: 10)),
                            const SizedBox(height: 2),
                            Text(DateFormat('d MMM yyyy', 'id_ID').format(nilai),
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );

        return Column(
          children: [
            LabeledField(
              label: 'Jenis pengajuan',
              child: Row(
                children: ['CUTI', 'IZIN', 'LEMBUR'].map((t) {
                  final aktif = jenis == t;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setSheet(() => jenis = t),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: aktif ? P.violet.withOpacity(.15) : P.abyss,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: aktif ? P.violet.withOpacity(.5) : P.line),
                          ),
                          child: Column(
                            children: [
                              Icon(_ikonJenis(t), size: 17, color: aktif ? P.violet : P.muted),
                              const SizedBox(height: 6),
                              Text(_labelJenis(t),
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w800,
                                    color: aktif ? P.violet : P.muted,
                                  )),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
            LabeledField(
              label: jenis == 'LEMBUR' ? 'Tanggal lembur' : 'Rentang tanggal',
              child: Row(
                children: [
                  kotakTanggal(jenis == 'LEMBUR' ? 'Tanggal' : 'Mulai', mulai, () => pilihTanggal(true)),
                  if (jenis != 'LEMBUR') ...[
                    const SizedBox(width: 10),
                    kotakTanggal('Selesai', selesai, () => pilihTanggal(false)),
                  ],
                ],
              ),
            ),
            if (jenis == 'LEMBUR')
              LabeledField(
                label: 'Jumlah jam',
                child: TextField(
                  controller: jam,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(hintText: 'Contoh: 3'),
                ),
              ),
            LabeledField(
              label: 'Alasan',
              child: TextField(
                controller: alasan,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Jelaskan keperluan secara ringkas…'),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(backgroundColor: P.violet, foregroundColor: Colors.white),
                onPressed: () async {
                  if (alasan.text.trim().length < 3) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      const SnackBar(content: Text('Alasan wajib diisi minimal 3 huruf')),
                    );
                    return;
                  }
                  final ok = await askConfirm(
                    ctx,
                    title: 'Kirim pengajuan?',
                    message: 'Pengajuan tidak dapat diubah setelah terkirim. Pastikan tanggal dan alasan sudah benar.',
                    detail: '${_labelJenis(jenis)} · ${DateFormat('d MMM yyyy', 'id_ID').format(mulai)}',
                    confirmLabel: 'Ya, kirim',
                    tone: DialogTone.info,
                  );
                  if (!ok) return;
                  try {
                    await Api.i.post('/tasks/leaves', {
                      'type': jenis,
                      'startDate': mulai.toIso8601String(),
                      'endDate': (jenis == 'LEMBUR' ? mulai : selesai).toIso8601String(),
                      if (jenis == 'LEMBUR') 'hours': double.tryParse(jam.text.trim()) ?? 0,
                      'reason': alasan.text.trim(),
                    });
                    if (ctx.mounted) Navigator.pop(ctx);
                    if (mounted) {
                      await showSuccess(context,
                          title: 'Pengajuan terkirim',
                          message: 'Pengawas akan meninjau dan memberi keputusan.');
                    }
                    _load();
                  } catch (e) {
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Gagal: $e')));
                    }
                  }
                },
                icon: const Icon(Icons.send_rounded, size: 17),
                label: const Text('KIRIM PENGAJUAN'),
              ),
            ),
          ],
        );
      },
    );
  }
}
