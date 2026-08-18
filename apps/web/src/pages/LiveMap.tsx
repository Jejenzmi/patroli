import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Radar, Users, Siren, MapPin, Crosshair, Layers, Map as MapIcon } from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/store';
import { Panel, PageHead, Avatar, Chip, Loading, Empty } from '../components/ui';
import MapView from '../components/MapView';
import { ago } from '../lib/format';

export default function LiveMap() {
  const qc = useQueryClient();
  const [focus, setFocus] = useState<[number, number] | undefined>();
  const [onlyPanic, setOnlyPanic] = useState(false);
  // FR-GPS-003: penampil denah per lantai, memakai titik QR terakhir yang dipindai.
  const [tampilan, setTampilan] = useState<'peta' | 'denah'>('peta');
  const [lantaiAktif, setLantaiAktif] = useState<string | null>(null);

  const denah = useQuery({
    queryKey: ['map-floors'],
    queryFn: () => api.get('/reports/floors'),
    refetchInterval: 30000,
    enabled: tampilan === 'denah',
  });

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
        <button
          className={`btn-sm ${tampilan === 'denah' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTampilan((v) => (v === 'peta' ? 'denah' : 'peta'))}
        >
          {tampilan === 'denah' ? <MapIcon size={14} /> : <Layers size={14} />}
          {tampilan === 'denah' ? 'Peta luar' : 'Denah lantai'}
        </button>
        <button className={`btn-sm ${onlyPanic ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setOnlyPanic((v) => !v)}>
          <Siren size={14} /> {onlyPanic ? 'Tampilkan semua' : 'Fokus darurat'}
        </button>
      </PageHead>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel bodyClass="p-3" className="overflow-hidden">
          {tampilan === 'denah' ? (
            <PanelDenah
              floors={denah.data || []}
              memuat={denah.isLoading}
              aktif={lantaiAktif}
              setAktif={setLantaiAktif}
            />
          ) : isLoading ? (
            <Loading label="Memuat peta…" />
          ) : (
            <MapView
              sites={onlyPanic ? [] : data?.sites || []}
              guards={onlyPanic ? [] : guards}
              panics={panics}
              tracks={onlyPanic ? [] : data?.tracks || []}
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


/**
 * Denah per lantai beserta posisi anggota.
 *
 * Di dalam gedung, GPS tidak cukup teliti untuk menyebut lantai. Karena itu
 * yang ditampilkan adalah titik QR terakhir yang dipindai seseorang — satu-
 * satunya keberadaan yang benar-benar terbukti (FR-GPS-003).
 */
function PanelDenah({
  floors,
  memuat,
  aktif,
  setAktif,
}: {
  floors: any[];
  memuat: boolean;
  aktif: string | null;
  setAktif: (v: string) => void;
}) {
  if (memuat) return <Loading label="Memuat denah lantai…" />;
  if (!floors.length)
    return (
      <Empty
        text="Belum ada denah lantai"
        hint="Unggah denah pada halaman Lantai & Regu, lalu tempatkan titik patroli di atasnya."
      />
    );

  const dipilih = floors.find((f) => f.id === aktif) || floors[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="w-auto min-w-[220px]"
          value={dipilih.site?.id || ''}
          onChange={(e) => {
            const pertama = floors.find((f) => f.site?.id === e.target.value);
            if (pertama) setAktif(pertama.id);
          }}
        >
          {[...new Map(floors.map((f) => [f.site?.id, f.site?.name])).entries()].map(([id, nama]) => (
            <option key={id} value={id}>{nama}</option>
          ))}
        </select>
        {floors
          .filter((f) => f.site?.id === dipilih.site?.id)
          .map((f) => (
            <button
              key={f.id}
              onClick={() => setAktif(f.id)}
              className={`btn btn-sm ${
                f.id === dipilih.id
                  ? 'bg-amber/15 text-amber shadow-[inset_0_0_0_1px_rgba(255,176,32,.35)]'
                  : 'border border-line text-muted hover:text-ink'
              }`}
            >
              {f.name}
              {f.guards?.length > 0 && (
                <span className="num ml-1 rounded-md bg-emerald/15 px-1.5 py-0.5 text-[10px] text-emerald">
                  {f.guards.length}
                </span>
              )}
            </button>
          ))}
        <span className="ml-auto text-[11px] text-muted">
          {floors.reduce((n, f) => n + (f.guards?.length || 0), 0)} anggota terdeteksi di dalam gedung
        </span>
      </div>

      {!dipilih.planUrl ? (
        <Empty text={`Denah ${dipilih.name} belum diunggah`} hint="Unggah gambar denahnya di halaman Lantai & Regu." />
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-abyss">
          <img src={dipilih.planUrl} alt={`Denah ${dipilih.name}`} className="w-full select-none" />

          {/* Titik QR pada lantai ini */}
          {(dipilih.checkpoints || [])
            .filter((c: any) => c.planX != null && c.planY != null)
            .map((c: any) => (
              <div
                key={c.id}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${c.planX}%`, top: `${c.planY}%` }}
              >
                <div className="h-3 w-3 rounded-full border-2 border-cyan bg-cyan/40" />
                <span className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-void/90 px-1.5 py-0.5 text-[10px] text-cyan group-hover:block">
                  {c.name}
                </span>
              </div>
            ))}

          {/* Anggota berdasarkan pemindaian terakhirnya */}
          {(dipilih.guards || []).map((g: any) => (
            <div
              key={g.guardId}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${g.planX}%`, top: `${g.planY}%` }}
              title={`${g.name} — ${g.checkpointName}, ${ago(g.at)}`}
            >
              <span className="absolute -inset-2 animate-ping rounded-full bg-emerald/25" />
              <div className="relative">
                <Avatar name={g.name} url={g.avatarUrl} size={26} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-full border-2 border-cyan bg-cyan/40" /> Titik QR
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-full bg-emerald" /> Anggota (pemindaian terakhir, 12 jam)
        </span>
      </div>
    </div>
  );
}
