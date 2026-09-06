import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';

import '../core/api.dart';
import '../core/geo.dart';
import '../core/theme.dart';
import '../blocs/duty_bloc.dart';
import '../models/models.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

class PatrolScreen extends StatelessWidget {
  const PatrolScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocBuilder<DutyBloc, DutyState>(
        builder: (context, state) {
          return Column(
            children: [
              GradientHeader(
                title: 'Patroli',
                subtitle: state.session == null
                    ? 'Pilih rute untuk memulai putaran'
                    : 'Putaran sedang berjalan — pindai setiap titik',
                accent: state.session == null ? P.amber : P.cyan,
                trailing: IconButton(
                  onPressed: () => context.read<DutyBloc>().add(DutyRefreshed()),
                  icon: const Icon(Icons.refresh, size: 20, color: P.muted),
                ),
              ),
              Expanded(
                child: state.session == null
                    ? _RouteChooser(state: state)
                    : _ActivePatrol(state: state, busy: state.loading),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Penanda hari untuk kartu rute: jadwal besok tidak boleh tampak seperti
/// jadwal hari ini.
String _hari(DateTime d) {
  final kini = DateTime.now();
  final t = DateTime(d.year, d.month, d.day);
  final ini = DateTime(kini.year, kini.month, kini.day);
  final selisih = t.difference(ini).inDays;
  if (selisih == 0) return 'hari ini';
  if (selisih == 1) return 'besok';
  if (selisih == -1) return 'kemarin';
  return DateFormat('d MMM', 'id').format(d);
}

/* ── Pilih rute untuk memulai patroli ── */

class _RouteChooser extends StatelessWidget {
  final DutyState state;
  const _RouteChooser({required this.state});

  @override
  Widget build(BuildContext context) {
    final withRoute = state.today.where((s) => s.route != null).toList();

    return RefreshIndicator(
      color: P.amber,
      backgroundColor: P.panel,
      onRefresh: () async => context.read<DutyBloc>().add(DutyRefreshed()),
      child: ListView(
        padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
        children: [IsiTerpusat(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          GlassCard(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Kicker('Mulai Putaran Patroli'),
                const SizedBox(height: 10),
                const Text(
                  'Pilih rute sesuai jadwal jaga Anda. Setiap titik diverifikasi lewat pemindaian QR/NFC dan koordinat GPS.',
                  style: TextStyle(color: P.muted, fontSize: 13, height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (!state.onDuty)
            GlassCard(
              border: P.amber.withOpacity(.35),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 16, color: P.amber),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Lakukan presensi masuk lebih dulu di tab Beranda sebelum memulai patroli.',
                      style: TextStyle(color: P.muted, fontSize: 12, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          if (!state.onDuty) const SizedBox(height: 16),
          if (withRoute.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Center(
                child: Column(
                  children: [
                    Icon(Icons.route_outlined, size: 36, color: P.muted),
                    SizedBox(height: 12),
                    Text('Belum ada rute patroli terjadwal hari ini',
                        style: TextStyle(color: P.muted, fontSize: 13)),
                  ],
                ),
              ),
            )
          else
            ...withRoute.map((s) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: GlassCard(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(s.route!.name,
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                            ),
                            StatusPill('${s.route!.checkpoints.length} titik', color: P.cyan),
                          ],
                        ),
                        const SizedBox(height: 4),
                        // Jadwal hari ini dan besok sama-sama ditampilkan agar
                        // shift yang melewati tengah malam tetap terlihat.
                        // Tanpa penanda hari, dua kartu bisa tampak kembar.
                        Text('${s.site.name} · shift ${s.shiftName} · ${_hari(s.date)}',
                            style: const TextStyle(color: P.muted, fontSize: 12)),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            StatusPill('${s.route!.expectedDurationMin} menit', color: P.amber, icon: Icons.timer_outlined),
                            if (s.route!.enforceOrder)
                              const StatusPill('Wajib urut', color: P.violet, icon: Icons.low_priority),
                            if (s.route!.requirePhoto)
                              const StatusPill('Wajib foto', color: P.emerald, icon: Icons.photo_camera_outlined),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: state.loading
                                ? null
                                : () async {
                                    final ok = await askConfirm(
                                      context,
                                      title: 'Mulai putaran patroli?',
                                      message:
                                          'Waktu mulai dicatat sekarang. Seluruh titik pada rute ini harus dipindai sebelum putaran ditutup.',
                                      detail:
                                          '${s.route!.name} · ${s.route!.checkpoints.length} titik · target ${s.route!.expectedDurationMin} menit',
                                      confirmLabel: 'Ya, mulai',
                                      tone: DialogTone.info,
                                    );
                                    if (ok && context.mounted) {
                                      context
                                          .read<DutyBloc>()
                                          .add(DutyPatrolStarted(s.route!.id, scheduleId: s.id));
                                    }
                                  },
                            icon: const Icon(Icons.play_arrow_rounded),
                            label: const Text('MULAI PATROLI'),
                          ),
                        ),
                      ],
                    ),
                  ),
                )),
        ]))],
      ),
    );
  }
}

/* ── Patroli sedang berjalan ── */

class _ActivePatrol extends StatelessWidget {
  final DutyState state;
  final bool busy;
  const _ActivePatrol({required this.state, required this.busy});

