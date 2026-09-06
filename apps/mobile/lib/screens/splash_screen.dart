import 'dart:math';
import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Layar pembuka: lambang Dharmapati dengan sapuan radar.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _radar =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 2600))..repeat();
  late final AnimationController _intro =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();

  @override
  void dispose() {
    _radar.dispose();
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final logoScale = CurvedAnimation(parent: _intro, curve: Curves.easeOutBack);
    final textFade = CurvedAnimation(
      parent: _intro,
      curve: const Interval(.35, 1, curve: Curves.easeOut),
    );

    // Diameter radar mengikuti ruang layar agar tetap utuh di layar kecil.
    final ukuran = MediaQuery.sizeOf(context);
    final radar = [210.0, ukuran.width * .58, ukuran.height * .26]
        .reduce((a, b) => a < b ? a : b);

    return Scaffold(
      backgroundColor: P.voidBg,
      // fit: expand — tanpa ini Stack menyusut selebar anak terlebarnya,
      // sehingga isi layar pembuka menempel di sisi kiri pada sebagian perangkat.
      body: Stack(
        fit: StackFit.expand,
        alignment: Alignment.center,
        children: [
          // Cahaya latar lembut — memakai gradasi agar tidak terlihat
          // sebagai piringan pekat pada layar besar.
          Positioned(
            top: -150,
            child: Container(
              width: 420,
              height: 420,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [P.amber.withOpacity(.13), P.amber.withOpacity(.03), Colors.transparent],
                  stops: const [0, .5, 1],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -170,
            right: -110,
            child: Container(
              width: 360,
              height: 360,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [P.cyan.withOpacity(.10), P.cyan.withOpacity(.025), Colors.transparent],
                  stops: const [0, .5, 1],
                ),
              ),
            ),
          ),

          Center(
            child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: radar,
                height: radar,
                child: AnimatedBuilder(
                  animation: Listenable.merge([_radar, _intro]),
                  builder: (_, __) => Stack(
                    alignment: Alignment.center,
                    children: [
                      // Lingkaran radar
                      for (var i = 1; i <= 3; i++)
                        Container(
                          width: radar / 3 * i,
                          height: radar / 3 * i,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: P.amber.withOpacity(.10)),
                          ),
                        ),
                      // Sapuan
                      Transform.rotate(
                        angle: _radar.value * 2 * pi,
                        child: Container(
                          width: radar,
                          height: radar,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: SweepGradient(
                              colors: [
                                P.amber.withOpacity(.28),
                                Colors.transparent,
                                Colors.transparent,
                              ],
                              stops: const [0, .22, 1],
                            ),
                          ),
                        ),
                      ),
                      // Perisai
                      Transform.scale(
                        scale: logoScale.value,
                        child: Container(
                          width: radar * .44,
                          height: radar * .44,
                          decoration: BoxDecoration(
                            color: P.abyss,
                            borderRadius: BorderRadius.circular(radar * .143),
                            border: Border.all(color: P.amber.withOpacity(.45), width: 1.5),
                            boxShadow: [
                              BoxShadow(color: P.amber.withOpacity(.25), blurRadius: 40, spreadRadius: -4),
                            ],
                          ),
                          child: Padding(
                            padding: EdgeInsets.all(radar * .045),
                            child: Image.asset('assets/merek/logo.png', fit: BoxFit.contain),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 34),
              FadeTransition(
                opacity: textFade,
                child: const Column(
                  children: [
                    FittedBox(
                      child: Text('DHARMAPATI',
                          style: TextStyle(
                              fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 6, height: 1)),
                    ),
                    SizedBox(height: 10),
                    Kicker('Security Field Operations'),
                  ],
                ),
              ),
            ],
            ),
          ),

          Positioned(
            bottom: 54,
            child: FadeTransition(
              opacity: textFade,
              child: Column(
                children: [
                  SizedBox(
                    width: 130,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: const LinearProgressIndicator(
                        minHeight: 3,
                        backgroundColor: Color(0x141FFFFF),
                        valueColor: AlwaysStoppedAnimation(P.amber),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text('Menyiapkan perangkat tugas…',
                      style: TextStyle(color: P.muted, fontSize: 11.5)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
