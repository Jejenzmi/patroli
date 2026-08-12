import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/theme.dart';

class OnboardPage {
  final IconData icon;
  final Color color;
  final String title;
  final String body;
  const OnboardPage(this.icon, this.color, this.title, this.body);
}

const _pages = [
  OnboardPage(
    Icons.fingerprint,
    P.emerald,
    'Presensi tanpa titip absen',
    'Masuk dan pulang jaga dicatat bersama koordinat GPS dan swafoto. Sistem menolak presensi di luar radius pos.',
  ),
  OnboardPage(
    Icons.qr_code_scanner,
    P.cyan,
    'Bukti patroli yang sah',
    'Pindai QR atau NFC di setiap titik. Jarak, waktu, dan urutan pemeriksaan terekam otomatis sebagai bukti.',
  ),
  OnboardPage(
    Icons.report_gmailerrorred_outlined,
    P.amber,
    'Lapor kejadian saat itu juga',
    'Kirim laporan berfoto langsung dari lapangan. Pusat komando menerimanya seketika lengkap dengan tenggat penanganan.',
  ),
  OnboardPage(
    Icons.emergency_share_outlined,
    P.danger,
    'Bantuan sejauh satu tombol',
    'Tombol darurat mengirim posisi Anda ke pusat komando dan seluruh supervisor dalam hitungan detik.',
  ),
];

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onDone;
  const OnboardingScreen({super.key, required this.onDone});

  static Future<bool> sudahDilihat() async =>
      (await SharedPreferences.getInstance()).getBool('patroli_onboarded') ?? false;

  static Future<void> tandaiSelesai() async =>
      (await SharedPreferences.getInstance()).setBool('patroli_onboarded', true);

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    await OnboardingScreen.tandaiSelesai();
    widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    final page = _pages[_index];
    final last = _index == _pages.length - 1;

    return Scaffold(
      backgroundColor: P.voidBg,
      body: SafeArea(
        child: Column(
          children: [
            // Kepala: logo + lewati
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: P.amber.withOpacity(.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: P.amber.withOpacity(.35)),
                    ),
                    child: const Icon(Icons.shield_outlined, color: P.amber, size: 17),
                  ),
                  const SizedBox(width: 10),
                  const Text('PATROLI',
                      style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 3.5, fontSize: 14)),
                  const Spacer(),
                  TextButton(
                    onPressed: _finish,
                    child: const Text('Lewati', style: TextStyle(color: P.muted, fontSize: 13)),
                  ),
                ],
              ),
            ),

            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) {
                  final p = _pages[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 30),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _Illustration(icon: p.icon, color: p.color),
                        const SizedBox(height: 44),
                        Text(
                          p.title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, height: 1.2),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          p.body,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: P.muted, fontSize: 14, height: 1.6),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Indikator + tombol
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 26),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _pages.length,
                      (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 280),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        height: 4,
                        width: i == _index ? 26 : 8,
                        decoration: BoxDecoration(
                          color: i == _index ? page.color : P.line,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: page.color,
                        foregroundColor: page.color == P.danger ? Colors.white : Colors.black,
                      ),
                      onPressed: () {
                        if (last) {
                          _finish();
                        } else {
                          _controller.nextPage(
                            duration: const Duration(milliseconds: 320),
                            curve: Curves.easeOutCubic,
                          );
                        }
                      },
                      icon: Icon(last ? Icons.login : Icons.arrow_forward, size: 18),
                      label: Text(last ? 'MULAI BERTUGAS' : 'LANJUT'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Ilustrasi sederhana: ikon di tengah cincin berputar.
class _Illustration extends StatefulWidget {
  final IconData icon;
  final Color color;
  const _Illustration({required this.icon, required this.color});

  @override
  State<_Illustration> createState() => _IllustrationState();
}

class _IllustrationState extends State<_Illustration> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(seconds: 9))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      height: 220,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Stack(
          alignment: Alignment.center,
          children: [
            Transform.rotate(
              angle: _c.value * 2 * pi,
              child: CustomPaint(
                size: const Size(220, 220),
                painter: _RingPainter(widget.color),
              ),
            ),
            Transform.rotate(
              angle: -_c.value * 2 * pi,
              child: Container(
                width: 148,
                height: 148,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: widget.color.withOpacity(.16)),
                ),
              ),
            ),
            Container(
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                color: widget.color.withOpacity(.13),
                borderRadius: BorderRadius.circular(34),
                border: Border.all(color: widget.color.withOpacity(.4)),
                boxShadow: [
                  BoxShadow(color: widget.color.withOpacity(.22), blurRadius: 46, spreadRadius: -6),
                ],
              ),
              child: Icon(widget.icon, color: widget.color, size: 46),
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final Color color;
  _RingPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 4;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..color = color.withOpacity(.5);

    // Busur terputus-putus mengelilingi ikon
    for (var i = 0; i < 6; i++) {
      final start = (i * pi / 3) + .12;
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius), start, .55, false, paint);
    }
    // Titik penanda
    final dot = Paint()..color = color;
    for (var i = 0; i < 3; i++) {
      final a = i * 2 * pi / 3;
      canvas.drawCircle(center + Offset(cos(a) * radius, sin(a) * radius), 3, dot);
    }
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) => old.color != color;
}
