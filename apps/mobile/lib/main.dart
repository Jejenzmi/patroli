import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/theme.dart';
import 'blocs/auth_bloc.dart';
import 'blocs/duty_bloc.dart';
import 'screens/login_screen.dart';
import 'screens/shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID', null);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: P.abyss,
  ));
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
        title: 'PATROLI',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const _Gate(),
      ),
    );
  }
}

class _Gate extends StatelessWidget {
  const _Gate();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        switch (state.status) {
          case AuthStatus.authenticated:
            return const ShellScreen();
          case AuthStatus.unknown:
            return const _Splash();
          default:
            return const LoginScreen();
        }
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              height: 76,
              width: 76,
              decoration: BoxDecoration(
                color: P.amber.withOpacity(.12),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: P.amber.withOpacity(.35)),
              ),
              child: const Icon(Icons.shield_outlined, color: P.amber, size: 36),
            ),
            const SizedBox(height: 18),
            const Text('PATROLI',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 6)),
            const SizedBox(height: 6),
            const Kicker('Security Field App'),
            const SizedBox(height: 28),
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2, color: P.amber),
            ),
          ],
        ),
      ),
    );
  }
}
