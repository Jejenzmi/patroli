import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'sinkron.dart';

/// Alamat server. Ganti lewat --dart-define=API_BASE saat build bila perlu.
const kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://patroli.gokar.id',
);

class Api {
  Api._();
  static final Api i = Api._();

  late final Dio dio = Dio(
    BaseOptions(
      baseUrl: '$kApiBase/api',
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
      validateStatus: (s) => s != null && s < 500,
    ),
  )..interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await Session.token();
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
      ),
    );

  /// Membungkus respons agar penanganan galat seragam di seluruh aplikasi.
  Future<dynamic> _unwrap(Future<Response> f) async {
    try {
      final r = await f;
      Sinkron.i.tandaiJaringanPulih();
      if (r.statusCode! >= 400) {
        throw ApiException(
          (r.data is Map ? r.data['message'] : null) ?? 'Permintaan gagal (${r.statusCode})',
          r.statusCode!,
        );
      }
      return r.data;
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        Sinkron.i.tandaiJaringanBermasalah();
        throw ApiException('Tidak dapat terhubung ke server. Periksa koneksi Anda.', 0);
      }
      Sinkron.i.tandaiJaringanBermasalah();
      throw ApiException(e.message ?? 'Kesalahan jaringan', 0);
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _unwrap(dio.get(path, queryParameters: query));

  /// Bacaan yang disinggahkan agar layar tetap terisi di area tanpa sinyal.
  ///
  /// Jawaban terakhir yang berhasil disimpan di perangkat; bila jaringan
  /// hilang, isi itulah yang ditampilkan, disertai penanda bahwa data mungkin
  /// tidak lagi mutakhir.
  Future<dynamic> getSinggah(String path, {Map<String, dynamic>? query}) async {
    final kunci = 'singgah:$path';
    try {
      final r = await get(path, query: query);
      final p = await SharedPreferences.getInstance();
      await p.setString(kunci, jsonEncode({'pada': DateTime.now().toIso8601String(), 'isi': r}));
      return r;
    } on ApiException catch (e) {
      if (e.status != 0) rethrow;
      final p = await SharedPreferences.getInstance();
      final simpanan = p.getString(kunci);
      if (simpanan == null) rethrow;
      return (jsonDecode(simpanan) as Map<String, dynamic>)['isi'];
    }
  }

  /// Waktu singgahan sebuah jalur terakhir diperbarui.
  static Future<DateTime?> waktuSinggahan(String path) async {
    final p = await SharedPreferences.getInstance();
    final s = p.getString('singgah:$path');
    if (s == null) return null;
    return DateTime.tryParse((jsonDecode(s) as Map<String, dynamic>)['pada'] as String? ?? '');
  }

  /// Mengirim tindakan; bila jaringan tidak ada, tindakan disimpan di
  /// perangkat dan dikirim sendiri begitu sinyal kembali.
  ///
  /// Mengembalikan `true` bila terkirim langsung, `false` bila mengantre.
  Future<bool> kirimAtauAntre({
    required String jalur,
    required Map<String, dynamic> isi,
    required String label,
    String metode = 'POST',
    File? berkas,
    String? folderBerkas,
    String? kolomBerkas,
  }) async {
    final muatan = Map<String, dynamic>.from(isi)
      ..putIfAbsent('offlineAt', () => DateTime.now().toIso8601String());
    try {
      if (berkas != null && kolomBerkas != null) {
        final url = await upload(berkas, folder: folderBerkas ?? 'antrean');
        if (kolomBerkas.endsWith('[]')) {
          final kunci = kolomBerkas.substring(0, kolomBerkas.length - 2);
          muatan[kunci] = [...List<String>.from(muatan[kunci] as List? ?? const []), url];
        } else {
          muatan[kolomBerkas] = url;
        }
      }
      if (metode == 'PUT') {
        await put(jalur, muatan);
      } else {
        await post(jalur, muatan);
      }
      return true;
    } on ApiException catch (e) {
      if (e.status != 0) rethrow; // Ditolak server — bukan urusan jaringan.
      await Sinkron.i.antre(
        metode: metode,
        jalur: jalur,
        isi: muatan,
        label: label,
        berkas: berkas,
        folderBerkas: folderBerkas,
        kolomBerkas: kolomBerkas,
      );
      return false;
    }
  }

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) => _unwrap(dio.post(path, data: body));

  Future<dynamic> put(String path, [Map<String, dynamic>? body]) => _unwrap(dio.put(path, data: body));

  Future<String> upload(File file, {String folder = 'mobile'}) async {
    final form = FormData.fromMap({
      'folder': folder,
      'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
    });
    final r = await _unwrap(dio.post('/uploads', data: form));
    return r['url'] as String;
  }
}

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, this.status);
  @override
  String toString() => message;
}

/// Penyimpanan sesi di perangkat.
class Session {
  static const _kToken = 'patroli_token';
  static const _kUser = 'patroli_user';

  static Future<String?> token() async =>
      (await SharedPreferences.getInstance()).getString(_kToken);

  static Future<void> save(String token, String userJson) async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kToken, token);
    await p.setString(_kUser, userJson);
  }

  static Future<String?> userJson() async =>
      (await SharedPreferences.getInstance()).getString(_kUser);

  static Future<void> clear() async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_kToken);
    await p.remove(_kUser);
  }
}
