import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Timer, AlertTriangle, Route as RouteIcon, Phone, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { Panel, PageHead, Stat, Avatar, Loading, Chip, Ring, Table, Bar } from '../components/ui';
import { d, dt, num, pct } from '../lib/format';

export default function GuardDetail() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['guard', id], queryFn: () => api.get(`/users/${id}/performance`) });
  const track = useQuery({ queryKey: ['track', id], queryFn: () => api.get(`/patrols/tracking/history/${id}`) });

  if (isLoading) return <Loading label="Memuat profil personel…" />;
  if (!data?.user) return <p className="text-muted">Personel tidak ditemukan.</p>;

  const u = data.user;

  return (
    <>
      <Link to="/personel" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-amber">
        <ArrowLeft size={13} /> Kembali ke data personel
      </Link>

      <div className="panel mb-4 flex flex-wrap items-center gap-5 panel-pad">
        <Avatar name={u.name} url={u.avatarUrl} size={72} ring="ring-2 ring-amber/30" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{u.name}</h1>
          <p className="num mt-0.5 text-sm text-muted">
            {u.employeeId} · {u.rank || 'Anggota'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            {u.homeSite && <span className="flex items-center gap-1"><MapPin size={11} /> {u.homeSite.name}</span>}
            {u.phone && <span className="flex items-center gap-1"><Phone size={11} /> {u.phone}</span>}
            <span>Bergabung {d(u.joinedAt)}</span>
          </div>
        </div>
        <Ring value={data.avgCompliance} size={92} label="Kepatuhan" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Patroli 30 Hari" value={num(data.patrolTotal)} sub={`${num(data.patrolCompleted)} tuntas`} icon={RouteIcon} tone="cyan" />
        <Stat label="Kepatuhan Rata-rata" value={pct(data.avgCompliance)} icon={ShieldCheck} tone="amber" />
        <Stat label="Ketepatan Waktu" value={pct(data.punctuality)} sub={`${num(data.lateCount)} kali terlambat`} icon={Timer} tone={data.punctuality >= 90 ? 'emerald' : 'danger'} />
        <Stat label="Insiden Dilaporkan" value={num(data.incidentsReported)} icon={AlertTriangle} tone="violet" />
      </div>

      <Panel title="Sesi Patroli Terakhir" icon={RouteIcon} className="mt-4" bodyClass="p-0">
        <Table head={['Waktu', 'Rute', 'Site', 'Kepatuhan', 'Status', '']}>
          {(data.recentSessions || []).map((s: any) => (
            <tr key={s.id} className="transition hover:bg-white/[.025]">
              <td className="num text-xs">{dt(s.startedAt, 'DD MMM · HH:mm')}</td>
              <td className="text-[13px]">{s.route?.name}</td>
              <td className="text-[13px] text-muted">{s.site?.name}</td>
              <td className="min-w-[140px]">
                <div className="flex items-center gap-2">
                  <Bar value={s.complianceRate} tone={s.complianceRate >= 90 ? 'emerald' : 'amber'} />
                  <span className="num text-[11px] font-bold">{pct(s.complianceRate)}</span>
                </div>
              </td>
              <td><Chip value={s.status} /></td>
              <td className="text-right">
                <Link to={`/patroli/${s.id}`} className="btn-ghost btn-sm">Detail</Link>
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
