import 'dart:math';
import 'package:geolocator/geolocator.dart';

/// Dilempar ketika koordinat berasal dari aplikasi pengubah lokasi.
class LokasiPalsu implements Exception {
  final Position posisi;
  LokasiPalsu(this.posisi);
  @override
  String toString() =>
      'Lokasi palsu terdeteksi. Matikan aplikasi pengubah lokasi (fake GPS) lalu ulangi.';
}

/// Layanan lokasi: izin, posisi terkini, dan hitung jarak.
class Geo {
  static Future<Position> current({bool highAccuracy = true, bool tolakPalsu = true}) async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception('Layanan lokasi perangkat mati. Aktifkan GPS terlebih dahulu.');
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied) {
      throw Exception('Izin lokasi ditolak. Aplikasi memerlukan lokasi untuk presensi dan patroli.');
    }
    if (perm == LocationPermission.deniedForever) {
      throw Exception('Izin lokasi diblokir permanen. Ubah lewat Pengaturan aplikasi.');
    }
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: highAccuracy ? LocationAccuracy.best : LocationAccuracy.medium,
        timeLimit: const Duration(seconds: 25),
      ),
    );

    // Android menandai koordinat yang berasal dari penyedia tiruan. Aplikasi
    // menolaknya di tempat, tetapi server tetap diberi tahu lewat tanda
    // `mocked` pada tiap tindakan supaya percobaannya tercatat.
    if (tolakPalsu && pos.isMocked) {
      throw LokasiPalsu(pos);
    }
    return pos;
  }

  /// Mengambil posisi apa adanya, termasuk bila berasal dari lokasi tiruan.
  /// Dipakai ketika percobaan pelanggaran justru perlu dilaporkan ke server.
  static Future<Position> currentApaAdanya({bool highAccuracy = true}) =>
      current(highAccuracy: highAccuracy, tolakPalsu: false);

  static Stream<Position> stream({int distanceFilter = 15}) => Geolocator.getPositionStream(
        locationSettings: LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: distanceFilter,
        ),
      );

  /// Jarak dua koordinat dalam meter (haversine).
  static double meters(double aLat, double aLng, double bLat, double bLng) {
    const r = 6371000.0;
    double rad(double d) => d * pi / 180;
    final dLat = rad(bLat - aLat);
    final dLng = rad(bLng - aLng);
    final h = sin(dLat / 2) * sin(dLat / 2) +
        cos(rad(aLat)) * cos(rad(bLat)) * sin(dLng / 2) * sin(dLng / 2);
    return 2 * r * asin(min(1, sqrt(h)));
  }
}
