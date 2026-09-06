import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'geo.dart';

/// Pengambilan foto bukti.
///
/// Tiga aturan yang dijaga modul ini, dan semuanya disengaja:
///
/// **Selalu kamera, tidak pernah galeri.** Foto bukti harus diambil saat itu
/// juga di tempat kejadian. Membuka galeri berarti membuka pintu bagi foto
/// lama, foto rekan, atau foto dari internet.
///
/// **Selalu bertanda air.** Logo perusahaan, waktu, dan koordinat dibakar ke
/// dalam gambar. Keterangan yang menempel pada berkasnya sendiri tetap ikut
/// walau gambarnya dipindahkan, dikirim ulang, atau dicetak — berbeda dengan
/// data yang hanya tersimpan di basis data.
///
/// **Tidak meninggalkan jejak di ponsel.** Berkas sementara dari kamera
/// dihapus segera setelah gambarnya dibaca ke memori, dan hasil bertanda air
/// tidak pernah menyentuh penyimpanan sama sekali — kecuali bila sedang tidak
/// ada jaringan, yang membuatnya harus mengantre di ruang privat aplikasi
/// sampai terkirim, lalu dihapus. Galeri ponsel tidak pernah tersentuh.
class Kamera {
  Kamera._();

  static img.Image? _logo;

  /// Logo hanya diurai sekali; mengurainya tiap memotret memboroskan waktu
  /// pada ponsel kelas bawah yang justru dipakai di lapangan.
  static Future<img.Image?> _ambilLogo() async {
    if (_logo != null) return _logo;
    try {
      final data = await rootBundle.load('assets/merek/logo.png');
      final asli = img.decodePng(data.buffer.asUint8List());
      if (asli == null) return null;
      _logo = img.copyResize(asli, height: 64, interpolation: img.Interpolation.average);
      return _logo;
    } catch (_) {
      return null;
    }
  }

  /// Mengambil foto lalu mengembalikan isinya yang sudah bertanda air.
  ///
  /// `null` berarti pengguna membatalkan. Kegagalan menandai gambar tidak
  /// membatalkan apa pun: foto asli tetap dikirim, karena bukti yang ada lebih
  /// berguna daripada bukti yang hilang.
  static Future<Uint8List?> ambil({
    CameraDevice kamera = CameraDevice.rear,
    String? keterangan,
    int lebarMaks = 1280,
    int mutu = 78,
  }) async {
    final hasil = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: kamera,
      imageQuality: mutu,
      maxWidth: lebarMaks.toDouble(),
    );
    if (hasil == null) return null;

    final berkas = File(hasil.path);
    Uint8List isi;
    try {
      isi = await berkas.readAsBytes();
    } finally {
      // Dibaca ke memori, berkasnya tidak diperlukan lagi.
      await _hapus(berkas);
    }

    try {
      return await _bubuhkanTandaAir(isi, keterangan: keterangan);
    } catch (_) {
      return isi;
    }
  }

  static Future<void> _hapus(File f) async {
    try {
      if (await f.exists()) await f.delete();
    } catch (_) {}
  }

  /// Membakar logo, waktu, dan koordinat ke bagian bawah gambar.
  static Future<Uint8List> _bubuhkanTandaAir(Uint8List isi, {String? keterangan}) async {
    final gambar = img.decodeImage(isi);
    if (gambar == null) return isi;

    // Koordinat diambil apa adanya: tanda air bersifat menerangkan, dan
    // penolakan lokasi palsu sudah ditangani server pada kiriman tindakannya.
    String lokasi = 'Lokasi tidak tersedia';
    try {
      final p = await Geo.currentApaAdanya(highAccuracy: false);
      if (p.latitude != 0 || p.longitude != 0) {
        lokasi =
            '${p.latitude.toStringAsFixed(6)}, ${p.longitude.toStringAsFixed(6)}'
            '  (akurasi ${p.accuracy.round()} m)';
      }
    } catch (_) {}

    // Hanya huruf ASCII: font bitmap paket image tidak memuat tanda seperti
    // titik tengah atau plus-minus, dan menggambarnya menyisakan lubang kosong.
    final waktu = DateFormat('d MMMM yyyy, HH:mm:ss', 'id').format(DateTime.now());

    final lebar = gambar.width;
    final skala = lebar / 1280;
    final tinggiBar = (keterangan == null ? 132 : 168) * skala;
    final atasBar = gambar.height - tinggiBar;

    // Bilah gelap semi-transparan supaya teks terbaca di atas latar apa pun.
    img.fillRect(
      gambar,
      x1: 0,
      y1: atasBar.round(),
      x2: lebar,
      y2: gambar.height,
      color: img.ColorRgba8(0, 0, 0, 150),
    );
    img.fillRect(
      gambar,
      x1: 0,
      y1: atasBar.round(),
      x2: lebar,
      y2: (atasBar + 3 * skala).round(),
      color: img.ColorRgba8(245, 179, 1, 255),
    );

    final logo = await _ambilLogo();
    var kiri = (24 * skala).round();
    if (logo != null) {
      final tinggiLogo = (72 * skala).round();
      final kecil = img.copyResize(logo, height: tinggiLogo, interpolation: img.Interpolation.average);
      img.compositeImage(
        gambar,
        kecil,
        dstX: kiri,
        dstY: (atasBar + (tinggiBar - tinggiLogo) / 2).round(),
      );
      kiri += kecil.width + (22 * skala).round();
    }

    final font = skala >= 1.4 ? img.arial48 : img.arial24;
    final tinggiBaris = (font.lineHeight * 1.08).round();
    var y = (atasBar + (24 * skala)).round();

    /// Huruf di luar ASCII diganti padanan terdekat supaya tidak menyisakan
    /// lubang pada barisan teks.
    String aman(String t) => t
        .replaceAll('·', '-')
        .replaceAll('±', '+/-')
        .replaceAll('—', '-')
        .replaceAll('–', '-')
        .replaceAll('…', '...')
        .replaceAll(RegExp(r'[^\x20-\x7E]'), '');

    void tulis(String teks, {img.Color? warna}) {
      img.drawString(gambar, aman(teks), font: font, x: kiri, y: y, color: warna ?? img.ColorRgb8(255, 255, 255));
      y += tinggiBaris;
    }

    tulis('DHARMAPATI', warna: img.ColorRgb8(245, 179, 1));
    tulis(waktu);
    tulis(lokasi);
    if (keterangan != null && keterangan.trim().isNotEmpty) {
      tulis(_potong(keterangan.trim(), 52));
    }

    return Uint8List.fromList(img.encodeJpg(gambar, quality: 82));
  }

  static String _potong(String t, int n) => t.length <= n ? t : '${t.substring(0, n - 1)}…';
}
