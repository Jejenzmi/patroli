import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/ui.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await Api.i.get('/frontdesk/announcements');
      if (mounted) setState(() {
            _items = r as List;
            _loading = false;
          });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Color _warna(String? p) => switch (p) {
        'CRITICAL' => P.danger,
        'HIGH' => const Color(0xFFFB923C),
        'MEDIUM' => P.amber,
        _ => P.cyan,
      };

  String _label(String? p) => switch (p) {
        'CRITICAL' => 'Kritis',
        'HIGH' => 'Tinggi',
        'MEDIUM' => 'Sedang',
        _ => 'Info',
      };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: RefreshIndicator(
        color: P.emerald,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const GradientHeader(
              title: 'Pengumuman Satuan',
              subtitle: 'Instruksi dan informasi resmi dari komando',
              accent: P.emerald,
              showBack: true,
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Column(children: [Shimmer(height: 120), SizedBox(height: 10), Shimmer(height: 120)]),
              )
            else if (_items.isEmpty)
              const EmptyState(
                icon: Icons.campaign_outlined,
                title: 'Belum ada pengumuman',
                hint: 'Pengumuman dari komando akan tampil di sini.',
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
                child: Column(
                  children: _items.asMap().entries.map((e) {
                    final a = e.value;
                    final warna = _warna(a['priority']);
                    return FadeInUp(
                      index: e.key,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(17),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [warna.withOpacity(.10), P.panel.withOpacity(.85)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: warna.withOpacity(.3)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(a['title'] ?? '',
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                                ),
                                StatusPill(_label(a['priority']), color: warna),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(a['body'] ?? '',
                                style: const TextStyle(color: P.ink, fontSize: 13, height: 1.55)),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                const Icon(Icons.person_outline, size: 12, color: P.muted),
                                const SizedBox(width: 5),
                                Text(a['createdBy']?['name'] ?? '-',
                                    style: const TextStyle(color: P.muted, fontSize: 11)),
                                const SizedBox(width: 12),
                                const Icon(Icons.schedule, size: 12, color: P.muted),
                                const SizedBox(width: 5),
                                Text(
                                  DateFormat('d MMM yyyy · HH:mm', 'id_ID')
                                      .format(DateTime.parse(a['publishedAt']).toLocal()),
                                  style: const TextStyle(color: P.muted, fontSize: 11),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
