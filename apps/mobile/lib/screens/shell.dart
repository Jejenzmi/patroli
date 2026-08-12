import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../core/theme.dart';
import '../blocs/duty_bloc.dart';
import 'home_screen.dart';
import 'patrol_screen.dart';
import 'incidents_screen.dart';
import 'profile_screen.dart';

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

  @override
  Widget build(BuildContext context) {
    // Pesan sukses/gagal dari bloc ditampilkan sekali di mana pun tab-nya.
    return BlocListener<DutyBloc, DutyState>(
      listenWhen: (a, b) => a.flash != b.flash || a.error != b.error,
      listener: (context, state) {
        final msg = state.error ?? state.flash;
        if (msg == null) return;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
            content: Text(msg),
            backgroundColor: state.error != null ? P.danger.withOpacity(.92) : P.emerald.withOpacity(.92),
            duration: const Duration(seconds: 3),
          ));
      },
      child: Scaffold(
        body: IndexedStack(
          index: _index,
          children: const [
            HomeScreen(),
            PatrolScreen(),
            IncidentsScreen(),
            ProfileScreen(),
          ],
        ),
        bottomNavigationBar: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: P.line)),
          ),
          child: BottomNavigationBar(
            currentIndex: _index,
            onTap: (i) => setState(() => _index = i),
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Beranda'),
              BottomNavigationBarItem(icon: Icon(Icons.route_outlined), activeIcon: Icon(Icons.route), label: 'Patroli'),
              BottomNavigationBarItem(icon: Icon(Icons.warning_amber_outlined), activeIcon: Icon(Icons.warning_amber), label: 'Insiden'),
              BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profil'),
            ],
          ),
        ),
      ),
    );
  }
}
