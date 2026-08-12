import 'dart:ui';
import 'package:flutter/material.dart';
import '../core/theme.dart';

enum DialogTone { danger, warn, save, logout, info }

class _ToneStyle {
  final Color color;
  final IconData icon;
  const _ToneStyle(this.color, this.icon);
}

const _tones = {
  DialogTone.danger: _ToneStyle(P.danger, Icons.delete_outline),
  DialogTone.warn: _ToneStyle(P.amber, Icons.error_outline),
  DialogTone.save: _ToneStyle(P.cyan, Icons.save_outlined),
  DialogTone.logout: _ToneStyle(P.violet, Icons.logout),
  DialogTone.info: _ToneStyle(P.emerald, Icons.info_outline),
};

/// Dialog konfirmasi beranimasi — dipakai untuk seluruh tindakan penting.
Future<bool> askConfirm(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Ya, lanjutkan',
  String cancelLabel = 'Batal',
  String? detail,
  DialogTone tone = DialogTone.warn,
}) async {
  final style = _tones[tone]!;
  final result = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'tutup',
    barrierColor: Colors.black.withOpacity(.72),
    transitionDuration: const Duration(milliseconds: 260),
    pageBuilder: (_, __, ___) => const SizedBox.shrink(),
    transitionBuilder: (ctx, anim, __, ___) {
      final curved = CurvedAnimation(
        parent: anim,
        curve: Curves.easeOutBack,
        reverseCurve: Curves.easeIn,
      );
      return BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 6 * anim.value, sigmaY: 6 * anim.value),
        child: FadeTransition(
          opacity: anim,
          child: ScaleTransition(
            scale: Tween(begin: .88, end: 1.0).animate(curved),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 26),
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    decoration: BoxDecoration(
                      color: P.panel,
                      borderRadius: BorderRadius.circular(26),
                      border: Border.all(color: P.line),
                      boxShadow: [
                        BoxShadow(color: style.color.withOpacity(.18), blurRadius: 48, spreadRadius: -6),
                        const BoxShadow(color: Colors.black54, blurRadius: 30, offset: Offset(0, 18)),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Pita aksen
                        Container(
                          height: 4,
                          decoration: BoxDecoration(
                            color: style.color,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 26, 24, 20),
                          child: Column(
                            children: [
                              _PulseBadge(color: style.color, icon: style.icon),
                              const SizedBox(height: 18),
                              Text(
                                title,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, height: 1.25),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                message,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: P.muted, fontSize: 13, height: 1.5),
                              ),
                              if (detail != null) ...[
                                const SizedBox(height: 14),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                                  decoration: BoxDecoration(
                                    color: P.abyss.withOpacity(.7),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: P.line),
                                  ),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Icon(Icons.help_outline, size: 14, color: style.color),
                                      const SizedBox(width: 9),
                                      Expanded(
                                        child: Text(detail,
                                            style: const TextStyle(fontSize: 12, height: 1.45, color: P.ink)),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        Container(
                          decoration: const BoxDecoration(
                            border: Border(top: BorderSide(color: P.line)),
                          ),
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                          child: Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: Text(cancelLabel),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: FilledButton(
                                  style: FilledButton.styleFrom(
                                    backgroundColor: style.color,
                                    foregroundColor: tone == DialogTone.danger || tone == DialogTone.logout
                                        ? Colors.white
                                        : Colors.black,
                                  ),
                                  onPressed: () => Navigator.pop(ctx, true),
                                  child: Text(confirmLabel, textAlign: TextAlign.center),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
  return result ?? false;
}

/// Umpan balik keberhasilan: lencana centang beranimasi lalu menutup sendiri.
Future<void> showSuccess(
  BuildContext context, {
  required String title,
  String? message,
  Duration duration = const Duration(milliseconds: 1500),
}) async {
  showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'tutup',
    barrierColor: Colors.black.withOpacity(.7),
    transitionDuration: const Duration(milliseconds: 240),
    pageBuilder: (_, __, ___) => const SizedBox.shrink(),
    transitionBuilder: (ctx, anim, __, ___) => FadeTransition(
      opacity: anim,
      child: ScaleTransition(
        scale: Tween(begin: .9, end: 1.0)
            .animate(CurvedAnimation(parent: anim, curve: Curves.easeOutBack)),
        child: Center(
          child: Material(
            color: Colors.transparent,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 50),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 30),
              decoration: BoxDecoration(
                color: P.panel,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: P.emerald.withOpacity(.35)),
                boxShadow: [
                  BoxShadow(color: P.emerald.withOpacity(.18), blurRadius: 44, spreadRadius: -8),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _PulseBadge(color: P.emerald, icon: Icons.check_rounded, size: 58),
                  const SizedBox(height: 16),
                  Text(title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                  if (message != null) ...[
                    const SizedBox(height: 6),
                    Text(message,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: P.muted, fontSize: 12.5, height: 1.45)),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await Future.delayed(duration);
  if (context.mounted && Navigator.canPop(context)) Navigator.pop(context);
}

class _PulseBadge extends StatefulWidget {
  final Color color;
  final IconData icon;
  final double size;
  const _PulseBadge({required this.color, required this.icon, this.size = 62});

  @override
  State<_PulseBadge> createState() => _PulseBadgeState();
}

class _PulseBadgeState extends State<_PulseBadge> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size + 26,
      height: widget.size + 26,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Stack(
          alignment: Alignment.center,
          children: [
            // Riak yang menyebar keluar
            for (final phase in [0.0, 0.5])
              Builder(builder: (_) {
                final t = (_c.value + phase) % 1.0;
                return Opacity(
                  opacity: (1 - t) * .55,
                  child: Container(
                    width: widget.size * (1 + t * .55),
                    height: widget.size * (1 + t * .55),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: widget.color.withOpacity(.7), width: 1.4),
                    ),
                  ),
                );
              }),
            Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                color: widget.color.withOpacity(.14),
                borderRadius: BorderRadius.circular(widget.size * .34),
                border: Border.all(color: widget.color.withOpacity(.45)),
              ),
              child: Icon(widget.icon, color: widget.color, size: widget.size * .42),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lembar bawah bergaya seragam untuk formulir singkat.
Future<T?> showAppSheet<T>(
  BuildContext context, {
  required String title,
  String? subtitle,
  required Widget Function(BuildContext, void Function(void Function())) builder,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setSheet) => Container(
        decoration: const BoxDecoration(
          color: P.panel,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(
            top: BorderSide(color: P.line),
            left: BorderSide(color: P.line),
            right: BorderSide(color: P.line),
          ),
        ),
        padding: EdgeInsets.fromLTRB(20, 14, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(color: P.line, borderRadius: BorderRadius.circular(9)),
                ),
              ),
              const SizedBox(height: 18),
              Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
              if (subtitle != null) ...[
                const SizedBox(height: 4),
                Text(subtitle, style: const TextStyle(color: P.muted, fontSize: 12.5, height: 1.4)),
              ],
              const SizedBox(height: 18),
              builder(ctx, setSheet),
            ],
          ),
        ),
      ),
    ),
  );
}
