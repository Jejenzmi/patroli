import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'theme.dart';

/// Pemeriksa pembaruan aplikasi.
///
/// Google Play memberi tahu adanya versi baru, tetapi hanya di dalam aplikasi
/// Play dan hanya bila penggunanya membukanya — sesuatu yang jarang dilakukan
/// anggota di lapangan. Sebagian ponsel dinas juga dipasang langsung dari
/// berkas APK, di luar Play. Karena itu aplikasi menanyakan sendiri versi
/// terbaru kepada server dan menyampaikannya di layar.
///
/// Yang dibandingkan adalah nomor build, bukan teks versinya: teks versi mudah
/// keliru diurutkan (1.10.0 lebih baru daripada 1.9.0, tetapi kalah bila
/// dibandingkan sebagai teks).
class Pembaruan {
  Pembaruan._();
  static final Pembaruan i = Pembaruan._();

  static const _kunciTunda = 'pembaruan_ditunda_build';

  bool _sudahDiperiksa = false;

  /// Memeriksa versi lalu menampilkan dialog bila memang ada yang lebih baru.
  ///
  /// Dipanggil sekali tiap kali aplikasi dibuka. Kegagalan jaringan diabaikan
  /// diam-diam — pemberitahuan pembaruan tidak boleh menghalangi anggota yang
  /// sedang buru-buru presensi.
  Future<void> periksa(BuildContext context, {bool paksaTampil = false}) async {
    if (_sudahDiperiksa && !paksaTampil) return;
    _sudahDiperiksa = true;

    try {
      final info = await PackageInfo.fromPlatform();
      final build = int.tryParse(info.buildNumber) ?? 0;
      if (build == 0) return;

      final r = await Api.i.get('/app/versi?build=$build');
      final adaPembaruan = r['adaPembaruan'] == true;
      final wajib = r['wajib'] == true;
      if (!adaPembaruan) return;

      // Pembaruan biasa boleh ditunda sampai versi berikutnya terbit;
      // pembaruan wajib tidak dapat dilewati.
      if (!wajib && !paksaTampil) {
        final p = await SharedPreferences.getInstance();
        if (p.getInt(_kunciTunda) == (r['build'] as num?)?.toInt()) return;
      }

      if (!context.mounted) return;
      await _tampilkan(
        context,
        versi: r['versi']?.toString() ?? '-',
        buildBaru: (r['build'] as num?)?.toInt() ?? 0,
        catatan: (r['catatan']?.toString() ?? '').trim(),
        tautan: r['tautanPlay']?.toString() ?? '',
        tautanApk: r['tautanApk']?.toString() ?? '',
        wajib: wajib,
      );
    } catch (_) {
      // Diabaikan dengan sengaja.
    }
  }

  Future<void> _tampilkan(
    BuildContext context, {
    required String versi,
    required int buildBaru,
    required String catatan,
    required String tautan,
    required String tautanApk,
    required bool wajib,
  }) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: !wajib,
      builder: (d) => PopScope(
        canPop: !wajib,
        child: AlertDialog(
          backgroundColor: P.panel,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          icon: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: (wajib ? P.danger : P.amber).withOpacity(.13),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: (wajib ? P.danger : P.amber).withOpacity(.3)),
            ),
            child: Icon(
              wajib ? Icons.system_update_alt : Icons.download_rounded,
              color: wajib ? P.danger : P.amber,
              size: 24,
            ),
          ),
          title: Text(
            wajib ? 'Pembaruan wajib' : 'Versi baru tersedia',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                wajib
                    ? 'Versi $versi harus dipasang sebelum aplikasi dapat dipakai lagi. '
                        'Versi yang Anda pakai sudah tidak didukung.'
                    : 'Versi $versi sudah terbit. Sebaiknya diperbarui agar presensi dan '
                        'patroli tercatat dengan cara yang paling baru.',
                style: const TextStyle(color: P.muted, fontSize: 13.5, height: 1.55),
                textAlign: TextAlign.center,
              ),
              if (catatan.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: P.abyss.withOpacity(.6),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: P.line),
                  ),
                  child: Text(
                    catatan,
                    style: const TextStyle(color: P.ink, fontSize: 12.5, height: 1.5),
                  ),
                ),
              ],
            ],
          ),
          actionsAlignment: MainAxisAlignment.center,
          actions: [
            if (!wajib)
              TextButton(
                onPressed: () async {
                  final p = await SharedPreferences.getInstance();
                  await p.setInt(_kunciTunda, buildBaru);
                  if (d.mounted) Navigator.pop(d);
                },
                child: const Text('Nanti saja', style: TextStyle(color: P.muted)),
              ),
            FilledButton.icon(
              onPressed: () => _buka(tautan, tautanApk),
              icon: const Icon(Icons.open_in_new, size: 17),
              label: const Text('PERBARUI'),
            ),
          ],
        ),
      ),
    );
  }

  /// Membuka halaman Play Store; bila Play tidak ada — ponsel dinas yang
  /// dipasang langsung dari APK — jatuh ke tautan berkas APK.
  Future<void> _buka(String tautanPlay, String tautanApk) async {
    for (final alamat in [tautanPlay, tautanApk]) {
      if (alamat.isEmpty) continue;
      final u = Uri.tryParse(alamat);
      if (u == null) continue;
      if (await canLaunchUrl(u)) {
        await launchUrl(u, mode: LaunchMode.externalApplication);
        return;
      }
    }
  }
}
