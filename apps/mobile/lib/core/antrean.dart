import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// Satu tindakan lapangan yang menunggu giliran dikirim.
class ItemAntrean {
  final int id;
  final String metode;
  final String jalur;
  final Map<String, dynamic> isi;

  /// Berkas yang harus diunggah lebih dulu (foto bukti, swafoto presensi).
  final String? berkas;
  final String? folderBerkas;

  /// Nama kolom pada isi yang diisi URL hasil unggahan. Akhiran `[]`
  /// berarti URL ditambahkan ke sebuah daftar, bukan menimpa satu nilai.
  final String? kolomBerkas;

  /// Keterangan singkat untuk ditampilkan kepada pengguna.
  final String label;
  final DateTime dibuat;
  final int percobaan;
  final String? galat;

  ItemAntrean({
    required this.id,
    required this.metode,
    required this.jalur,
    required this.isi,
    required this.label,
    required this.dibuat,
    this.berkas,
    this.folderBerkas,
    this.kolomBerkas,
    this.percobaan = 0,
    this.galat,
  });

  factory ItemAntrean.dariBaris(Map<String, Object?> r) => ItemAntrean(
        id: r['id'] as int,
        metode: r['metode'] as String,
        jalur: r['jalur'] as String,
        isi: jsonDecode(r['isi'] as String) as Map<String, dynamic>,
        berkas: r['berkas'] as String?,
        folderBerkas: r['folder'] as String?,
        kolomBerkas: r['kolom'] as String?,
        label: r['label'] as String,
        dibuat: DateTime.parse(r['dibuat'] as String),
        percobaan: (r['percobaan'] as int?) ?? 0,
        galat: r['galat'] as String?,
      );
}

/// Penyimpanan tindakan yang belum terkirim.
///
/// Di area tanpa sinyal — basement, gudang berdinding logam, perkebunan —
/// petugas tetap harus dapat memindai titik, mencatat tamu, dan melapor.
/// Semua tindakan disimpan berurutan di perangkat, lalu dikirim apa adanya
/// begitu jaringan pulih. Urutan dijaga karena pemindaian titik dan presensi
/// bermakna hanya bila runtutannya benar.
class Antrean {
  Antrean._();
  static final Antrean i = Antrean._();

  Database? _db;

  /// Penyimpanan cadangan bila basis data tidak tersedia (mis. pratinjau web
  /// yang dipakai untuk pemeriksaan tampilan). Antrean tetap berjalan, hanya
  /// tidak bertahan setelah aplikasi ditutup — dan yang terpenting, kegagalan
  /// penyimpanan tidak boleh menjatuhkan aplikasi di tangan petugas.
  final List<Map<String, Object?>> _memori = [];
  int _nomor = 0;
  bool _tanpaDb = false;

  Future<Database?> get db async {
    if (_db != null) return _db;
    if (_tanpaDb) return null;
    try {
      final dir = await getDatabasesPath();
      _db = await openDatabase(
        p.join(dir, 'patroli_antrean.db'),
        version: 1,
        onCreate: (d, _) => d.execute('''
          CREATE TABLE antrean (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metode TEXT NOT NULL,
            jalur TEXT NOT NULL,
            isi TEXT NOT NULL,
            berkas TEXT,
            folder TEXT,
            kolom TEXT,
            label TEXT NOT NULL,
            dibuat TEXT NOT NULL,
            percobaan INTEGER NOT NULL DEFAULT 0,
            galat TEXT
          )
        '''),
      );
      return _db;
    } catch (_) {
      _tanpaDb = true;
      return null;
    }
  }

