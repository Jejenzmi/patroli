import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/ui.dart';

/// Slip gaji digital milik anggota sendiri.
///
/// Server hanya mengirim slip pada periode yang sudah dikunci; selama masih
/// draf, angkanya belum mengikat dan tidak boleh terlihat.
class PayslipScreen extends StatefulWidget {
  const PayslipScreen({super.key});

  @override
  State<PayslipScreen> createState() => _PayslipScreenState();
}

final _rp = NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0);

String _namaBulan(String periode) {
  final p = periode.split('-');
  if (p.length != 2) return periode;
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  final i = int.tryParse(p[1]) ?? 0;
  return i >= 1 && i <= 12 ? '${bulan[i - 1]} ${p[0]}' : periode;
}

class _PayslipScreenState extends State<PayslipScreen> {
  List _slip = [];
  List _kasbon = [];
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
      final slip = await Api.i.get('/payroll/saya');
      final kasbon = await Api.i.get('/payroll/loans/saya');
      if (!mounted) return;
      setState(() {
        _slip = slip as List;
        _kasbon = kasbon as List;
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

  @override
  Widget build(BuildContext context) {
    final aktif = _kasbon.where((k) => k['status'] == 'AKTIF').toList();

    return Scaffold(
      body: RefreshIndicator(
        color: P.amber,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const GradientHeader(
              title: 'Slip Gaji Saya',
              subtitle: 'Rincian penghasilan dan potongan tiap bulan',
              accent: P.emerald,
              showBack: true,
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(16, 18, 16, bottomInset(context)),
              child: IsiTerpusat(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_loading)
                      const Column(children: [Shimmer(height: 110), SizedBox(height: 12), Shimmer(height: 110)])
                    else if (_galat != null)
                      EmptyState(
                        icon: Icons.wifi_off_rounded,
                        title: 'Gagal memuat slip',
                        hint: _galat,
                      )
                    else ...[
                      if (aktif.isNotEmpty) ...[
                        const SectionTitle('Kasbon Berjalan', icon: Icons.account_balance_wallet_outlined),
                        ...aktif.map((k) => _KartuKasbon(kasbon: k)),
                        const SizedBox(height: 18),
                      ],
                      const SectionTitle('Riwayat Slip', icon: Icons.receipt_long_outlined),
                      if (_slip.isEmpty)
                        const EmptyState(
                          icon: Icons.receipt_long_outlined,
                          title: 'Belum ada slip terbit',
                          hint: 'Slip muncul di sini setelah bagian keuangan mengunci periode penggajian.',
                        )
                      else
                        ..._slip.asMap().entries.map(
                              (e) => FadeInUp(
                                index: e.key,
                                child: _KartuSlip(slip: e.value),
                              ),
                            ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KartuKasbon extends StatelessWidget {
  final Map kasbon;
  const _KartuKasbon({required this.kasbon});

  @override
  Widget build(BuildContext context) {
    final jumlah = (kasbon['amount'] as num).toDouble();
    final dibayar = (kasbon['paidAmount'] as num).toDouble();
    final sisa = jumlah - dibayar;
    final progres = jumlah > 0 ? (dibayar / jumlah).clamp(0.0, 1.0) : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: P.panel.withOpacity(.7),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: P.violet.withOpacity(.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Kasbon ${_rp.format(jumlah)}',
                style: const TextStyle(color: P.ink, fontWeight: FontWeight.w800, fontSize: 14),
              ),
              Text(
                'sisa ${_rp.format(sisa)}',
                style: const TextStyle(color: P.violet, fontWeight: FontWeight.w800, fontSize: 12.5),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: progres,
              minHeight: 6,
              backgroundColor: P.line,
              valueColor: const AlwaysStoppedAnimation(P.violet),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Dipotong ${kasbon['installmentCount']}× ${_rp.format((kasbon['installmentAmount'] as num).toDouble())} mulai ${kasbon['startPeriod']}',
            style: const TextStyle(color: P.muted, fontSize: 11.5),
          ),
        ],
      ),
    );
  }
}

class _KartuSlip extends StatelessWidget {
  final Map slip;
  const _KartuSlip({required this.slip});

  @override
  Widget build(BuildContext context) {
    final run = slip['run'] as Map;
    final thr = run['type'] == 'THR';

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => PayslipDetailScreen(slipId: slip['id'] as String)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: P.panel.withOpacity(.7),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: P.line),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: (thr ? P.violet : P.emerald).withOpacity(.14),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: (thr ? P.violet : P.emerald).withOpacity(.4)),
              ),
              child: Icon(thr ? Icons.card_giftcard_outlined : Icons.payments_outlined,
                  color: thr ? P.violet : P.emerald, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _namaBulan(run['period'] as String),
                    style: const TextStyle(color: P.ink, fontWeight: FontWeight.w800, fontSize: 14.5),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    thr ? 'Tunjangan Hari Raya' : '${slip['hariHadir']} hari hadir · ${slip['jamLembur']} jam lembur',
                    style: const TextStyle(color: P.muted, fontSize: 11.5),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _rp.format((slip['netto'] as num).toDouble()),
                  style: const TextStyle(color: P.emerald, fontWeight: FontWeight.w900, fontSize: 14.5),
                ),
                const SizedBox(height: 3),
                Text(
                  run['status'] == 'DIBAYAR' ? 'Dibayarkan' : 'Menunggu transfer',
                  style: TextStyle(
                    color: run['status'] == 'DIBAYAR' ? P.emerald : P.amber,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Rincian satu slip: pendapatan, potongan, dan iuran.
class PayslipDetailScreen extends StatefulWidget {
  final String slipId;
  const PayslipDetailScreen({super.key, required this.slipId});

  @override
  State<PayslipDetailScreen> createState() => _PayslipDetailScreenState();
}

class _PayslipDetailScreenState extends State<PayslipDetailScreen> {
  Map<String, dynamic>? _slip;
  bool _loading = true;
  String? _galat;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Api.i.get('/payroll/slips/${widget.slipId}');
      if (!mounted) return;
      setState(() {
        _slip = r as Map<String, dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _galat = '$e';
      });
    }
  }

  Widget _baris(String label, num nilai, {Color? warna, String? catatan}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(label, style: const TextStyle(color: P.ink, fontSize: 13)),
                ),
                Text(
                  _rp.format(nilai.toDouble()),
                  style: TextStyle(color: warna ?? P.ink, fontSize: 13, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            if (catatan != null && catatan.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(catatan, style: const TextStyle(color: P.muted, fontSize: 10.5)),
              ),
          ],
        ),
      );

  Widget _panel({required String judul, required List<Widget> anak, Color? aksen}) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
        decoration: BoxDecoration(
          color: P.panel.withOpacity(.7),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: (aksen ?? P.line).withOpacity(aksen == null ? 1 : .35)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Kicker(judul),
            const SizedBox(height: 6),
            ...anak,
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final s = _slip;
    final run = s?['run'] as Map?;

    return Scaffold(
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          GradientHeader(
            title: run != null ? _namaBulan(run['period'] as String) : 'Slip Gaji',
            subtitle: run != null
                ? (run['type'] == 'THR' ? 'Tunjangan Hari Raya' : 'Gaji bulanan')
                : 'Memuat…',
            accent: P.emerald,
            showBack: true,
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 18, 16, bottomInset(context)),
            child: IsiTerpusat(
              child: _loading
                  ? const Column(children: [Shimmer(height: 140), SizedBox(height: 12), Shimmer(height: 220)])
                  : s == null
                      ? EmptyState(
                          icon: Icons.receipt_long_outlined,
                          title: 'Slip tidak dapat dibuka',
                          hint: _galat,
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Nilai yang diterima
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(22),
                              margin: const EdgeInsets.only(bottom: 16),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [P.emerald.withOpacity(.16), P.panel.withOpacity(.9)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(color: P.emerald.withOpacity(.4)),
                              ),
                              child: Column(
                                children: [
                                  const Kicker('Gaji Diterima'),
                                  const SizedBox(height: 10),
                                  Text(
                                    _rp.format((s['netto'] as num).toDouble()),
                                    style: const TextStyle(
                                      fontSize: 32,
                                      height: 1.1,
                                      fontWeight: FontWeight.w900,
                                      color: P.emerald,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    '${s['bankName'] ?? '—'} · ${s['bankAccount'] ?? '—'}',
                                    style: const TextStyle(color: P.muted, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),

                            _panel(
                              judul: 'Rekap Kehadiran',
                              anak: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    _Angka(label: 'Hadir', nilai: '${s['hariHadir']}'),
                                    _Angka(label: 'Jadwal', nilai: '${s['hariJadwal']}'),
                                    _Angka(
                                      label: 'Mangkir',
                                      nilai: '${s['hariMangkir']}',
                                      warna: (s['hariMangkir'] as num) > 0 ? P.danger : null,
                                    ),
                                    _Angka(label: 'Lembur', nilai: '${s['jamLembur']} j'),
                                  ],
                                ),
                              ],
                            ),

                            _panel(
                              judul: 'Pendapatan',
                              aksen: P.emerald,
                              anak: [
                                ...((s['earnings'] ?? []) as List).map(
                                  (e) => _baris(e['label'] as String, e['jumlah'] as num,
                                      catatan: e['catatan'] as String?),
                                ),
                                const Divider(color: P.line, height: 18),
                                _baris('Bruto', s['bruto'] as num, warna: P.emerald),
                              ],
                            ),

                            _panel(
                              judul: 'Potongan',
                              aksen: P.danger,
                              anak: [
                                if (((s['deductions'] ?? []) as List).isEmpty)
                                  const Padding(
                                    padding: EdgeInsets.symmetric(vertical: 8),
                                    child: Text('Tidak ada potongan bulan ini',
                                        style: TextStyle(color: P.muted, fontSize: 12.5)),
                                  ),
                                ...((s['deductions'] ?? []) as List).map(
                                  (e) => _baris(e['label'] as String, e['jumlah'] as num,
                                      warna: P.danger, catatan: e['catatan'] as String?),
                                ),
                                const Divider(color: P.line, height: 18),
                                _baris('Total potongan', s['totalPotongan'] as num, warna: P.danger),
                              ],
                            ),

                            _panel(
                              judul: 'Iuran & Pajak',
                              anak: [
                                _baris('Iuran BPJS ditanggung Anda', s['bpjsPekerja'] as num),
                                _baris('Iuran BPJS ditanggung perusahaan', s['bpjsPerusahaan'] as num,
                                    warna: P.muted),
                                _baris('PPh 21', s['pph21'] as num,
                                    catatan: s['pph21Basis'] as String?),
                              ],
                            ),

                            const SizedBox(height: 4),
                            Text(
                              'Bila ada angka yang tidak sesuai, sampaikan kepada Danru atau bagian keuangan '
                              'sebelum tanggal transfer berikutnya.',
                              style: const TextStyle(color: P.muted, fontSize: 11.5, height: 1.5),
                            ),
                          ],
                        ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Angka extends StatelessWidget {
  final String label;
  final String nilai;
  final Color? warna;
  const _Angka({required this.label, required this.nilai, this.warna});

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text(
            nilai,
            style: TextStyle(color: warna ?? P.ink, fontSize: 19, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: P.muted, fontSize: 10.5)),
        ],
      );
}
