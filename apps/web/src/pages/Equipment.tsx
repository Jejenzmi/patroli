import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Plus, Pencil, Trash2 } from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Table, Chip, Loading, Empty, Modal, Field, Select, Confirm, Stat } from '../components/ui';
import { num } from '../lib/format';

const STATUS_ID: Record<string, string> = {
  AVAILABLE: 'Tersedia',
  ASSIGNED: 'Dipegang',
  MAINTENANCE: 'Perbaikan',
  LOST: 'Hilang',
  DAMAGED: 'Rusak',
};

export default function Equipment() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');
  const [siteId, setSiteId] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ category: 'UMUM' });
  const [del, setDel] = useState<string | null>(null);

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const guards = useQuery({ queryKey: ['guards'], queryFn: () => api.get('/users?role=GUARD&pageSize=200') });
  const { data, isLoading } = useQuery({
    queryKey: ['equipment', siteId],
    queryFn: () => api.get('/master/equipment' + qs({ siteId })),
  });

  const save = async () => {
    if (!form.siteId || !form.code || !form.name) return toast.err('Site, kode, dan nama wajib diisi');
    try {
      if (form.id) await api.put(`/master/equipment/${form.id}`, form);
      else await api.post('/master/equipment', form);
      toast.ok('Inventaris tersimpan');
      setOpen(false);
      setForm({ category: 'UMUM' });
      qc.invalidateQueries({ queryKey: ['equipment'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const rows = data || [];

  return (
    <>
      <PageHead crumb="Pos Jaga" title="Inventaris Peralatan" desc="Handy talky, senter, metal detector, APAR, dan peralatan jaga lain.">
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-auto">
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        {canEdit && (
          <button className="btn-primary btn-sm" onClick={() => { setForm({ category: 'UMUM' }); setOpen(true); }}>
            <Plus size={14} /> Tambah Barang
          </button>
        )}
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DAMAGED'].map((s) => (
          <Stat
            key={s}
            label={STATUS_ID[s]}
            value={num(rows.filter((r: any) => r.status === s).length)}
            icon={Boxes}
            tone={s === 'AVAILABLE' ? 'emerald' : s === 'ASSIGNED' ? 'cyan' : s === 'MAINTENANCE' ? 'amber' : 'danger'}
          />
        ))}
      </div>

      <Panel title="Daftar Inventaris" icon={Boxes} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada data inventaris" />
        ) : (
          <Table head={['Kode', 'Nama Barang', 'Kategori', 'Site', 'Dipegang', 'Status', '']}>
            {rows.map((e: any) => (
              <tr key={e.id} className="transition hover:bg-white/[.025]">
                <td className="num text-[12.5px] font-bold text-amber">{e.code}</td>
                <td>
                  <p className="text-[13px] font-semibold">{e.name}</p>
                  {e.serialNumber && <p className="num text-[10.5px] text-muted">SN {e.serialNumber}</p>}
                </td>
                <td className="text-[12px] text-muted">{e.category}</td>
                <td className="text-[12px] text-muted">{e.site?.name}</td>
                <td className="text-[12.5px]">{e.assignedTo?.name || '—'}</td>
                <td>
                  <Chip
                    value={e.status === 'AVAILABLE' ? 'DONE' : e.status === 'ASSIGNED' ? 'CONFIRMED' : e.status === 'MAINTENANCE' ? 'LATE' : 'ABSENT'}
                  >
                    {STATUS_ID[e.status]}
                  </Chip>
                </td>
                <td className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost btn-sm" onClick={() => { setForm({ ...e, assignedToId: e.assignedTo?.id || '' }); setOpen(true); }}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setDel(e.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'Ubah Inventaris' : 'Tambah Inventaris'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Site">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode barang">
              <input className="w-full" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Kategori">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['UMUM', 'KOMUNIKASI', 'PENERANGAN', 'DETEKSI', 'DAMKAR', 'KENDARAAN'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Nama barang">
            <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Nomor seri">
            <input className="w-full" value={form.serialNumber || ''} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </Field>
          {form.id && (
            <>
              <Field label="Dipegang oleh" hint="Mengisi kolom ini otomatis mengubah status menjadi Dipegang.">
                <Select value={form.assignedToId || ''} onChange={(e) => setForm({ ...form, assignedToId: e.target.value || null })}>
                  <option value="">Tidak dipegang siapa pun</option>
                  {(guards.data?.data || []).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status || 'AVAILABLE'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_ID).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await api.del(`/master/equipment/${del}`);
          toast.ok('Inventaris dihapus');
          qc.invalidateQueries({ queryKey: ['equipment'] });
        }}
        message="Hapus barang inventaris ini dari daftar?"
        danger
        confirmLabel="Hapus"
      />
    </>
  );
}
