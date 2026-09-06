import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../blocs/duty_bloc.dart';
import '../core/pengawas_gerak.dart';
import '../core/theme.dart';

/// Menyalakan pengawas gerak selama anggota berstatus masuk, lalu menampilkan
/// hitung mundur bila ia tidak bergerak. Bila hitung mundur habis tanpa
/// jawaban, sinyal darurat MAN_DOWN dikirim ke pusat komando.
class PengawasManDown extends StatefulWidget {
  final Widget child;
  const PengawasManDown({super.key, required this.child});

  @override
  State<PengawasManDown> createState() => _PengawasManDownState();
}

class _PengawasManDownState extends State<PengawasManDown> {
  bool _dialogTerbuka = false;

  @override
  void initState() {
    super.initState();
    PengawasGerak.i.onDiam = _tanya;
    _selaraskan(context.read<DutyBloc>().state);
  }

  @override
  void dispose() {
    PengawasGerak.i.onDiam = null;
    PengawasGerak.i.henti();
    super.dispose();
  }

  void _selaraskan(DutyState s) {
    if (s.onDuty) {
      PengawasGerak.i.mulai();
    } else {
      PengawasGerak.i.henti();
    }
  }

  Future<void> _tanya() async {
    if (_dialogTerbuka || !mounted) return;
    _dialogTerbuka = true;
    final aman = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _DialogManDown(),
    );
    _dialogTerbuka = false;
    if (!mounted) return;

    if (aman == true) {
      PengawasGerak.i.tandaiAman();
      return;
    }

    // Tidak dijawab: perlakukan sebagai keadaan darurat.
    final duty = context.read<DutyBloc>().state;
    // Bentuk data mengikuti home_screen: presensi terbuka membawa objek site,
    // dan bila belum ada, jadwal hari ini yang dipakai.
    final siteId = duty.attendance?['site']?['id'] as String? ??
        (duty.today.isNotEmpty ? duty.today.first.site.id : null);
    if (siteId != null) {
      context.read<DutyBloc>().add(DutyPanicTriggered(
            siteId,
            type: 'MAN_DOWN',
            message: 'Tidak ada gerakan selama '
                '${PengawasGerak.i.ambangDiam.inMinutes} menit dan panggilan pemeriksaan tidak dijawab.',
          ));
    }
    PengawasGerak.i.tandaiAman();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<DutyBloc, DutyState>(
      listenWhen: (a, b) => a.onDuty != b.onDuty,
      listener: (_, s) => _selaraskan(s),
      child: widget.child,
    );
  }
}

/// Hitung mundur pemeriksaan. Sengaja menutupi layar dan berbunyi visual:
/// yang dicari adalah reaksi cepat, bukan keindahan.
class _DialogManDown extends StatefulWidget {
  const _DialogManDown();

  @override
  State<_DialogManDown> createState() => _DialogManDownState();
}

class _DialogManDownState extends State<_DialogManDown> {
  late int _sisa = PengawasGerak.i.tenggangJawab.inSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _sisa--);
      if (_sisa <= 0) {
        t.cancel();
        Navigator.of(context).pop(false);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = PengawasGerak.i.tenggangJawab.inSeconds;
    return PopScope(
      canPop: false,
      child: Dialog(
        backgroundColor: P.panel,
        insetPadding: const EdgeInsets.all(24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 96,
                    height: 96,
                    child: CircularProgressIndicator(
                      value: total == 0 ? 0 : _sisa / total,
                      strokeWidth: 7,
                      backgroundColor: P.line,
                      valueColor: const AlwaysStoppedAnimation(P.danger),
                    ),
                  ),
                  Text(
                    '$_sisa',
                    style: const TextStyle(color: P.danger, fontSize: 30, fontWeight: FontWeight.w900),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const Text(
                'Anda masih baik-baik saja?',
                textAlign: TextAlign.center,
                style: TextStyle(color: P.ink, fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                'Ponsel Anda tidak bergerak selama ${PengawasGerak.i.ambangDiam.inMinutes} menit. '
                'Bila tidak dijawab, sinyal darurat otomatis dikirim ke pusat komando beserta lokasi Anda.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: P.muted, fontSize: 12.5, height: 1.5),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  style: FilledButton.styleFrom(
                    backgroundColor: P.emerald,
                    foregroundColor: P.voidBg,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text(
                    'SAYA BAIK-BAIK SAJA',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: .6),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text(
                  'Kirim sinyal darurat sekarang',
                  style: TextStyle(color: P.danger, fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
