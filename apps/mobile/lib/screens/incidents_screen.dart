import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/geo.dart';
import '../core/theme.dart';
import '../blocs/duty_bloc.dart';
import '../models/models.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

const kCategories = {
  'ORANG_MENCURIGAKAN': 'Orang Mencurigakan',
  'PENCURIAN': 'Pencurian',
  'PERUSAKAN': 'Perusakan',
  'KEBAKARAN': 'Kebakaran',
  'KECELAKAAN': 'Kecelakaan',
  'KERUSAKAN_FASILITAS': 'Kerusakan Fasilitas',
  'PELANGGARAN_TAMU': 'Pelanggaran Tamu',
  'MEDIS': 'Medis',
  'LAINNYA': 'Lainnya',
};

const kSeverity = {'LOW': 'Rendah', 'MEDIUM': 'Sedang', 'HIGH': 'Tinggi', 'CRITICAL': 'Kritis'};

Color severityColor(String s) => switch (s) {
      'CRITICAL' => P.danger,
      'HIGH' => const Color(0xFFFB923C),
      'MEDIUM' => P.amber,
      _ => P.emerald,
    };

class IncidentsScreen extends StatefulWidget {
  const IncidentsScreen({super.key});

  @override
  State<IncidentsScreen> createState() => _IncidentsScreenState();
}

class _IncidentsScreenState extends State<IncidentsScreen> {
  List<IncidentModel> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await Api.i.get('/incidents', query: {'pageSize': 50});
      setState(() {
        _items = ((r['data'] ?? []) as List).map((e) => IncidentModel.fromJson(e)).toList();
        _loading = false;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: null,
      body: Column(children: [
        GradientHeader(
          title: 'Laporan Insiden',
          subtitle: 'Kejadian yang Anda laporkan dari lapangan',
          accent: P.danger,
          bottom: Row(children: [
            StatTile(icon: Icons.description_outlined, label: 'Total', value: '${_items.length}', color: P.cyan),
            const SizedBox(width: 10),
            StatTile(
              icon: Icons.priority_high,
              label: 'Kritis / tinggi',
              value: '${_items.where((i) => i.severity == 'CRITICAL' || i.severity == 'HIGH').length}',
              color: P.danger,
            ),
            const SizedBox(width: 10),
            StatTile(
              icon: Icons.pending_actions,
              label: 'Belum selesai',
              value: '${_items.where((i) => i.status != 'RESOLVED' && i.status != 'CLOSED').length}',
              color: P.amber,
            ),
          ]),
        ),
        // Aksi utama diletakkan menetap di bawah kepala layar agar tidak
        // menutupi kartu dan tidak bertumpuk dengan tombol pindai.
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: IsiTerpusat(
            child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: P.danger, foregroundColor: Colors.white),
              onPressed: () async {
                final created = await Navigator.push<bool>(
                  context,
                  MaterialPageRoute(builder: (_) => const IncidentFormScreen()),
                );
                if (created == true) _load();
              },
              icon: const Icon(Icons.add_alert_outlined, size: 18),
              label: const Text('LAPOR KEJADIAN BARU'),
            ),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
        color: P.amber,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: P.amber, strokeWidth: 2))
            : _error != null
                ? ListView(children: [
                    Padding(
                      padding: const EdgeInsets.all(40),
                      child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: P.muted)),
                    )
                  ])
                : _items.isEmpty
                    ? ListView(children: const [
                        EmptyState(
                          icon: Icons.verified_outlined,
                          title: 'Belum ada laporan insiden',
                          hint: 'Ketuk tombol LAPOR untuk mengirim kejadian dari lapangan.',
                        )
                      ])
                    : ListView.separated(
                        padding: EdgeInsets.fromLTRB(16, 16, 16, bottomInset(context)),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          final it = _items[i];
                          final c = severityColor(it.severity);
                          return IsiTerpusat(
                            child: GlassCard(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 4,
                                  height: 54,
                                  decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(4)),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(it.code,
                                              style: const TextStyle(
                                                  color: P.amber, fontSize: 11, fontWeight: FontWeight.w800)),
                                          const SizedBox(width: 8),
                                          StatusPill(kSeverity[it.severity] ?? it.severity, color: c),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(it.title,
                                          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${kCategories[it.category] ?? it.category} · ${it.siteName ?? ''}',
                                        style: const TextStyle(color: P.muted, fontSize: 11.5),
                                      ),
                                      Text(
                                        DateFormat('d MMM yyyy · HH:mm', 'id_ID').format(it.occurredAt.toLocal()),
                                        style: const TextStyle(color: P.muted, fontSize: 11),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          );
                        },
                      ),
          ),
        ),
      ]),
    );
  }
}

/* ── Formulir laporan ── */

class IncidentFormScreen extends StatefulWidget {
  const IncidentFormScreen({super.key});

  @override
  State<IncidentFormScreen> createState() => _IncidentFormScreenState();
}

class _IncidentFormScreenState extends State<IncidentFormScreen> {
  final _title = TextEditingController();
  final _desc = TextEditingController();
  final _hint = TextEditingController();
  String _category = 'ORANG_MENCURIGAKAN';
  String _severity = 'MEDIUM';
  final List<String> _photos = [];
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    final duty = context.watch<DutyBloc>().state;
    final siteId = duty.attendance?['site']?['id'] ??
        (duty.today.isNotEmpty ? duty.today.first.site.id : null);
    final siteName = duty.attendance?['site']?['name'] ??
        (duty.today.isNotEmpty ? duty.today.first.site.name : 'Belum ada penempatan');

