import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../blocs/duty_bloc.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

class VisitorsScreen extends StatefulWidget {
  const VisitorsScreen({super.key});

  @override
  State<VisitorsScreen> createState() => _VisitorsScreenState();
}

class _VisitorsScreenState extends State<VisitorsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  String _filter = 'SEMUA';

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
      final r = await Api.i.get('/frontdesk/visitors', query: {'limit': 100});
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

  List<dynamic> get _tersaring => _filter == 'SEMUA'
      ? _items
      : _items.where((v) => v['status'] == _filter).toList();

  @override
  Widget build(BuildContext context) {
    final diDalam = _items.where((v) => v['status'] == 'INSIDE').length;

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: P.cyan,
        foregroundColor: Colors.black,
        onPressed: _formTamu,
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('TAMU MASUK', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: RefreshIndicator(
        color: P.cyan,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            GradientHeader(
              title: 'Buku Tamu',
              subtitle: 'Pencatatan tamu masuk dan keluar area',
              accent: P.cyan,
              showBack: true,
              bottom: Row(
                children: [
                  StatTile(icon: Icons.groups_outlined, label: 'Tercatat', value: '${_items.length}', color: P.cyan),
                  const SizedBox(width: 10),
                  StatTile(icon: Icons.meeting_room_outlined, label: 'Di dalam', value: '$diDalam', color: P.amber),
                  const SizedBox(width: 10),
                  StatTile(
                    icon: Icons.directions_car_outlined,
                    label: 'Bawa kendaraan',
                    value: '${_items.where((v) => v['vehiclePlate'] != null).length}',
                    color: P.violet,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  for (final f in ['SEMUA', 'INSIDE', 'CHECKED_OUT'])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onTap: () => setState(() => _filter = f),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: _filter == f ? P.cyan.withOpacity(.14) : P.panel,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                                color: _filter == f ? P.cyan.withOpacity(.45) : P.line),
                          ),
                          child: Text(
                            f == 'SEMUA' ? 'Semua' : f == 'INSIDE' ? 'Di dalam' : 'Sudah keluar',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: _filter == f ? P.cyan : P.muted,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Column(children: [Shimmer(height: 92), SizedBox(height: 10), Shimmer(height: 92)]),
              )
            else if (_tersaring.isEmpty)
              const EmptyState(
                icon: Icons.person_search_outlined,
                title: 'Belum ada catatan tamu',
                hint: 'Ketuk tombol Tamu Masuk untuk mencatat kunjungan pertama.',
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
                child: Column(
                  children: _tersaring.asMap().entries.map((e) {
                    final v = e.value;
                    final diDalam = v['status'] == 'INSIDE';
                    return FadeInUp(
                      index: e.key,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: P.panel.withOpacity(.7),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                              color: diDalam ? P.cyan.withOpacity(.3) : P.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(v['name'] ?? '-',
                                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                                ),
                                StatusPill(diDalam ? 'Di dalam' : 'Keluar',
                                    color: diDalam ? P.cyan : P.muted),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text('${v['company'] ?? 'Perorangan'} · ${v['purpose'] ?? '-'}',
                                style: const TextStyle(color: P.muted, fontSize: 12, height: 1.4)),
                            if (v['vehiclePlate'] != null)
                              Text('Kendaraan ${v['vehiclePlate']}',
                                  style: const TextStyle(color: P.violet, fontSize: 11.5)),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                const Icon(Icons.login, size: 12, color: P.emerald),
                                const SizedBox(width: 5),
                                Text(
                                  DateFormat('d MMM · HH:mm', 'id_ID')
                                      .format(DateTime.parse(v['checkInAt']).toLocal()),
                                  style: const TextStyle(color: P.muted, fontSize: 11),
                                ),
                                if (v['checkOutAt'] != null) ...[
                                  const SizedBox(width: 14),
                                  const Icon(Icons.logout, size: 12, color: P.muted),
                                  const SizedBox(width: 5),
                                  Text(
                                    DateFormat('HH:mm').format(DateTime.parse(v['checkOutAt']).toLocal()),
                                    style: const TextStyle(color: P.muted, fontSize: 11),
                                  ),
                                ],
                                const Spacer(),
                                if (diDalam)
                                  TextButton.icon(
                                    onPressed: () => _keluarkan(v),
                                    icon: const Icon(Icons.logout, size: 14, color: P.amber),
                                    label: const Text('Catat keluar',
                                        style: TextStyle(color: P.amber, fontSize: 12)),
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

  Future<void> _keluarkan(dynamic v) async {
    final ok = await askConfirm(
      context,
      title: 'Catat tamu keluar?',
      message: 'Waktu keluar dicatat sekarang dan kartu tamu dinyatakan sudah dikembalikan.',
      detail: '${v['name']} — ${v['company'] ?? 'perorangan'}',
      confirmLabel: 'Ya, catat keluar',
      tone: DialogTone.warn,
    );
    if (!ok) return;
    try {
      await Api.i.post('/frontdesk/visitors/${v['id']}/checkout', {});
      if (mounted) await showSuccess(context, title: 'Tamu tercatat keluar');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _formTamu() async {
    final siteId = _siteId;
    if (siteId == null) {
      await askConfirm(
        context,
        title: 'Belum ada penempatan',
        message: 'Anda belum memiliki jadwal atau presensi aktif, sehingga site pencatatan belum diketahui.',
        confirmLabel: 'Mengerti',
        cancelLabel: 'Tutup',
        tone: DialogTone.info,
      );
      return;
    }

    final nama = TextEditingController();
    final perusahaan = TextEditingController();
    final identitas = TextEditingController();
    final keperluan = TextEditingController();
    final ditemui = TextEditingController();
    final nopol = TextEditingController();

    await showAppSheet(
      context,
      title: 'Catat Tamu Masuk',
      subtitle: 'Identitas dan keperluan tamu wajib diisi sesuai kartu identitas.',
      builder: (ctx, setSheet) => Column(
        children: [
          LabeledField(
            label: 'Nama tamu',
            child: TextField(controller: nama, decoration: const InputDecoration(hintText: 'Nama sesuai identitas')),
          ),
          LabeledField(
            label: 'Perusahaan / instansi',
            child: TextField(controller: perusahaan, decoration: const InputDecoration(hintText: 'mis. PT Sinar Jaya')),
          ),
          LabeledField(
            label: 'Nomor identitas',
            child: TextField(
              controller: identitas,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(hintText: 'Nomor KTP/SIM'),
            ),
          ),
          LabeledField(
            label: 'Keperluan',
            child: TextField(controller: keperluan, decoration: const InputDecoration(hintText: 'mis. Meeting dengan HRD')),
          ),
          LabeledField(
            label: 'Menemui',
            child: TextField(controller: ditemui, decoration: const InputDecoration(hintText: 'Nama / bagian yang dituju')),
          ),
          LabeledField(
            label: 'Nomor polisi kendaraan',
            child: TextField(
              controller: nopol,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(hintText: 'Kosongkan bila tanpa kendaraan'),
            ),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: P.cyan),
              onPressed: () async {
                if (nama.text.trim().isEmpty || keperluan.text.trim().isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Nama dan keperluan tamu wajib diisi')),
                  );
                  return;
                }
                final ok = await askConfirm(
                  ctx,
                  title: 'Simpan catatan tamu?',
                  message: 'Data tamu akan tercatat masuk pada jam ini dan terlihat di pusat komando.',
                  detail: '${nama.text.trim()} — ${keperluan.text.trim()}',
                  confirmLabel: 'Ya, simpan',
                  tone: DialogTone.save,
                );
                if (!ok) return;
                try {
                  await Api.i.post('/frontdesk/visitors', {
                    'siteId': siteId,
                    'name': nama.text.trim(),
                    'company': perusahaan.text.trim().isEmpty ? null : perusahaan.text.trim(),
                    'idNumber': identitas.text.trim().isEmpty ? null : identitas.text.trim(),
                    'purpose': keperluan.text.trim(),
                    'hostName': ditemui.text.trim().isEmpty ? null : ditemui.text.trim(),
                    'vehiclePlate': nopol.text.trim().isEmpty ? null : nopol.text.trim().toUpperCase(),
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) await showSuccess(context, title: 'Tamu tercatat masuk');
                  _load();
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Gagal: $e')));
                  }
                }
              },
              icon: const Icon(Icons.save_outlined, size: 18),
              label: const Text('SIMPAN CATATAN'),
            ),
          ),
        ],
      ),
    );
  }
}
