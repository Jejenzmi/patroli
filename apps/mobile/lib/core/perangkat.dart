import 'dart:io';
import 'dart:math';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Identitas perangkat yang dipakai untuk mengikat akun pada satu ponsel.
///
/// Penandanya dibuat sekali lalu disimpan di perangkat. Memasang ulang
/// aplikasi memang menghasilkan penanda baru — karena itu ciri perangkat
/// (merek, model, papan, versi sistem) ikut dikirim, supaya server dapat
/// mengenali bahwa ponselnya sebenarnya sama dan tidak merepotkan petugas.
class Perangkat {
  Perangkat._();
  static final Perangkat i = Perangkat._();

  static const _kunci = 'patroli_device_id';
  Map<String, dynamic>? _singgahan;

  String _acak() {
    final r = Random.secure();
    final huruf = List.generate(24, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0'));
    return huruf.join();
  }

  Future<String> _penanda() async {
    final p = await SharedPreferences.getInstance();
    var id = p.getString(_kunci);
    if (id == null || id.isEmpty) {
      id = _acak();
      await p.setString(_kunci, id);
    }
    return id;
  }

  /// Keterangan perangkat yang dikirim bersama permintaan masuk.
  Future<Map<String, dynamic>> info() async {
    if (_singgahan != null) return _singgahan!;

    final id = await _penanda();
    var label = 'Perangkat tidak dikenal';
    var fingerprint = '';
    var platform = 'unknown';
    var osVersion = '';
    var fisik = true;

    try {
      final d = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final a = await d.androidInfo;
        label = '${a.brand} ${a.model}'.trim();
        // Ciri sengaja tidak memuat nomor seri: cukup untuk mengenali ponsel
        // yang sama, tanpa menyimpan penanda perangkat keras yang sensitif.
        fingerprint = [a.brand, a.model, a.device, a.hardware, a.version.sdkInt].join('|');
        platform = 'android';
        osVersion = 'Android ${a.version.release} (SDK ${a.version.sdkInt})';
        fisik = a.isPhysicalDevice;
      } else if (Platform.isIOS) {
        final a = await d.iosInfo;
        label = a.utsname.machine;
        fingerprint = [a.model, a.utsname.machine, a.systemVersion].join('|');
        platform = 'ios';
        osVersion = 'iOS ${a.systemVersion}';
        fisik = a.isPhysicalDevice;
      }
    } catch (_) {
      // Perangkat yang menolak memberi keterangan tetap boleh dipakai;
      // pengikatan cukup bersandar pada penandanya.
    }

    var versiAplikasi = '';
    try {
      final v = await PackageInfo.fromPlatform();
      versiAplikasi = '${v.version}+${v.buildNumber}';
    } catch (_) {}

    _singgahan = {
      'deviceId': id,
      'fingerprint': fingerprint.isEmpty ? null : fingerprint,
      'label': label,
      'platform': platform,
      'osVersion': osVersion,
      'appVersion': versiAplikasi,
      'isPhysical': fisik,
    };
    return _singgahan!;
  }

  /// Penanda saja, untuk disertakan pada tindakan lapangan.
  Future<String> id() async => _penanda();

  /// Apakah aplikasi berjalan pada ponsel sungguhan.
  Future<bool> fisik() async => (await info())['isPhysical'] == true;
}
