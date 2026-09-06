import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

import 'package:patroli_mobile/core/antrean.dart';
import 'package:patroli_mobile/core/api.dart';
import 'package:patroli_mobile/core/sinkron.dart';

/// Pengganti jaringan: dapat dibuat "putus" sesuka kita, dan mencatat
/// permintaan yang sampai agar urutannya dapat diperiksa.
class JaringanTiruan implements HttpClientAdapter {
  bool putus = false;
  int tolakDengan = 0; // 0 = terima
  final List<String> diterima = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<List<int>>? body, Future? cancel) async {
    if (putus) {
      throw DioException(requestOptions: options, type: DioExceptionType.connectionError, message: 'putus');
    }
    diterima.add('${options.method} ${options.path}');
    if (tolakDengan != 0) {
      return ResponseBody.fromString(jsonEncode({'message': 'ditolak'}), tolakDengan,
          headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});
    }
    return ResponseBody.fromString(jsonEncode({'ok': true, 'url': '/storage/uji.jpg'}), 200,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late JaringanTiruan jaringan;

  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    // Sesi dan basis data disiapkan seperti pada perangkat sungguhan.
    SharedPreferences.setMockInitialValues({'patroli_token': 'token-uji'});
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  setUp(() async {
    jaringan = JaringanTiruan();
    Api.i.dio.httpClientAdapter = jaringan;
    await Antrean.i.kosongkan();
  });

  test('tanpa jaringan, tindakan disimpan dan tidak hilang', () async {
    jaringan.putus = true;
    final terkirim = await Api.i.kirimAtauAntre(
      jalur: '/patrols/S1/scan',
      isi: {'code': 'PATROLI:CP:A1', 'condition': 'AMAN'},
      label: 'Pemindaian titik A1',
    );
    expect(terkirim, isFalse, reason: 'tidak boleh mengaku terkirim saat jaringan mati');
    expect(await Antrean.i.jumlah(), 1);

    final antre = await Antrean.i.semua();
    expect(antre.first.label, 'Pemindaian titik A1');
    expect(antre.first.isi['code'], 'PATROLI:CP:A1');
    expect(antre.first.isi['offlineAt'], isNotNull,
        reason: 'waktu kejadian di lapangan harus ikut tersimpan');
  });

  test('antrean terkirim berurutan begitu jaringan pulih', () async {
    jaringan.putus = true;
    for (final kode in ['A1', 'A2', 'A3']) {
      await Api.i.kirimAtauAntre(
        jalur: '/patrols/S1/scan',
        isi: {'code': kode},
        label: 'Titik $kode',
      );
    }
    expect(await Antrean.i.jumlah(), 3);

    jaringan.putus = false;
    await Sinkron.i.kirimSemua();

    expect(await Antrean.i.jumlah(), 0, reason: 'antrean harus kosong setelah terkirim');
    expect(jaringan.diterima, [
      'POST /patrols/S1/scan',
      'POST /patrols/S1/scan',
      'POST /patrols/S1/scan',
    ]);
  });

  test('jaringan putus di tengah pengiriman tidak merusak urutan', () async {
    jaringan.putus = true;
    for (final kode in ['A1', 'A2']) {
      await Api.i.kirimAtauAntre(jalur: '/patrols/S1/scan', isi: {'code': kode}, label: 'Titik $kode');
    }

    // Pulih sebentar lalu putus lagi setelah satu kiriman berhasil.
    jaringan.putus = false;
    final asli = jaringan.diterima;
    Api.i.dio.interceptors.add(InterceptorsWrapper(onResponse: (r, h) {
      if (asli.length == 1) jaringan.putus = true;
      h.next(r);
    }));
    await Sinkron.i.kirimSemua();

    expect(await Antrean.i.jumlah(), 1, reason: 'sisa antrean harus tetap tersimpan');
    final sisa = await Antrean.i.semua();
    expect(sisa.first.isi['code'], 'A2', reason: 'yang tersisa harus yang belum terkirim');
    Api.i.dio.interceptors.removeLast();
  });

  test('penolakan server tidak menyumbat antrean selamanya', () async {
    jaringan.putus = true;
    await Api.i.kirimAtauAntre(jalur: '/patrols/S1/scan', isi: {'code': 'A1'}, label: 'Titik A1');
    await Api.i.kirimAtauAntre(jalur: '/patrols/S1/scan', isi: {'code': 'A2'}, label: 'Titik A2');

    jaringan.putus = false;
    jaringan.tolakDengan = 409; // mis. titik sudah dipindai rekan
    for (var i = 0; i < 3; i++) {
      await Sinkron.i.kirimSemua();
    }
    expect(await Antrean.i.jumlah(), 0,
        reason: 'catatan yang ditolak server dibuang setelah beberapa percobaan, bukan menyumbat');
  });

  test('penolakan server saat daring dilaporkan langsung, tidak diantre', () async {
    jaringan.tolakDengan = 422;
    await expectLater(
      Api.i.kirimAtauAntre(jalur: '/schedules/attendance/check-in', isi: {'siteId': 'X'}, label: 'Presensi'),
      throwsA(isA<ApiException>()),
    );
    expect(await Antrean.i.jumlah(), 0,
        reason: 'penolakan aturan (mis. di luar radius) harus diberitahukan, bukan disimpan diam-diam');
  });

  test('foto bukti ikut mengantre dan diunggah lebih dulu saat pulih', () async {
    final foto = File('${Directory.systemTemp.path}/uji-bukti.jpg')
      ..writeAsBytesSync(List.filled(64, 7));

    jaringan.putus = true;
    await Api.i.kirimAtauAntre(
      jalur: '/incidents',
      isi: {'title': 'Uji', 'mediaUrls': <String>[]},
      label: 'Laporan insiden',
      berkas: foto,
      folderBerkas: 'insiden',
      kolomBerkas: 'mediaUrls[]',
    );
    final antre = await Antrean.i.semua();
    expect(antre.first.berkas, isNotNull, reason: 'foto harus disalin agar tidak hilang');

    jaringan.putus = false;
    await Sinkron.i.kirimSemua();
    expect(jaringan.diterima.first, contains('/uploads'),
        reason: 'foto diunggah lebih dulu, baru laporannya');
    expect(jaringan.diterima.last, 'POST /incidents');
    expect(await Antrean.i.jumlah(), 0);
  });

  test('foto dari kamera diantre dari memori, tanpa berkas sementara', () async {
    // Jalur yang sebenarnya dipakai aplikasi sejak foto bukti bertanda air:
    // gambarnya tidak pernah menyentuh penyimpanan, jadi yang diantre adalah
    // isinya. Berkas hanya lahir bila memang harus menunggu jaringan.
    final isi = Uint8List.fromList(List.filled(128, 42));

    jaringan.putus = true;
    await Api.i.kirimAtauAntre(
      jalur: '/patrols/x/scan',
      isi: {'checkpointId': 'cp-1'},
      label: 'Pemindaian titik',
      isiBerkas: isi,
      folderBerkas: 'patroli',
      kolomBerkas: 'photoUrl',
    );

    final antre = await Antrean.i.semua();
    expect(antre.length, 1);
    final jalurBerkas = antre.first.berkas;
    expect(jalurBerkas, isNotNull, reason: 'isi foto harus ditulis agar tidak hilang');
    expect(File(jalurBerkas!).existsSync(), isTrue);
    expect(File(jalurBerkas).readAsBytesSync().length, isi.length,
        reason: 'isinya harus tersimpan utuh');

    jaringan.putus = false;
    await Sinkron.i.kirimSemua();
    expect(jaringan.diterima.first, contains('/uploads'),
        reason: 'foto diunggah lebih dulu, baru pemindaiannya');
    expect(await Antrean.i.jumlah(), 0);
    expect(File(jalurBerkas).existsSync(), isFalse,
        reason: 'berkas antrean harus hilang setelah terkirim — tidak ada yang tertinggal di ponsel');
  });
}
