import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Palet "Command Center" — sama dengan aplikasi web agar identitas konsisten.
class P {
  static const voidBg = Color(0xFF05070C);
  static const abyss = Color(0xFF0A0E17);
  static const panel = Color(0xFF111726);
  static const panel2 = Color(0xFF161E31);
  static const line = Color(0xFF1F2A40);
  static const muted = Color(0xFF7A8AA6);
  static const ink = Color(0xFFE6EDF7);
  static const amber = Color(0xFFFFB020);
  static const amberSoft = Color(0xFFFFD27A);
  static const cyan = Color(0xFF22D3EE);
  static const violet = Color(0xFFA78BFA);
  static const emerald = Color(0xFF34D399);
  static const danger = Color(0xFFFF5A5A);
}



/// Lebar isi maksimal. Pada tablet, isi dipusatkan agar baris teks tidak
/// terlalu panjang dan tombol tidak melebar berlebihan.
const double kMaxContentWidth = 620;

/// Layar kecil (mis. 320–359 dp) memerlukan kisi dan jarak yang lebih rapat.
bool layarSempit(BuildContext context) => MediaQuery.sizeOf(context).width < 360;

/// Perangkat berlayar lebar (tablet).
bool layarLebar(BuildContext context) => MediaQuery.sizeOf(context).shortestSide >= 600;

/// Membatasi lebar isi dan memusatkannya pada layar lebar.
class IsiTerpusat extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  const IsiTerpusat({super.key, required this.child, this.maxWidth = kMaxContentWidth});

  @override
  Widget build(BuildContext context) => Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: child,
        ),
      );
}

/// Tinggi bilah navigasi bawah pada kerangka utama.
const double kNavBarHeight = 74;

/// Jarak aman bawah untuk isi tab: bilah navigasi + tonjolan tombol pindai.
/// Dipakai agar tidak ada tombol atau kartu yang tertutup tombol pindai.
double bottomInset(BuildContext context) =>
    kNavBarHeight + MediaQuery.of(context).padding.bottom + 34;

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: P.voidBg,
    colorScheme: base.colorScheme.copyWith(
      primary: P.amber,
      secondary: P.cyan,
      surface: P.panel,
      error: P.danger,
      onPrimary: Colors.black,
      onSurface: P.ink,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: P.abyss,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: P.ink,
        fontSize: 17,
        fontWeight: FontWeight.w800,
        letterSpacing: .2,
      ),
      systemOverlayStyle: SystemUiOverlayStyle.light,
    ),
    cardTheme: CardTheme(
      color: P.panel,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: P.line),
      ),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: P.abyss,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: P.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: P.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: P.amber, width: 1.4),
      ),
      labelStyle: const TextStyle(color: P.muted, fontSize: 13),
      hintStyle: const TextStyle(color: Color(0x807A8AA6), fontSize: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: P.amber,
        foregroundColor: Colors.black,
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 22),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: P.ink,
        side: const BorderSide(color: P.line),
        padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textTheme: base.textTheme.apply(bodyColor: P.ink, displayColor: P.ink),
    dividerTheme: const DividerThemeData(color: P.line, thickness: 1, space: 1),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: P.abyss,
      selectedItemColor: P.amber,
      unselectedItemColor: P.muted,
      type: BottomNavigationBarType.fixed,
      showUnselectedLabels: true,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: P.panel2,
      contentTextStyle: const TextStyle(color: P.ink),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      behavior: SnackBarBehavior.floating,
    ),
    dialogTheme: DialogTheme(
      backgroundColor: P.panel,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: P.line),
      ),
    ),
  );
}

/// Label kecil huruf kapital dengan jarak huruf lebar — aksen khas tema ini.
class Kicker extends StatelessWidget {
  final String text;
  final Color color;
  const Kicker(this.text, {super.key, this.color = P.muted});

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.6,
        ),
      );
}

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final Color? border;
  final VoidCallback? onTap;
  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.border,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: P.panel.withOpacity(.72),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: border ?? P.line),
          ),
          child: child,
        ),
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  final String text;
  final Color color;
  final IconData? icon;
  const StatusPill(this.text, {super.key, this.color = P.amber, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 11, color: color), const SizedBox(width: 5)],
          Text(
            text.toUpperCase(),
            style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: .8),
          ),
        ],
      ),
    );
  }
}
