import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Kepala layar dengan gradien — dipakai konsisten di seluruh halaman.
class GradientHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget? bottom;
  final Color accent;
  final bool showBack;

  const GradientHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.bottom,
    this.accent = P.amber,
    this.showBack = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 14, 20, 18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withOpacity(.16), P.abyss, P.voidBg],
        ),
        border: const Border(bottom: BorderSide(color: P.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (showBack)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: _RoundButton(
                    icon: Icons.arrow_back,
                    onTap: () => Navigator.maybePop(context),
                  ),
                ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, height: 1.15)),
                    if (subtitle != null) ...[
                      const SizedBox(height: 3),
                      Text(subtitle!,
                          style: const TextStyle(color: P.muted, fontSize: 12.5, height: 1.35)),
                    ],
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          if (bottom != null) ...[const SizedBox(height: 16), bottom!],
        ],
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _RoundButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => Material(
        color: P.panel,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: P.line),
            ),
            child: Icon(icon, size: 18, color: P.ink),
          ),
        ),
      );
}

/// Tombol pintasan pada kisi layanan.
class QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final String? badge;

  const QuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: color.withOpacity(.13),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: color.withOpacity(.3)),
                ),
                child: Icon(icon, color: color, size: 23),
              ),
              if (badge != null)
                Positioned(
                  right: -4,
                  top: -4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: P.danger,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: P.voidBg, width: 1.5),
                    ),
                    child: Text(badge!,
                        style: const TextStyle(
                            color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, height: 1.25, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  final IconData? icon;

  const SectionTitle(this.title, {super.key, this.action, this.onAction, this.icon});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          if (icon != null) ...[Icon(icon, size: 15, color: P.amber), const SizedBox(width: 8)],
          Expanded(child: Kicker(title)),
          if (action != null)
            GestureDetector(
              onTap: onAction,
              child: Row(
                children: [
                  Text(action!,
                      style: const TextStyle(color: P.amber, fontSize: 11.5, fontWeight: FontWeight.w700)),
                  const Icon(Icons.chevron_right, size: 15, color: P.amber),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Kotak berkilau saat data sedang dimuat.
class Shimmer extends StatefulWidget {
  final double height;
  final double? width;
  final double radius;
  const Shimmer({super.key, this.height = 70, this.width, this.radius = 18});

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Container(
          height: widget.height,
          width: widget.width ?? double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(-1 + _c.value * 2, 0),
              end: Alignment(1 + _c.value * 2, 0),
              colors: [
                Colors.white.withOpacity(.03),
                Colors.white.withOpacity(.08),
                Colors.white.withOpacity(.03),
              ],
            ),
          ),
        ),
      );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? hint;
  final Widget? action;

  const EmptyState({super.key, required this.icon, required this.title, this.hint, this.action});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 32),
      child: Column(
        children: [
          Container(
            width: 62,
            height: 62,
            decoration: BoxDecoration(
              color: P.panel,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: P.line),
            ),
            child: Icon(icon, color: P.muted, size: 26),
          ),
          const SizedBox(height: 16),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          if (hint != null) ...[
            const SizedBox(height: 6),
            Text(hint!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: P.muted, fontSize: 12, height: 1.5)),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}

/// Petak angka ringkas.
class StatTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const StatTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: P.panel.withOpacity(.7),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: P.line),
        ),
        child: Column(
          children: [
            Icon(icon, size: 17, color: color),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 2),
            Text(label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: P.muted, fontSize: 10.5, height: 1.2)),
          ],
        ),
      ),
    );
  }
}

/// Kolom isian dengan label seragam.
class LabeledField extends StatelessWidget {
  final String label;
  final Widget child;
  const LabeledField({super.key, required this.label, required this.child});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Kicker(label),
            const SizedBox(height: 7),
            child,
          ],
        ),
      );
}

/// Animasi masuk berjenjang untuk daftar kartu.
class FadeInUp extends StatelessWidget {
  final Widget child;
  final int index;
  const FadeInUp({super.key, required this.child, this.index = 0});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 380 + (index.clamp(0, 8) * 55)),
      curve: Curves.easeOutCubic,
      builder: (_, v, child) => Opacity(
        opacity: v.clamp(0, 1),
        child: Transform.translate(offset: Offset(0, 18 * (1 - v)), child: child),
      ),
      child: child,
    );
  }
}