  /// Menyalin foto ke folder aplikasi supaya tidak hilang saat sistem
  /// membersihkan berkas sementara kamera sebelum sempat terkirim.
  Future<String?> simpanBerkas(File? sumber) async {
    if (sumber == null) return null;
    try {
      if (!await sumber.exists()) return null;
      final dir = await getApplicationDocumentsDirectory();
      final tujuan = Directory(p.join(dir.path, 'antrean'));
      if (!await tujuan.exists()) await tujuan.create(recursive: true);
      final nama = '${DateTime.now().microsecondsSinceEpoch}${p.extension(sumber.path)}';
      final salinan = await sumber.copy(p.join(tujuan.path, nama));
      return salinan.path;
    } catch (_) {
      return sumber.path;
    }
  }

  /// Menulis foto dari memori ke ruang privat aplikasi.
  ///
  /// Hanya dipakai saat tidak ada jaringan: foto bukti tidak boleh hilang
  /// hanya karena sinyal sedang mati. Berkasnya dihapus begitu kiriman
  /// berhasil, dan tidak pernah masuk galeri ponsel.
  Future<String?> simpanIsi(Uint8List isi) async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final tujuan = Directory(p.join(dir.path, 'antrean'));
      if (!await tujuan.exists()) await tujuan.create(recursive: true);
      final berkas = File(p.join(tujuan.path, '${DateTime.now().microsecondsSinceEpoch}.jpg'));
      await berkas.writeAsBytes(isi, flush: true);
      return berkas.path;
    } catch (_) {
      return null;
    }
  }

  Future<int> tambah({
    required String metode,
    required String jalur,
    required Map<String, dynamic> isi,
    required String label,
    String? berkas,
    String? folderBerkas,
    String? kolomBerkas,
  }) async {
    final baris = <String, Object?>{
      'metode': metode,
      'jalur': jalur,
      'isi': jsonEncode(isi),
      'berkas': berkas,
      'folder': folderBerkas,
      'kolom': kolomBerkas,
      'label': label,
      'dibuat': DateTime.now().toIso8601String(),
      'percobaan': 0,
    };
    final d = await db;
    if (d == null) {
      _memori.add({...baris, 'id': ++_nomor});
      return _nomor;
    }
    return d.insert('antrean', baris);
  }

  Future<List<ItemAntrean>> semua({int batas = 200}) async {
    final d = await db;
    if (d == null) return _memori.take(batas).map(ItemAntrean.dariBaris).toList();
    final r = await d.query('antrean', orderBy: 'id ASC', limit: batas);
    return r.map(ItemAntrean.dariBaris).toList();
  }

  Future<int> jumlah() async {
    final d = await db;
    if (d == null) return _memori.length;
    return Sqflite.firstIntValue(await d.rawQuery('SELECT COUNT(*) FROM antrean')) ?? 0;
  }

  Future<void> hapus(int id) async {
    final d = await db;
    if (d == null) {
      _memori.removeWhere((b) => b['id'] == id);
      return;
    }
    final baris = await d.query('antrean', where: 'id = ?', whereArgs: [id], limit: 1);
    if (baris.isNotEmpty) {
      final berkas = baris.first['berkas'] as String?;
      if (berkas != null) {
        try {
          final f = File(berkas);
          if (await f.exists()) await f.delete();
        } catch (_) {}
      }
    }
    await d.delete('antrean', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> tandaiGagal(int id, String galat) async {
    final d = await db;
    if (d == null) {
      for (final b in _memori) {
        if (b['id'] == id) {
          b['percobaan'] = ((b['percobaan'] as int?) ?? 0) + 1;
          b['galat'] = galat;
        }
      }
      return;
    }
    await d.rawUpdate(
      'UPDATE antrean SET percobaan = percobaan + 1, galat = ? WHERE id = ?',
      [galat, id],
    );
  }

  Future<void> kosongkan() async {
    final d = await db;
    if (d == null) {
      _memori.clear();
      return;
    }
    final baris = await d.query('antrean');
    for (final b in baris) {
      final berkas = b['berkas'] as String?;
      if (berkas == null) continue;
      try {
        final f = File(berkas);
        if (await f.exists()) await f.delete();
      } catch (_) {}
    }
    await d.delete('antrean');
  }
}
