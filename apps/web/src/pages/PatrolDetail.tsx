import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Camera, MapPin, Ruler, Timer } from 'lucide-react';
import { api } from '../lib/api';
import { Panel, PageHead, Chip, Avatar, Loading, Ring, Stat } from '../components/ui';
import MapView from '../components/MapView';
import { dt, t, num, pct, label } from '../lib/format';

export default function PatrolDetail() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['patrol', id], queryFn: () => api.get(`/patrols/${id}`) });

  if (isLoading) return <Loading label="Memuat sesi patroli…" />;
  if (!data) return <p className="text-muted">Sesi tidak ditemukan.</p>;

  const scanned = new Set(data.scans.map((s: any) => s.checkpointId));
  const track: [number, number][] = (data.pings || []).map((p: any) => [p.lat, p.lng]);

  return (
    <>
      <Link to="/patroli" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-amber">
        <ArrowLeft size={13} /> Kembali ke daftar sesi
      </Link>

      <PageHead
        crumb={data.site?.name}
        title={data.route?.name}
        desc={`Sesi patroli oleh ${data.guard?.name} · ${dt(data.startedAt)}`}
      >
        <Chip value={data.status} />
      </PageHead>

      <div className="grid gap-4 lg:grid-cols-4">
        <Stat label="Kepatuhan" value={pct(data.complianceRate)} icon={CheckCircle2} tone={data.complianceRate >= 90 ? 'emerald' : 'amber'} />
        <Stat label="Titik Dipindai" value={`${data.scannedCount}/${data.totalCheckpoints}`} icon={MapPin} tone="cyan" />
        <Stat label="Durasi" value={`${num(data.durationMin)} mnt`} sub={`Target ${data.route?.expectedDurationMin} mnt`} icon={Timer} tone="violet" />
        <Stat label="Jarak Tempuh" value={`${num(data.distanceM)} m`} icon={Ruler} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Jejak & Titik Patroli" icon={MapPin} bodyClass="p-3">
          <MapView
            sites={[
              {
                id: data.site.id,
                name: data.site.name,
                lat: data.site.lat,
                lng: data.site.lng,
                radiusM: data.site.radiusM,
                checkpoints: data.route.checkpoints.map((rc: any) => rc.checkpoint),
              },
            ]}
            track={track}
            scannedIds={[...scanned] as string[]}
            height={430}
          />
        </Panel>

        <Panel title="Urutan Pemeriksaan" icon={Clock} bodyClass="p-0">
          <ol className="relative px-5 py-4">
            <span className="absolute left-[31px] top-5 bottom-5 w-px bg-line/70" />
            {data.route.checkpoints.map((rc: any) => {
              const scan = data.scans.find((s: any) => s.checkpointId === rc.checkpointId);
              const ok = !!scan;
              return (
                <li key={rc.id} className="relative flex gap-4 pb-5 last:pb-0">
                  <span
                    className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${
                      ok
                        ? scan.condition === 'BERMASALAH'
                          ? 'border-danger/50 bg-danger/15 text-danger'
                          : scan.condition === 'PERLU_PERHATIAN'
                            ? 'border-amber/50 bg-amber/15 text-amber'
                            : 'border-emerald/45 bg-emerald/15 text-emerald'
                        : 'border-danger/40 bg-danger/10 text-danger'
                    }`}
                  >
                    {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-bold">{rc.checkpoint.name}</p>
                      <span className="num text-[10px] text-muted">#{rc.orderIndex}</span>
                      {scan?.isLate && <Chip value="LATE" />}
                      {scan?.condition === 'BERMASALAH' && <Chip value="CRITICAL" tone="severity">Bermasalah</Chip>}
                      {scan?.condition === 'PERLU_PERHATIAN' && <Chip value="MEDIUM" tone="severity">Perlu perhatian</Chip>}
                      {scan?.distanceFlag && <Chip value="HIGH" tone="severity">Jarak tidak wajar</Chip>}
                    </div>
                    <p className="num text-[11px] text-muted">
                      {rc.checkpoint.code} · target menit ke-{rc.targetMinute}
                    </p>
                    {ok ? (
                      <div className="mt-1.5 rounded-xl border border-line/70 bg-abyss/40 px-3 py-2">
                        <p className="num text-[11px] text-ink">
                          Dipindai {t(scan.scannedAt)} · metode {scan.method}
                          {scan.distanceM != null && ` · ${scan.distanceM} m dari titik`}
                        </p>
                        {scan.note && <p className="mt-1 text-[11px] text-amber">Catatan: {scan.note}</p>}
                        {scan.photoUrl && (
                          <a href={scan.photoUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-cyan hover:underline">
                            <Camera size={11} /> Lihat foto bukti
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] font-semibold text-danger">Titik tidak dipindai</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      </div>

      {data.missedCheckpoints?.length > 0 && (
        <Panel title="Titik Terlewat" icon={XCircle} className="mt-4">
          <div className="flex flex-wrap gap-2">
            {data.missedCheckpoints.map((c: any) => (
              <span key={c.id} className="chip border-danger/40 bg-danger/10 text-danger">
                {c.name}
              </span>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
