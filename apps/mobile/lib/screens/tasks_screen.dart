
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/kamera.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

/// Tugas insidental dan instruksi untuk anggota (FR-TASK-001..004).
class TasksScreen extends StatefulWidget {
  final int tabAwal;
  const TasksScreen({super.key, this.tabAwal = 0});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> with SingleTickerProviderStateMixin {
  late final TabController _tab =
      TabController(length: 2, vsync: this, initialIndex: widget.tabAwal);
  List<dynamic> _tugas = [];
  List<dynamic> _instruksi = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final hasil = await Future.wait([
        Api.i.get('/tasks'),
        Api.i.get('/tasks/instructions/list'),
      ]);
      if (!mounted) return;
      setState(() {
        _tugas = hasil[0] as List;
        _instruksi = hasil[1] as List;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Color _warnaPrioritas(String p) => switch (p) {
        'MENDESAK' => P.danger,
        'TINGGI' => const Color(0xFFFB923C),
        'NORMAL' => P.cyan,
        _ => P.emerald,
      };

  String _labelStatus(String s) => switch (s) {
        'BARU' => 'Baru',
        'DIKERJAKAN' => 'Dikerjakan',
        'SELESAI' => 'Selesai',
        _ => 'Dibatalkan',
      };

  @override
  Widget build(BuildContext context) {
    final belum = _tugas.where((t) => t['status'] != 'SELESAI').length;

    return Scaffold(
      body: Column(
        children: [
          GradientHeader(
            title: 'Tugas & Instruksi',
            subtitle: '$belum tugas menunggu diselesaikan',
            accent: P.emerald,
            showBack: true,
            bottom: Container(
              decoration: BoxDecoration(
                color: P.abyss.withOpacity(.7),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: P.line),
              ),
              padding: const EdgeInsets.all(4),
              child: TabBar(
                controller: _tab,
                dividerColor: Colors.transparent,
                indicatorSize: TabBarIndicatorSize.tab,
                indicator: BoxDecoration(
                  color: P.emerald.withOpacity(.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: P.emerald.withOpacity(.4)),
                ),
                labelColor: P.emerald,
                unselectedLabelColor: P.muted,
                labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                tabs: const [Tab(text: 'Tugas Saya'), Tab(text: 'Instruksi')],
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: Column(children: [Shimmer(height: 110), SizedBox(height: 10), Shimmer(height: 110)]),
                  )
                : TabBarView(controller: _tab, children: [_tabTugas(), _tabInstruksi()]),
          ),
        ],
      ),
    );
  }

  Widget _tabTugas() {
    if (_tugas.isEmpty) {
      return const EmptyState(
        icon: Icons.assignment_outlined,
        title: 'Belum ada tugas',
        hint: 'Tugas insidental dari Danru akan muncul di sini.',
      );
    }
    return RefreshIndicator(
      color: P.emerald,
      backgroundColor: P.panel,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
        children: _tugas.asMap().entries.map((e) {
          final t = e.value;
          final warna = _warnaPrioritas(t['priority']);
          final selesai = t['status'] == 'SELESAI';
          final lewat = t['dueAt'] != null &&
              DateTime.parse(t['dueAt']).isBefore(DateTime.now()) &&
              !selesai;
          return FadeInUp(
            index: e.key,
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: P.panel.withOpacity(.72),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: selesai ? P.line : warna.withOpacity(.35)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      StatusPill(t['priority'], color: warna),
                      const SizedBox(width: 8),
                      StatusPill(_labelStatus(t['status']),
                          color: selesai ? P.emerald : t['status'] == 'DIKERJAKAN' ? P.amber : P.cyan),
                      const Spacer(),
                      if (lewat) const StatusPill('Lewat tenggat', color: P.danger),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(t['title'] ?? '',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                  if (t['description'] != null) ...[
                    const SizedBox(height: 4),
                    Text(t['description'],
                        style: const TextStyle(color: P.muted, fontSize: 12.5, height: 1.45)),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.place_outlined, size: 12, color: P.muted),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(t['site']?['name'] ?? '-',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: P.muted, fontSize: 11.5)),
                      ),
                      if (t['dueAt'] != null) ...[
                        const Icon(Icons.schedule, size: 12, color: P.muted),
                        const SizedBox(width: 5),
                        Text(
                          DateFormat('d MMM · HH:mm', 'id_ID').format(DateTime.parse(t['dueAt']).toLocal()),
                          style: TextStyle(color: lewat ? P.danger : P.muted, fontSize: 11.5),
                        ),
                      ],
                    ],
                  ),
                  if (t['result'] != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: P.abyss.withOpacity(.6),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: P.line),
                      ),
                      child: Text('Hasil: ${t['result']}',
                          style: const TextStyle(fontSize: 12, height: 1.45)),
                    ),
                  ],
                  if (!selesai) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        if (t['status'] == 'BARU')
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _ubahStatus(t, 'DIKERJAKAN'),
                              icon: const Icon(Icons.play_arrow_rounded, size: 16),
                              label: const Text('MULAI'),
                            ),
                          ),
                        if (t['status'] == 'BARU') const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(backgroundColor: P.emerald),
                            onPressed: () => _selesaikan(t),
                            icon: const Icon(Icons.check_rounded, size: 16),
                            label: const Text('SELESAIKAN'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _tabInstruksi() {
    if (_instruksi.isEmpty) {
      return const EmptyState(
        icon: Icons.campaign_outlined,
        title: 'Belum ada instruksi',
        hint: 'Arahan dari Danru dan Chief Security akan muncul di sini.',
      );
    }
    return RefreshIndicator(
      color: P.emerald,
      backgroundColor: P.panel,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
        children: _instruksi.asMap().entries.map((e) {
          final i = e.value;
          final mendesak = i['urgent'] == true;
          final dibaca = i['sudahDibaca'] == true;
          return FadeInUp(
            index: e.key,
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    (mendesak ? P.danger : P.cyan).withOpacity(dibaca ? .05 : .12),
                    P.panel.withOpacity(.85),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color: (mendesak ? P.danger : P.cyan).withOpacity(dibaca ? .2 : .4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (mendesak) ...[
                        const StatusPill('Mendesak', color: P.danger, icon: Icons.priority_high),
                        const SizedBox(width: 8),
                      ],
                      Expanded(
                        child: Text(i['title'] ?? '',
                            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
                      ),
                      if (dibaca)
                        const Icon(Icons.done_all, size: 16, color: P.emerald)
                      else
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(color: P.amber, shape: BoxShape.circle),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(i['body'] ?? '',
                      style: const TextStyle(color: P.ink, fontSize: 13, height: 1.55)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.person_outline, size: 12, color: P.muted),
                      const SizedBox(width: 5),
                      Text(i['sender']?['name'] ?? '-',
                          style: const TextStyle(color: P.muted, fontSize: 11)),
                      const SizedBox(width: 12),
                      Text(
                        DateFormat('d MMM · HH:mm', 'id_ID').format(DateTime.parse(i['createdAt']).toLocal()),
                        style: const TextStyle(color: P.muted, fontSize: 11),
                      ),
                      const Spacer(),
                      if (!dibaca)
                        TextButton.icon(
                          onPressed: () => _tandaiDibaca(i),
                          icon: const Icon(Icons.done, size: 14, color: P.cyan),
                          label: const Text('Tandai dibaca',
                              style: TextStyle(color: P.cyan, fontSize: 12)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Future<void> _ubahStatus(dynamic t, String status) async {
    try {
      await Api.i.put('/tasks/${t['id']}', {'status': status});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _tandaiDibaca(dynamic i) async {
    try {
      await Api.i.post('/tasks/instructions/${i['id']}/read', {});
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  /// Menyelesaikan tugas: catatan hasil dan foto bukti (FR-TASK-002).
  Future<void> _selesaikan(dynamic t) async {
    final hasil = TextEditingController();
    final bukti = <String>[];

    await showAppSheet(
      context,
      title: 'Selesaikan Tugas',
      subtitle: t['title'],
      builder: (ctx, setSheet) => Column(
        children: [
          LabeledField(
            label: 'Catatan hasil',
            child: TextField(
              controller: hasil,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Apa yang dikerjakan dan bagaimana hasilnya…',
              ),
            ),
          ),
          LabeledField(
            label: 'Foto bukti',
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                ...bukti.map((u) => ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network('$kApiBase$u',
                          width: 72,
                          height: 72,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                                width: 72,
                                height: 72,
                                color: P.abyss,
                                child: const Icon(Icons.image, color: P.muted, size: 18),
                              )),
                    )),
                GestureDetector(
                  onTap: () async {
                    final isi = await Kamera.ambil(keterangan: 'Bukti penyelesaian tugas', lebarMaks: 1600);
                    if (isi == null) return;
                    try {
                      final url = await Api.i.unggahIsi(isi, folder: 'tugas', nama: 'tugas.jpg');
                      setSheet(() => bukti.add(url));
                    } catch (e) {
                      if (ctx.mounted) {
                        ScaffoldMessenger.of(ctx)
                            .showSnackBar(SnackBar(content: Text('Gagal unggah: $e')));
                      }
                    }
                  },
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: P.abyss,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: P.line),
                    ),
                    child: const Icon(Icons.add_a_photo_outlined, color: P.muted, size: 20),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: P.emerald),
              onPressed: () async {
                if (hasil.text.trim().isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Catatan hasil wajib diisi')),
                  );
                  return;
                }
                final ok = await askConfirm(
                  ctx,
                  title: 'Tandai tugas selesai?',
                  message: 'Pemberi tugas akan menerima pemberitahuan beserta catatan hasil Anda.',
                  detail: t['title'],
                  confirmLabel: 'Ya, selesai',
                  tone: DialogTone.info,
                );
                if (!ok) return;
                try {
                  await Api.i.put('/tasks/${t['id']}', {
                    'status': 'SELESAI',
                    'result': hasil.text.trim(),
                    'proofUrls': bukti,
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) await showSuccess(context, title: 'Tugas diselesaikan');
                  _load();
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Gagal: $e')));
                  }
                }
              },
              icon: const Icon(Icons.check_rounded, size: 18),
              label: const Text('TANDAI SELESAI'),
            ),
          ),
        ],
      ),
    );
  }
}
