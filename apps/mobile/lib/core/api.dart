import 'dart:io';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
      if (r.statusCode! >= 400) {
        throw ApiException(
          (r.data is Map ? r.data['message'] : null) ?? 'Permintaan gagal (${r.statusCode})',
          r.statusCode!,
        );
      }
      return r.data;
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
        throw ApiException('Tidak dapat terhubung ke server. Periksa koneksi Anda.', 0);
      }
      throw ApiException(e.message ?? 'Kesalahan jaringan', 0);
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) =>
      _unwrap(dio.get(path, queryParameters: query));

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
