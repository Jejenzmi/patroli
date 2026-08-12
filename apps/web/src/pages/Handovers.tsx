import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Avatar, Loading, Empty, Modal, Field, Select, Textarea, Chip } from '../components/ui';
import { dt, d, ago } from '../lib/format';

export default function Handovers() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const [siteId, setSiteId] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ equipmentOk: true });

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const guards = useQuery({ queryKey: ['guards'], queryFn: () => api.get('/users?role=GUARD&pageSize=200') });
  const { data, isLoading } = useQuery({
    queryKey: ['handovers', siteId],
    queryFn: () => api.get('/frontdesk/handovers' + qs({ siteId })),
  });

  const save = async () => {
    if (!form.siteId || !form.toGuardId || !form.situation) return toast.err('Site, penerima, dan uraian situasi wajib diisi');
    try {
      await api.post('/frontdesk/handovers', form);
      toast.ok('Berita acara serah terima terkirim');
      setOpen(false);
      setForm({ equipmentOk: true });
      qc.invalidateQueries({ queryKey: ['handovers'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const rows = data || [];

  return (
    <>
      <PageHead crumb="Personel" title="Serah Terima Shift" desc="Berita acara pergantian jaga: situasi terakhir, pekerjaan tertunda, dan kondisi peralatan.">
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-auto">
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Buat Berita Acara
        </button>
      </PageHead>

      {isLoading ? (
        <Loading />
      ) : !rows.length ? (
        <Panel><Empty text="Belum ada catatan serah terima" /></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((h: any) => (
            <Panel key={h.id} bodyClass="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Avatar name={h.fromGuard?.name} url={h.fromGuard?.avatarUrl} size={32} />
                  <div className="leading-tight">
                    <p className="text-[12.5px] font-bold">{h.fromGuard?.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">Menyerahkan</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-amber" />
                <div className="flex items-center gap-2">
                  <Avatar name={h.toGuard?.name} url={h.toGuard?.avatarUrl} size={32} />
                  <div className="leading-tight">
                    <p className="text-[12.5px] font-bold">{h.toGuard?.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted">Menerima</p>
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <p className="num text-[11px] text-muted">{d(h.shiftDate)}</p>
                  {h.acknowledgedAt ? (
                    <Chip value="DONE">Dikonfirmasi</Chip>
                  ) : (
                    <Chip value="PLANNED">Menunggu</Chip>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="rounded-xl border border-line/70 bg-abyss/40 p-3">
                  <p className="text-[10px] uppercase tracking-[.14em] text-muted">Situasi terakhir</p>
                  <p className="mt-1 text-[13px] leading-relaxed">{h.situation}</p>
                </div>
                {h.pendingWork && (
                  <div className="rounded-xl border border-amber/25 bg-amber/[.06] p-3">
                    <p className="text-[10px] uppercase tracking-[.14em] text-amber">Pekerjaan tertunda</p>
                    <p className="mt-1 text-[13px]">{h.pendingWork}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[12px]">
                  <span className={h.equipmentOk ? 'text-emerald' : 'text-danger'}>
                    {h.equipmentOk ? '✓ Peralatan lengkap' : '✗ Ada masalah peralatan'}
                  </span>
                  {h.equipmentNote && <span className="text-muted">— {h.equipmentNote}</span>}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                <span className="text-[10.5px] text-muted">{ago(h.createdAt)}</span>
                {!h.acknowledgedAt && h.toGuard?.id === me?.id && (
                  <button
                    className="btn-primary btn-sm"
                    onClick={async () => {
                      await api.post(`/frontdesk/handovers/${h.id}/ack`, {});
                      toast.ok('Serah terima dikonfirmasi');
                      qc.invalidateQueries({ queryKey: ['handovers'] });
                    }}
                  >
                    <CheckCircle2 size={12} /> Konfirmasi Terima
                  </button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Berita Acara Serah Terima"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Kirim</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Diserahkan kepada">
            <Select value={form.toGuardId || ''} onChange={(e) => setForm({ ...form, toGuardId: e.target.value })}>
              <option value="">Pilih anggota…</option>
              {(guards.data?.data || []).filter((g: any) => g.id !== me?.id).map((g: any) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tanggal shift">
            <input type="date" className="w-full" value={form.shiftDate || ''} onChange={(e) => setForm({ ...form, shiftDate: e.target.value })} />
          </Field>
          <Field label="Kondisi peralatan">
            <Select value={String(form.equipmentOk)} onChange={(e) => setForm({ ...form, equipmentOk: e.target.value === 'true' })}>
              <option value="true">Lengkap dan berfungsi</option>
              <option value="false">Ada masalah</option>
            </Select>
          </Field>
          <Field label="Uraian situasi" className="sm:col-span-2">
            <Textarea value={form.situation || ''} onChange={(e) => setForm({ ...form, situation: e.target.value })} placeholder="Kondisi area, kejadian selama shift, hal yang perlu diperhatikan…" />
          </Field>
          <Field label="Pekerjaan tertunda" className="sm:col-span-2">
            <input className="w-full" value={form.pendingWork || ''} onChange={(e) => setForm({ ...form, pendingWork: e.target.value })} />
          </Field>
          <Field label="Catatan peralatan" className="sm:col-span-2">
            <input className="w-full" value={form.equipmentNote || ''} onChange={(e) => setForm({ ...form, equipmentNote: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
