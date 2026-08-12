import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, Plus, Search } from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Chip, Avatar, Loading, Empty, Modal, Field, Select, Textarea, SearchBox, Table } from '../components/ui';
import { dt, ago, CATEGORY_LABEL, label } from '../lib/format';

const CATEGORIES = Object.keys(CATEGORY_LABEL);

export default function Incidents() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ severity: 'MEDIUM', category: 'ORANG_MENCURIGAKAN' });
  const [saving, setSaving] = useState(false);

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const { data, isLoading } = useQuery({
    queryKey: ['incidents', status, severity, q],
    queryFn: () => api.get('/incidents' + qs({ status, severity, q, pageSize: 100 })),
  });

  const submit = async () => {
    if (!form.siteId || !form.title || !form.description) return toast.err('Lengkapi site, judul, dan uraian');
    setSaving(true);
    try {
      await api.post('/incidents', { ...form, lossValue: form.lossValue ? Number(form.lossValue) : undefined });
      toast.ok('Insiden tercatat', 'Laporan diteruskan ke pusat komando');
      setOpen(false);
      setForm({ severity: 'MEDIUM', category: 'ORANG_MENCURIGAKAN' });
      qc.invalidateQueries({ queryKey: ['incidents'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
    } finally {
      setSaving(false);
    }
  };

  const rows = data?.data || [];

  return (
    <>
      <PageHead crumb="Operasi" title="Manajemen Insiden" desc="Pelaporan, penugasan, dan penyelesaian insiden dengan tenggat SLA.">
        <button className="btn-ghost btn-sm" onClick={() => api.downloadCsv('incidents')}>
          <Download size={14} /> Ekspor
        </button>
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Laporan Baru
        </button>
      </PageHead>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchBox value={q} onChange={setQ} placeholder="Cari judul atau kode insiden…" className="lg:col-span-2" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          {['OPEN', 'IN_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'].map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </Select>
        <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">Semua tingkat</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </Select>
      </div>

      <Panel title={`Daftar Insiden · ${data?.total ?? 0}`} icon={AlertTriangle} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Tidak ada insiden pada filter ini" />
        ) : (
          <div className="divide-y divide-line/60">
            {rows.map((i: any) => {
              const overdue = i.slaDueAt && !i.resolvedAt && new Date(i.slaDueAt) < new Date();
              return (
                <Link key={i.id} to={`/insiden/${i.id}`} className="flex gap-4 px-5 py-4 transition hover:bg-white/[.025]">
                  <div
                    className={`w-1 shrink-0 rounded-full ${
                      i.severity === 'CRITICAL' ? 'bg-danger' : i.severity === 'HIGH' ? 'bg-orange-400' : i.severity === 'MEDIUM' ? 'bg-amber' : 'bg-emerald'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-[11px] font-bold text-amber">{i.code}</span>
                      <Chip value={i.severity} tone="severity" />
                      <Chip value={i.status} />
                      {overdue && <span className="chip border-danger/50 bg-danger/15 text-danger">Lewat SLA</span>}
                    </div>
                    <p className="mt-1.5 text-sm font-bold text-ink">{i.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">{i.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span>{CATEGORY_LABEL[i.category] || i.category}</span>
                      <span>· {i.site?.name}</span>
                      <span>· {dt(i.occurredAt)}</span>
                      {i.assignee && <span>· PJ: {i.assignee.name}</span>}
                    </div>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                    <Avatar name={i.reporter?.name} url={i.reporter?.avatarUrl} size={30} />
                    <span className="text-[10px] text-muted">{ago(i.createdAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Laporan Insiden Baru"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan Laporan'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site kejadian">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Kategori">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tingkat keparahan" hint="Menentukan tenggat SLA: Kritis 1 jam, Tinggi 8 jam, Sedang 24 jam, Rendah 72 jam.">
            <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Waktu kejadian">
            <input
              type="datetime-local"
              className="w-full"
              value={form.occurredAt || ''}
              onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
            />
          </Field>
          <Field label="Judul singkat" className="sm:col-span-2">
            <input
              className="w-full"
              placeholder="mis. Orang tidak dikenal di area parkir"
              value={form.title || ''}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Uraian kejadian" className="sm:col-span-2">
            <Textarea
              placeholder="Kronologi, tindakan yang sudah diambil, dan kondisi terakhir…"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Petunjuk lokasi">
            <input
              className="w-full"
              placeholder="mis. Sisi utara pagar"
              value={form.locationHint || ''}
              onChange={(e) => setForm({ ...form, locationHint: e.target.value })}
            />
          </Field>
          <Field label="Perkiraan kerugian (Rp)">
            <input
              type="number"
              className="w-full"
              value={form.lossValue || ''}
              onChange={(e) => setForm({ ...form, lossValue: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
