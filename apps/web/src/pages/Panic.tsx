import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Siren, CheckCircle2, ShieldCheck, Phone } from 'lucide-react';
import { api } from '../lib/api';
import { getSocket, toast } from '../lib/store';
import { Panel, PageHead, Chip, Avatar, Loading, Empty } from '../components/ui';
import MapView from '../components/MapView';
import { dt, ago } from '../lib/format';
import { ask } from '../components/confirm';

export default function Panic() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['panics'],
    queryFn: () => api.get('/incidents/panic/list'),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const s = getSocket();
    const r = () => qc.invalidateQueries({ queryKey: ['panics'] });
    s.on('panic:new', r);
    s.on('panic:ack', r);
    return () => {
      s.off('panic:new', r);
      s.off('panic:ack', r);
    };
  }, [qc]);

  const act = async (id: string, kind: 'ack' | 'resolve') => {
    const ok = await ask.action(
      kind === 'ack' ? 'Respons sinyal darurat?' : 'Tutup sinyal darurat?',
      kind === 'ack'
        ? 'Anggota akan menerima pemberitahuan bahwa bantuan sedang menuju lokasi, dan nama Anda tercatat sebagai penanggap.'
        : 'Sinyal ditandai selesai. Pastikan situasi di lapangan benar-benar sudah aman.',
      kind === 'ack' ? 'Ya, respons' : 'Ya, tutup'
    );
    if (!ok) return;
    try {
      await api.post(`/incidents/panic/${id}/${kind}`, {});
      toast.ok(kind === 'ack' ? 'Sinyal direspons' : 'Sinyal ditutup');
      qc.invalidateQueries({ queryKey: ['panics'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const rows = data || [];
  const active = rows.filter((r: any) => r.status !== 'RESOLVED');

  return (
    <>
      <PageHead crumb="Operasi" title="Sinyal Darurat" desc="Permintaan bantuan yang dikirim anggota dari aplikasi lapangan." />

      {active.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-danger/45 bg-danger/10 px-5 py-4">
          <Siren size={20} className="text-danger animate-ticker" />
          <div>
            <p className="text-sm font-bold text-danger">{active.length} sinyal darurat menunggu penanganan</p>
            <p className="text-xs text-muted">Hubungi anggota dan tugaskan tim pendukung sesegera mungkin.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Panel title="Daftar Sinyal" icon={Siren} bodyClass="p-0">
          {isLoading ? (
            <Loading />
          ) : !rows.length ? (
            <Empty text="Belum ada sinyal darurat" hint="Semoga tetap begini." />
          ) : (
            <div className="max-h-[65vh] divide-y divide-line/60 overflow-y-auto">
              {rows.map((p: any) => (
                <div key={p.id} className={`px-5 py-4 ${p.status === 'ACTIVE' ? 'bg-danger/[.05]' : ''}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={p.guard?.name} url={p.guard?.avatarUrl} size={38} ring={p.status === 'ACTIVE' ? 'ring-2 ring-danger/40' : ''} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold">{p.guard?.name}</p>
                        <Chip value={p.status} />
                      </div>
                      <p className="text-xs text-muted">{p.site?.name} · {dt(p.createdAt)} ({ago(p.createdAt)})</p>
                      {p.message && <p className="mt-1.5 text-[13px] text-ink/90">“{p.message}”</p>}
                      {p.acknowledgedBy && (
                        <p className="mt-1 text-[11px] text-emerald">
                          Direspons oleh {p.acknowledgedBy.name} · {ago(p.acknowledgedAt)}
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {p.guard?.phone && (
                          <a href={`tel:${p.guard.phone}`} className="btn-ghost btn-sm">
                            <Phone size={12} /> {p.guard.phone}
                          </a>
                        )}
                        {p.status === 'ACTIVE' && (
                          <button className="btn-primary btn-sm" onClick={() => act(p.id, 'ack')}>
                            <ShieldCheck size={12} /> Respons
                          </button>
                        )}
                        {p.status !== 'RESOLVED' && (
                          <button className="btn-ghost btn-sm" onClick={() => act(p.id, 'resolve')}>
                            <CheckCircle2 size={12} /> Tutup
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Sebaran Lokasi" icon={Siren} bodyClass="p-3">
          <MapView panics={rows.filter((r: any) => r.lat)} height={520} />
        </Panel>
      </div>
    </>
  );
}