  PatrolSessionModel get session => state.session!;

  @override
  Widget build(BuildContext context) {
    final cps = session.route.checkpoints;
    // Kemajuan menghitung juga titik yang sudah dipindai namun catatannya
    // masih menunggu jaringan, supaya petugas tidak memindai ulang.
    final selesai = state.titikSelesai;
    final done = selesai.length;
    final next = cps.where((c) => !selesai.contains(c.id)).toList();

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [P.cyan.withOpacity(.14), P.abyss],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: const Border(bottom: BorderSide(color: P.line)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(session.route.name,
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                  ),
                  StatusPill('$done / ${cps.length}', color: P.cyan),
                  const SizedBox(width: 8),
                  // Aksi mengakhiri diletakkan di kepala layar, bukan di bawah,
                  // agar tidak bertumpuk dengan tombol pindai yang melayang.
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      foregroundColor: P.amber,
                      side: BorderSide(color: P.amber.withOpacity(.45)),
                    ),
                    onPressed: busy ? null : () => _akhiri(context, done, cps.length),
                    child: const Text('AKHIRI', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${session.site.name} · mulai ${DateFormat('HH:mm').format(session.startedAt.toLocal())}',
                style: const TextStyle(color: P.muted, fontSize: 12),
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: cps.isEmpty ? 0 : done / cps.length,
                  minHeight: 7,
                  backgroundColor: Colors.white10,
                  valueColor: const AlwaysStoppedAnimation(P.cyan),
                ),
              ),
            ],
          ),
        ),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
            children: [
              SizedBox(
                height: 190,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: FlutterMap(
                    options: MapOptions(
                      initialCenter: LatLng(cps.first.lat, cps.first.lng),
                      initialZoom: 15.5,
                      interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'id.gokar.patroli',
                      ),
                      MarkerLayer(
                        markers: cps.map((c) {
                          final ok = selesai.contains(c.id);
                          return Marker(
                            point: LatLng(c.lat, c.lng),
                            width: 30,
                            height: 30,
                            child: Container(
                              decoration: BoxDecoration(
                                color: P.panel,
                                shape: BoxShape.circle,
                                border: Border.all(color: ok ? P.emerald : P.muted, width: 2),
                              ),
                              child: Icon(ok ? Icons.check : Icons.circle_outlined,
                                  size: 14, color: ok ? P.emerald : P.muted),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Kicker('Urutan Titik Pemeriksaan'),
              const SizedBox(height: 12),
              ...cps.map((c) => _CheckpointTile(
                    cp: c,
                    scanned: selesai.contains(c.id),
                    tertunda: state.tertunda.contains(c.id),
                    isNext: next.isNotEmpty && next.first.id == c.id,
                    sessionId: session.id,
                    requirePhoto: session.route.requirePhoto,
                  )),
            ],
          ),
        ),

        // Petunjuk: pemindaian memakai tombol melayang di bilah bawah.
        Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: P.abyss,
            border: Border(top: BorderSide(color: P.line)),
          ),
          padding: EdgeInsets.fromLTRB(16, 12, 16, bottomInset(context) - 46),
          child: Row(
            children: [
              const Icon(Icons.qr_code_scanner, size: 15, color: P.amber),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  'Ketuk tombol pindai kuning di tengah bilah bawah untuk memindai titik.',
                  style: TextStyle(color: P.muted.withOpacity(.95), fontSize: 11.5, height: 1.35),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _akhiri(BuildContext context, int done, int total) async {
    final kurang = total - done;
    final ok = await askConfirm(
      context,
      title: 'Akhiri putaran patroli?',
      message: kurang > 0
          ? 'Masih ada $kurang titik yang belum dipindai dan akan tercatat sebagai terlewat pada laporan kepatuhan.'
          : 'Seluruh titik sudah dipindai. Putaran akan ditutup dan hasilnya dikirim ke pusat komando.',
      detail: '$done dari $total titik terpindai',
      confirmLabel: 'Ya, akhiri',
      tone: kurang > 0 ? DialogTone.warn : DialogTone.info,
    );
    if (ok && context.mounted) {
      context.read<DutyBloc>().add(DutyPatrolFinished(session.id));
    }
  }
}

class _CheckpointTile extends StatelessWidget {
  final Checkpoint cp;
  final bool scanned, isNext, requirePhoto;

  /// Sudah dipindai petugas tetapi catatannya masih menunggu jaringan.
  final bool tertunda;
  final String sessionId;

  const _CheckpointTile({
    required this.cp,
    required this.scanned,
    required this.isNext,
    required this.sessionId,
    required this.requirePhoto,
    this.tertunda = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: scanned ? P.emerald.withOpacity(.06) : P.panel.withOpacity(.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: scanned
              ? P.emerald.withOpacity(.35)
              : isNext
                  ? P.amber.withOpacity(.45)
                  : P.line,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: scanned ? P.emerald.withOpacity(.15) : P.abyss,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: scanned ? P.emerald.withOpacity(.4) : P.line),
            ),
            child: scanned
                ? const Icon(Icons.check, size: 16, color: P.emerald)
                : Center(
                    child: Text('${cp.orderIndex}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: P.muted)),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(cp.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                Row(
                  children: [
                    if (cp.floorName != null) ...[
                      // Penanda lantai: menegaskan titik ini berada di lantai berapa.
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        margin: const EdgeInsets.only(right: 6),
                        decoration: BoxDecoration(
                          color: P.violet.withOpacity(.14),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: P.violet.withOpacity(.35)),
                        ),
                        child: Text(
                          cp.floorLevel != null ? 'Lt. ${cp.floorLevel}' : cp.floorName!,
                          style: const TextStyle(color: P.violet, fontSize: 9.5, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                    Expanded(
                      child: Text('${cp.code} · target menit ${cp.targetMinute}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: P.muted, fontSize: 11)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (!scanned)
            IconButton(
              tooltip: 'Pindai lewat GPS / catatan',
              onPressed: () => _manualSheet(context),
              icon: const Icon(Icons.more_horiz, color: P.muted, size: 20),
            ),
          if (tertunda) const StatusPill('Menunggu kirim', color: P.cyan, icon: Icons.cloud_upload_outlined),
          if (isNext && !scanned) const StatusPill('Berikutnya', color: P.amber),
        ],
      ),
    );
  }

  /// Alternatif bila stiker QR rusak: verifikasi lewat GPS, sekaligus lapor temuan.
  void _manualSheet(BuildContext context) {
    final note = TextEditingController();
    // BRULE-002: kondisi titik dilaporkan dalam tiga tingkat, bukan sekadar ada/tidak.
    String kondisi = 'AMAN';
    String? photoUrl;

    const pilihanKondisi = [
      ('AMAN', 'Aman', Icons.verified_outlined, P.emerald),
      ('PERLU_PERHATIAN', 'Perlu perhatian', Icons.error_outline, P.amber),
      ('BERMASALAH', 'Bermasalah', Icons.report_gmailerrorred_outlined, P.danger),
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: P.panel,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.of(sheetCtx).viewInsets.bottom + 22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: P.line, borderRadius: BorderRadius.circular(9)),
                ),
              ),
              const SizedBox(height: 16),
              Text(cp.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              Text(cp.code, style: const TextStyle(color: P.muted, fontSize: 12)),
              const SizedBox(height: 16),
              TextField(
                controller: note,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Catatan kondisi titik (opsional)…',
                ),
              ),
              const SizedBox(height: 16),
              const Kicker('Kondisi Titik'),
              const SizedBox(height: 8),
              Row(
                children: pilihanKondisi.map((k) {
                  final aktif = kondisi == k.$1;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setSheet(() => kondisi = k.$1),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
                          decoration: BoxDecoration(
                            color: aktif ? k.$4.withOpacity(.15) : P.abyss,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: aktif ? k.$4.withOpacity(.55) : P.line),
                          ),
                          child: Column(
                            children: [
                              Icon(k.$3, size: 18, color: aktif ? k.$4 : P.muted),
                              const SizedBox(height: 6),
                              Text(
                                k.$2,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 10.5,
                                  height: 1.2,
                                  fontWeight: FontWeight.w800,
                                  color: aktif ? k.$4 : P.muted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 6),
              Text(
                kondisi == 'AMAN'
                    ? 'Tidak ada yang perlu ditindaklanjuti di titik ini.'
                    : 'Pusat kendali menerima pemberitahuan langsung atas kondisi ini.',
                style: const TextStyle(color: P.muted, fontSize: 11, height: 1.4),
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: () async {
                  final shot = await ImagePicker().pickImage(
                    source: ImageSource.camera,
                    imageQuality: 70,
                    maxWidth: 1600,
                  );
                  if (shot == null) return;
                  try {
                    final url = await Api.i.upload(File(shot.path), folder: 'patroli');
                    setSheet(() => photoUrl = url);
                  } catch (e) {
                    if (sheetCtx.mounted) {
                      ScaffoldMessenger.of(sheetCtx)
                          .showSnackBar(SnackBar(content: Text('Gagal unggah foto: $e')));
                    }
                  }
                },
                icon: Icon(photoUrl == null ? Icons.photo_camera_outlined : Icons.check_circle,
                    size: 18, color: photoUrl == null ? P.ink : P.emerald),
                label: Text(photoUrl == null ? 'Ambil foto bukti' : 'Foto terlampir'),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () async {
                    if (requirePhoto && photoUrl == null) {
                      ScaffoldMessenger.of(sheetCtx).showSnackBar(
                        const SnackBar(content: Text('Rute ini mewajibkan foto di setiap titik')),
                      );
                      return;
                    }
                    // Pastikan benar-benar berada di dekat titik sebelum mengirim.
                    try {
                      final pos = await Geo.current();
                      final dist = Geo.meters(pos.latitude, pos.longitude, cp.lat, cp.lng);
                      if (dist > cp.radiusM * 1.0) {
                        if (sheetCtx.mounted) {
                          ScaffoldMessenger.of(sheetCtx).showSnackBar(
                            SnackBar(
                              content: Text(
                                  'Anda ${dist.round()} m dari titik (batas ${cp.radiusM} m). Mendekatlah lalu coba lagi.'),
                            ),
                          );
                        }
                        return;
                      }
                    } catch (e) {
                      if (sheetCtx.mounted) {
                        ScaffoldMessenger.of(sheetCtx).showSnackBar(SnackBar(content: Text('$e')));
                      }
                      return;
                    }
                    final adaTemuan = kondisi != 'AMAN';
                    final setuju = await askConfirm(
                      sheetCtx,
                      title: adaTemuan ? 'Kirim temuan di titik ini?' : 'Verifikasi titik lewat GPS?',
                      message: adaTemuan
                          ? 'Temuan akan diteruskan ke supervisor sebagai pemberitahuan langsung.'
                          : 'Titik ditandai terperiksa memakai koordinat GPS Anda saat ini.',
                      detail: '${cp.name} · ${kondisi == 'BERMASALAH' ? 'bermasalah' : kondisi == 'PERLU_PERHATIAN' ? 'perlu perhatian' : 'aman'}',
                      confirmLabel: 'Ya, kirim',
                      tone: adaTemuan ? DialogTone.warn : DialogTone.save,
                    );
                    if (!setuju) return;
                    if (!sheetCtx.mounted) return;
                    // Bloc diambil sebelum lembar ditutup: memakai context
                    // setelah await berisiko menyentuh widget yang sudah lepas.
                    final bloc = context.read<DutyBloc>();
                    Navigator.pop(sheetCtx);
                    bloc.add(DutyCheckpointScanned(
                          sessionId: sessionId,
                          checkpointId: cp.id,
                          method: 'GPS',
                          note: note.text.trim().isEmpty ? null : note.text.trim(),
                          photoUrl: photoUrl,
                          condition: kondisi,
                          reported: true,
                        ));
                  },
                  icon: const Icon(Icons.my_location, size: 18),
                  label: const Text('VERIFIKASI LEWAT GPS'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
