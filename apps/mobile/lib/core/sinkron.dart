import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:connectivity_plus/connectivity_plus.dart';

import 'antrean.dart';
import 'api.dart';

/// Keadaan sinkronisasi yang ditampilkan kepada pengguna.
class StatusSinkron {
  final bool daring;
  final int menunggu;
  final bool sedangKirim;
  final String? galat;
  final DateTime? terakhirBerhasil;

  const StatusSinkron({
    this.daring = true,
    this.menunggu = 0,
    this.sedangKirim = false,
    this.galat,
    this.terakhirBerhasil,
  });

  StatusSinkron salin({
    bool? daring,
    int? menunggu,
    bool? sedangKirim,
    String? galat,
    bool hapusGalat = false,
    DateTime? terakhirBerhasil,
  }) =>
      StatusSinkron(
        daring: daring ?? this.daring,
        menunggu: menunggu ?? this.menunggu,
        sedangKirim: sedangKirim ?? this.sedangKirim,
        // Keterangan galat dipertahankan sampai benar-benar dihapus; bila
        // ikut hilang pada setiap pembaruan, sebab kegagalan tidak akan
        // pernah terbaca — baik oleh petugas maupun saat penelusuran.
        galat: hapusGalat ? null : (galat ?? this.galat),
        terakhirBerhasil: terakhirBerhasil ?? this.terakhirBerhasil,
      );
}

/// Pengirim ulang tindakan yang sempat tertahan tanpa jaringan.
///
/// Dijalankan begitu jaringan tersambung kembali, dan diulang berkala sebagai
/// jaring pengaman bila pemberitahuan sistem operasi terlewat. Antrean dikirim
/// berurutan: satu kegagalan jaringan menghentikan giliran agar urutan
/// pemindaian tidak tertukar.
class Sinkron {
  Sinkron._();
  static final Sinkron i = Sinkron._();

  final _pengendali = StreamController<StatusSinkron>.broadcast();
  Stream<StatusSinkron> get aliran => _pengendali.stream;
  StatusSinkron status = const StatusSinkron();

  Timer? _berkala;
  StreamSubscription? _langganan;
  bool _jalan = false;

  Future<void> mulai() async {
    try {
      await _mulaiSebenarnya();
    } catch (e) {
      // Kegagalan penyiapan penyinkron tidak boleh menghalangi petugas
      // membuka aplikasi; pengiriman ulang dicoba lagi pada giliran berikutnya.
      _berkala ??= Timer.periodic(const Duration(seconds: 60), (_) => kirimSemua());
    }
  }

  Future<void> _mulaiSebenarnya() async {
    await _perbaruiJumlah();
    _langganan = Connectivity().onConnectivityChanged.listen((hasil) {
      final daring = hasil.any((h) => h != ConnectivityResult.none);
      _pancar(status.salin(daring: daring));
      if (daring) kirimSemua();
    });
    try {
      final awal = await Connectivity().checkConnectivity();
      _pancar(status.salin(daring: awal.any((h) => h != ConnectivityResult.none)));
    } catch (_) {}
    _berkala = Timer.periodic(const Duration(seconds: 45), (_) => kirimSemua());
    kirimSemua();
  }

  void hentikan() {
    _berkala?.cancel();
    _langganan?.cancel();
  }

  void _pancar(StatusSinkron s) {
    status = s;
    if (!_pengendali.isClosed) _pengendali.add(s);
  }

  /// Dipanggil ketika sebuah permintaan gagal karena jaringan.
  ///
  /// Indikator sistem operasi saja tidak cukup: ponsel yang tersambung Wi-Fi
  /// tanpa jalur keluar, atau sinyal seluler satu batang di basement, tetap
  /// dilaporkan "tersambung". Yang menentukan adalah apakah server benar-benar
  /// dapat dihubungi.
  void tandaiJaringanBermasalah() {
    if (status.daring) _pancar(status.salin(daring: false));
  }

  /// Dipanggil setelah sebuah permintaan berhasil.
  void tandaiJaringanPulih() {
    if (!status.daring) {
      _pancar(status.salin(daring: true, hapusGalat: true));
      kirimSemua();
    }
  }

