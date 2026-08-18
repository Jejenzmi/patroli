import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar as RadarShape, LineChart, Line, Legend,
} from 'recharts';
import { BarChart3, Download, Building2, TrendingDown, Trophy, FileSpreadsheet, Siren } from 'lucide-react';
import { api, qs } from '../lib/api';
import { Panel, PageHead, Table, Loading, Empty, Avatar, Bar as ProgressBar, Stat } from '../components/ui';
import { dayjs, num, pct } from '../lib/format';

export default function Reports() {
  const [from, setFrom] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));

  const range = qs({ from, to });
  const siteSum = useQuery({ queryKey: ['site-sum', from, to], queryFn: () => api.get('/reports/sites/summary' + range) });
  const ranking = useQuery({ queryKey: ['rank', from, to], queryFn: () => api.get('/reports/guards/ranking' + range) });
  const missed = useQuery({ queryKey: ['missed', from, to], queryFn: () => api.get('/reports/checkpoints/missed' + range) });
  const trend = useQuery({ queryKey: ['trend30'], queryFn: () => api.get('/reports/trend/compliance?days=30') });
  const incSum = useQuery({ queryKey: ['inc-sum', from, to], queryFn: () => api.get('/reports/incidents/summary' + range) });
  const panic = useQuery({ queryKey: ['panic-sum', from, to], queryFn: () => api.get('/reports/panic/summary' + range) });

  const sites = siteSum.data || [];
  const totalPatrols = sites.reduce((a: number, s: any) => a + s.patrols, 0);
  const totalIncidents = sites.reduce((a: number, s: any) => a + s.incidents, 0);
  const avgCompliance = sites.length ? sites.reduce((a: number, s: any) => a + s.compliance, 0) / sites.length : 0;

  return (
    <>
      <PageHead crumb="Analitik" title="Laporan & Ekspor" desc="Rekapitulasi kepatuhan patroli, insiden, dan kinerja personel per periode.">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Patroli" value={num(totalPatrols)} icon={BarChart3} tone="cyan" />
        <Stat label="Kepatuhan Rata-rata" value={pct(avgCompliance)} icon={Trophy} tone="amber" />
        <Stat label="Total Insiden" value={num(totalIncidents)} icon={TrendingDown} tone="violet" />
        <Stat label="Kepatuhan SLA" value={pct(incSum.data?.slaCompliance)} icon={FileSpreadsheet} tone="emerald" />
      </div>

      <Panel title="Unduh Data Mentah" icon={Download} className="mb-4">
        <div className="flex flex-wrap gap-2">
          {[
            { k: 'patrols', l: 'Rekap Sesi Patroli' },
            { k: 'incidents', l: 'Rekap Insiden' },
            { k: 'attendance', l: 'Rekap Presensi' },
            { k: 'panic', l: 'Rekap Sinyal Darurat' },
            { k: 'attempts', l: 'Percobaan Presensi Ditolak' },
          ].map((x) => (
            <button key={x.k} className="btn-ghost btn-sm" onClick={() => api.downloadCsv(x.k, { from, to })}>
              <FileSpreadsheet size={13} /> {x.l} (CSV)
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Tren Kepatuhan 30 Hari" icon={BarChart3}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data || []}>
                <CartesianGrid stroke="#1F2A40" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#7A8AA6' }} />
                <Line type="monotone" dataKey="compliance" name="Kepatuhan %" stroke="#FFB020" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sessions" name="Jumlah sesi" stroke="#22D3EE" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Profil Risiko per Site" icon={Building2}>
          <div className="h-[260px]">
            {siteSum.isLoading ? (
              <Loading />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={sites.map((s: any) => ({ site: s.code, kepatuhan: s.compliance, insiden: Math.min(100, s.incidents * 10) }))}>
                  <PolarGrid stroke="#1F2A40" />
                  <PolarAngleAxis dataKey="site" tick={{ fill: '#7A8AA6', fontSize: 10 }} />
                  <RadarShape name="Kepatuhan" dataKey="kepatuhan" stroke="#FFB020" fill="#FFB020" fillOpacity={0.25} />
                  <RadarShape name="Indeks insiden" dataKey="insiden" stroke="#FF5A5A" fill="#FF5A5A" fillOpacity={0.15} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#7A8AA6' }} />
                  <Tooltip contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Rekap Tombol Darurat" icon={Siren} className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { l: 'Total sinyal', v: num(panic.data?.total), c: 'text-cyan' },
            { l: 'Masih aktif', v: num(panic.data?.aktif), c: 'text-danger' },
            { l: 'Rata-rata waktu respons', v: `${panic.data?.rataResponsMenit ?? 0} mnt`, c: 'text-amber' },
            { l: 'Rata-rata waktu tuntas', v: `${panic.data?.rataTuntasMenit ?? 0} mnt`, c: 'text-emerald' },
          ].map((x) => (
            <div key={x.l} className="rounded-xl border border-line/70 bg-abyss/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[.14em] text-muted">{x.l}</p>
              <p className={`num mt-1 text-xl font-extrabold ${x.c}`}>{x.v}</p>
            </div>
          ))}
        </div>
        {panic.data?.data?.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table>
              <thead>
                <tr>{['Waktu', 'Anggota', 'Site', 'Lantai', 'Status', 'Respons'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {panic.data.data.slice(0, 8).map((p: any) => (
                  <tr key={p.id}>
                    <td className="num text-[12px]">{dayjs(p.createdAt).format('DD MMM · HH:mm')}</td>
                    <td className="text-[12.5px]">{p.guard?.name}</td>
                    <td className="text-[12px] text-muted">{p.site?.name}</td>
                    <td className="text-[12px] text-muted">{p.floor?.name || '—'}</td>
                    <td className="text-[12px]">{p.status}</td>
                    <td className="num text-[12px]">
                      {p.acknowledgedAt
                        ? `${Math.round((new Date(p.acknowledgedAt).getTime() - new Date(p.createdAt).getTime()) / 60000)} mnt`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Rekapitulasi per Site" icon={Building2} className="mt-4" bodyClass="p-0">
        {siteSum.isLoading ? (
          <Loading />
        ) : !sites.length ? (
          <Empty text="Belum ada data pada periode ini" />
        ) : (
          <Table head={['Site', 'Klien', 'Patroli', 'Kepatuhan', 'Titik Terlewat', 'Insiden', 'Presensi', 'Tamu']}>
            {sites.map((s: any) => (
              <tr key={s.siteId} className="transition hover:bg-white/[.025]">
                <td>
                  <p className="text-[13px] font-semibold">{s.name}</p>
                  <p className="num text-[10px] text-muted">{s.code}</p>
                </td>
                <td className="text-[12px] text-muted">{s.client}</td>
                <td className="num text-[13px]">{num(s.patrols)}</td>
                <td className="min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={s.compliance} tone={s.compliance >= 90 ? 'emerald' : s.compliance >= 75 ? 'amber' : 'danger'} />
                    <span className="num text-[11px] font-bold">{pct(s.compliance)}</span>
                  </div>
                </td>
                <td className="num text-[13px] text-danger">{num(s.missed)}</td>
                <td className="num text-[13px]">{num(s.incidents)}</td>
                <td className="num text-[13px]">{num(s.attendance)}</td>
                <td className="num text-[13px]">{num(s.visitors)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Peringkat Kinerja Personel" icon={Trophy} bodyClass="p-0">
          {ranking.isLoading ? (
            <Loading />
          ) : !ranking.data?.length ? (
            <Empty text="Belum ada data kinerja" />
          ) : (
            <div className="max-h-[420px] divide-y divide-line/60 overflow-y-auto">
              {ranking.data.map((g: any, i: number) => (
                <div key={g.guardId} className="flex items-center gap-3 px-5 py-3">
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
                      {g.sessions} patroli · {pct(g.compliance)} kepatuhan · {pct(g.punctuality)} tepat waktu
                    </p>
                  </div>
                  <span className="num text-sm font-bold text-amber">{g.score}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Titik Paling Sering Terlewat" icon={TrendingDown} bodyClass="p-0">
          {missed.isLoading ? (
            <Loading />
          ) : !missed.data?.length ? (
            <Empty text="Tidak ada titik yang terlewat" hint="Kepatuhan patroli sempurna pada periode ini." />
          ) : (
            <div className="p-4">
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={missed.data.slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke="#1F2A40" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,.03)' }}
                      contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }}
                      formatter={(v: any, n: any, p: any) => [`${v}% (${p.payload.missed}/${p.payload.expected})`, 'Terlewat']}
                    />
                    <Bar dataKey="missRate" radius={[0, 6, 6, 0]} barSize={14}>
                      {missed.data.slice(0, 10).map((m: any, i: number) => (
                        <Cell key={i} fill={m.missRate > 30 ? '#FF5A5A' : m.missRate > 15 ? '#FFB020' : '#22D3EE'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
