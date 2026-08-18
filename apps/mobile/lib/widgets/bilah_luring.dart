import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/antrean.dart';
import '../core/sinkron.dart';
import '../core/theme.dart';

/// Bilah tipis di atas layar yang menerangkan keadaan jaringan.
///
/// Tidak tampil sama sekali selama semuanya normal. Ia muncul hanya ketika
/// petugas perlu tahu: sedang berada di area tanpa sinyal, atau masih ada
/// catatan yang menunggu giliran terkirim.
class BilahLuring extends StatefulWidget {
  /// Isi aplikasi yang dibungkus. Bilah hanya menyisipkan dirinya di atas
  /// isi tersebut ketika memang ada yang perlu diberitahukan.
  final Widget child;
  const BilahLuring({super.key, required this.child});

  @override
  State<BilahLuring> createState() => _BilahLuringState();
}

class _BilahLuringState extends State<BilahLuring> {
  StatusSinkron _status = Sinkron.i.status;

  @override
  void initState() {
    super.initState();
    Sinkron.i.aliran.listen((s) {
      if (mounted) setState(() => _status = s);
    });
  }

  @override
  Widget build(BuildContext context) {
    final luring = !_status.daring;
    final menunggu = _status.menunggu;
    if (!luring && menunggu == 0) return widget.child;

    final warna = luring ? P.amber : P.cyan;
    final pesan = luring
        ? (menunggu > 0
            ? 'Tanpa jaringan · $menunggu catatan menunggu terkirim'
            : 'Tanpa jaringan · pekerjaan tetap tercatat di perangkat')
        : _status.sedangKirim
            ? 'Mengirim $menunggu catatan yang tertunda…'
            : '$menunggu catatan menunggu terkirim';

    // Bilah ditumpuk di atas isi aplikasi, bukan menyusutkannya lewat Column.
    // Menaruh Navigator di dalam Column membuatnya kehilangan batas ukuran yang
    // diharapkan dan layar berikutnya gagal tergambar. Sebagai gantinya, isi
    // tetap seukuran penuh dan hanya diberi tahu bahwa tepi atasnya bertambah.
    final mq = MediaQuery.of(context);
    final tinggiBilah = mq.padding.top + _tinggiIsiBilah;

    return Stack(
      children: [
        Positioned.fill(
          child: MediaQuery(
            data: mq.copyWith(padding: mq.padding.copyWith(top: tinggiBilah)),
            child: widget.child,
          ),
        ),
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: _bilah(context, luring, menunggu, warna, pesan),
        ),
      ],
    );
  }

  /// Tinggi isi bilah di luar area aman bilah status.
  static const double _tinggiIsiBilah = 30;

  Widget _bilah(BuildContext context, bool luring, int menunggu, Color warna, String pesan) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _bukaRincian(context),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 8, 16, 8),
          color: warna.withOpacity(.14),
          child: Row(
            children: [
              if (_status.sedangKirim)
                SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(strokeWidth: 2, color: warna),
                )
              else
                Icon(luring ? Icons.cloud_off_rounded : Icons.cloud_upload_outlined, size: 14, color: warna),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  pesan,
                  style: TextStyle(color: warna, fontSize: 11.5, fontWeight: FontWeight.w700),
                ),
              ),
              Text('Rincian',
                  style: TextStyle(color: warna.withOpacity(.8), fontSize: 10.5, fontWeight: FontWeight.w800)),
              Icon(Icons.chevron_right, size: 15, color: warna.withOpacity(.8)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _bukaRincian(BuildContext context) async {
    final daftar = await Sinkron.i.daftarTertunda();
    if (!context.mounted) return;
    await showModalBottomSheet(
      context: context,
      backgroundColor: P.panel,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(color: P.line, borderRadius: BorderRadius.circular(9)),
              ),
            ),
            const SizedBox(height: 18),
            const Text('Menunggu Terkirim',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(
              daftar.isEmpty
                  ? 'Semua catatan sudah terkirim ke pusat komando.'
                  : 'Catatan ini tersimpan aman di perangkat dan akan terkirim sendiri begitu jaringan pulih. Anda tidak perlu mengulang apa pun.',
              style: const TextStyle(color: P.muted, fontSize: 12.5, height: 1.45),
            ),
            const SizedBox(height: 16),
            if (daftar.isNotEmpty)
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 300),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: daftar.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _baris(daftar[i]),
                ),
              ),
            if (_status.galat != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: P.danger.withOpacity(.08),
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: P.danger.withOpacity(.3)),
                ),
                child: Text(_status.galat!,
                    style: const TextStyle(color: P.danger, fontSize: 11.5, height: 1.4)),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: daftar.isEmpty
                    ? null
                    : () {
                        Sinkron.i.kirimSemua();
                        Navigator.pop(ctx);
                      },
                icon: const Icon(Icons.sync, size: 17),
                label: const Text('COBA KIRIM SEKARANG'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _baris(ItemAntrean it) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: P.abyss.withOpacity(.6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: P.line),
        ),
        child: Row(
          children: [
            Icon(
              it.berkas != null ? Icons.photo_camera_outlined : Icons.description_outlined,
              size: 15,
              color: P.muted,
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(it.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(
                    DateFormat('d MMM · HH:mm', 'id_ID').format(it.dibuat.toLocal()),
                    style: const TextStyle(color: P.muted, fontSize: 11),
                  ),
                  if (it.galat != null) ...[
                    const SizedBox(height: 4),
                    Text('Percobaan ${it.percobaan}: ${it.galat}',
                        style: const TextStyle(color: P.danger, fontSize: 10.5, height: 1.35)),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}
