import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShieldCheck, Plus, Pencil, Trash2, QrCode, Route as RouteIcon, GripVertical, Printer, Clock, Radio,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Select, Confirm, Table, Chip } from '../components/ui';
import MapView from '../components/MapView';
import { ask } from '../components/confirm';

export default function CheckpointsRoutes() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'titik' | 'rute' | 'shift'>('titik');
  const [siteId, setSiteId] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [del, setDel] = useState<{ kind: string; id: string } | null>(null);
  const [qrOf, setQrOf] = useState<any>(null);

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const cps = useQuery({ queryKey: ['cps', siteId], queryFn: () => api.get('/master/checkpoints' + qs({ siteId })) });
  const routes = useQuery({ queryKey: ['routes', siteId], queryFn: () => api.get('/master/routes' + qs({ siteId })) });
  const shifts = useQuery({ queryKey: ['shifts-all', siteId], queryFn: () => api.get('/master/shifts' + qs({ siteId })) });

  const save = async () => {
    const jenis = tab === 'titik' ? 'titik patroli' : tab === 'rute' ? 'rute patroli' : 'shift jaga';
    if (!(await (form.id ? ask.save(jenis) : ask.create(jenis, form.name)))) return;
    try {
      if (tab === 'titik') {
        if (!form.siteId || !form.code || !form.name || !form.lat || !form.lng)
          return toast.err('Site, kode, nama, dan koordinat wajib diisi');
        const body = { ...form, lat: Number(form.lat), lng: Number(form.lng), radiusM: Number(form.radiusM) || 30 };
        if (form.id) await api.put(`/master/checkpoints/${form.id}`, body);
        else await api.post('/master/checkpoints', body);
      } else if (tab === 'rute') {
        if (!form.siteId || !form.name || !form.checkpointIds?.length)
          return toast.err('Site, nama rute, dan minimal satu titik wajib diisi');
        const body = {
          ...form,
          expectedDurationMin: Number(form.expectedDurationMin) || 45,
          graceMin: Number(form.graceMin) || 10,
        };
        if (form.id) await api.put(`/master/routes/${form.id}`, body);
        else await api.post('/master/routes', body);
      } else {
        if (!form.siteId || !form.name || !form.startTime || !form.endTime)
          return toast.err('Site, nama, dan jam shift wajib diisi');
        const body = { ...form, lateToleranceMin: Number(form.lateToleranceMin) || 10 };
        if (form.id) await api.put(`/master/shifts/${form.id}`, body);
        else await api.post('/master/shifts', body);
      }
      toast.ok('Data tersimpan');
      setOpen(false);
      setForm({});
      qc.invalidateQueries();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const siteCps = (cps.data || []).filter((c: any) => !form.siteId || c.siteId === form.siteId);

  const TABS = [
    { k: 'titik', l: 'Titik Patroli', i: ShieldCheck, n: cps.data?.length },
    { k: 'rute', l: 'Rute Patroli', i: RouteIcon, n: routes.data?.length },
    { k: 'shift', l: 'Shift Jaga', i: Clock, n: shifts.data?.length },
  ] as const;

  return (
    <>
      <PageHead crumb="Konfigurasi" title="Titik, Rute & Shift" desc="Konfigurasi titik pemeriksaan berkode QR/NFC, urutan rute, dan pola shift.">
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-auto">
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <button
          className="btn-primary btn-sm"
          onClick={() => {
            setForm(tab === 'titik' ? { radiusM: 30, siteId } : tab === 'rute' ? { expectedDurationMin: 45, graceMin: 10, checkpointIds: [], siteId } : { startTime: '07:00', endTime: '15:00', lateToleranceMin: 10, siteId });
            setOpen(true);
          }}
        >
          <Plus size={14} /> Tambah
        </button>
      </PageHead>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`btn btn-sm ${tab === t.k ? 'bg-amber/15 text-amber shadow-[inset_0_0_0_1px_rgba(255,176,32,.35)]' : 'border border-line text-muted hover:text-ink'}`}
          >
            <t.i size={13} /> {t.l}
            <span className="num ml-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px]">{t.n ?? 0}</span>
          </button>
        ))}
      </div>

      {tab === 'titik' && (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Panel title="Daftar Titik Patroli" icon={ShieldCheck} bodyClass="p-0">
            {cps.isLoading ? (
              <Loading />
            ) : !cps.data?.length ? (
              <Empty text="Belum ada titik patroli" />
            ) : (
              <Table head={['Kode', 'Nama Titik', 'Zona', 'Site', 'Toleransi', '']}>
                {cps.data.map((c: any) => (
                  <tr key={c.id} className="transition hover:bg-white/[.025]">
                    <td className="num text-[12px] font-bold text-amber">{c.code}</td>
                    <td>
                      <p className="text-[13px] font-semibold">{c.name}</p>
                      <p className="num text-[10px] text-muted">{c.lat.toFixed(5)}, {c.lng.toFixed(5)}</p>
                    </td>
                    <td>
                      {c.zone && (
                        <span className="chip border-line" style={{ color: c.zone.color, borderColor: `${c.zone.color}55` }}>
                          {c.zone.name}
                        </span>
                      )}
                    </td>
                    <td className="text-[12px] text-muted">{c.site?.name}</td>
                    <td className="num text-[12px]">{c.radiusM} m</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button className="btn-ghost btn-sm" onClick={() => setQrOf(c)}>
                          <QrCode size={12} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => { setForm({ ...c }); setOpen(true); }}>
                          <Pencil size={12} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setDel({ kind: 'checkpoints', id: c.id })}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Sebaran Titik" icon={ShieldCheck} bodyClass="p-3" className="h-fit">
            <MapView
              sites={(sites.data || [])
                .filter((s: any) => !siteId || s.id === siteId)
                .map((s: any) => ({
                  ...s,
                  checkpoints: (cps.data || []).filter((c: any) => c.siteId === s.id),
                }))}
              height={520}
            />
          </Panel>
        </div>
      )}

      {tab === 'rute' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {routes.isLoading ? (
            <Loading />
          ) : !routes.data?.length ? (
            <Panel className="lg:col-span-2"><Empty text="Belum ada rute patroli" /></Panel>
          ) : (
            routes.data.map((r: any) => (
              <Panel key={r.id} bodyClass="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold">{r.name}</h3>
                    <p className="text-xs text-muted">{r.site?.name}</p>
                    <p className="mt-1 text-[11.5px] text-muted">{r.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        setForm({ ...r, checkpointIds: r.checkpoints.map((rc: any) => rc.checkpointId) });
                        setOpen(true);
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => setDel({ kind: 'routes', id: r.id })}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="chip border-cyan/35 bg-cyan/10 text-cyan">{r.checkpoints.length} titik</span>
                  <span className="chip border-amber/35 bg-amber/10 text-amber">{r.expectedDurationMin} menit</span>
                  <span className="chip border-line text-muted">toleransi {r.graceMin} mnt</span>
                  {r.enforceOrder && <span className="chip border-violet/35 bg-violet/10 text-violet">wajib urut</span>}
                  {r.requirePhoto && <span className="chip border-emerald/35 bg-emerald/10 text-emerald">wajib foto</span>}
                </div>

                <ol className="mt-4 space-y-1.5">
                  {r.checkpoints.map((rc: any) => (
                    <li key={rc.id} className="flex items-center gap-2.5 rounded-lg border border-line/60 bg-abyss/40 px-3 py-2">
                      <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-md bg-amber/15 text-[10px] font-bold text-amber">
                        {rc.orderIndex}
                      </span>
                      <span className="flex-1 truncate text-[12.5px]">{rc.checkpoint.name}</span>
                      <span className="num text-[10px] text-muted">mnt {rc.targetMinute}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            ))
          )}
        </div>
      )}

      {tab === 'shift' && (
        <Panel title="Pola Shift Jaga" icon={Clock} bodyClass="p-0">
          {shifts.isLoading ? (
            <Loading />
          ) : !shifts.data?.length ? (
            <Empty text="Belum ada shift" />
          ) : (
            <Table head={['Shift', 'Jam', 'Site', 'Toleransi Telat', 'Lintas Hari', '']}>
              {shifts.data.map((s: any) => (
                <tr key={s.id} className="transition hover:bg-white/[.025]">
                  <td>
                    <span className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  </td>
                  <td className="num text-[13px]">{s.startTime} – {s.endTime}</td>
                  <td className="text-[12px] text-muted">{s.site?.name}</td>
                  <td className="num text-[12.5px]">{s.lateToleranceMin} menit</td>
                  <td>{s.crossesMidnight ? <Chip value="CONFIRMED">Ya</Chip> : <span className="text-[12px] text-muted">Tidak</span>}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost btn-sm" onClick={() => { setForm({ ...s }); setOpen(true); }}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setDel({ kind: 'shifts', id: s.id })}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {/* Formulir */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={tab === 'titik' ? 'Titik Patroli' : tab === 'rute' ? 'Rute Patroli' : 'Shift Jaga'}
        wide={tab === 'rute'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site" className="sm:col-span-2">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value, checkpointIds: [] })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>

          {tab === 'titik' && (
            <>
              <Field label="Kode titik" hint="Dipakai sebagai isi kode QR.">
                <input className="w-full" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </Field>
              <Field label="Nama titik">
                <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Lintang">
                <input className="w-full" value={form.lat ?? ''} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
              </Field>
              <Field label="Bujur">
                <input className="w-full" value={form.lng ?? ''} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
              </Field>
              <Field label="Toleransi jarak (meter)">
                <input type="number" className="w-full" value={form.radiusM ?? 30} onChange={(e) => setForm({ ...form, radiusM: e.target.value })} />
              </Field>
              <Field label="Tag NFC (opsional)">
                <input className="w-full" value={form.nfcTag || ''} onChange={(e) => setForm({ ...form, nfcTag: e.target.value })} />
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <input className="w-full" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </>
          )}

          {tab === 'rute' && (
            <>
              <Field label="Nama rute">
                <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Durasi normal (menit)">
                <input type="number" className="w-full" value={form.expectedDurationMin ?? 45} onChange={(e) => setForm({ ...form, expectedDurationMin: e.target.value })} />
              </Field>
              <Field label="Toleransi keterlambatan (menit)">
                <input type="number" className="w-full" value={form.graceMin ?? 10} onChange={(e) => setForm({ ...form, graceMin: e.target.value })} />
              </Field>
              <Field label="Aturan pemindaian">
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 normal-case tracking-normal text-ink">
                    <input type="checkbox" className="!w-auto" checked={!!form.enforceOrder} onChange={(e) => setForm({ ...form, enforceOrder: e.target.checked })} />
                    <span className="text-[13px]">Wajib berurutan</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 normal-case tracking-normal text-ink">
                    <input type="checkbox" className="!w-auto" checked={!!form.requirePhoto} onChange={(e) => setForm({ ...form, requirePhoto: e.target.checked })} />
                    <span className="text-[13px]">Wajib foto tiap titik</span>
                  </label>
                </div>
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <input className="w-full" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field label="Urutan titik patroli" hint="Klik untuk menambah; urutan mengikuti urutan pemilihan." className="sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                    {siteCps.map((c: any) => {
                      const on = form.checkpointIds?.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              checkpointIds: on
                                ? form.checkpointIds.filter((x: string) => x !== c.id)
                                : [...(form.checkpointIds || []), c.id],
                            })
                          }
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${on ? 'bg-amber/12 text-amber' : 'hover:bg-white/[.04] text-ink'}`}
                        >
                          <span className="num text-[10px] text-muted">{c.code}</span>
                          <span className="flex-1 truncate text-[12.5px]">{c.name}</span>
                        </button>
                      );
                    })}
                    {!siteCps.length && <p className="p-3 text-center text-xs text-muted">Pilih site terlebih dahulu</p>}
                  </div>
                  <ol className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                    {(form.checkpointIds || []).map((id: string, i: number) => {
                      const c = siteCps.find((x: any) => x.id === id);
                      return (
                        <li key={id} className="flex items-center gap-2 rounded-lg bg-abyss/50 px-2.5 py-2">
                          <GripVertical size={12} className="text-muted" />
                          <span className="num grid h-5 w-5 place-items-center rounded-md bg-amber/15 text-[10px] font-bold text-amber">{i + 1}</span>
                          <span className="flex-1 truncate text-[12.5px]">{c?.name}</span>
                        </li>
                      );
                    })}
                    {!form.checkpointIds?.length && <p className="p-3 text-center text-xs text-muted">Belum ada titik dipilih</p>}
                  </ol>
                </div>
              </Field>
            </>
          )}

          {tab === 'shift' && (
            <>
              <Field label="Nama shift">
                <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Warna penanda">
                <input className="w-full" value={form.color || '#22D3EE'} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </Field>
              <Field label="Jam mulai">
                <input type="time" className="w-full" value={form.startTime || ''} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </Field>
              <Field label="Jam selesai">
                <input type="time" className="w-full" value={form.endTime || ''} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </Field>
              <Field label="Toleransi telat (menit)" className="sm:col-span-2">
                <input type="number" className="w-full" value={form.lateToleranceMin ?? 10} onChange={(e) => setForm({ ...form, lateToleranceMin: e.target.value })} />
              </Field>
            </>
          )}
        </div>
      </Modal>

      {/* Kartu QR untuk dicetak dan ditempel di lokasi */}
      <Modal open={!!qrOf} onClose={() => setQrOf(null)} title="Kartu QR Titik Patroli">
        {qrOf && (
          <div id="qr-print" className="rounded-2xl border border-line bg-white p-6 text-center text-black">
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-black/50">PATROLI · TITIK PEMERIKSAAN</p>
            <h3 className="mt-2 text-xl font-extrabold">{qrOf.name}</h3>
            <p className="text-xs text-black/60">{qrOf.site?.name}</p>
            <div className="my-5 flex justify-center">
              <QRCodeSVG value={`PATROLI:CP:${qrOf.code}`} size={196} level="H" includeMargin />
            </div>
            <p className="font-mono text-sm font-bold tracking-widest">{qrOf.code}</p>
            {qrOf.nfcTag && <p className="mt-1 font-mono text-[10px] text-black/50">NFC {qrOf.nfcTag}</p>}
          </div>
        )}
        <button
          className="btn-primary mt-4 w-full"
          onClick={() => {
            const w = window.open('', '_blank', 'width=520,height=680');
            if (!w) return;
            w.document.write(
              `<html><head><title>QR ${qrOf?.code}</title></head><body style="font-family:system-ui;display:grid;place-items:center;height:100%">${
                document.getElementById('qr-print')?.outerHTML || ''
              }</body></html>`
            );
            w.document.close();
            w.print();
          }}
        >
          <Printer size={14} /> Cetak Kartu
        </button>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await api.del(`/master/${del!.kind}/${del!.id}`);
            toast.ok('Data dihapus');
            qc.invalidateQueries();
          } catch (e: any) {
            toast.err('Gagal menghapus', e.message);
          }
        }}
        message="Data ini akan dihapus permanen. Riwayat patroli yang sudah terjadi tetap tersimpan. Lanjutkan?"
        danger
        confirmLabel="Hapus"
      />
    </>
  );
}
