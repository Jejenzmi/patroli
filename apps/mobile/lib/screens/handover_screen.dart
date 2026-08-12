import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../blocs/auth_bloc.dart';
import '../blocs/duty_bloc.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

class HandoverScreen extends StatefulWidget {
  const HandoverScreen({super.key});

  @override
  State<HandoverScreen> createState() => _HandoverScreenState();
}

class _HandoverScreenState extends State<HandoverScreen> {
  List<dynamic> _items = [];
  List<dynamic> _anggota = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String? get _siteId {
    final duty = context.read<DutyBloc>().state;
    return duty.attendance?['site']?['id'] ??
        (duty.today.isNotEmpty ? duty.today.first.site.id : null);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final r = await Api.i.get('/frontdesk/handovers');
      List<dynamic> anggota = [];
      try {
        final u = await Api.i.get('/users', query: {'role': 'GUARD', 'pageSize': 100});
        anggota = (u['data'] ?? []) as List;
      } catch (_) {
        // Anggota biasa tidak berhak melihat daftar personel; penerima diisi manual.
      }
      if (mounted) setState(() {
            _items = r as List;
            _anggota = anggota;
            _loading = false;
          });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthBloc>().state.user;

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: P.emerald,
        foregroundColor: Colors.black,
        onPressed: _form,
        icon: const Icon(Icons.assignment_turned_in_outlined),
        label: const Text('BUAT BERITA ACARA', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: RefreshIndicator(
        color: P.emerald,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const GradientHeader(
              title: 'Serah Terima Shift',
              subtitle: 'Berita acara pergantian jaga',
              accent: P.emerald,
              showBack: true,
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Column(children: [Shimmer(height: 150), SizedBox(height: 10), Shimmer(height: 150)]),
              )
            else if (_items.isEmpty)
              const EmptyState(
                icon: Icons.assignment_outlined,
                title: 'Belum ada serah terima',
                hint: 'Buat berita acara saat mengakhiri shift agar penerima tahu situasi terakhir.',
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
                child: Column(
                  children: _items.asMap().entries.map((e) {
                    final h = e.value;
                    final untukSaya = h['toGuard']?['id'] == me?.id;
                    final sudah = h['acknowledgedAt'] != null;
                    return FadeInUp(
                      index: e.key,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: P.panel.withOpacity(.72),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                              color: untukSaya && !sudah ? P.amber.withOpacity(.4) : P.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Row(
                                    children: [
                                      Flexible(
                                        child: Text(h['fromGuard']?['name'] ?? '-',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                                      ),
                                      const Padding(
                                        padding: EdgeInsets.symmetric(horizontal: 8),
                                        child: Icon(Icons.arrow_forward, size: 14, color: P.amber),
                                      ),
                                      Flexible(
                                        child: Text(h['toGuard']?['name'] ?? '-',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                                      ),
                                    ],
                                  ),
                                ),
                                StatusPill(sudah ? 'Dikonfirmasi' : 'Menunggu',
                                    color: sudah ? P.emerald : P.amber),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${h['site']?['name'] ?? '-'} · ${DateFormat('d MMM yyyy', 'id_ID').format(DateTime.parse(h['shiftDate']).toLocal())}',
                              style: const TextStyle(color: P.muted, fontSize: 11.5),
                            ),
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: P.abyss.withOpacity(.6),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: P.line),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Kicker('Situasi terakhir'),
                                  const SizedBox(height: 5),
                                  Text(h['situation'] ?? '-',
                                      style: const TextStyle(fontSize: 12.5, height: 1.5)),
                                ],
                              ),
                            ),
                            if (h['pendingWork'] != null) ...[
                              const SizedBox(height: 8),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.pending_actions, size: 13, color: P.amber),
                                  const SizedBox(width: 7),
                                  Expanded(
                                    child: Text(h['pendingWork'],
                                        style: const TextStyle(color: P.amber, fontSize: 12, height: 1.4)),
                                  ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Icon(
                                  h['equipmentOk'] == true ? Icons.check_circle_outline : Icons.error_outline,
                                  size: 13,
                                  color: h['equipmentOk'] == true ? P.emerald : P.danger,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  h['equipmentOk'] == true ? 'Peralatan lengkap' : 'Ada masalah peralatan',
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    color: h['equipmentOk'] == true ? P.emerald : P.danger,
                                  ),
                                ),
                                const Spacer(),
                                if (untukSaya && !sudah)
                                  TextButton.icon(
                                    onPressed: () => _konfirmasi(h),
                                    icon: const Icon(Icons.how_to_reg, size: 15, color: P.emerald),
                                    label: const Text('Konfirmasi terima',
                                        style: TextStyle(color: P.emerald, fontSize: 12)),
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

  Future<void> _konfirmasi(dynamic h) async {
    final ok = await askConfirm(
      context,
      title: 'Konfirmasi serah terima?',
      message: 'Anda menyatakan telah menerima situasi, pekerjaan tertunda, dan peralatan sebagaimana tercatat.',
      detail: 'Dari ${h['fromGuard']?['name']}',
      confirmLabel: 'Ya, saya terima',
      tone: DialogTone.info,
    );
    if (!ok) return;
    try {
      await Api.i.post('/frontdesk/handovers/${h['id']}/ack', {});
      if (mounted) await showSuccess(context, title: 'Serah terima dikonfirmasi');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _form() async {
    final siteId = _siteId;
    final me = context.read<AuthBloc>().state.user;
    if (siteId == null) {
      await askConfirm(
        context,
        title: 'Belum ada penempatan',
        message: 'Site belum diketahui karena Anda belum memiliki jadwal atau presensi aktif.',
        confirmLabel: 'Mengerti',
        cancelLabel: 'Tutup',
        tone: DialogTone.info,
      );
      return;
    }

    final situasi = TextEditingController();
    final tertunda = TextEditingController();
    final catatanAlat = TextEditingController();
    var alatOk = true;
    String? penerima;

    final kandidat = _anggota.where((a) => a['id'] != me?.id).toList();

    await showAppSheet(
      context,
      title: 'Berita Acara Serah Terima',
      subtitle: 'Penerima shift akan menerima notifikasi begitu berita acara dikirim.',
      builder: (ctx, setSheet) => Column(
        children: [
          LabeledField(
            label: 'Diserahkan kepada',
            child: kandidat.isEmpty
                ? Container(
                    padding: const EdgeInsets.all(13),
                    decoration: BoxDecoration(
                      color: P.abyss,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: P.line),
                    ),
                    child: const Text(
                      'Daftar anggota tidak tersedia untuk akun Anda. Hubungi supervisor untuk membuat serah terima.',
                      style: TextStyle(color: P.muted, fontSize: 12, height: 1.45),
                    ),
                  )
                : DropdownButtonFormField<String>(
                    value: penerima,
                    isExpanded: true,
                    dropdownColor: P.panel,
                    decoration: const InputDecoration(hintText: 'Pilih anggota penerima'),
                    items: kandidat
                        .map<DropdownMenuItem<String>>((a) => DropdownMenuItem(
                              value: a['id'] as String,
                              child: Text(a['name'] ?? '-', overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: (v) => setSheet(() => penerima = v),
                  ),
          ),
          LabeledField(
            label: 'Uraian situasi',
            child: TextField(
              controller: situasi,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Kondisi area, kejadian selama shift, hal yang perlu diperhatikan…',
              ),
            ),
          ),
          LabeledField(
            label: 'Pekerjaan tertunda',
            child: TextField(
              controller: tertunda,
              decoration: const InputDecoration(hintText: 'Kosongkan bila tidak ada'),
            ),
          ),
          LabeledField(
            label: 'Kondisi peralatan',
            child: Row(
              children: [
                for (final v in [true, false])
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setSheet(() => alatOk = v),
                      child: Container(
                        margin: EdgeInsets.only(right: v ? 8 : 0),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: alatOk == v
                              ? (v ? P.emerald : P.danger).withOpacity(.14)
                              : P.abyss,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: alatOk == v
                                ? (v ? P.emerald : P.danger).withOpacity(.5)
                                : P.line,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            v ? 'Lengkap' : 'Ada masalah',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800,
                              color: alatOk == v ? (v ? P.emerald : P.danger) : P.muted,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (!alatOk)
            LabeledField(
              label: 'Catatan peralatan',
              child: TextField(
                controller: catatanAlat,
                decoration: const InputDecoration(hintText: 'mis. HT nomor 2 baterai lemah'),
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: P.emerald),
              onPressed: kandidat.isEmpty
                  ? null
                  : () async {
                      if (penerima == null || situasi.text.trim().length < 3) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(content: Text('Pilih penerima dan isi uraian situasi')),
                        );
                        return;
                      }
                      final ok = await askConfirm(
                        ctx,
                        title: 'Kirim berita acara?',
                        message: 'Isi berita acara tidak dapat diubah setelah dikirim dan langsung diteruskan ke penerima shift.',
                        confirmLabel: 'Ya, kirim',
                        tone: DialogTone.save,
                      );
                      if (!ok) return;
                      try {
                        await Api.i.post('/frontdesk/handovers', {
                          'siteId': siteId,
                          'toGuardId': penerima,
                          'situation': situasi.text.trim(),
                          'pendingWork': tertunda.text.trim().isEmpty ? null : tertunda.text.trim(),
                          'equipmentOk': alatOk,
                          'equipmentNote': catatanAlat.text.trim().isEmpty ? null : catatanAlat.text.trim(),
                        });
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) await showSuccess(context, title: 'Berita acara terkirim');
                        _load();
                      } catch (e) {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Gagal: $e')));
                        }
                      }
                    },
              icon: const Icon(Icons.send_rounded, size: 18),
              label: const Text('KIRIM BERITA ACARA'),
            ),
          ),
        ],
      ),
    );
  }
}
