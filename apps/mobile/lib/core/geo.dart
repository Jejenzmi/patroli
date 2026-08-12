import 'dart:math';
import 'package:geolocator/geolocator.dart';

/// Layanan lokasi: izin, posisi terkini, dan hitung jarak.
class Geo {
  static Future<Position> current({bool highAccuracy = true}) async {
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
    return Geolocator.getCurrentPosition(
      locationSettings: LocationSettings(
        accuracy: highAccuracy ? LocationAccuracy.best : LocationAccuracy.medium,
        timeLimit: const Duration(seconds: 25),
      ),
    );
  }

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
