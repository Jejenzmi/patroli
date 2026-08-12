import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../blocs/duty_bloc.dart';
import '../widgets/app_dialog.dart';
import '../widgets/ui.dart';

const _jenisKendaraan = ['MOBIL', 'MOTOR', 'TRUK', 'BOX', 'BUS', 'LAINNYA'];

class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  List<dynamic> _items = [];
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
      final r = await Api.i.get('/frontdesk/vehicles', query: {'limit': 100});
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

  @override
  Widget build(BuildContext context) {
    final diDalam = _items.where((v) => v['outAt'] == null).length;

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: P.violet,
        foregroundColor: Colors.black,
        onPressed: _form,
        icon: const Icon(Icons.local_shipping_outlined),
        label: const Text('KENDARAAN MASUK', style: TextStyle(fontWeight: FontWeight.w900)),
      ),
      body: RefreshIndicator(
        color: P.violet,
        backgroundColor: P.panel,
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            GradientHeader(
              title: 'Lalu Lintas Kendaraan',
              subtitle: 'Kendaraan masuk, muatan, dan jam keluar',
              accent: P.violet,
              showBack: true,
              bottom: Row(
                children: [
                  StatTile(icon: Icons.list_alt, label: 'Tercatat', value: '${_items.length}', color: P.violet),
                  const SizedBox(width: 10),
                  StatTile(icon: Icons.warehouse_outlined, label: 'Di dalam', value: '$diDalam', color: P.amber),
                  const SizedBox(width: 10),
                  StatTile(
                    icon: Icons.local_shipping_outlined,
                    label: 'Truk / box',
                    value: '${_items.where((v) => ['TRUK', 'BOX'].contains(v['vehicleType'])).length}',
                    color: P.cyan,
                  ),
                ],
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Column(children: [Shimmer(height: 88), SizedBox(height: 10), Shimmer(height: 88)]),
              )
            else if (_items.isEmpty)
              const EmptyState(
                icon: Icons.no_transfer_outlined,
                title: 'Belum ada catatan kendaraan',
                hint: 'Catat kendaraan yang masuk area lewat tombol di bawah.',
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
                child: Column(
                  children: _items.asMap().entries.map((e) {
                    final v = e.value;
                    final masih = v['outAt'] == null;
                    return FadeInUp(
                      index: e.key,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: P.panel.withOpacity(.7),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: masih ? P.violet.withOpacity(.3) : P.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: P.abyss,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: P.amber.withOpacity(.45)),
                                  ),
                                  child: Text(v['plate'] ?? '-',
                                      style: const TextStyle(
                                          color: P.amber, fontSize: 13, fontWeight: FontWeight.w900, letterSpacing: 1)),
                                ),
                                const SizedBox(width: 10),
                                StatusPill(v['vehicleType'] ?? '-', color: P.violet),
                                const Spacer(),
                                StatusPill(masih ? 'Di dalam' : 'Keluar', color: masih ? P.cyan : P.muted),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              '${v['driverName'] ?? 'Pengemudi tidak dicatat'} · ${v['company'] ?? '-'}',
                              style: const TextStyle(color: P.muted, fontSize: 12),
                            ),
                            if (v['cargo'] != null)
                              Text('Muatan: ${v['cargo']}',
                                  style: const TextStyle(color: P.ink, fontSize: 12, height: 1.4)),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(Icons.login, size: 12, color: P.emerald),
                                const SizedBox(width: 5),
                                Text(
                                  DateFormat('d MMM · HH:mm', 'id_ID')
                                      .format(DateTime.parse(v['inAt']).toLocal()),
                                  style: const TextStyle(color: P.muted, fontSize: 11),
                                ),
                                const Spacer(),
                                if (masih)
                                  TextButton.icon(
                                    onPressed: () => _keluarkan(v),
                                    icon: const Icon(Icons.logout, size: 14, color: P.amber),
                                    label: const Text('Catat keluar',
                                        style: TextStyle(color: P.amber, fontSize: 12)),
                                  )
                                else
                                  Text(
                                    'Keluar ${DateFormat('HH:mm').format(DateTime.parse(v['outAt']).toLocal())}',
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

  Future<void> _keluarkan(dynamic v) async {
    final ok = await askConfirm(
      context,
      title: 'Catat kendaraan keluar?',
      message: 'Waktu keluar dicatat sekarang. Pastikan muatan sudah diperiksa sesuai prosedur.',
      detail: '${v['plate']} — ${v['driverName'] ?? 'pengemudi tidak dicatat'}',
      confirmLabel: 'Ya, catat keluar',
      tone: DialogTone.warn,
    );
    if (!ok) return;
    try {
      await Api.i.post('/frontdesk/vehicles/${v['id']}/out', {});
      if (mounted) await showSuccess(context, title: 'Kendaraan tercatat keluar');
      _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _form() async {
    final siteId = _siteId;
    if (siteId == null) {
      await askConfirm(
        context,
        title: 'Belum ada penempatan',
        message: 'Site pencatatan belum diketahui karena Anda belum memiliki jadwal atau presensi aktif.',
        confirmLabel: 'Mengerti',
        cancelLabel: 'Tutup',
        tone: DialogTone.info,
      );
      return;
    }

    final nopol = TextEditingController();
    final pengemudi = TextEditingController();
    final perusahaan = TextEditingController();
    final muatan = TextEditingController();
    final keperluan = TextEditingController();
    var jenis = 'MOBIL';

    await showAppSheet(
      context,
      title: 'Catat Kendaraan Masuk',
      subtitle: 'Periksa muatan dan identitas pengemudi sebelum mencatat.',
      builder: (ctx, setSheet) => Column(
        children: [
          LabeledField(
            label: 'Nomor polisi',
            child: TextField(
              controller: nopol,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(hintText: 'mis. B 1234 XYZ'),
            ),
          ),
          LabeledField(
            label: 'Jenis kendaraan',
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _jenisKendaraan
                  .map((j) => GestureDetector(
                        onTap: () => setSheet(() => jenis = j),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                          decoration: BoxDecoration(
                            color: jenis == j ? P.violet.withOpacity(.15) : P.abyss,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: jenis == j ? P.violet.withOpacity(.5) : P.line),
                          ),
                          child: Text(j,
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: jenis == j ? P.violet : P.muted,
                              )),
                        ),
                      ))
                  .toList(),
            ),
          ),
          LabeledField(
            label: 'Nama pengemudi',
            child: TextField(controller: pengemudi, decoration: const InputDecoration(hintText: 'Nama pengemudi')),
          ),
          LabeledField(
            label: 'Perusahaan',
            child: TextField(controller: perusahaan, decoration: const InputDecoration(hintText: 'Asal perusahaan')),
          ),
          LabeledField(
            label: 'Muatan',
            child: TextField(controller: muatan, decoration: const InputDecoration(hintText: 'mis. Bahan baku plastik')),
          ),
          LabeledField(
            label: 'Keperluan',
            child: TextField(controller: keperluan, decoration: const InputDecoration(hintText: 'mis. Bongkar material')),
          ),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: P.violet),
              onPressed: () async {
                if (nopol.text.trim().isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Nomor polisi wajib diisi')),
                  );
                  return;
                }
                final ok = await askConfirm(
                  ctx,
                  title: 'Simpan catatan kendaraan?',
                  message: 'Kendaraan tercatat masuk pada jam ini dan terlihat di pusat komando.',
                  detail: '${nopol.text.trim().toUpperCase()} · $jenis',
                  confirmLabel: 'Ya, simpan',
                  tone: DialogTone.save,
                );
                if (!ok) return;
                try {
                  await Api.i.post('/frontdesk/vehicles', {
                    'siteId': siteId,
                    'plate': nopol.text.trim().toUpperCase(),
                    'vehicleType': jenis,
                    'driverName': pengemudi.text.trim().isEmpty ? null : pengemudi.text.trim(),
                    'company': perusahaan.text.trim().isEmpty ? null : perusahaan.text.trim(),
                    'cargo': muatan.text.trim().isEmpty ? null : muatan.text.trim(),
                    'purpose': keperluan.text.trim().isEmpty ? null : keperluan.text.trim(),
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) await showSuccess(context, title: 'Kendaraan tercatat masuk');
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
