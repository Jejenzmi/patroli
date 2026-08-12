import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, Plus, LogOut } from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Table, Loading, Empty, Modal, Field, Select, SearchBox, Stat, Chip } from '../components/ui';
import { dt, t, num } from '../lib/format';
import { ask } from '../components/confirm';

export default function Vehicles() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [siteId, setSiteId] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ vehicleType: 'MOBIL' });

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', q, siteId],
    queryFn: () => api.get('/frontdesk/vehicles' + qs({ q, siteId, limit: 300 })),
  });

  const save = async () => {
    if (!form.siteId || !form.plate) return toast.err('Site dan nomor polisi wajib diisi');
    if (!(await ask.create('catatan kendaraan', String(form.plate).toUpperCase()))) return;
    try {
      await api.post('/frontdesk/vehicles', form);
      toast.ok('Kendaraan tercatat masuk');
      setOpen(false);
      setForm({ vehicleType: 'MOBIL' });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const rows = data || [];
  const inside = rows.filter((r: any) => !r.outAt).length;

  return (
    <>
      <PageHead crumb="Pos Jaga" title="Lalu Lintas Kendaraan" desc="Catatan kendaraan masuk dan keluar area, termasuk muatan.">
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Kendaraan Masuk
        </button>
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Total Catatan" value={num(rows.length)} icon={Car} tone="cyan" />
        <Stat label="Masih di Dalam" value={num(inside)} icon={Car} tone="amber" pulse={inside > 0} />
        <Stat label="Truk / Box" value={num(rows.filter((r: any) => ['TRUK', 'BOX'].includes(r.vehicleType)).length)} icon={Car} tone="violet" />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nomor polisi…" />
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      </div>

      <Panel title="Catatan Kendaraan" icon={Car} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada catatan kendaraan" />
        ) : (
          <Table head={['Nopol', 'Jenis', 'Pengemudi', 'Muatan / Keperluan', 'Site', 'Masuk', 'Keluar', '']}>
            {rows.map((v: any) => (
              <tr key={v.id} className="transition hover:bg-white/[.025]">
                <td className="num text-[13px] font-bold text-amber">{v.plate}</td>
                <td><Chip value="PLANNED">{v.vehicleType}</Chip></td>
                <td className="text-[12.5px]">
                  {v.driverName || '—'}
                  {v.company && <p className="text-[10.5px] text-muted">{v.company}</p>}
                </td>
                <td className="text-[12.5px]">
                  {v.cargo || '—'}
                  {v.purpose && <p className="text-[10.5px] text-muted">{v.purpose}</p>}
                </td>
                <td className="text-[12.5px] text-muted">{v.site?.name}</td>
                <td className="num text-[12.5px]">{dt(v.inAt, 'DD MMM · HH:mm')}</td>
                <td className="num text-[12.5px]">{v.outAt ? t(v.outAt) : <span className="text-emerald">di dalam</span>}</td>
                <td className="text-right">
                  {!v.outAt && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        if (!(await ask.action('Catat kendaraan keluar?', 'Waktu keluar dicatat sekarang untuk kendaraan ini.', 'Ya, catat keluar', v.plate))) return;
                        await api.post(`/frontdesk/vehicles/${v.id}/out`, {});
                        toast.ok('Kendaraan keluar');
                        qc.invalidateQueries({ queryKey: ['vehicles'] });
                      }}
                    >
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
        title="Catat Kendaraan Masuk"
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
          <Field label="Nomor polisi">
            <input className="w-full uppercase" value={form.plate || ''} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
          </Field>
          <Field label="Jenis kendaraan">
            <Select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
              {['MOBIL', 'MOTOR', 'TRUK', 'BOX', 'BUS', 'LAINNYA'].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nama pengemudi">
            <input className="w-full" value={form.driverName || ''} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
          </Field>
          <Field label="Perusahaan">
            <input className="w-full" value={form.company || ''} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Keperluan">
            <input className="w-full" value={form.purpose || ''} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          </Field>
          <Field label="Muatan" className="sm:col-span-2">
            <input className="w-full" value={form.cargo || ''} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
