import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck, Plus, Megaphone, Clock, CheckCircle2, AlertTriangle, Eye, Trash2,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import {
  Panel, PageHead, Chip, Avatar, Loading, Empty, Modal, Field, Select, Textarea, Confirm, Stat, Table,
} from '../components/ui';
import { ask } from '../components/confirm';
import { dt, ago, num } from '../lib/format';

const PRIORITAS: Record<string, { label: string; tone: string }> = {
  RENDAH: { label: 'Rendah', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
  NORMAL: { label: 'Normal', tone: 'text-cyan border-cyan/40 bg-cyan/10' },
  TINGGI: { label: 'Tinggi', tone: 'text-orange-400 border-orange-400/40 bg-orange-400/10' },
  MENDESAK: { label: 'Mendesak', tone: 'text-danger border-danger/50 bg-danger/15' },
};

const STATUS: Record<string, { label: string; tone: string }> = {
  BARU: { label: 'Baru', tone: 'text-cyan border-cyan/40 bg-cyan/10' },
  DIKERJAKAN: { label: 'Dikerjakan', tone: 'text-amber border-amber/40 bg-amber/10' },
  SELESAI: { label: 'Selesai', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
  DIBATALKAN: { label: 'Dibatalkan', tone: 'text-muted border-line bg-white/5' },
};

export default function Tasks() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const isCommand = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');
  const [tab, setTab] = useState<'tugas' | 'instruksi'>('tugas');
  const [openTask, setOpenTask] = useState(false);
  const [openIns, setOpenIns] = useState(false);
  const [form, setForm] = useState<any>({ priority: 'NORMAL' });
  const [insForm, setInsForm] = useState<any>({});
  const [del, setDel] = useState<{ jenis: string; id: string } | null>(null);
  const [bacaan, setBacaan] = useState<any>(null);

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const guards = useQuery({ queryKey: ['guards'], queryFn: () => api.get('/users?role=GUARD&pageSize=200') });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => api.get('/master/teams') });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => api.get('/tasks?limit=200') });
  const instruksi = useQuery({ queryKey: ['instruksi'], queryFn: () => api.get('/tasks/instructions/list') });

  const simpanTugas = async () => {
    if (!form.siteId || !form.assigneeId || !form.title)
      return toast.err('Site, petugas, dan judul tugas wajib diisi');
    if (!(await ask.create('tugas', `${form.title} — untuk petugas terpilih`))) return;
    try {
      await api.post('/tasks', form);
      toast.ok('Tugas dikirim', 'Petugas menerima notifikasi');
      setOpenTask(false);
      setForm({ priority: 'NORMAL' });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const simpanInstruksi = async () => {
    if (!insForm.title || !insForm.body) return toast.err('Judul dan isi instruksi wajib diisi');
    if (!(await ask.create('instruksi', insForm.urgent ? 'Ditandai mendesak.' : undefined))) return;
    try {
      const r = await api.post('/tasks/instructions', insForm);
      toast.ok('Instruksi terkirim', `Diteruskan ke ${r.penerima} penerima`);
      setOpenIns(false);
      setInsForm({});
      qc.invalidateQueries({ queryKey: ['instruksi'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const ubahStatus = async (t: any, status: string) => {
    if (!(await ask.action(`Ubah status menjadi ${STATUS[status].label}?`, 'Perubahan status tercatat beserta waktunya.', 'Ya, ubah'))) return;
    await api.put(`/tasks/${t.id}`, { status });
    toast.ok('Status tugas diperbarui');
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };

  const daftar = tasks.data || [];
  const hitung = (s: string) => daftar.filter((t: any) => t.status === s).length;

  return (
    <>
      <PageHead crumb="Operasi" title="Tugas & Instruksi" desc="Pekerjaan insidental dan arahan resmi kepada anggota maupun regu.">
        {isCommand && tab === 'tugas' && (
          <button className="btn-primary btn-sm" onClick={() => setOpenTask(true)}>
            <Plus size={14} /> Tugas Baru
          </button>
        )}
        {isCommand && tab === 'instruksi' && (
          <button className="btn-primary btn-sm" onClick={() => setOpenIns(true)}>
            <Plus size={14} /> Instruksi Baru
          </button>
        )}
      </PageHead>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { k: 'tugas', l: 'Tugas Insidental', i: ClipboardCheck, n: daftar.length },
          { k: 'instruksi', l: 'Instruksi', i: Megaphone, n: instruksi.data?.length },
        ].map((t) => (
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

      {tab === 'tugas' && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Baru" value={num(hitung('BARU'))} icon={Clock} tone="cyan" />
            <Stat label="Dikerjakan" value={num(hitung('DIKERJAKAN'))} icon={AlertTriangle} tone="amber" />
            <Stat label="Selesai" value={num(hitung('SELESAI'))} icon={CheckCircle2} tone="emerald" />
            <Stat
              label="Mendesak Belum Selesai"
              value={num(daftar.filter((t: any) => t.priority === 'MENDESAK' && t.status !== 'SELESAI').length)}
              icon={AlertTriangle}
              tone="danger"
            />
          </div>

          <Panel title="Daftar Tugas" icon={ClipboardCheck} bodyClass="p-0">
            {tasks.isLoading ? (
              <Loading />
            ) : !daftar.length ? (
              <Empty text="Belum ada tugas" hint="Buat tugas insidental seperti pemeriksaan APAR atau pengawalan setoran." />
            ) : (
              <div className="divide-y divide-line/60">
                {daftar.map((t: any) => (
                  <div key={t.id} className="flex gap-4 px-5 py-4 transition hover:bg-white/[.025]">
                    <div className={`w-1 shrink-0 rounded-full ${t.priority === 'MENDESAK' ? 'bg-danger' : t.priority === 'TINGGI' ? 'bg-orange-400' : t.priority === 'NORMAL' ? 'bg-cyan' : 'bg-emerald'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`chip ${PRIORITAS[t.priority]?.tone}`}>{PRIORITAS[t.priority]?.label}</span>
                        <span className={`chip ${STATUS[t.status]?.tone}`}>{STATUS[t.status]?.label}</span>
                        {t.dueAt && new Date(t.dueAt) < new Date() && t.status !== 'SELESAI' && (
                          <span className="chip border-danger/50 bg-danger/15 text-danger">Lewat tenggat</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-bold">{t.title}</p>
                      {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                        <span className="flex items-center gap-1.5">
                          <Avatar name={t.assignee?.name} url={t.assignee?.avatarUrl} size={18} /> {t.assignee?.name}
                        </span>
                        <span>· {t.site?.name}</span>
                        {t.dueAt && <span>· tenggat {dt(t.dueAt)}</span>}
                        <span>· dibuat {ago(t.createdAt)}</span>
                      </div>
                      {t.result && (
                        <p className="mt-2 rounded-lg border border-line/70 bg-abyss/40 px-3 py-2 text-[12px]">
                          Hasil: {t.result}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {isCommand && t.status !== 'SELESAI' && (
                        <button className="btn-ghost btn-sm" onClick={() => ubahStatus(t, 'SELESAI')}>
                          <CheckCircle2 size={12} /> Tandai selesai
                        </button>
                      )}
                      {isCommand && (
                        <button className="btn-ghost btn-sm" onClick={() => setDel({ jenis: 'tugas', id: t.id })}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'instruksi' && (
        <Panel title="Instruksi" icon={Megaphone} bodyClass="p-0">
          {instruksi.isLoading ? (
            <Loading />
          ) : !instruksi.data?.length ? (
            <Empty text="Belum ada instruksi" />
          ) : (
            <div className="divide-y divide-line/60">
              {instruksi.data.map((i: any) => (
                <div key={i.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {i.urgent && <span className="chip border-danger/50 bg-danger/15 text-danger">Mendesak</span>}
                    <p className="text-sm font-bold">{i.title}</p>
                    {i.team && <span className="chip border-violet/40 bg-violet/10 text-violet">{i.team.name}</span>}
                    {i.site && <span className="chip border-line text-muted">{i.site.name}</span>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{i.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <Avatar name={i.sender?.name} url={i.sender?.avatarUrl} size={18} /> {i.sender?.name}
                    </span>
                    <span>· {ago(i.createdAt)}</span>
                    {isCommand && (
                      <button className="btn-ghost btn-sm" onClick={async () => setBacaan(await api.get(`/tasks/instructions/${i.id}/reads`))}>
                        <Eye size={12} /> Siapa sudah membaca
                      </button>
                    )}
                    {isCommand && (
                      <button className="btn-ghost btn-sm" onClick={() => setDel({ jenis: 'instruksi', id: i.id })}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Formulir tugas */}
      <Modal
        open={openTask}
        onClose={() => setOpenTask(false)}
        title="Tugas Insidental Baru"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenTask(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanTugas}>Kirim Tugas</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Petugas pelaksana">
            <Select value={form.assigneeId || ''} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
              <option value="">Pilih petugas…</option>
              {(guards.data?.data || []).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label="Judul pekerjaan" className="sm:col-span-2">
            <input className="w-full" placeholder="mis. Pemeriksaan APAR lantai 1" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Uraian" className="sm:col-span-2">
            <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Rincian pekerjaan dan hasil yang diharapkan…" />
          </Field>
          <Field label="Prioritas">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {Object.entries(PRIORITAS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Tenggat">
            <input type="datetime-local" className="w-full" value={form.dueAt || ''} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Formulir instruksi */}
      <Modal
        open={openIns}
        onClose={() => setOpenIns(false)}
        title="Instruksi Baru"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenIns(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanInstruksi}>Kirim</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Judul">
            <input className="w-full" value={insForm.title || ''} onChange={(e) => setInsForm({ ...insForm, title: e.target.value })} />
          </Field>
          <Field label="Isi instruksi">
            <Textarea value={insForm.body || ''} onChange={(e) => setInsForm({ ...insForm, body: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ditujukan ke regu" hint="Kosongkan bila untuk seluruh site.">
              <Select value={insForm.teamId || ''} onChange={(e) => setInsForm({ ...insForm, teamId: e.target.value || null })}>
                <option value="">Semua regu</option>
                {(teams.data || []).map((t: any) => <option key={t.id} value={t.id}>{t.name} — {t.site?.name}</option>)}
              </Select>
            </Field>
            <Field label="Site">
              <Select value={insForm.siteId || ''} onChange={(e) => setInsForm({ ...insForm, siteId: e.target.value || null })}>
                <option value="">Seluruh site</option>
                {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 normal-case tracking-normal text-ink">
            <input type="checkbox" className="!w-auto" checked={!!insForm.urgent} onChange={(e) => setInsForm({ ...insForm, urgent: e.target.checked })} />
            <span className="text-[13px]">Tandai sebagai instruksi mendesak</span>
          </label>
        </div>
      </Modal>

      {/* Daftar pembaca instruksi */}
      <Modal open={!!bacaan} onClose={() => setBacaan(null)} title="Sudah Membaca Instruksi">
        {!bacaan?.length ? (
          <Empty text="Belum ada yang membaca" />
        ) : (
          <Table head={['Personel', 'NIP', 'Waktu baca']}>
            {bacaan.map((b: any) => (
              <tr key={b.id}>
                <td className="text-[13px]">{b.user?.name}</td>
                <td className="num text-[12px] text-muted">{b.user?.employeeId}</td>
                <td className="num text-[12px]">{dt(b.readAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await api.del(del!.jenis === 'tugas' ? `/tasks/${del!.id}` : `/tasks/instructions/${del!.id}`);
          toast.ok('Data dihapus');
          qc.invalidateQueries();
        }}
        message="Hapus data ini secara permanen?"
        danger
        confirmLabel="Hapus"
      />
    </>
  );
}
