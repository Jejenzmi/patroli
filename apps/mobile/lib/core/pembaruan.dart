import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:in_app_update/in_app_update.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'theme.dart';

/// Pembaruan aplikasi.
///
/// Ada dua jalur, dan keduanya diperlukan.
///
/// Ponsel yang memasang aplikasi dari Google Play diperbarui langsung di
/// dalam aplikasi lewat Play In-App Update: berkasnya diunduh sendiri di latar
/// belakang, lalu anggota tinggal menyetujui pemasangannya. Tidak ada langkah
/// mencari aplikasi di toko, yang jarang dilakukan anggota di lapangan.
///
/// Sebagian ponsel dinas dipasang langsung dari berkas APK di luar Play.
/// Perangkat itu tidak dikenal Play sama sekali, sehingga jatuh ke jalur kedua:
/// bertanya kepada server dan menampilkan tautan unduhan.
///
/// Server tetap memegang keputusan wajib-tidaknya, karena Play hanya tahu ada
/// versi yang lebih baru — bukan versi mana yang sudah tidak boleh dipakai.
class Pembaruan {
  Pembaruan._();
  static final Pembaruan i = Pembaruan._();

  static const _kunciTunda = 'pembaruan_ditunda_build';

  bool _sudahDiperiksa = false;

  /// Diperiksa tanpa `dart:io`: di build web pustaka itu melempar galat saat
  /// dijalankan, dan galat itu akan menelan pula jalur cadangan berbasis
  /// server yang seharusnya tetap bekerja.
  bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  /// Dipanggil sekali tiap aplikasi dibuka.
  ///
  /// Kegagalan apa pun diabaikan diam-diam: pemberitahuan pembaruan tidak
  /// boleh menghalangi anggota yang sedang buru-buru presensi.
  Future<void> periksa(BuildContext context, {bool paksaTampil = false}) async {
    if (_sudahDiperiksa && !paksaTampil) return;
    _sudahDiperiksa = true;

    try {
      final info = await PackageInfo.fromPlatform();
      final build = int.tryParse(info.buildNumber) ?? 0;
      if (build == 0) return;

      // Kebijakan diambil lebih dulu: wajib atau tidak ditentukan server.
      Map<String, dynamic> kebijakan = const {};
      try {
        final r = await Api.i.get('/app/versi?build=$build');
        if (r is Map) kebijakan = Map<String, dynamic>.from(r);
      } catch (_) {
        // Server tak terjangkau — Play masih bisa dicoba sendiri.
      }
      final wajib = kebijakan['wajib'] == true;

      if (_android && await _lewatPlay(context, wajib: wajib)) return;

      // Play tidak mengenali perangkat ini (pemasangan dari berkas APK) atau
      // tidak punya pembaruan; jatuh ke pemberitahuan berbasis server.
      if (kebijakan['adaPembaruan'] != true) return;
      if (!wajib && !paksaTampil) {
        final p = await SharedPreferences.getInstance();
        if (p.getInt(_kunciTunda) == (kebijakan['build'] as num?)?.toInt()) return;
      }
      if (!context.mounted) return;
      await _dialogTautan(
        context,
        versi: kebijakan['versi']?.toString() ?? '-',
        buildBaru: (kebijakan['build'] as num?)?.toInt() ?? 0,
        catatan: (kebijakan['catatan']?.toString() ?? '').trim(),
        tautanPlay: kebijakan['tautanPlay']?.toString() ?? '',
        tautanApk: kebijakan['tautanApk']?.toString() ?? '',
        wajib: wajib,
      );
    } catch (_) {
      // Diabaikan dengan sengaja.
    }
  }

  /// Mencoba jalur Google Play. Mengembalikan true bila Play yang menangani.
  Future<bool> _lewatPlay(BuildContext context, {required bool wajib}) async {
    try {
      final info = await InAppUpdate.checkForUpdate();
      if (info.updateAvailability != UpdateAvailability.updateAvailable) return false;

      if (wajib && info.immediateUpdateAllowed) {
        // Play mengambil alih layar sampai pemasangan selesai. Pantas untuk
        // versi yang memang sudah tidak boleh dipakai.
        await InAppUpdate.performImmediateUpdate();
        return true;
      }

      if (info.flexibleUpdateAllowed) {
        // Diunduh di latar belakang: anggota tetap dapat presensi dan
        // berpatroli selama berkasnya turun.
        await InAppUpdate.startFlexibleUpdate();
        if (!context.mounted) return true;
        await _dialogPasang(context);
        return true;
      }

      if (info.immediateUpdateAllowed) {
        await InAppUpdate.performImmediateUpdate();
        return true;
      }
      return false;
    } catch (_) {
      // Aplikasi tidak dipasang dari Play, atau layanan Play tidak tersedia.
      return false;
    }
  }

  /// Ditampilkan setelah berkas pembaruan selesai diunduh.
  ///
  /// Pemasangan tidak dijalankan diam-diam karena memulai ulang aplikasi di
  /// tengah shift dapat memutus patroli yang sedang berjalan.
  Future<void> _dialogPasang(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (d) => AlertDialog(
        backgroundColor: P.panel,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        icon: _ikon(Icons.download_done_rounded, P.emerald),
        title: const Text(
          'Pembaruan siap dipasang',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          textAlign: TextAlign.center,
        ),
        content: const Text(
          'Berkas pembaruan sudah selesai diunduh. Pemasangan memulai ulang aplikasi '
          'sebentar — pastikan tidak ada patroli atau presensi yang belum ditutup.',
          style: TextStyle(color: P.muted, fontSize: 13.5, height: 1.55),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d),
            child: const Text('Nanti saja', style: TextStyle(color: P.muted)),
          ),
          FilledButton.icon(
            onPressed: () async {
              Navigator.pop(d);
              try {
                await InAppUpdate.completeFlexibleUpdate();
              } catch (_) {}
            },
            icon: const Icon(Icons.install_mobile, size: 17),
            label: const Text('PASANG SEKARANG'),
          ),
        ],
      ),
    );
  }

  Widget _ikon(IconData ikon, Color warna) => Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: warna.withOpacity(.13),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: warna.withOpacity(.3)),
        ),
        child: Icon(ikon, color: warna, size: 24),
      );

  Future<void> _dialogTautan(
    BuildContext context, {
    required String versi,
    required int buildBaru,
    required String catatan,
    required String tautanPlay,
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
          icon: _ikon(
            wajib ? Icons.system_update_alt : Icons.download_rounded,
            wajib ? P.danger : P.amber,
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
                  child: Text(catatan,
                      style: const TextStyle(color: P.ink, fontSize: 12.5, height: 1.5)),
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
              onPressed: () => _buka(tautanPlay, tautanApk),
              icon: const Icon(Icons.open_in_new, size: 17),
              label: const Text('PERBARUI'),
            ),
          ],
        ),
      ),
    );
  }

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
