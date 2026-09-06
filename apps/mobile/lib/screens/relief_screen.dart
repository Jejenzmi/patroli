import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

/// Tawaran shift pengganti yang ditujukan kepada anggota ini.
///
/// Pos kosong merugikan dua kali — dipotong klien dan kena denda SLA — maka
/// tawaran dibuat sesingkat mungkin: satu layar, satu tombol.
class ReliefScreen extends StatefulWidget {
  const ReliefScreen({super.key});

  @override
  State<ReliefScreen> createState() => _ReliefScreenState();
}

class _ReliefScreenState extends State<ReliefScreen> {
  List _tawaran = [];
  bool _loading = true;
  String? _galat;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await Api.i.get('/relief/saya');
      if (!mounted) return;
      setState(() {
        _tawaran = r as List;
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

  Future<void> _ambil(Map t) async {
    final tanggal = DateFormat('d MMMM yyyy', 'id').format(DateTime.parse(t['date']).toLocal());
    final ok = await askConfirm(
      context,
      title: 'Sanggupi shift ini?',
      message:
          'Anda akan langsung masuk roster ${t['site']['name']} — ${t['shift']['name']} pada $tanggal. '
          'Pastikan Anda benar-benar bisa hadir; pos yang batal diisi merugikan perusahaan dan klien.',
      confirmLabel: 'Ya, saya sanggup',
      tone: DialogTone.save,
    );
    if (!ok) return;

    try {
      await Api.i.post('/relief/${t['offerId']}/ambil', {});
      if (!mounted) return;
      await showSuccess(context, title: 'Pos terisi', message: 'Jadwal jaga Anda sudah diperbarui.');
      _load();
    } catch (e) {
      if (!mounted) return;
      // Tawaran bisa saja baru diambil orang lain atau tertahan batas jam kerja.
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      _load();
    }
  }

  Future<void> _tolak(Map t) async {
    final ok = await askConfirm(
      context,
      title: 'Tidak bisa mengambil shift ini?',
      message: 'Komandan akan tahu bahwa Anda berhalangan, sehingga dapat mencari orang lain lebih cepat.',
      confirmLabel: 'Ya, saya tidak bisa',
    );
    if (!ok) return;
    try {
      await Api.i.post('/relief/${t['offerId']}/tolak', {});
      _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        color: P.amber,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const GradientHeader(
              title: 'Tawaran Shift',
              subtitle: 'Pos kosong yang ditawarkan kepada Anda',
              accent: P.cyan,
              showBack: true,
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(16, 18, 16, bottomInset(context)),
              child: IsiTerpusat(
                child: _loading
                    ? const Column(children: [Shimmer(height: 150), SizedBox(height: 12), Shimmer(height: 150)])
                    : _galat != null
                        ? EmptyState(icon: Icons.wifi_off_rounded, title: 'Gagal memuat', hint: _galat)
                        : _tawaran.isEmpty
                            ? const EmptyState(
                                icon: Icons.event_available_outlined,
                                title: 'Tidak ada tawaran',
                                hint: 'Bila ada pos kosong yang cocok dengan Anda, tawarannya muncul di sini '
                                    'dan Anda menerima notifikasi.',
                              )
                            : Column(
                                children: _tawaran
                                    .asMap()
                                    .entries
                                    .map((e) => FadeInUp(
                                          index: e.key,
                                          child: _KartuTawaran(
                                            tawaran: e.value,
                                            onAmbil: () => _ambil(e.value),
                                            onTolak: () => _tolak(e.value),
                                          ),
                                        ))
                                    .toList(),
                              ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KartuTawaran extends StatelessWidget {
  final Map tawaran;
  final VoidCallback onAmbil;
  final VoidCallback onTolak;
  const _KartuTawaran({required this.tawaran, required this.onAmbil, required this.onTolak});

  @override
  Widget build(BuildContext context) {
    final tanggal = DateTime.parse(tawaran['date']).toLocal();
    final site = tawaran['site'] as Map;
    final shift = tawaran['shift'] as Map;
    final ditolak = tawaran['response'] == 'TIDAK_BISA';
    final jarak = tawaran['distanceM'];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [P.cyan.withOpacity(ditolak ? .04 : .12), P.panel.withOpacity(.9)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: P.cyan.withOpacity(ditolak ? .15 : .4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: P.cyan.withOpacity(.14),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: P.cyan.withOpacity(.4)),
                ),
                child: Text(
                  DateFormat('EEE, d MMM', 'id').format(tanggal).toUpperCase(),
                  style: const TextStyle(color: P.cyan, fontSize: 10.5, fontWeight: FontWeight.w900, letterSpacing: .8),
                ),
              ),
              const Spacer(),
              Text(
                '${shift['startTime']}–${shift['endTime']}',
                style: const TextStyle(color: P.ink, fontSize: 12.5, fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            site['name'] as String,
            style: const TextStyle(color: P.ink, fontSize: 16, fontWeight: FontWeight.w900, height: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            '${shift['name']}'
            '${jarak != null ? ' · ${(jarak / 1000).toStringAsFixed(1)} km dari penempatan Anda' : ''}',
            style: const TextStyle(color: P.muted, fontSize: 12),
          ),
          if (site['address'] != null) ...[
            const SizedBox(height: 6),
            Text(site['address'] as String, style: const TextStyle(color: P.muted, fontSize: 11.5, height: 1.4)),
          ],
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: P.panel2.withOpacity(.6),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline, size: 14, color: P.muted),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${tawaran['reason']}${tawaran['note'] != null ? '\n${tawaran['note']}' : ''}',
                    style: const TextStyle(color: P.muted, fontSize: 11.5, height: 1.45),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (ditolak)
            const Text(
              'Anda sudah menyatakan tidak bisa mengambil shift ini.',
              style: TextStyle(color: P.danger, fontSize: 11.5, fontWeight: FontWeight.w700),
            )
          else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onTolak,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: P.muted,
                      side: const BorderSide(color: P.line),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Tidak bisa', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: onAmbil,
                    style: FilledButton.styleFrom(
                      backgroundColor: P.cyan,
                      foregroundColor: P.voidBg,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text('Saya sanggup', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900)),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
