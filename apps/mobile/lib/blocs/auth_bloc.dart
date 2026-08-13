import 'dart:convert';
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../core/api.dart';
import '../models/models.dart';

/* ── Peristiwa ── */

abstract class AuthEvent extends Equatable {
  @override
  List<Object?> get props => [];
}

class AuthBootstrapped extends AuthEvent {}

class AuthLoginRequested extends AuthEvent {
  final String username, password;
  AuthLoginRequested(this.username, this.password);
  @override
  List<Object?> get props => [username, password];
}

class AuthLoggedOut extends AuthEvent {}

/* ── Keadaan ── */

enum AuthStatus { unknown, authenticated, unauthenticated, loading }

class AuthState extends Equatable {
  final AuthStatus status;
  final MeUser? user;
  final String? error;
  const AuthState({this.status = AuthStatus.unknown, this.user, this.error});

  AuthState copyWith({AuthStatus? status, MeUser? user, String? error}) =>
      AuthState(status: status ?? this.status, user: user ?? this.user, error: error);

  @override
  List<Object?> get props => [status, user?.id, error];
}

/* ── Bloc ── */

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc() : super(const AuthState()) {
    on<AuthBootstrapped>((e, emit) async {
      final token = await Session.token();
      if (token == null) return emit(const AuthState(status: AuthStatus.unauthenticated));
      try {
        final me = await Api.i.get('/auth/me');
        emit(AuthState(status: AuthStatus.authenticated, user: MeUser.fromJson(me)));
      } catch (_) {
        // Sesi kedaluwarsa: pakai data tersimpan bila ada, agar tetap bisa dibuka luring.
        final cached = await Session.userJson();
        if (cached != null) {
          emit(AuthState(status: AuthStatus.authenticated, user: MeUser.fromJson(jsonDecode(cached))));
        } else {
          await Session.clear();
          emit(const AuthState(status: AuthStatus.unauthenticated));
        }
      }
    });

    on<AuthLoginRequested>((e, emit) async {
      emit(const AuthState(status: AuthStatus.loading));
      try {
        final r = await Api.i.post('/auth/login', {
          'username': e.username,
          'password': e.password,
          // Penanda platform: server menolak akun klien di aplikasi lapangan.
          'platform': 'mobile',
        });
        final user = MeUser.fromJson(r['user']);
        // Aplikasi lapangan ditujukan untuk petugas; akun klien memakai portal web.
        if (user.role == 'CLIENT') {
          return emit(const AuthState(
            status: AuthStatus.unauthenticated,
            error: 'Akun klien dilayani lewat portal web patroli.gokar.id, bukan aplikasi lapangan.',
          ));
        }
        await Session.save(r['token'], jsonEncode(user.toJson()));
        emit(AuthState(status: AuthStatus.authenticated, user: user));
      } on ApiException catch (err) {
        emit(AuthState(status: AuthStatus.unauthenticated, error: err.message));
      } catch (err) {
        emit(AuthState(status: AuthStatus.unauthenticated, error: 'Gagal masuk: $err'));
      }
    });

    on<AuthLoggedOut>((e, emit) async {
      await Session.clear();
      emit(const AuthState(status: AuthStatus.unauthenticated));
    });
  }
}
