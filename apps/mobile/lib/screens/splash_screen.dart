import 'dart:math';
import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Layar pembuka: perisai PATROLI dengan sapuan radar.
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

    return Scaffold(
      backgroundColor: P.voidBg,
      body: Stack(
        alignment: Alignment.center,
        children: [
          // Cahaya latar
          Positioned(
            top: -100,
            child: Container(
              width: 380,
              height: 380,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: P.amber.withOpacity(.07),
              ),
            ),
          ),
          Positioned(
            bottom: -120,
            right: -80,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(shape: BoxShape.circle, color: P.cyan.withOpacity(.06)),
            ),
          ),

          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 210,
                height: 210,
                child: AnimatedBuilder(
                  animation: Listenable.merge([_radar, _intro]),
                  builder: (_, __) => Stack(
                    alignment: Alignment.center,
                    children: [
                      // Lingkaran radar
                      for (var i = 1; i <= 3; i++)
                        Container(
                          width: 70.0 * i,
                          height: 70.0 * i,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: P.amber.withOpacity(.10)),
                          ),
                        ),
                      // Sapuan
                      Transform.rotate(
                        angle: _radar.value * 2 * pi,
                        child: Container(
                          width: 210,
                          height: 210,
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
                          width: 92,
                          height: 92,
                          decoration: BoxDecoration(
                            color: P.abyss,
                            borderRadius: BorderRadius.circular(30),
                            border: Border.all(color: P.amber.withOpacity(.45), width: 1.5),
                            boxShadow: [
                              BoxShadow(color: P.amber.withOpacity(.25), blurRadius: 40, spreadRadius: -4),
                            ],
                          ),
                          child: const Icon(Icons.shield_outlined, color: P.amber, size: 44),
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
                    Text('PATROLI',
                        style: TextStyle(
                            fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 9, height: 1)),
                    SizedBox(height: 10),
                    Kicker('Security Field Operations'),
                  ],
                ),
              ),
            ],
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
