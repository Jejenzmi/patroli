import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';

export interface Me {
  id: string;
  name: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'GUARD' | 'CLIENT';
  avatarUrl?: string | null;
  employeeId?: string | null;
  rank?: string | null;
  clientId?: string | null;
  homeSite?: { id: string; name: string } | null;
}

interface AuthState {
  me: Me | null;
  ready: boolean;
  setMe: (m: Me | null) => void;
  load: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  ready: false,
  setMe: (me) => set({ me }),
  load: async () => {
    if (!localStorage.getItem('patroli_token')) return set({ ready: true, me: null });
    try {
      const me = await api.get<Me>('/auth/me');
      set({ me, ready: true });
      connectSocket();
    } catch {
      set({ me: null, ready: true });
    }
  },
  login: async (username, password) => {
    const r = await api.post<{ token: string; user: Me }>('/auth/login', { username, password });
    localStorage.setItem('patroli_token', r.token);
    set({ me: r.user, ready: true });
    connectSocket();
  },
  logout: () => {
    localStorage.removeItem('patroli_token');
    disconnectSocket();
    set({ me: null });
    location.href = '/masuk';
  },
}));

/* ── Kanal realtime ── */

let socket: Socket | null = null;

export function connectSocket() {
  if (socket?.connected) return socket;
  socket = io('/', { path: '/socket.io', auth: { token: localStorage.getItem('patroli_token') } });
  socket.on('connect_error', () => {});
  return socket;
}
export function getSocket() {
  return socket || connectSocket();
}
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/* ── Pesan singkat (toast) ── */

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'ok' | 'warn' | 'error' | 'info';
}

interface ToastState {
  items: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  drop: (id: number) => void;
}

export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { ...t, id }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 5200);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export const toast = {
  ok: (title: string, body?: string) => useToast.getState().push({ title, body, tone: 'ok' }),
  err: (title: string, body?: string) => useToast.getState().push({ title, body, tone: 'error' }),
  warn: (title: string, body?: string) => useToast.getState().push({ title, body, tone: 'warn' }),
  info: (title: string, body?: string) => useToast.getState().push({ title, body, tone: 'info' }),
};