    return Scaffold(
      appBar: AppBar(title: const Text('Laporan Insiden Baru')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          GlassCard(
            child: Row(
              children: [
                const Icon(Icons.place_outlined, size: 16, color: P.amber),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Kicker('Lokasi kejadian'),
                      const SizedBox(height: 3),
                      Text(siteName, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const Kicker('Kategori'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: kCategories.entries.map((e) {
              final on = _category == e.key;
              return GestureDetector(
                onTap: () => setState(() => _category = e.key),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                  decoration: BoxDecoration(
                    color: on ? P.amber.withOpacity(.14) : P.panel,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: on ? P.amber.withOpacity(.5) : P.line),
                  ),
                  child: Text(e.value,
                      style: TextStyle(
                          color: on ? P.amber : P.muted, fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 20),
          const Kicker('Tingkat keparahan'),
          const SizedBox(height: 8),
          Row(
            children: kSeverity.entries.map((e) {
              final on = _severity == e.key;
              final c = severityColor(e.key);
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _severity = e.key),
                  child: Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: on ? c.withOpacity(.14) : P.panel,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: on ? c.withOpacity(.55) : P.line),
                    ),
                    child: Center(
                      child: Text(e.value,
                          style: TextStyle(
                              color: on ? c : P.muted, fontSize: 12, fontWeight: FontWeight.w800)),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          Text(
            'Tenggat penanganan: ${switch (_severity) { 'CRITICAL' => '1 jam', 'HIGH' => '8 jam', 'MEDIUM' => '24 jam', _ => '72 jam' }}',
            style: const TextStyle(color: P.muted, fontSize: 11),
          ),
          const SizedBox(height: 20),
          const Kicker('Judul singkat'),
          const SizedBox(height: 8),
          TextField(
            controller: _title,
            decoration: const InputDecoration(hintText: 'mis. Orang tidak dikenal di area parkir'),
          ),
          const SizedBox(height: 18),
          const Kicker('Uraian kejadian'),
          const SizedBox(height: 8),
          TextField(
            controller: _desc,
            maxLines: 5,
            decoration: const InputDecoration(
              hintText: 'Kronologi, tindakan yang sudah diambil, kondisi terakhir…',
            ),
          ),
          const SizedBox(height: 18),
          const Kicker('Petunjuk lokasi'),
          const SizedBox(height: 8),
          TextField(
            controller: _hint,
            decoration: const InputDecoration(hintText: 'mis. Sisi utara pagar, dekat gudang B'),
          ),
          const SizedBox(height: 20),
          const Kicker('Foto bukti'),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              ..._photos.map((url) => ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network('$kApiBase$url',
                        width: 78, height: 78, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                              width: 78,
                              height: 78,
                              color: P.panel,
                              child: const Icon(Icons.image, color: P.muted, size: 18),
                            )),
                  )),
              GestureDetector(
                onTap: _addPhoto,
                child: Container(
                  width: 78,
                  height: 78,
                  decoration: BoxDecoration(
                    color: P.panel,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: P.line),
                  ),
                  child: const Icon(Icons.add_a_photo_outlined, color: P.muted, size: 20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: (_saving || siteId == null) ? null : () => _submit(siteId),
              icon: _saving
                  ? const SizedBox(
                      width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Icon(Icons.send_rounded),
              label: Text(_saving ? 'MENGIRIM…' : 'KIRIM LAPORAN'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _addPhoto() async {
    final shot = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 72,
      maxWidth: 1600,
    );
    if (shot == null) return;
    try {
      final url = await Api.i.upload(File(shot.path), folder: 'insiden');
      setState(() => _photos.add(url));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal unggah: $e')));
    }
  }

  Future<void> _submit(String siteId) async {
    if (_title.text.trim().length < 3 || _desc.text.trim().length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Judul dan uraian kejadian wajib diisi')),
      );
      return;
    }
    final setuju = await askConfirm(
      context,
      title: 'Kirim laporan insiden?',
      message: 'Laporan langsung diteruskan ke pusat komando dan supervisor, serta tenggat penanganan mulai dihitung.',
      detail: '${kSeverity[_severity]} — ${_title.text.trim()}',
      confirmLabel: 'Ya, kirim',
      tone: DialogTone.danger,
    );
    if (!setuju) return;
    setState(() => _saving = true);
    double? lat, lng;
    try {
      final pos = await Geo.current(highAccuracy: false);
      lat = pos.latitude;
      lng = pos.longitude;
    } catch (_) {
      // Koordinat opsional — laporan tetap bisa dikirim.
    }
    try {
      await Api.i.post('/incidents', {
        'siteId': siteId,
        'category': _category,
        'severity': _severity,
        'title': _title.text.trim(),
        'description': _desc.text.trim(),
        'locationHint': _hint.text.trim().isEmpty ? null : _hint.text.trim(),
        'lat': lat,
        'lng': lng,
        'mediaUrls': _photos,
      });
      if (mounted) {
        await showSuccess(context,
            title: 'Laporan terkirim',
            message: 'Pusat komando sudah menerima laporan Anda.');
      }
      if (mounted) {
        await showSuccess(context,
            title: 'Laporan terkirim',
            message: 'Pusat komando sudah menerima laporan Anda.');
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mengirim: $e')));
      }
    }
  }
}
