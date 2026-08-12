import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';
import {
  ShieldCheck, Users, Route as RouteIcon, AlertTriangle, Siren, UserSquare2,
  Clock3, Activity, TrendingUp, MapPinned, ArrowUpRight, Timer,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/store';
import { Panel, Stat, Ring, Chip, Avatar, Loading, Empty, Bar as ProgressBar, PageHead } from '../components/ui';
import MapView from '../components/MapView';
import { ago, dt, num, pct, label, CATEGORY_LABEL } from '../lib/format';

const SEV_COLOR: Record<string, string> = {
  LOW: '#34D399',
  MEDIUM: '#FFB020',
  HIGH: '#FB923C',
  CRITICAL: '#FF5A5A',
};

const FEED_TONE: Record<string, string> = {
  SCAN: 'border-cyan/35 bg-cyan/10 text-cyan',
  INCIDENT: 'border-amber/35 bg-amber/10 text-amber',
  ATTENDANCE: 'border-emerald/35 bg-emerald/10 text-emerald',
  PANIC: 'border-danger/40 bg-danger/10 text-danger',
};

const FEED_LABEL: Record<string, string> = {
  SCAN: 'Pindai',
  INCIDENT: 'Insiden',
  ATTENDANCE: 'Presensi',
  PANIC: 'Darurat',
};

export default function Dashboard() {
  const qc = useQueryClient();

  const dash = useQuery({ queryKey: ['dash'], queryFn: () => api.get('/reports/dashboard'), refetchInterval: 45000 });
  const trend = useQuery({ queryKey: ['trend'], queryFn: () => api.get('/reports/trend/compliance?days=14') });
  const incSum = useQuery({ queryKey: ['incsum'], queryFn: () => api.get('/reports/incidents/summary') });
  const feed = useQuery({ queryKey: ['feed'], queryFn: () => api.get('/reports/feed'), refetchInterval: 30000 });
  const active = useQuery({ queryKey: ['active'], queryFn: () => api.get('/patrols/active'), refetchInterval: 25000 });
  const mapData = useQuery({ queryKey: ['map'], queryFn: () => api.get('/reports/map'), refetchInterval: 30000 });
  const ranking = useQuery({ queryKey: ['ranking'], queryFn: () => api.get('/reports/guards/ranking') });

  // Setiap kejadian realtime langsung menyegarkan panel terkait.
  useEffect(() => {
    const s = getSocket();
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
      qc.invalidateQueries({ queryKey: ['active'] });
    };
    const events = ['patrol:scan', 'patrol:start', 'patrol:end', 'incident:new', 'attendance:update', 'panic:new'];
    events.forEach((e) => s.on(e, refresh));
    const onLoc = () => qc.invalidateQueries({ queryKey: ['map'] });
    s.on('location:update', onLoc);
    return () => {
      events.forEach((e) => s.off(e, refresh));
      s.off('location:update', onLoc);
    };
  }, [qc]);

  const d = dash.data || {};
  const sum = incSum.data || {};

  return (
    <>
      <PageHead
        crumb="Operasi"
        title="Pusat Komando"
        desc="Ringkasan situasi seluruh site, patroli berjalan, dan kejadian terbaru."
      >
        <Link to="/peta" className="btn-ghost btn-sm">
          <MapPinned size={14} /> Buka peta situasi
        </Link>
        <Link to="/laporan" className="btn-primary btn-sm">
          <TrendingUp size={14} /> Laporan
        </Link>
      </PageHead>

      {/* Baris statistik utama */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Anggota Bertugas"
          value={num(d.guardsOnDuty)}
          sub={`${num(d.lateToday)} terlambat hari ini`}
          icon={Users}
          tone="cyan"
        />
        <Stat
          label="Patroli Berjalan"
          value={num(d.activePatrols)}
          sub={`${num(d.patrolsCompleted)} dari ${num(d.patrolsToday)} tuntas hari ini`}
          icon={RouteIcon}
          tone="amber"
          pulse={d.activePatrols > 0}
        />
        <Stat
          label="Insiden Terbuka"
          value={num(d.openIncidents)}
          sub={d.overdueSla > 0 ? `${num(d.overdueSla)} lewat batas SLA` : 'Semua dalam batas SLA'}
          icon={AlertTriangle}
          tone={d.overdueSla > 0 ? 'danger' : 'violet'}
        />
        <Stat
          label="Sinyal Darurat Aktif"
          value={num(d.activePanics)}
          sub={d.activePanics > 0 ? 'Perlu respons segera' : 'Tidak ada sinyal aktif'}
          icon={Siren}
          tone={d.activePanics > 0 ? 'danger' : 'emerald'}
          pulse={d.activePanics > 0}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Kepatuhan */}
        <Panel title="Kepatuhan Patroli" icon={ShieldCheck} className="xl:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-5">
              <Ring value={d.complianceToday || 0} size={104} label="Hari ini" />
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[.16em] text-muted">Titik terlewat</p>
                  <p className="num text-xl font-bold text-danger">{num(d.missedCheckpointsToday)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[.16em] text-muted">Site dipantau</p>
                  <p className="num text-xl font-bold">{num(d.sitesCount)}</p>
                </div>
              </div>
            </div>
            <div className="h-[180px] flex-1">
              {trend.isLoading ? (
                <Loading />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.data || []}>
                    <defs>
                      <linearGradient id="gComp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFB020" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#FFB020" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1F2A40" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => String(v).slice(8)}
                      tick={{ fill: '#7A8AA6', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis domain={[0, 100]} tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip
                      contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: '#7A8AA6' }}
                      formatter={(v: any) => [`${v}%`, 'Kepatuhan']}
                    />
                    <Area type="monotone" dataKey="compliance" stroke="#FFB020" strokeWidth={2} fill="url(#gComp)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Panel>

        {/* Insiden per keparahan */}
        <Panel title="Sebaran Insiden 30 Hari" icon={AlertTriangle}>
          <div className="flex items-center gap-4">
            <div className="h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sum.bySeverity || []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {(sum.bySeverity || []).map((e: any) => (
                      <Cell key={e.name} fill={SEV_COLOR[e.name] || '#7A8AA6'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any, n: any) => [v, label(n)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {(sum.bySeverity || []).map((s: any) => (
                <div key={s.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: SEV_COLOR[s.name] }} />
                    {label(s.name)}
                  </span>
                  <span className="num text-sm font-bold">{s.value}</span>
                </div>
              ))}
              <div className="mt-3 border-t border-line/60 pt-3">
                <p className="text-[10px] uppercase tracking-[.16em] text-muted">Kepatuhan SLA</p>
                <p className="num text-lg font-bold text-emerald">{pct(sum.slaCompliance)}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Patroli berjalan */}
        <Panel
          title="Patroli Sedang Berjalan"
          icon={Activity}
          className="xl:col-span-2"
          bodyClass="p-0"
          action={<Link to="/patroli" className="subtle hover:text-amber">Semua sesi →</Link>}
        >
          {active.isLoading ? (
            <Loading />
          ) : !active.data?.length ? (
            <Empty text="Tidak ada patroli yang sedang berjalan" hint="Sesi akan muncul otomatis saat anggota memulai patroli." />
          ) : (
            <div className="divide-y divide-line/60">
              {active.data.map((s: any) => {
                const total = s.route?.checkpoints?.length || s.totalCheckpoints || 1;
                const done = s.scans?.length || 0;
                const p = Math.round((done / total) * 100);
                return (
                  <Link
                    key={s.id}
                    to={`/patroli/${s.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[.025]"
                  >
                    <Avatar name={s.guard?.name} url={s.guard?.avatarUrl} size={38} ring="ring-2 ring-cyan/25" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">{s.guard?.name}</p>
                        <Chip value="IN_PROGRESS" />
                      </div>
                      <p className="truncate text-xs text-muted">
                        {s.route?.name} · {s.site?.name} · mulai {ago(s.startedAt)}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar value={p} tone="cyan" />
                        <span className="num shrink-0 text-[11px] font-bold text-cyan">
                          {done}/{total}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight size={15} className="shrink-0 text-muted" />
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Aliran kejadian */}
        <Panel
          title="Aliran Kejadian"
          icon={Clock3}
          bodyClass="p-0"
          action={<span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald"><span className="h-1.5 w-1.5 rounded-full bg-emerald animate-ticker" />Langsung</span>}
        >
          <div className="max-h-[420px] overflow-y-auto">
            {feed.isLoading ? (
              <Loading />
            ) : !feed.data?.length ? (
              <Empty text="Belum ada kejadian" />
            ) : (
              <ol className="relative px-5 py-4">
                <span className="absolute left-[30px] top-4 bottom-4 w-px bg-line/70" />
                {feed.data.map((f: any, i: number) => (
                  <li key={i} className="relative flex gap-3.5 pb-4 last:pb-0">
                    <span
                      className={`relative z-10 mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-lg border text-[8px] font-bold ${FEED_TONE[f.type]}`}
                    >
                      {FEED_LABEL[f.type]?.[0]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug text-ink">{f.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">{f.meta}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted/60">{ago(f.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Peta */}
        <Panel
          title="Peta Situasi"
          icon={MapPinned}
          className="xl:col-span-2"
          bodyClass="p-3"
          action={<Link to="/peta" className="subtle hover:text-amber">Layar penuh →</Link>}
        >
          {mapData.isLoading ? (
            <Loading />
          ) : (
            <MapView
              sites={mapData.data?.sites || []}
              guards={mapData.data?.presence || []}
              panics={mapData.data?.panics || []}
              height={340}
            />
          )}
        </Panel>

        {/* Peringkat anggota */}
        <Panel title="Peringkat Kinerja Anggota" icon={TrendingUp} bodyClass="p-0">
          {ranking.isLoading ? (
            <Loading />
          ) : !ranking.data?.length ? (
            <Empty text="Belum ada data kinerja" />
          ) : (
            <div className="divide-y divide-line/60">
              {ranking.data.slice(0, 7).map((g: any, i: number) => (
                <Link
                  key={g.guardId}
                  to={`/personel/${g.guardId}`}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[.025]"
                >
                  <span
                    className={`num grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
                      i === 0 ? 'bg-amber/20 text-amber' : i < 3 ? 'bg-cyan/15 text-cyan' : 'bg-white/5 text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <Avatar name={g.name} url={g.avatarUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{g.name}</p>
                    <p className="num text-[10.5px] text-muted">
                      {g.sessions} patroli · {pct(g.compliance)} kepatuhan
                    </p>
                  </div>
                  <span className="num text-sm font-bold text-amber">{g.score}</span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Insiden per Kategori" icon={AlertTriangle}>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(sum.byCategory || []).map((c: any) => ({ ...c, label: CATEGORY_LABEL[c.name] || c.name }))} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#1F2A40" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,.03)' }}
                  contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="value" fill="#22D3EE" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Ringkasan Pos Jaga" icon={UserSquare2}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: 'Tamu di dalam area', v: num(d.visitorsInside), c: 'text-cyan', i: UserSquare2 },
              { l: 'Insiden kritis aktif', v: num(d.criticalIncidents), c: 'text-danger', i: AlertTriangle },
              { l: 'Terlambat hari ini', v: num(d.lateToday), c: 'text-amber', i: Timer },
              { l: 'Patroli hari ini', v: num(d.patrolsToday), c: 'text-emerald', i: RouteIcon },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-line/70 bg-abyss/40 p-4">
                <x.i size={15} className={x.c} />
                <p className="num mt-2.5 text-2xl font-extrabold">{x.v}</p>
                <p className="mt-1 text-[11px] leading-tight text-muted">{x.l}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
