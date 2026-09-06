import 'dart:async';
import 'dart:math';

import 'package:sensors_plus/sensors_plus.dart';

/// Pengawas anggota yang bertugas sendirian (lone worker).
///
/// Selama berstatus masuk, percepatan perangkat dipantau. Bila tidak ada
/// gerakan berarti selama ambang waktu tertentu, aplikasi bertanya lebih dulu;
/// bila pertanyaan itu pun tidak dijawab, sinyal darurat MAN_DOWN dikirim.
///
/// Batasan yang harus diketahui: pemantauan hanya berjalan selama aplikasi
/// masih hidup di layar. Android menghentikan sensor bagi aplikasi yang
/// dilatarbelakangkan tanpa layanan latar depan; menambahkannya adalah
/// pekerjaan tersendiri yang belum dilakukan.
class PengawasGerak {
  PengawasGerak._();
  static final PengawasGerak i = PengawasGerak._();

  /// Selisih percepatan (m/s²) dari gravitasi yang dianggap sebagai gerakan.
  static const ambangGerak = 0.9;

  /// Lama diam sebelum aplikasi bertanya.
  Duration ambangDiam = const Duration(minutes: 20);

  /// Lama menunggu jawaban sebelum sinyal dikirim.
  Duration tenggangJawab = const Duration(seconds: 60);

  StreamSubscription<AccelerometerEvent>? _langganan;
  Timer? _pemeriksa;
  DateTime _gerakTerakhir = DateTime.now();
  bool _sedangBertanya = false;

  /// Dipanggil saat anggota dicurigai tidak bergerak.
  void Function()? onDiam;

  bool get berjalan => _langganan != null;
  Duration get diamSelama => DateTime.now().difference(_gerakTerakhir);

  void mulai() {
    if (_langganan != null) return;
    _gerakTerakhir = DateTime.now();
    _sedangBertanya = false;

    _langganan = accelerometerEventStream(samplingPeriod: const Duration(milliseconds: 500)).listen(
      (e) {
        // Besar vektor percepatan; saat diam nilainya mendekati gravitasi.
        final besar = sqrt(e.x * e.x + e.y * e.y + e.z * e.z);
        if ((besar - 9.81).abs() > ambangGerak) _gerakTerakhir = DateTime.now();
      },
      onError: (_) {
        // Perangkat tanpa akselerometer: pengawasan dimatikan diam-diam,
        // fitur lain tidak boleh ikut terganggu.
        henti();
      },
      cancelOnError: true,
    );

    _pemeriksa = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_sedangBertanya) return;
      if (DateTime.now().difference(_gerakTerakhir) >= ambangDiam) {
        _sedangBertanya = true;
        onDiam?.call();
      }
    });
  }

  /// Dipanggil setelah anggota menjawab bahwa ia baik-baik saja.
  void tandaiAman() {
    _gerakTerakhir = DateTime.now();
    _sedangBertanya = false;
  }

  void henti() {
    _langganan?.cancel();
    _langganan = null;
    _pemeriksa?.cancel();
    _pemeriksa = null;
    _sedangBertanya = false;
  }
}
