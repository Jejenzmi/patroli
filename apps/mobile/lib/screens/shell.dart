import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../core/theme.dart';
import '../blocs/duty_bloc.dart';
import '../widgets/app_dialog.dart';
import 'home_screen.dart';
import 'patrol_screen.dart';
import 'incidents_screen.dart';
import 'profile_screen.dart';
import 'services_screen.dart';
import 'scan_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    context.read<DutyBloc>().add(DutyRefreshed());
  }

  /// Tombol pindai di tengah: langsung ke kamera bila ada patroli berjalan.
  Future<void> _scan() async {
    final duty = context.read<DutyBloc>().state;
    if (duty.session == null) {
      await askConfirm(
        context,
        title: 'Belum ada patroli berjalan',
        message: 'Mulai putaran patroli lebih dulu dari tab Patroli agar hasil pemindaian tercatat pada sesi yang benar.',
        confirmLabel: 'Buka Patroli',
        cancelLabel: 'Nanti',
        tone: DialogTone.info,
      ).then((ok) {
        if (ok && mounted) setState(() => _index = 1);
      });
      return;
    }
    final code = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const ScanScreen()),
    );
    if (code != null && mounted) {
      context.read<DutyBloc>().add(
            DutyCheckpointScanned(sessionId: duty.session!.id, code: code, method: 'QR'),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<DutyBloc, DutyState>(
      listenWhen: (a, b) => a.flash != b.flash || a.error != b.error,
      listener: (context, state) {
        final msg = state.error ?? state.flash;
        if (msg == null) return;
        final gagal = state.error != null;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
            content: Row(
              children: [
                Icon(gagal ? Icons.error_outline : Icons.check_circle_outline,
                    color: gagal ? P.danger : P.emerald, size: 18),
                const SizedBox(width: 10),
                Expanded(child: Text(msg, style: const TextStyle(fontSize: 13))),
              ],
            ),
            backgroundColor: P.panel,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: (gagal ? P.danger : P.emerald).withOpacity(.4)),
            ),
            duration: const Duration(seconds: 3),
          ));
      },
      child: Scaffold(
        extendBody: true,
        body: AnimatedSwitcher(
          duration: const Duration(milliseconds: 260),
          transitionBuilder: (child, anim) => FadeTransition(
            opacity: anim,
            child: SlideTransition(
              position: Tween(begin: const Offset(0, .015), end: Offset.zero).animate(anim),
              child: child,
            ),
          ),
          child: IndexedStack(
            key: ValueKey(_index),
            index: _index,
            children: const [
              HomeScreen(),
              PatrolScreen(),
              ServicesScreen(),
              IncidentsScreen(),
              ProfileScreen(),
            ],
          ),
        ),
        floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
        floatingActionButton: _ScanButton(onTap: _scan),
        bottomNavigationBar: _BottomBar(
          index: _index,
          onTap: (i) => setState(() => _index = i),
        ),
      ),
    );
  }
}

class _ScanButton extends StatefulWidget {
  final VoidCallback onTap;
  const _ScanButton({required this.onTap});

  @override
  State<_ScanButton> createState() => _ScanButtonState();
}

class _ScanButtonState extends State<_ScanButton> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 74,
      height: 74,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Stack(
          alignment: Alignment.center,
          children: [
            Opacity(
              opacity: (1 - _c.value) * .45,
              child: Container(
                width: 58 + _c.value * 20,
                height: 58 + _c.value * 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: P.amber.withOpacity(.7)),
                ),
              ),
            ),
            GestureDetector(
              onTap: widget.onTap,
              child: Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [P.amberSoft, P.amber],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(color: P.voidBg, width: 4),
                  boxShadow: [
                    BoxShadow(color: P.amber.withOpacity(.45), blurRadius: 26, spreadRadius: -4),
                  ],
                ),
                child: const Icon(Icons.qr_code_scanner, color: Colors.black, size: 26),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  const _BottomBar({required this.index, required this.onTap});

  static const _items = [
    (Icons.grid_view_rounded, 'Beranda', 0),
    (Icons.route_outlined, 'Patroli', 1),
    (Icons.apps_rounded, 'Layanan', 2),
    (Icons.warning_amber_rounded, 'Insiden', 3),
    (Icons.person_outline, 'Profil', 4),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 74 + MediaQuery.of(context).padding.bottom,
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(
        color: P.abyss,
        border: Border(top: BorderSide(color: P.line)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _items.length; i++) ...[
            // Ruang untuk tombol pindai yang menggantung di tengah
            if (i == 2) const SizedBox(width: 74),
            Expanded(
              child: _Tab(
                icon: _items[i].$1,
                label: _items[i].$2,
                active: index == _items[i].$3,
                onTap: () => onTap(_items[i].$3),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _Tab({required this.icon, required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 240),
            height: 3,
            width: active ? 20 : 0,
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(color: P.amber, borderRadius: BorderRadius.circular(9)),
          ),
          Icon(icon, size: 21, color: active ? P.amber : P.muted),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: active ? FontWeight.w800 : FontWeight.w500,
              color: active ? P.amber : P.muted,
            ),
          ),
        ],
      ),
    );
  }
}
