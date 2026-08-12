import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, ShieldAlert, Clock, MapPin, User, Timer, Image } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Chip, Avatar, Loading, Field, Select, Textarea } from '../components/ui';
import MapView from '../components/MapView';
import { dt, ago, rupiah, label, CATEGORY_LABEL } from '../lib/format';
import { ask } from '../components/confirm';

export default function IncidentDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { me } = useAuth();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['incident', id], queryFn: () => api.get(`/incidents/${id}`) });
  const guards = useQuery({
    queryKey: ['spv'],
    queryFn: () => api.get('/users?role=SUPERVISOR&pageSize=100'),
    enabled: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || ''),
  });

  const isCommand = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');

  const patch = async (body: any, tanya?: { judul: string; pesan: string }) => {
    if (tanya && !(await ask.action(tanya.judul, tanya.pesan, 'Ya, perbarui'))) return;
    setBusy(true);
    try {
      await api.put(`/incidents/${id}`, body);
      toast.ok('Insiden diperbarui');
      qc.invalidateQueries({ queryKey: ['incident', id] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await api.post(`/incidents/${id}/updates`, { note });
    setNote('');
    qc.invalidateQueries({ queryKey: ['incident', id] });
  };

  if (isLoading) return <Loading label="Memuat insiden…" />;
  if (!data) return <p className="text-muted">Insiden tidak ditemukan.</p>;

  const overdue = data.slaDueAt && !data.resolvedAt && new Date(data.slaDueAt) < new Date();

  return (
    <>
      <Link to="/insiden" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-amber">
        <ArrowLeft size={13} /> Kembali ke daftar insiden
      </Link>

      <PageHead crumb={data.code} title={data.title} desc={`${CATEGORY_LABEL[data.category] || data.category} · ${data.site?.name}`}>
        <Chip value={data.severity} tone="severity" />
        <Chip value={data.status} />
      </PageHead>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel title="Uraian Kejadian" icon={ShieldAlert}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{data.description}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { l: 'Waktu kejadian', v: dt(data.occurredAt), i: Clock },
                { l: 'Batas SLA', v: dt(data.slaDueAt), i: Timer, tone: overdue ? 'text-danger' : '' },
                { l: 'Pelapor', v: data.reporter?.name, i: User },
                { l: 'Lokasi', v: data.locationHint || '—', i: MapPin },
                ...(data.lossValue ? [{ l: 'Perkiraan kerugian', v: rupiah(data.lossValue), i: ShieldAlert }] : []),
                ...(data.resolvedAt ? [{ l: 'Diselesaikan', v: dt(data.resolvedAt), i: Clock }] : []),
              ].map((x: any) => (
                <div key={x.l} className="rounded-xl border border-line/70 bg-abyss/40 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[.14em] text-muted">
                    <x.i size={11} /> {x.l}
                  </p>
                  <p className={`mt-1 text-[13px] font-semibold ${x.tone || ''}`}>{x.v}</p>
                </div>
              ))}
            </div>
          </Panel>

          {data.media?.length > 0 && (
            <Panel title="Bukti Foto" icon={Image}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.media.map((m: any) => (
                  <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="group relative overflow-hidden rounded-xl border border-line">
                    <img src={m.url} alt={m.caption || ''} className="h-32 w-full object-cover transition group-hover:scale-105" />
                  </a>
                ))}
              </div>
            </Panel>
          )}

          {data.lat && (
            <Panel title="Titik Kejadian" icon={MapPin} bodyClass="p-3">
              <MapView
                sites={[{ id: data.site.id, name: data.site.name, lat: data.lat, lng: data.lng, radiusM: 60 }]}
                height={280}
                zoom={17}
              />
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          {isCommand && (
            <Panel title="Tindakan Komando" icon={ShieldAlert}>
              <div className="space-y-3">
                <Field label="Status penanganan">
                  <Select
                    value={data.status}
                    onChange={(e) =>
                      patch({ status: e.target.value }, {
                        judul: `Ubah status menjadi ${label(e.target.value)}?`,
                        pesan: 'Perubahan status tercatat pada riwayat penanganan dan pelapor akan menerima notifikasi.',
                      })
                    }
                    disabled={busy}
                  >
                    {['OPEN', 'IN_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((s) => (
                      <option key={s} value={s}>{label(s)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tingkat keparahan">
                  <Select
                    value={data.severity}
                    onChange={(e) =>
                      patch({ severity: e.target.value }, {
                        judul: `Ubah tingkat keparahan menjadi ${label(e.target.value)}?`,
                        pesan: 'Tenggat SLA insiden ini akan dihitung ulang mengikuti tingkat keparahan yang baru.',
                      })
                    }
                    disabled={busy}
                  >
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                      <option key={s} value={s}>{label(s)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Penanggung jawab">
                  <Select
                    value={data.assigneeId || ''}
                    onChange={(e) =>
                      patch({ assigneeId: e.target.value || null }, {
                        judul: 'Tugaskan penanganan insiden?',
                        pesan: 'Penanggung jawab yang dipilih akan menerima notifikasi penugasan.',
                      })
                    }
                    disabled={busy}
                  >
                    <option value="">Belum ditugaskan</option>
                    {(guards.data?.data || []).map((g: any) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Panel>
          )}

          <Panel title="Riwayat Penanganan" icon={Clock} bodyClass="p-0">
            <ol className="relative px-5 py-4">
              <span className="absolute left-[30px] top-5 bottom-16 w-px bg-line/70" />
              {data.updates.map((u: any) => (
                <li key={u.id} className="relative flex gap-3.5 pb-4">
                  <Avatar name={u.user?.name} url={u.user?.avatarUrl} size={24} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-amber">{u.action}</p>
                    {u.note && <p className="mt-0.5 text-[12px] leading-relaxed text-ink/85">{u.note}</p>}
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted/70">
                      {u.user?.name} · {ago(u.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-line/70 p-4">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tambahkan catatan penanganan…"
                className="min-h-[70px]"
              />
              <button className="btn-primary btn-sm mt-2 w-full" onClick={addNote} disabled={!note.trim()}>
                <Send size={13} /> Kirim Catatan
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
