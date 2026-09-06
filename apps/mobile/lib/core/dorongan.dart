import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api.dart';

/// Pemberitahuan dorong.
///
/// Layanan latar depan menjaga aplikasi hidup selama shift — tetapi hanya
/// selama shift. Sinyal darurat pukul dua pagi harus tetap membangunkan
/// ponsel pengawas yang aplikasinya tertutup penuh, bahkan ponsel yang baru
/// selesai dinyalakan ulang. Yang membangunkannya bukan aplikasi ini,
/// melainkan layanan Google yang memang selalu berjalan.
///
/// Dua kanal dipisah dengan sengaja. Pemberitahuan darurat berbunyi nyaring
/// dan menembus tampilan apa pun; pemberitahuan biasa tidak, supaya anggota
/// tidak berhenti memperhatikan keduanya.
class Dorongan {
  Dorongan._();
  static final Dorongan i = Dorongan._();

  static const _kanalDarurat = AndroidNotificationChannel(
    'dharmapati_darurat',
    'Sinyal Darurat',
    description: 'Tombol darurat dan kejadian yang menuntut tindakan segera.',
    importance: Importance.max,
    enableVibration: true,
    playSound: true,
  );

  static const _kanalUmum = AndroidNotificationChannel(
    'dharmapati_umum',
    'Pemberitahuan',
    description: 'Tugas, instruksi, pengumuman, jadwal, dan slip gaji.',
    importance: Importance.high,
  );

  final _lokal = FlutterLocalNotificationsPlugin();
  bool _siap = false;

  /// Dipanggil sekali sebelum aplikasi berjalan.
  Future<void> siapkan() async {
    if (_siap || kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await Firebase.initializeApp();

      final android = _lokal
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await android?.createNotificationChannel(_kanalDarurat);
      await android?.createNotificationChannel(_kanalUmum);
      await _lokal.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        ),
      );

      // Android 13 ke atas: pemberitahuan harus diizinkan lebih dulu.
      await FirebaseMessaging.instance.requestPermission();

      // Pesan yang tiba saat aplikasi sedang dibuka tidak ditampilkan sistem,
      // jadi digambar sendiri agar anggota tetap melihatnya.
      FirebaseMessaging.onMessage.listen(_tampilkan);

      FirebaseMessaging.onBackgroundMessage(_penanganLatar);
      _siap = true;
    } catch (e) {
      debugPrint('[dorongan] gagal disiapkan: $e');
    }
  }

  Future<void> _tampilkan(RemoteMessage pesan) async {
    final n = pesan.notification;
    if (n == null) return;
    final darurat = pesan.data['kanal'] == 'darurat';
    final kanal = darurat ? _kanalDarurat : _kanalUmum;
    await _lokal.show(
      pesan.hashCode,
      n.title,
      n.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          kanal.id,
          kanal.name,
          channelDescription: kanal.description,
          importance: darurat ? Importance.max : Importance.high,
          priority: darurat ? Priority.max : Priority.high,
          category: darurat ? AndroidNotificationCategory.alarm : null,
          styleInformation: BigTextStyleInformation(n.body ?? ''),
        ),
      ),
    );
  }

  /// Mendaftarkan token perangkat ke server. Dipanggil setiap kali masuk.
  ///
  /// Token dapat berubah sendiri — pemasangan ulang aplikasi, pemulihan
  /// cadangan, atau pembersihan data — jadi perubahannya ikut dipantau.
  Future<void> daftarkan() async {
    if (!_siap) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await Api.i.post('/auth/device-token', {'token': token});
      FirebaseMessaging.instance.onTokenRefresh.listen((t) {
        Api.i.post('/auth/device-token', {'token': t}).catchError((_) => null);
      });
    } catch (e) {
      debugPrint('[dorongan] gagal mendaftarkan token: $e');
    }
  }

  /// Dipanggil saat keluar: ponsel yang sudah bukan miliknya tidak boleh lagi
  /// menerima pemberitahuan tugas orang lain.
  Future<void> lepas() async {
    try {
      await Api.i.post('/auth/device-token', {'token': ''});
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }
}

/// Penangan pesan saat aplikasi tertutup. Harus berupa fungsi tingkat atas.
///
/// Tidak menggambar apa pun: pesan yang membawa bagian `notification`
/// ditampilkan sendiri oleh Android, dan menggambarnya lagi di sini akan
/// memunculkan dua pemberitahuan untuk satu kejadian.
@pragma('vm:entry-point')
Future<void> _penanganLatar(RemoteMessage pesan) async {}