  Future<void> _perbaruiJumlah() async {
    _pancar(status.salin(menunggu: await Antrean.i.jumlah()));
  }

  /// Menaruh tindakan ke antrean. Dipakai baik saat sedang luring maupun saat
  /// pengiriman langsung gagal karena jaringan.
  Future<void> antre({
    required String metode,
    required String jalur,
    required Map<String, dynamic> isi,
    required String label,
    File? berkas,
    Uint8List? isiBerkas,
    String? folderBerkas,
    String? kolomBerkas,
  }) async {
    final salinan = isiBerkas != null
        ? await Antrean.i.simpanIsi(isiBerkas)
        : await Antrean.i.simpanBerkas(berkas);
    await Antrean.i.tambah(
      metode: metode,
      jalur: jalur,
      isi: isi,
      label: label,
      berkas: salinan,
      folderBerkas: folderBerkas,
      kolomBerkas: kolomBerkas,
    );
    await _perbaruiJumlah();
  }

  /// Mengosongkan antrean secara berurutan. Aman dipanggil berkali-kali.
  Future<void> kirimSemua() async {
    if (_jalan) return;
    _jalan = true;
    try {
      var item = await Antrean.i.semua();
      if (item.isEmpty) {
        _pancar(status.salin(menunggu: 0));
        return;
      }
      _pancar(status.salin(sedangKirim: true, menunggu: item.length));

      for (final it in item) {
        try {
          final isi = Map<String, dynamic>.from(it.isi);

          // Foto diunggah lebih dulu, lalu URL-nya dipasang pada isian.
          if (it.berkas != null && it.kolomBerkas != null) {
            final f = File(it.berkas!);
            if (await f.exists()) {
              final url = await Api.i.upload(f, folder: it.folderBerkas ?? 'antrean');
              if (it.kolomBerkas!.endsWith('[]')) {
                final kunci = it.kolomBerkas!.substring(0, it.kolomBerkas!.length - 2);
                final daftar = List<String>.from(isi[kunci] as List? ?? const []);
                daftar.add(url);
                isi[kunci] = daftar;
              } else {
                isi[it.kolomBerkas!] = url;
              }
            }
          }

          if (it.metode == 'PUT') {
            await Api.i.put(it.jalur, isi);
          } else {
            await Api.i.post(it.jalur, isi);
          }
          await Antrean.i.hapus(it.id);
          _pancar(status.salin(
            menunggu: await Antrean.i.jumlah(),
            terakhirBerhasil: DateTime.now(),
            hapusGalat: true,
          ));
        } on ApiException catch (e) {
          if (e.status == 0) {
            // Jaringan putus lagi: hentikan giliran, urutan tetap terjaga.
            _pancar(status.salin(daring: false, sedangKirim: false, galat: e.message));
            return;
          }
          if (e.status == 401) {
            // Sesi kedaluwarsa: tunggu pengguna masuk lagi, jangan buang data.
            _pancar(status.salin(sedangKirim: false, galat: 'Sesi berakhir, masuk kembali untuk mengirim'));
            return;
          }
          // Ditolak server (mis. titik sudah dipindai orang lain, atau sudah
          // presensi). Menahannya di antrean hanya akan menyumbat; dibuang
          // sambil dicatat supaya pengguna tahu apa yang tidak jadi terkirim.
          await Antrean.i.tandaiGagal(it.id, e.message);
          if (it.percobaan >= 2) {
            await Antrean.i.hapus(it.id);
            _pancar(status.salin(
              menunggu: await Antrean.i.jumlah(),
              galat: '${it.label}: ${e.message}',
            ));
          }
        } catch (e) {
          _pancar(status.salin(sedangKirim: false, galat: '$e'));
          return;
        }
      }
    } finally {
      _jalan = false;
      _pancar(status.salin(sedangKirim: false, menunggu: await Antrean.i.jumlah()));
    }
  }

  Future<List<ItemAntrean>> daftarTertunda() => Antrean.i.semua();
}
