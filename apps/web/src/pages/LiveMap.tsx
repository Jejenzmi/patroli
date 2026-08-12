import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Radar, Users, Siren, MapPin, Crosshair } from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/store';
import { Panel, PageHead, Avatar, Chip, Loading, Empty } from '../components/ui';
import MapView from '../components/MapView';
import { ago } from '../lib/format';

export default function LiveMap() {
  const qc = useQueryClient();
  const [focus, setFocus] = useState<[number, number] | undefined>();
  const [onlyPanic, setOnlyPanic] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['map-live'],
    queryFn: () => api.get('/reports/map'),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const s = getSocket();
    const refresh = () => qc.invalidateQueries({ queryKey: ['map-live'] });
    s.on('location:update', refresh);
    s.on('panic:new', refresh);
    return () => {
      s.off('location:update', refresh);
      s.off('panic:new', refresh);
    };
  }, [qc]);

  const guards = data?.presence || [];
  const panics = (data?.panics || []).filter((p: any) => p.status === 'ACTIVE' || p.status === 'ACKNOWLEDGED');

  return (
    <>
      <PageHead crumb="Operasi" title="Peta Situasi" desc="Posisi anggota, site, titik patroli, dan sinyal darurat secara langsung.">
        <button className={`btn-sm ${onlyPanic ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setOnlyPanic((v) => !v)}>
          <Siren size={14} /> {onlyPanic ? 'Tampilkan semua' : 'Fokus darurat'}
        </button>
      </PageHead>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel bodyClass="p-3" className="overflow-hidden">
          {isLoading ? (
            <Loading label="Memuat peta…" />
          ) : (
            <MapView
              sites={onlyPanic ? [] : data?.sites || []}
              guards={onlyPanic ? [] : guards}
              panics={panics}
              center={focus}
              zoom={focus ? 17 : undefined}
              height="calc(100vh - 230px)"
            />
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Sinyal Darurat" icon={Siren} bodyClass="p-0">
            {!panics.length ? (
              <p className="px-5 py-6 text-center text-xs text-muted">Tidak ada sinyal darurat aktif</p>
            ) : (
              <div className="divide-y divide-line/60">
                {panics.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => p.lat && setFocus([p.lat, p.lng])}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-danger/[.06]"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-danger/40 bg-danger/15">
                      <Siren size={14} className="text-danger" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-danger">{p.guard?.name}</p>
                      <p className="truncate text-[11px] text-muted">{p.site?.name} · {ago(p.createdAt)}</p>
                    </div>
                    <Chip value={p.status} />
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Anggota Online"
            icon={Users}
            bodyClass="p-0"
            action={<span className="num text-xs font-bold text-cyan">{guards.length}</span>}
          >
            <div className="max-h-[38vh] overflow-y-auto">
              {!guards.length ? (
                <Empty text="Belum ada posisi terkirim" hint="Posisi muncul saat aplikasi lapangan aktif." />
              ) : (
                <div className="divide-y divide-line/60">
                  {guards.map((g: any) => (
                    <button
                      key={g.guardId}
                      onClick={() => setFocus([g.lat, g.lng])}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[.03]"
                    >
                      <Avatar name={g.name} size={32} ring="ring-2 ring-cyan/25" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{g.name}</p>
                        <p className="num truncate text-[10.5px] text-muted">
                          {g.lat.toFixed(5)}, {g.lng.toFixed(5)} · {ago(g.at)}
                        </p>
                      </div>
                      {g.batteryPct != null && (
                        <span className={`num text-[11px] font-bold ${g.batteryPct < 20 ? 'text-danger' : 'text-muted'}`}>
                          {g.batteryPct}%
                        </span>
                      )}
                      <Crosshair size={13} className="shrink-0 text-muted" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Site Terpantau" icon={MapPin} bodyClass="p-0">
            <div className="max-h-[26vh] overflow-y-auto divide-y divide-line/60">
              {(data?.sites || []).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setFocus([s.lat, s.lng])}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[.03]"
                >
                  <Radar size={14} className="shrink-0 text-amber" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{s.name}</p>
                    <p className="text-[10.5px] text-muted">{s.checkpoints?.length || 0} titik patroli</p>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
