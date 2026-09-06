import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../core/theme.dart';

/// Hasil laporan satu titik.
class LaporanTitik {
  final String condition;
  final String? note;
  final String? photoUrl;

  /// Foto yang belum sempat diunggah karena jaringan mati — ikut diantre
  /// bersama pemindaiannya.
  final File? foto;

  const LaporanTitik({required this.condition, this.note, this.photoUrl, this.foto});
}

const _pilihan = [
  ('AMAN', 'Aman', 'Tidak ada temuan', Icons.verified_outlined, P.emerald),
  ('PERLU_PERHATIAN', 'Perlu perhatian', 'Ada yang perlu ditindaklanjuti', Icons.error_outline, P.amber),
  ('BERMASALAH', 'Bermasalah', 'Perlu penanganan segera', Icons.report_gmailerrorred_outlined, P.danger),
];

/// Meminta laporan kondisi titik — wajib diisi.
///
/// Lembar ini tidak dapat ditutup dengan mengetuk latar: selama laporannya
/// belum ada, titik berikutnya memang tidak boleh dipindai. Pembatalan hanya
/// mungkin lewat tombol yang menyatakan pemindaian dibatalkan.
Future<LaporanTitik?> mintaLaporanTitik(
  BuildContext context, {
  required String namaTitik,
  bool wajibFoto = false,
}) {
  String kondisi = 'AMAN';
  final catatan = TextEditingController();
  String? photoUrl;
  File? fotoLokal;
  bool mengunggah = false;

  return showModalBottomSheet<LaporanTitik>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: P.panel,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
    ),
    builder: (sheetCtx) => StatefulBuilder(
      builder: (sheetCtx, setSheet) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(sheetCtx).viewInsets.bottom + 24,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 18),
                  decoration: BoxDecoration(color: P.line, borderRadius: BorderRadius.circular(9)),
                ),
              ),
              Row(
                children: [
                  const Icon(Icons.assignment_outlined, color: P.amber, size: 18),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text('Laporan Titik — Wajib',
                        style: TextStyle(color: P.ink, fontSize: 16, fontWeight: FontWeight.w900)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '$namaTitik · titik berikutnya baru bisa dipindai setelah laporan ini terkirim.',
                style: const TextStyle(color: P.muted, fontSize: 12, height: 1.45),
              ),
              const SizedBox(height: 18),

              ..._pilihan.map((o) {
                final aktif = kondisi == o.$1;
                return GestureDetector(
                  onTap: () => setSheet(() => kondisi = o.$1),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: aktif ? o.$5.withOpacity(.12) : P.panel2.withOpacity(.5),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: aktif ? o.$5.withOpacity(.55) : P.line),
                    ),
                    child: Row(
                      children: [
                        Icon(o.$4, size: 19, color: aktif ? o.$5 : P.muted),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(o.$2,
                                  style: TextStyle(
                                      color: aktif ? o.$5 : P.ink,
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w800)),
                              Text(o.$3, style: const TextStyle(color: P.muted, fontSize: 11)),
                            ],
                          ),
                        ),
                        if (aktif) Icon(Icons.check_circle, size: 18, color: o.$5),
                      ],
                    ),
                  ),
                );
              }),

              const SizedBox(height: 10),
              TextField(
                controller: catatan,
                minLines: 2,
                maxLines: 4,
                style: const TextStyle(color: P.ink, fontSize: 13.5),
                decoration: InputDecoration(
                  hintText: kondisi == 'AMAN'
                      ? 'Catatan keadaan titik (opsional)'
                      : 'Jelaskan temuannya — wajib diisi',
                  hintStyle: const TextStyle(color: P.muted, fontSize: 12.5),
                  filled: true,
                  fillColor: P.panel2.withOpacity(.5),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: P.line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: P.line),
                  ),
                ),
              ),

              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: mengunggah
                    ? null
                    : () async {
                        final shot = await ImagePicker()
                            .pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 1280);
                        if (shot == null) return;
                        setSheet(() => mengunggah = true);
                        try {
                          final url = await Api.i.upload(File(shot.path), folder: 'patroli');
                          setSheet(() {
                            photoUrl = url;
                            fotoLokal = null;
                            mengunggah = false;
                          });
                        } catch (_) {
                          // Tanpa jaringan, fotonya ikut mengantre bersama laporan.
                          setSheet(() {
                            fotoLokal = File(shot.path);
                            mengunggah = false;
                          });
                        }
                      },
                style: OutlinedButton.styleFrom(
                  foregroundColor: P.ink,
                  side: const BorderSide(color: P.line),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: Icon(
                  photoUrl != null || fotoLokal != null ? Icons.check_circle : Icons.photo_camera_outlined,
                  size: 18,
                  color: photoUrl != null || fotoLokal != null ? P.emerald : P.ink,
                ),
                label: Text(
                  mengunggah
                      ? 'Mengunggah…'
                      : photoUrl != null
                          ? 'Foto terlampir'
                          : fotoLokal != null
                              ? 'Foto menunggu jaringan'
                              : wajibFoto
                                  ? 'Ambil foto bukti (wajib)'
                                  : 'Ambil foto bukti (opsional)',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
              ),

              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    final isi = catatan.text.trim();
                    if (kondisi != 'AMAN' && isi.isEmpty) {
                      ScaffoldMessenger.of(sheetCtx).showSnackBar(
                        const SnackBar(content: Text('Jelaskan temuannya pada catatan')),
                      );
                      return;
                    }
                    if (wajibFoto && photoUrl == null && fotoLokal == null) {
                      ScaffoldMessenger.of(sheetCtx).showSnackBar(
                        const SnackBar(content: Text('Rute ini mewajibkan foto bukti di setiap titik')),
                      );
                      return;
                    }
                    Navigator.pop(
                      sheetCtx,
                      LaporanTitik(
                        condition: kondisi,
                        note: isi.isEmpty ? null : isi,
                        photoUrl: photoUrl,
                        foto: fotoLokal,
                      ),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: P.amber,
                    foregroundColor: P.voidBg,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('KIRIM LAPORAN TITIK',
                      style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, letterSpacing: .6)),
                ),
              ),
              const SizedBox(height: 6),
              Center(
                child: TextButton(
                  onPressed: () => Navigator.pop(sheetCtx, null),
                  child: const Text('Batalkan pemindaian titik ini',
                      style: TextStyle(color: P.muted, fontSize: 12)),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
