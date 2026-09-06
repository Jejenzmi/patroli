import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/sinkron.dart';
import 'widgets/bilah_luring.dart';
import 'core/theme.dart';
import 'blocs/auth_bloc.dart';
import 'blocs/duty_bloc.dart';
import 'screens/login_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/shell.dart';
import 'screens/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID', null);
  // Tampilan tepi-ke-tepi: latar aplikasi menembus bilah status dan navigasi.
  // Ponsel dikunci potret; tablet dibiarkan bebas agar nyaman dipakai mendatar.
  final layar = WidgetsBinding.instance.platformDispatcher.views.first;
  final sisiTerpendek = layar.physicalSize.shortestSide / layar.devicePixelRatio;
  await SystemChrome.setPreferredOrientations(
    sisiTerpendek >= 600
        ? DeviceOrientation.values
        : [DeviceOrientation.portraitUp, DeviceOrientation.portraitDown],
  );
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarDividerColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.light,
  ));
  // Pengiriman ulang tindakan yang tertahan tanpa jaringan berjalan sejak
  // aplikasi dibuka. Sengaja tidak ditunggu: layar harus tampil lebih dulu,
  // apa pun keadaan penyimpanan dan jaringan.
  unawaited(Sinkron.i.mulai());
  runApp(const PatroliApp());
}

class PatroliApp extends StatelessWidget {
  const PatroliApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => AuthBloc()..add(AuthBootstrapped())),
        BlocProvider(create: (_) => DutyBloc()),
      ],
      child: MaterialApp(
        title: 'DHARMAPATI',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        // Pengaturan ukuran huruf sistem dibatasi agar tata letak tetap utuh
        // pada perangkat yang menyetel huruf sangat besar.
        // Bilah keadaan jaringan dipasang di atas seluruh rute, bukan hanya
        // layar utama: petugas bisa saja sedang membuka Tugas atau Buku Tamu
        // ketika sinyal hilang, dan justru di situ ia perlu tahu.
        builder: (context, child) => MediaQuery.withClampedTextScaling(
          minScaleFactor: 0.85,
          maxScaleFactor: 1.25,
          child: BilahLuring(child: child ?? const SizedBox.shrink()),
        ),
        home: const _Gate(),
      ),
    );
  }
}

/// Alur pembuka: splash → (pengenalan) → masuk → beranda.
class _Gate extends StatefulWidget {
  const _Gate();

  @override
  State<_Gate> createState() => _GateState();
}

class _GateState extends State<_Gate> {
  bool _splashSelesai = false;
  bool? _perluOnboarding;

  @override
  void initState() {
    super.initState();
    _mulai();
  }

  Future<void> _mulai() async {
    final sudah = await OnboardingScreen.sudahDilihat();
    // Splash tetap ditahan sejenak agar animasi pembuka terlihat utuh.
    await Future.delayed(const Duration(milliseconds: 2200));
    if (!mounted) return;
    setState(() {
      _perluOnboarding = !sudah;
      _splashSelesai = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 420),
      switchInCurve: Curves.easeOutCubic,
      transitionBuilder: (child, anim) => FadeTransition(
        opacity: anim,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, .03), end: Offset.zero).animate(anim),
          child: child,
        ),
      ),
      child: _isi(),
    );
  }

  Widget _isi() {
    if (!_splashSelesai) return const SplashScreen(key: ValueKey('splash'));

    if (_perluOnboarding == true) {
      return OnboardingScreen(
        key: const ValueKey('onboarding'),
        onDone: () => setState(() => _perluOnboarding = false),
      );
    }

    return BlocBuilder<AuthBloc, AuthState>(
      key: const ValueKey('gate'),
      builder: (context, state) {
        switch (state.status) {
          case AuthStatus.authenticated:
            return const ShellScreen(key: ValueKey('shell'));
          case AuthStatus.unknown:
            return const SplashScreen(key: ValueKey('splash-wait'));
          default:
            return const LoginScreen(key: ValueKey('login'));
        }
      },
    );
  }
}
