import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Pencil, Trash2, MapPin, Phone, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Confirm } from '../components/ui';
import { d, num } from '../lib/format';
import { ask } from '../components/confirm';

export default function Clients() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [del, setDel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/master/clients') });

  const save = async () => {
    if (!form.code || !form.name) return toast.err('Kode dan nama klien wajib diisi');
    if (!(await (form.id ? ask.save(`data klien ${form.name}`) : ask.create('klien', form.name)))) return;
    try {
      if (form.id) await api.put(`/master/clients/${form.id}`, form);
      else await api.post('/master/clients', form);
      toast.ok('Data klien tersimpan');
      setOpen(false);
      setForm({});
      qc.invalidateQueries({ queryKey: ['clients'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  return (
    <>
      <PageHead crumb="Konfigurasi" title="Klien" desc="Perusahaan pengguna jasa pengamanan beserta kontraknya.">
        <button className="btn-primary btn-sm" onClick={() => { setForm({}); setOpen(true); }}>
          <Plus size={14} /> Tambah Klien
        </button>
      </PageHead>

      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Panel><Empty text="Belum ada klien terdaftar" /></Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c: any) => (
            <Panel key={c.id} bodyClass="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="num text-[10px] font-bold uppercase tracking-widest text-amber">{c.code}</span>
                  <h3 className="mt-1 text-base font-extrabold leading-tight">{c.name}</h3>
                  <p className="mt-1 text-xs text-muted">{c.contactName || 'Tanpa PIC'}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setForm({ ...c, contractEnd: c.contractEnd?.slice(0, 10) });
                      setOpen(true);
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setDel(c.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-[12px] text-muted">
                {c.address && <p className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0" /> {c.address}</p>}
                {c.phone && <p className="flex items-center gap-1.5"><Phone size={12} /> {c.phone}</p>}
                {c.contractNo && (
                  <p className="flex items-center gap-1.5">
                    <FileText size={12} /> {c.contractNo}
                    {c.contractEnd && <span> · s.d. {d(c.contractEnd)}</span>}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-line/70 bg-abyss/40 px-4 py-3">
                <span className="text-[10px] uppercase tracking-[.14em] text-muted">Site dikelola</span>
                <span className="num text-lg font-extrabold text-amber">{num(c._count?.sites)}</span>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'Ubah Data Klien' : 'Tambah Klien'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kode klien">
            <input className="w-full" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Nama perusahaan">
            <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Nama PIC">
            <input className="w-full" value={form.contactName || ''} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </Field>
          <Field label="Telepon">
            <input className="w-full" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Surel">
            <input className="w-full" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Nomor kontrak">
            <input className="w-full" value={form.contractNo || ''} onChange={(e) => setForm({ ...form, contractNo: e.target.value })} />
          </Field>
          <Field label="Kontrak berakhir">
            <input type="date" className="w-full" value={form.contractEnd || ''} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} />
          </Field>
          <Field label="Alamat" className="sm:col-span-2">
            <input className="w-full" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await api.del(`/master/clients/${del}`);
            toast.ok('Klien dihapus');
            qc.invalidateQueries({ queryKey: ['clients'] });
          } catch (e: any) {
            toast.err('Gagal menghapus', e.message);
          }
        }}
        message="Menghapus klien akan menghapus seluruh site, titik patroli, dan riwayat operasionalnya. Lanjutkan?"
        danger
        confirmLabel="Hapus klien"
      />
    </>
  );
}
