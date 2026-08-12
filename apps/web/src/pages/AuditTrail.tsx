import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Filter } from 'lucide-react';
import { api, qs } from '../lib/api';
import { Panel, PageHead, Table, Loading, Empty, Select, Chip } from '../components/ui';
import { dt, ago, label } from '../lib/format';

const ENTITIES = ['User', 'Site', 'Client', 'Checkpoint', 'PatrolRoute', 'PatrolSession', 'Schedule', 'Attendance', 'Incident', 'PanicAlert', 'Visitor'];

const ACTION_TONE: Record<string, string> = {
  LOGIN: 'CONFIRMED',
  CREATE: 'DONE',
  UPDATE: 'LATE',
  DELETE: 'ABSENT',
  DEACTIVATE: 'ABSENT',
  PANIC: 'ACTIVE',
  CHECK_IN: 'ON_TIME',
  CHECK_OUT: 'DONE',
  PATROL_START: 'IN_PROGRESS',
  PATROL_FINISH: 'COMPLETED',
};

export default function AuditTrail() {
  const [entity, setEntity] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['audit', entity],
    queryFn: () => api.get('/frontdesk/audit' + qs({ entity, limit: 300 })),
  });

  return (
    <>
      <PageHead crumb="Analitik" title="Jejak Audit" desc="Rekam jejak seluruh perubahan data dan tindakan pengguna sistem.">
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-auto">
          <option value="">Semua entitas</option>
          {ENTITIES.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </Select>
      </PageHead>

      <Panel title={`Catatan Aktivitas · ${data?.length ?? 0}`} icon={ScrollText} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !data?.length ? (
          <Empty text="Belum ada jejak audit" />
        ) : (
          <Table head={['Waktu', 'Pengguna', 'Tindakan', 'Entitas', 'Rincian', 'IP']}>
            {data.map((a: any) => (
              <tr key={a.id} className="transition hover:bg-white/[.025]">
                <td>
                  <p className="num text-[12.5px]">{dt(a.createdAt)}</p>
                  <p className="text-[10px] text-muted">{ago(a.createdAt)}</p>
                </td>
                <td>
                  <p className="text-[13px] font-semibold">{a.user?.name || 'Sistem'}</p>
                  <p className="text-[10px] text-muted">{label(a.user?.role)}</p>
                </td>
                <td><Chip value={ACTION_TONE[a.action] || 'PLANNED'}>{a.action}</Chip></td>
                <td className="text-[12.5px]">{a.entity}</td>
                <td className="num max-w-[280px] truncate text-[11px] text-muted">
                  {a.meta ? JSON.stringify(a.meta) : a.entityId || '—'}
                </td>
                <td className="num text-[11px] text-muted">{a.ip || '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}
