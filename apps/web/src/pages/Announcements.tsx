import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Select, Textarea, Chip, Avatar, Confirm } from '../components/ui';
import { dt, ago, label } from '../lib/format';

export default function Announcements() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const canPost = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ audience: 'ALL', priority: 'LOW' });
  const [del, setDel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['announcements'], queryFn: () => api.get('/frontdesk/announcements') });

  const save = async () => {
    if (!form.title || !form.body) return toast.err('Judul dan isi wajib diisi');
    try {
      await api.post('/frontdesk/announcements', form);
      toast.ok('Pengumuman diterbitkan', 'Notifikasi terkirim ke penerima');
      setOpen(false);
      setForm({ audience: 'ALL', priority: 'LOW' });
      qc.invalidateQueries({ queryKey: ['announcements'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  return (
    <>
      <PageHead crumb="Konfigurasi" title="Pengumuman" desc="Instruksi dan informasi resmi untuk seluruh anggota satuan.">
        {canPost && (
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Buat Pengumuman
          </button>
        )}
      </PageHead>

      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Panel><Empty text="Belum ada pengumuman" /></Panel>
      ) : (
        <div className="space-y-3">
          {data.map((a: any) => (
            <Panel key={a.id} bodyClass="p-5">
              <div className="flex items-start gap-4">
                <div
                  className={`w-1 self-stretch rounded-full ${
                    a.priority === 'CRITICAL' ? 'bg-danger' : a.priority === 'HIGH' ? 'bg-orange-400' : a.priority === 'MEDIUM' ? 'bg-amber' : 'bg-cyan'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold">{a.title}</h3>
                    <Chip value={a.priority} tone="severity" />
                    <span className="chip border-line text-muted">
                      {a.audience === 'ALL' ? 'Semua' : label(a.audience)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/85">{a.body}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                    <Avatar name={a.createdBy?.name} url={a.createdBy?.avatarUrl} size={20} />
                    {a.createdBy?.name} · {dt(a.publishedAt)} ({ago(a.publishedAt)})
                  </div>
                </div>
                {canPost && (
                  <button className="btn-ghost btn-sm shrink-0" onClick={() => setDel(a.id)}>
                    <Trash2 size={12} />
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
        title="Buat Pengumuman"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Terbitkan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Judul">
            <input className="w-full" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Isi pengumuman">
            <Textarea value={form.body || ''} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Penerima">
              <Select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="ALL">Semua pengguna</option>
                <option value="GUARD">Anggota lapangan</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="CLIENT">Klien</option>
              </Select>
            </Field>
            <Field label="Prioritas">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => (
                  <option key={p} value={p}>{label(p)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Berlaku sampai (opsional)">
            <input type="date" className="w-full" value={form.expiresAt || ''} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await api.del(`/frontdesk/announcements/${del}`);
          toast.ok('Pengumuman dihapus');
          qc.invalidateQueries({ queryKey: ['announcements'] });
        }}
        message="Hapus pengumuman ini?"
        danger
        confirmLabel="Hapus"
      />
    </>
  );
}
