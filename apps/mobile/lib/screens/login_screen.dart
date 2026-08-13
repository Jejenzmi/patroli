import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../core/theme.dart';
import '../blocs/auth_bloc.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _obscure = true;
  late final AnimationController _radar =
      AnimationController(vsync: this, duration: const Duration(seconds: 7))..repeat();

  @override
  void dispose() {
    _radar.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state.error != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.error!), backgroundColor: P.danger.withOpacity(.9)),
            );
          }
        },
        builder: (context, state) {
          final busy = state.status == AuthStatus.loading;
          return Stack(
            fit: StackFit.expand,
            children: [
              // Latar: cahaya lembut yang tidak menyisakan sudut tajam
              Positioned(
                top: -140,
                left: -110,
                child: AnimatedBuilder(
                  animation: _radar,
                  builder: (_, __) => Container(
                    width: 420,
                    height: 420,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          P.amber.withOpacity(.16 + _radar.value * .05),
                          P.amber.withOpacity(.04),
                          Colors.transparent,
                        ],
                        stops: const [0, .55, 1],
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: -170,
                right: -130,
                child: Container(
                  width: 380,
                  height: 380,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [P.cyan.withOpacity(.13), P.cyan.withOpacity(.03), Colors.transparent],
                      stops: const [0, .55, 1],
                    ),
                  ),
                ),
              ),

              SafeArea(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
                  child: Center(
                    child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            height: 52,
                            width: 52,
                            decoration: BoxDecoration(
                              color: P.amber.withOpacity(.12),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: P.amber.withOpacity(.35)),
                            ),
                            child: const Icon(Icons.shield_outlined, color: P.amber, size: 26),
                          ),
                          const SizedBox(width: 14),
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('PATROLI',
                                  style: TextStyle(
                                      fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: 5)),
                              SizedBox(height: 2),
                              Kicker('Aplikasi Lapangan'),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 48),
                      const Text(
                        'Selamat bertugas.',
                        style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, height: 1.1),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Masuk untuk presensi, memulai patroli, dan melaporkan kejadian dari lapangan.',
                        style: TextStyle(color: P.muted, fontSize: 14, height: 1.5),
                      ),
                      const SizedBox(height: 34),

                      const Kicker('Nama pengguna / NIP'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _user,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          hintText: 'mis. guard1',
                          prefixIcon: Icon(Icons.badge_outlined, color: P.muted, size: 20),
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Kicker('Kata sandi'),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _pass,
                        obscureText: _obscure,
                        onSubmitted: (_) => _submit(context),
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          prefixIcon: const Icon(Icons.lock_outline, color: P.muted, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(_obscure ? Icons.visibility_off : Icons.visibility,
                                color: P.muted, size: 20),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: busy ? null : () => _submit(context),
                          child: busy
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                                )
                              : const Text('MASUK'),
                        ),
                      ),
                      const SizedBox(height: 28),
                      GlassCard(
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline, size: 16, color: P.cyan),
                            const SizedBox(width: 10),
                            Expanded(
                              child: RichText(
                                text: const TextSpan(
                                  style: TextStyle(color: P.muted, fontSize: 12, height: 1.5),
                                  children: [
                                    TextSpan(text: 'Akun percobaan: '),
                                    TextSpan(
                                      text: 'guard1 / guard123',
                                      style: TextStyle(color: P.ink, fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
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
            ],
          );
        },
      ),
    );
  }

  void _submit(BuildContext context) {
    if (_user.text.trim().isEmpty || _pass.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Isi nama pengguna dan kata sandi')),
      );
      return;
    }
    context.read<AuthBloc>().add(AuthLoginRequested(_user.text.trim(), _pass.text));
  }
}
