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
import 'scan_screen.dart';

class PatrolScreen extends StatelessWidget {
  const PatrolScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Patroli'),
        actions: [
          IconButton(
            onPressed: () => context.read<DutyBloc>().add(DutyRefreshed()),
            icon: const Icon(Icons.refresh, size: 20),
          ),
        ],
      ),
      body: BlocBuilder<DutyBloc, DutyState>(
        builder: (context, state) {
          if (state.session == null) return _RouteChooser(state: state);
          return _ActivePatrol(session: state.session!, busy: state.loading);
        },
      ),
    );
  }
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
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
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
                        Text('${s.site.name} · shift ${s.shiftName}',
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
                                : () => context
                                    .read<DutyBloc>()
                                    .add(DutyPatrolStarted(s.route!.id, scheduleId: s.id)),
                            icon: const Icon(Icons.play_arrow_rounded),
                            label: const Text('MULAI PATROLI'),
                          ),
                        ),
                      ],
                    ),
                  ),
                )),
        ],
      ),
    );
  }
}

/* ── Patroli sedang berjalan ── */

class _ActivePatrol extends StatelessWidget {
  final PatrolSessionModel session;
  final bool busy;
  const _ActivePatrol({required this.session, required this.busy});

  @override
  Widget build(BuildContext context) {
    final cps = session.route.checkpoints;
    final done = session.scannedIds.length;
    final next = cps.where((c) => !session.scannedIds.contains(c.id)).toList();

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
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
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
                          final ok = session.scannedIds.contains(c.id);
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
                    scanned: session.scannedIds.contains(c.id),
                    isNext: next.isNotEmpty && next.first.id == c.id,
                    sessionId: session.id,
                    requirePhoto: session.route.requirePhoto,
                  )),
            ],
          ),
        ),

        // Aksi utama
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          decoration: const BoxDecoration(
            color: P.abyss,
            border: Border(top: BorderSide(color: P.line)),
          ),
          child: SafeArea(
            top: false,
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: FilledButton.icon(
                    onPressed: busy
                        ? null
                        : () async {
                            final code = await Navigator.push<String>(
                              context,
                              MaterialPageRoute(builder: (_) => const ScanScreen()),
                            );
                            if (code != null && context.mounted) {
                              context.read<DutyBloc>().add(
                                    DutyCheckpointScanned(sessionId: session.id, code: code, method: 'QR'),
                                  );
                            }
                          },
                    icon: const Icon(Icons.qr_code_scanner),
                    label: const Text('PINDAI TITIK'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: OutlinedButton.icon(
                    onPressed: busy
                        ? null
                        : () async {
                            final ok = await showDialog<bool>(
                              context: context,
                              builder: (c) => AlertDialog(
                                title: const Text('Akhiri patroli?'),
                                content: Text(done < cps.length
                                    ? 'Masih ada ${cps.length - done} titik yang belum dipindai. Titik tersebut akan tercatat terlewat.'
                                    : 'Seluruh titik sudah dipindai. Akhiri putaran patroli ini?'),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Batal')),
                                  FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Akhiri')),
                                ],
                              ),
                            );
                            if (ok == true && context.mounted) {
                              context.read<DutyBloc>().add(DutyPatrolFinished(session.id));
                            }
                          },
                    icon: const Icon(Icons.flag_outlined, size: 18),
                    label: const Text('AKHIRI'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CheckpointTile extends StatelessWidget {
  final Checkpoint cp;
  final bool scanned, isNext, requirePhoto;
  final String sessionId;

  const _CheckpointTile({
    required this.cp,
    required this.scanned,
    required this.isNext,
    required this.sessionId,
    required this.requirePhoto,
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
                Text('${cp.code} · target menit ${cp.targetMinute}',
                    style: const TextStyle(color: P.muted, fontSize: 11)),
              ],
            ),
          ),
          if (!scanned)
            IconButton(
              tooltip: 'Pindai lewat GPS / catatan',
              onPressed: () => _manualSheet(context),
              icon: const Icon(Icons.more_horiz, color: P.muted, size: 20),
            ),
          if (isNext && !scanned) const StatusPill('Berikutnya', color: P.amber),
        ],
      ),
    );
  }

  /// Alternatif bila stiker QR rusak: verifikasi lewat GPS, sekaligus lapor temuan.
  void _manualSheet(BuildContext context) {
    final note = TextEditingController();
    bool issue = false;
    String? photoUrl;

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
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: issue,
                activeColor: P.amber,
                onChanged: (v) => setSheet(() => issue = v),
                title: const Text('Ada temuan di titik ini', style: TextStyle(fontSize: 14)),
                subtitle: const Text('Supervisor akan menerima notifikasi',
                    style: TextStyle(color: P.muted, fontSize: 11)),
              ),
              const SizedBox(height: 4),
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
                    Navigator.pop(sheetCtx);
                    context.read<DutyBloc>().add(DutyCheckpointScanned(
                          sessionId: sessionId,
                          checkpointId: cp.id,
                          method: 'GPS',
                          note: note.text.trim().isEmpty ? null : note.text.trim(),
                          photoUrl: photoUrl,
                          issue: issue,
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
