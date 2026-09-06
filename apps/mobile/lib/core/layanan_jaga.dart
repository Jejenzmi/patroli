import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

/// Layanan latar depan yang menjaga aplikasi tetap hidup selama bertugas.
///
/// Tanpa ini, Android membekukan proses aplikasi begitu layar terkunci atau
/// ponsel masuk saku: pengiriman jejak lokasi berhenti, pengawas gerak
/// berhenti membaca sensor, dan pemberitahuan tidak pernah sampai. Untuk
/// aplikasi jaga hal itu berarti sistem berhenti tepat pada saat anggota
/// benar-benar sedang berjaga.
///
/// Layanan dinyalakan saat presensi masuk dan dimatikan saat presensi pulang,
/// bukan sepanjang hari. Selama menyala, pemberitahuan tetapnya terlihat di
/// bilah status — anggota selalu tahu aplikasi sedang memantau, dan itu
/// memang seharusnya terlihat.
///
/// Jenis layanan yang dipakai adalah `location`, sehingga aplikasi boleh
/// membaca posisi selama layanan hidup **tanpa** meminta izin lokasi latar
/// belakang. Pilihan ini disengaja: izin itu memberi akses jauh lebih luas
/// daripada yang diperlukan, dan menuntut deklarasi tambahan di Google Play.
class LayananJaga {
  LayananJaga._();
  static final LayananJaga i = LayananJaga._();

  bool _siap = false;

  void _siapkan() {
    if (_siap) return;
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'dharmapati_jaga',
        channelName: 'Status Jaga',
        channelDescription:
            'Menjaga presensi, jejak patroli, dan tombol darurat tetap bekerja selama Anda bertugas.',
        channelImportance: NotificationChannelImportance.LOW,
        priority: NotificationPriority.LOW,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: false,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(60000),
        autoRunOnBoot: false,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
    _siap = true;
  }

  /// Dinyalakan setelah presensi masuk diterima server.
  Future<void> mulai({required String site, required String shift}) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      _siapkan();

      // Android 13 ke atas menuntut izin pemberitahuan sebelum layanan boleh
      // menampilkan status tetapnya.
      if (!await FlutterForegroundTask.checkNotificationPermission().then(
        (v) => v == NotificationPermission.granted,
      )) {
        await FlutterForegroundTask.requestNotificationPermission();
      }

      if (await FlutterForegroundTask.isRunningService) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'Sedang bertugas · $shift',
          notificationText: site,
        );
        return;
      }

      await FlutterForegroundTask.startService(
        notificationTitle: 'Sedang bertugas · $shift',
        notificationText: site,
        callback: _mulaiTugasLatar,
      );
    } catch (e) {
      debugPrint('[jaga] gagal menyalakan layanan: $e');
    }
  }

  /// Dimatikan setelah presensi pulang.
  Future<void> hentikan() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      if (await FlutterForegroundTask.isRunningService) {
        await FlutterForegroundTask.stopService();
      }
    } catch (e) {
      debugPrint('[jaga] gagal menghentikan layanan: $e');
    }
  }

  /// Menyesuaikan keterangan pada pemberitahuan tetap, mis. saat ronde mulai.
  Future<void> perbaruiKeterangan(String teks) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      if (await FlutterForegroundTask.isRunningService) {
        await FlutterForegroundTask.updateService(notificationText: teks);
      }
    } catch (_) {}
  }
}

@pragma('vm:entry-point')
void _mulaiTugasLatar() {
  FlutterForegroundTask.setTaskHandler(_TugasJaga());
}

/// Denyut layanan.
///
/// Pekerjaan sesungguhnya — kirim jejak, baca sensor — tetap berjalan di
/// isolate utama aplikasi, yang justru tetap hidup karena layanan ini ada.
/// Penangan ini hanya menjaga denyutnya dan memperbarui keterangan waktu.
class _TugasJaga extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {}

  @override
  void onRepeatEvent(DateTime timestamp) {}

  @override
  Future<void> onDestroy(DateTime timestamp) async {}
}
