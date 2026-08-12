import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserSquare2, Plus, LogOut, Car } from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Table, Chip, Loading, Empty, Modal, Field, Select, SearchBox, Stat } from '../components/ui';
import { dt, t, num } from '../lib/format';
import { ask } from '../components/confirm';

export default function Visitors() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [siteId, setSiteId] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ idType: 'KTP' });

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const { data, isLoading } = useQuery({
    queryKey: ['visitors', q, status, siteId],
    queryFn: () => api.get('/frontdesk/visitors' + qs({ q, status, siteId, limit: 300 })),
  });

  const save = async () => {
    if (!form.siteId || !form.name || !form.purpose) return toast.err('Site, nama, dan keperluan wajib diisi');
    if (!(await ask.create('catatan tamu', form.name))) return;
    try {
      await api.post('/frontdesk/visitors', form);
      toast.ok('Tamu tercatat');
      setOpen(false);
      setForm({ idType: 'KTP' });
      qc.invalidateQueries({ queryKey: ['visitors'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const checkout = async (id: string, name: string) => {
    if (!(await ask.action('Catat tamu keluar?', 'Waktu keluar akan dicatat sekarang dan status tamu berubah menjadi sudah keluar.', 'Ya, catat keluar', name))) return;
    await api.post(`/frontdesk/visitors/${id}/checkout`, {});
    toast.ok('Tamu keluar area');
    qc.invalidateQueries({ queryKey: ['visitors'] });
  };

  const rows = data || [];
  const inside = rows.filter((r: any) => r.status === 'INSIDE').length;

  return (
    <>
      <PageHead crumb="Pos Jaga" title="Buku Tamu" desc="Pencatatan tamu masuk dan keluar area beserta identitas dan keperluan.">
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Tamu Masuk
        </button>
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Tamu Tercatat" value={num(rows.length)} icon={UserSquare2} tone="cyan" />
        <Stat label="Masih di Dalam" value={num(inside)} icon={UserSquare2} tone="amber" pulse={inside > 0} />
        <Stat label="Membawa Kendaraan" value={num(rows.filter((r: any) => r.vehiclePlate).length)} icon={Car} tone="violet" />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama, perusahaan, atau nopol…" />
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status</option>
          <option value="INSIDE">Di dalam</option>
          <option value="CHECKED_OUT">Sudah keluar</option>
        </Select>
      </div>

      <Panel title="Catatan Kunjungan" icon={UserSquare2} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada catatan tamu" />
        ) : (
          <Table head={['Tamu', 'Keperluan', 'Site', 'Masuk', 'Keluar', 'Status', '']}>
            {rows.map((v: any) => (
              <tr key={v.id} className="transition hover:bg-white/[.025]">
                <td>
                  <p className="text-[13px] font-semibold">{v.name}</p>
                  <p className="text-[10.5px] text-muted">{v.company || '—'} · {v.idType} {v.idNumber?.slice(0, 6)}***</p>
                </td>
                <td>
                  <p className="text-[12.5px]">{v.purpose}</p>
                  {v.hostName && <p className="text-[10.5px] text-muted">Menemui: {v.hostName}</p>}
                  {v.vehiclePlate && <p className="num text-[10.5px] text-cyan">{v.vehiclePlate}</p>}
                </td>
                <td className="text-[12.5px] text-muted">{v.site?.name}</td>
                <td className="num text-[12.5px]">{dt(v.checkInAt, 'DD MMM · HH:mm')}</td>
                <td className="num text-[12.5px]">{v.checkOutAt ? t(v.checkOutAt) : '—'}</td>
                <td><Chip value={v.status} /></td>
                <td className="text-right">
                  {v.status === 'INSIDE' && (
                    <button className="btn-ghost btn-sm" onClick={() => checkout(v.id, v.name)}>
                      <LogOut size={12} /> Keluar
                    </button>
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
        title="Catat Tamu Masuk"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Simpan</button>
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
          <Field label="Nomor kartu tamu">
            <input className="w-full" value={form.badgeNo || ''} onChange={(e) => setForm({ ...form, badgeNo: e.target.value })} />
          </Field>
          <Field label="Nama tamu">
            <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Perusahaan / Instansi">
            <input className="w-full" value={form.company || ''} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Jenis identitas">
            <Select value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
              {['KTP', 'SIM', 'PASPOR', 'KARTU PEGAWAI'].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nomor identitas">
            <input className="w-full" value={form.idNumber || ''} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
          </Field>
          <Field label="Keperluan">
            <input className="w-full" value={form.purpose || ''} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </Field>
          <Field label="Menemui">
            <input className="w-full" value={form.hostName || ''} onChange={(e) => setForm({ ...form, hostName: e.target.value })} />
          </Field>
          <Field label="Nomor polisi kendaraan">
            <input className="w-full" value={form.vehiclePlate || ''} onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })} />
          </Field>
          <Field label="Barang bawaan">
            <input className="w-full" value={form.itemsBrought || ''} onChange={(e) => setForm({ ...form, itemsBrought: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
