import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Route as RouteIcon, Download, Filter } from 'lucide-react';
import { api, qs } from '../lib/api';
import { Panel, PageHead, Table, Chip, Avatar, Loading, Empty, Bar, Select } from '../components/ui';
import { dt, t, pct, num } from '../lib/format';

export default function Patrols() {
  const [siteId, setSiteId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const { data, isLoading } = useQuery({
    queryKey: ['patrols', siteId, status, from, to],
    queryFn: () => api.get('/patrols' + qs({ siteId, status, from, to, limit: 200 })),
  });

  return (
    <>
      <PageHead crumb="Operasi" title="Sesi Patroli" desc="Riwayat putaran patroli beserta bukti pemindaian titik.">
        <button className="btn-ghost btn-sm" onClick={() => api.downloadCsv('patrols', { from, to })}>
          <Download size={14} /> Ekspor CSV
        </button>
      </PageHead>

      <Panel
        title="Penyaring"
        icon={Filter}
        className="mb-4"
        bodyClass="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="IN_PROGRESS">Berjalan</option>
          <option value="COMPLETED">Tuntas</option>
          <option value="ABANDONED">Terbengkalai</option>
        </Select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </Panel>

      <Panel title={`Daftar Sesi · ${num(data?.length || 0)}`} icon={RouteIcon} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty text="Tidak ada sesi patroli pada filter ini" />
        ) : (
          <Table head={['Anggota', 'Rute / Site', 'Mulai', 'Selesai', 'Kepatuhan', 'Status', '']}>
            {data.map((s: any) => (
              <tr key={s.id} className="transition hover:bg-white/[.025]">
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.guard?.name} url={s.guard?.avatarUrl} size={30} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{s.guard?.name}</p>
                      <p className="num text-[10.5px] text-muted">{s.guard?.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p className="text-[13px]">{s.route?.name}</p>
                  <p className="text-[11px] text-muted">{s.site?.name}</p>
                </td>
                <td className="num text-xs">{dt(s.startedAt, 'DD MMM · HH:mm')}</td>
                <td className="num text-xs">{s.endedAt ? t(s.endedAt) : '—'}</td>
                <td className="min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <Bar
                      value={s.complianceRate}
                      tone={s.complianceRate >= 90 ? 'emerald' : s.complianceRate >= 70 ? 'amber' : 'danger'}
                    />
                    <span className="num shrink-0 text-[11px] font-bold">{pct(s.complianceRate)}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    {s.scannedCount}/{s.totalCheckpoints} titik
                    {s.missedCount > 0 && <span className="text-danger"> · {s.missedCount} terlewat</span>}
                  </p>
                </td>
                <td>
                  <Chip value={s.status} />
                </td>
                <td className="text-right">
                  <Link to={`/patroli/${s.id}`} className="btn-ghost btn-sm">
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
