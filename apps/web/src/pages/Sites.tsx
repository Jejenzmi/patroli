import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2, ShieldCheck, Route as RouteIcon, Layers } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Select, Confirm, SearchBox } from '../components/ui';
import MapView from '../components/MapView';

export default function Sites() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const canEdit = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ radiusM: 200 });
  const [del, setDel] = useState<string | null>(null);

  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/master/clients') });
  const { data, isLoading } = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });

  const save = async () => {
    if (!form.clientId || !form.code || !form.name || !form.lat || !form.lng)
      return toast.err('Klien, kode, nama, dan koordinat wajib diisi');
    const body = { ...form, lat: Number(form.lat), lng: Number(form.lng), radiusM: Number(form.radiusM) || 200 };
    try {
      if (form.id) await api.put(`/master/sites/${form.id}`, body);
      else await api.post('/master/sites', body);
      toast.ok('Site tersimpan');
      setOpen(false);
      setForm({ radiusM: 200 });
      qc.invalidateQueries({ queryKey: ['sites'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const rows = (data || []).filter((s: any) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHead crumb="Konfigurasi" title="Site & Lokasi" desc="Lokasi penempatan pengamanan beserta radius geofence presensi.">
        {canEdit && (
          <button className="btn-primary btn-sm" onClick={() => { setForm({ radiusM: 200 }); setOpen(true); }}>
            <Plus size={14} /> Tambah Site
          </button>
        )}
      </PageHead>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div>
          <SearchBox value={q} onChange={setQ} placeholder="Cari site…" className="mb-4" />
          {isLoading ? (
            <Loading />
          ) : !rows.length ? (
            <Panel><Empty text="Belum ada site" /></Panel>
          ) : (
            <div className="space-y-3">
              {rows.map((s: any) => (
                <Panel key={s.id} bodyClass="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="num text-[10px] font-bold uppercase tracking-widest text-amber">{s.code}</span>
                        {!s.isActive && <span className="chip border-danger/40 bg-danger/10 text-danger">Nonaktif</span>}
                      </div>
                      <h3 className="mt-1 truncate text-[15px] font-bold">{s.name}</h3>
                      <p className="truncate text-xs text-muted">{s.client?.name} · {s.address || '—'}</p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1.5">
                        <button className="btn-ghost btn-sm" onClick={() => { setForm({ ...s, clientId: s.client?.id }); setOpen(true); }}>
                          <Pencil size={12} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setDel(s.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { i: ShieldCheck, l: 'Titik', v: s._count?.checkpoints },
                      { i: RouteIcon, l: 'Rute', v: s._count?.routes },
                      { i: Layers, l: 'Zona', v: s._count?.zones },
                    ].map((x) => (
                      <div key={x.l} className="rounded-xl border border-line/70 bg-abyss/40 px-3 py-2 text-center">
                        <x.i size={12} className="mx-auto text-muted" />
                        <p className="num mt-1 text-sm font-bold">{x.v ?? 0}</p>
                        <p className="text-[9.5px] uppercase tracking-widest text-muted">{x.l}</p>
                      </div>
                    ))}
                  </div>
                  <p className="num mt-2 text-[10.5px] text-muted">
                    {s.lat.toFixed(5)}, {s.lng.toFixed(5)} · geofence {s.radiusM} m
                  </p>
                </Panel>
              ))}
            </div>
          )}
        </div>

        <Panel title="Sebaran Site" icon={MapPin} bodyClass="p-3" className="h-fit xl:sticky xl:top-4">
          <MapView sites={rows} height="calc(100vh - 240px)" />
        </Panel>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'Ubah Site' : 'Tambah Site'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Klien">
            <Select value={form.clientId || ''} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Pilih klien…</option>
              {(clients.data || []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Kode site">
            <input className="w-full" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Nama site" className="sm:col-span-2">
            <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Alamat" className="sm:col-span-2">
            <input className="w-full" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Lintang (latitude)" hint="Ambil dari Google Maps, mis. -6.27950">
            <input className="w-full" value={form.lat ?? ''} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          </Field>
          <Field label="Bujur (longitude)">
            <input className="w-full" value={form.lng ?? ''} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
          </Field>
          <Field label="Radius geofence (meter)" hint="Presensi hanya diterima dalam radius ini.">
            <input type="number" className="w-full" value={form.radiusM ?? 200} onChange={(e) => setForm({ ...form, radiusM: e.target.value })} />
          </Field>
          <Field label="Kota">
            <input className="w-full" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Nama PIC lokasi">
            <input className="w-full" value={form.picName || ''} onChange={(e) => setForm({ ...form, picName: e.target.value })} />
          </Field>
          <Field label="Telepon PIC">
            <input className="w-full" value={form.picPhone || ''} onChange={(e) => setForm({ ...form, picPhone: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await api.del(`/master/sites/${del}`);
            toast.ok('Site dihapus');
            qc.invalidateQueries({ queryKey: ['sites'] });
          } catch (e: any) {
            toast.err('Gagal menghapus', e.message);
          }
        }}
        message="Menghapus site akan menghapus titik patroli, rute, jadwal, dan riwayat operasional di dalamnya. Lanjutkan?"
        danger
        confirmLabel="Hapus site"
      />
    </>
  );
}
