import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map, Route, ShieldCheck, CalendarDays, Fingerprint, AlertTriangle,
  Users, Building2, MapPin, UserSquare2, Car, ClipboardList, Boxes, Megaphone,
  BarChart3, ScrollText, LogOut, Bell, Menu, Radio, Siren, ChevronsLeft, ChevronsRight, Search,
  ClipboardCheck, Trophy, Layers, CalendarClock, Volume2, ShieldAlert,
} from 'lucide-react';
import { useAuth, useToast, getSocket, toast } from '../lib/store';
import { api } from '../lib/api';
import { Avatar } from './ui';
import { ConfirmHost, ask } from './confirm';
import { dt, ago } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: any;
  roles?: string[];
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operasi',
    items: [
      { to: '/', label: 'Pusat Komando', icon: LayoutDashboard },
      { to: '/peta', label: 'Peta Situasi', icon: Map },
      { to: '/patroli', label: 'Sesi Patroli', icon: Route },
      { to: '/insiden', label: 'Insiden', icon: AlertTriangle },
      { to: '/tugas', label: 'Tugas & Instruksi', icon: ClipboardCheck },
      { to: '/darurat', label: 'Sinyal Darurat', icon: Siren, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'CLIENT'] },
    ],
  },
  {
    group: 'Personel',
    items: [
      { to: '/jadwal', label: 'Jadwal Jaga', icon: CalendarDays },
      { to: '/presensi', label: 'Presensi', icon: Fingerprint },
      { to: '/personel', label: 'Data Personel', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'CLIENT'] },
      { to: '/serah-terima', label: 'Serah Terima', icon: ClipboardList },
      { to: '/cuti', label: 'Cuti & Lembur', icon: CalendarClock },
    ],
  },
  {
    group: 'Pos Jaga',
    items: [
      { to: '/tamu', label: 'Buku Tamu', icon: UserSquare2 },
      { to: '/kendaraan', label: 'Lalu Lintas Kendaraan', icon: Car },
      { to: '/inventaris', label: 'Inventaris', icon: Boxes },
    ],
  },
  {
    group: 'Konfigurasi',
    items: [
      { to: '/klien', label: 'Klien', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { to: '/site', label: 'Site & Lokasi', icon: MapPin, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'CLIENT'] },
      { to: '/titik', label: 'Titik & Rute', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] },
      { to: '/lantai', label: 'Lantai & Regu', icon: Layers, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] },
      { to: '/sirene', label: 'Darurat & Sirene', icon: Volume2, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] },
      { to: '/pengumuman', label: 'Pengumuman', icon: Megaphone },
    ],
  },
  {
    group: 'Analitik',
    items: [
      { to: '/kpi', label: 'Penilaian Kinerja', icon: Trophy, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'CLIENT'] },
      { to: '/laporan', label: 'Laporan & Ekspor', icon: BarChart3 },
      { to: '/integritas', label: 'Integritas & Perangkat', icon: ShieldAlert, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] },
      { to: '/jejak-audit', label: 'Jejak Audit', icon: ScrollText, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] },
    ],
  },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden md:block text-right leading-tight">
      <div className="num text-sm font-bold text-ink">
        {now.toLocaleTimeString('id-ID', { hour12: false })}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted">
        {now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })} · WIB
      </div>
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const r = await api.get<{ data: any[]; unread: number }>('/frontdesk/notifications');
      setItems(r.data);
      setUnread(r.unread);
    } catch {}
  };

  useEffect(() => {
    load();
    const s = getSocket();
    const onNotif = () => load();
    s.on('notification:new', onNotif);
    const id = setInterval(load, 60000);
    return () => {
      s.off('notification:new', onNotif);
      clearInterval(id);
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread) api.post('/frontdesk/notifications/read', {}).then(load).catch(() => {});
        }}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-panel2/60 text-muted hover:text-amber hover:border-amber/40 transition"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              className="panel absolute right-0 top-11 z-50 w-[360px] max-h-[70vh] overflow-hidden flex flex-col"
            >
              <div className="panel-head">
                <h3 className="panel-title">Notifikasi</h3>
                <span className="subtle">{items.length} terbaru</span>
              </div>
              <div className="overflow-y-auto divide-y divide-line/60">
                {items.length === 0 && <p className="p-6 text-center text-sm text-muted">Belum ada notifikasi</p>}
                {items.map((n) => (
                  <div key={n.id} className={clsx('px-4 py-3 hover:bg-white/[.03]', !n.readAt && 'bg-amber/[.04]')}>
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted line-clamp-2">{n.body}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted/60">{ago(n.createdAt)}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toasts() {
  const items = useToast((s) => s.items);
  const drop = useToast((s) => s.drop);
  const tone = {
    ok: 'border-emerald/40 bg-emerald/10 text-emerald',
    error: 'border-danger/45 bg-danger/10 text-danger',
    warn: 'border-amber/40 bg-amber/10 text-amber',
    info: 'border-cyan/40 bg-cyan/10 text-cyan',
  } as const;
  return (
    <div className="fixed bottom-5 right-5 z-[2000] flex w-[340px] flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            onClick={() => drop(t.id)}
            className={clsx('panel cursor-pointer border px-4 py-3', tone[t.tone])}
          >
            <p className="text-sm font-bold">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-ink/70">{t.body}</p>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function Layout() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(localStorage.getItem('patroli_rail') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('patroli_rail', collapsed ? '1' : '0');
  }, [collapsed]);

  // Sinyal darurat & insiden kritis muncul seketika di seluruh halaman.
  useEffect(() => {
    if (!me) return;
    const s = getSocket();
    const onPanic = (a: any) => {
      toast.err('🚨 SINYAL DARURAT', `${a?.guard?.name ?? 'Anggota'} di ${a?.site?.name ?? 'lokasi'}`);
      try {
        new Audio(
          'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
        ).play().catch(() => {});
      } catch {}
    };
    const onIncident = (i: any) => toast.warn('Insiden baru', `${i?.code ?? ''} ${i?.title ?? ''}`);
    s.on('panic:new', onPanic);
    s.on('incident:new', onIncident);
    return () => {
      s.off('panic:new', onPanic);
      s.off('incident:new', onIncident);
    };
  }, [me]);

  const groups = useMemo(
    () =>
      NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.roles || (me && i.roles.includes(me.role))),
      })).filter((g) => g.items.length),
    [me]
  );

  const rail = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.group} className="mb-2">
          {!collapsed && (
            <p className="px-3 pb-1.5 pt-3 text-[9.5px] font-bold uppercase tracking-[.2em] text-muted/50">
              {g.group}
            </p>
          )}
          {g.items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => clsx('rail-item', isActive && 'rail-item-active', collapsed && 'justify-center px-2')}
              title={collapsed ? i.label : undefined}
            >
              <i.icon size={16} className="shrink-0" />
              {!collapsed && <span className="truncate">{i.label}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-void">
      {/* Rel navigasi */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col border-r border-line/70 bg-abyss/80 backdrop-blur-xl transition-[width] duration-300',
          collapsed ? 'w-[74px]' : 'w-[250px]'
        )}
      >
        <div className={clsx('flex items-center gap-2.5 border-b border-line/70 px-4 py-4', collapsed && 'justify-center px-2')}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber/15 border border-amber/30">
            <ShieldCheck size={18} className="text-amber" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-[.18em] text-ink">PATROLI</p>
              <p className="text-[9.5px] uppercase tracking-[.16em] text-muted">Command Center</p>
            </div>
          )}
        </div>
        {rail}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-3 flex items-center justify-center gap-2 rounded-xl border border-line/70 py-2 text-xs text-muted hover:text-amber hover:border-amber/40 transition"
        >
          {collapsed ? <ChevronsRight size={14} /> : <><ChevronsLeft size={14} /> Ciutkan</>}
        </button>
      </aside>

      {/* Rel versi ponsel */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-void/80 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-line bg-abyss lg:hidden"
            >
              <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber/15 border border-amber/30">
                  <ShieldCheck size={18} className="text-amber" />
                </div>
                <p className="text-sm font-extrabold tracking-[.18em]">PATROLI</p>
              </div>
              {rail}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Area utama */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-line/70 bg-abyss/60 px-4 py-3 backdrop-blur-xl">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden rounded-lg p-2 text-muted hover:text-ink">
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1.5">
            <Radio size={12} className="text-emerald animate-ticker" />
            <span className="text-[10.5px] font-bold uppercase tracking-[.14em] text-emerald">Sistem Aktif</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Clock />
            <Notifications />
            <button
              onClick={() => nav('/profil')}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-panel2/60 py-1.5 pl-1.5 pr-3 hover:border-amber/40 transition"
            >
              <Avatar name={me?.name} url={me?.avatarUrl} size={28} />
              <div className="hidden text-left leading-tight sm:block">
                <p className="max-w-[140px] truncate text-xs font-bold text-ink">{me?.name}</p>
                <p className="text-[9.5px] uppercase tracking-widest text-amber">{me?.rank || me?.role}</p>
              </div>
            </button>
            <button
              onClick={async () => {
                if (await ask.logout()) logout();
              }}
              title="Keluar"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-panel2/60 text-muted hover:text-danger hover:border-danger/40 transition"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-grid [background-size:44px_44px]">
          <div className="mx-auto max-w-[1600px] p-5 lg:p-7 animate-riseIn">
            <Outlet />
          </div>
        </main>
      </div>

      <Toasts />
      <ConfirmHost />
    </div>
  );
}
