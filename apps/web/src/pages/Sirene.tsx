import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Siren, Plus, Trash2, Volume2, VolumeX, Radio, Users2, Route, Pencil } from 'lucide-react';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import {
  Panel, PageHead, Loading, Empty, Modal, Field, Select, Input, Confirm, Table, Chip,
} from '../components/ui';
import { ask } from '../components/confirm';

/**
 * Divisi penanggap, perutean jenis darurat, dan sirene tiang.
 *
 * Halaman ini yang menentukan siapa yang datang ketika tombol darurat ditekan,
 * dan pengeras suara mana yang berbunyi.
 */

const JENIS: { k: string; l: string; tone: string }[] = [
  { k: 'KEBAKARAN', l: 'Kebakaran', tone: 'border-danger/45 bg-danger/12 text-danger' },
  { k: 'KECELAKAAN', l: 'Kecelakaan kerja', tone: 'border-amber/45 bg-amber/12 text-amber' },
  { k: 'MEDIS', l: 'Gawat medis', tone: 'border-emerald/45 bg-emerald/12 text-emerald' },
  { k: 'KRIMINAL', l: 'Tindak kriminal', tone: 'border-danger/45 bg-danger/12 text-danger' },
  { k: 'BENCANA', l: 'Bencana alam', tone: 'border-violet/45 bg-violet/12 text-violet' },
  { k: 'UMUM', l: 'Bantuan umum', tone: 'border-cyan/45 bg-cyan/12 text-cyan' },
];

const labelJenis = (k: string) => JENIS.find((j) => j.k === k)?.l ?? k;
const toneJenis = (k: string) => JENIS.find((j) => j.k === k)?.tone ?? 'border-line text-muted';

export default function Sirene() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const bolehUbah = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');
  const bolehUji = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');

  const [tab, setTab] = useState<'divisi' | 'perutean' | 'sirene'>('divisi');
  const [openDivisi, setOpenDivisi] = useState(false);
  const [openSirene, setOpenSirene] = useState(false);
  const [openRute, setOpenRute] = useState(false);
  const [formDivisi, setFormDivisi] = useState<any>({ memberIds: [] });
  const [formSirene, setFormSirene] = useState<any>({ driver: 'HTTP_GET', durationS: 60 });
  const [formRute, setFormRute] = useState<any>({ type: 'KEBAKARAN' });
  const [del, setDel] = useState<{ jenis: string; id: string; nama: string } | null>(null);
  const [menguji, setMenguji] = useState<string | null>(null);

  const divisi = useQuery({ queryKey: ['divisi'], queryFn: () => api.get('/master/divisions') });
  const rute = useQuery({ queryKey: ['panic-routes'], queryFn: () => api.get('/master/panic-routes') });
  const sirene = useQuery({ queryKey: ['alarms'], queryFn: () => api.get('/master/alarms') });
  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const lantai = useQuery({ queryKey: ['floors-all'], queryFn: () => api.get('/master/floors') });
  const orang = useQuery({ queryKey: ['users-all'], queryFn: () => api.get('/users?pageSize=200') });

  const simpanDivisi = async () => {
    if (!formDivisi.code || !formDivisi.name) return toast.err('Kode dan nama divisi wajib diisi');
    if (!(await ask.save(`divisi ${formDivisi.name}`))) return;
    try {
      if (formDivisi.id) await api.put(`/master/divisions/${formDivisi.id}`, formDivisi);
      else await api.post('/master/divisions', formDivisi);
      toast.ok('Divisi tersimpan', 'Anggota divisi menerima pemberitahuan saat kejadian yang sesuai');
      setOpenDivisi(false);
      setFormDivisi({ memberIds: [] });
      qc.invalidateQueries({ queryKey: ['divisi'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
    }
  };

  const simpanRute = async () => {
    if (!formRute.divisionId) return toast.err('Pilih divisi penanggapnya');
    if (!(await ask.create('perutean darurat', `${labelJenis(formRute.type)} → divisi terpilih`))) return;
    try {
      await api.post('/master/panic-routes', formRute);
      toast.ok('Perutean ditambahkan');
      setOpenRute(false);
      qc.invalidateQueries({ queryKey: ['panic-routes'] });
    } catch (e: any) {
      toast.err('Gagal menambahkan', e.message);
    }
  };

  const simpanSirene = async () => {
    if (!formSirene.siteId || !formSirene.code || !formSirene.name || !formSirene.endpointOn)
      return toast.err('Site, kode, nama, dan alamat nyala wajib diisi');
    if (!(await ask.save(`sirene ${formSirene.name}`))) return;
    try {
      const isi = { ...formSirene, durationS: Number(formSirene.durationS) || 60 };
      if (formSirene.id) await api.put(`/master/alarms/${formSirene.id}`, isi);
      else await api.post('/master/alarms', isi);
      toast.ok('Sirene tersimpan');
      setOpenSirene(false);
      setFormSirene({ driver: 'HTTP_GET', durationS: 60 });
      qc.invalidateQueries({ queryKey: ['alarms'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
    }
  };

  const uji = async (d: any, action: 'ON' | 'OFF') => {
    if (action === 'ON' && !(await ask.action(
      'Bunyikan sirene ini sekarang?',
      'Sirene akan benar-benar berbunyi di lapangan. Beri tahu petugas lebih dulu agar tidak dikira keadaan darurat.',
      'Ya, bunyikan',
    ))) return;
    setMenguji(d.id);
    try {
      const r = await api.post(`/master/alarms/${d.id}/test`, { action });
      if (r.ok) toast.ok(action === 'ON' ? 'Sirene berbunyi' : 'Sirene dimatikan', `${r.name} · ${r.latencyMs} ms`);
      else toast.err('Perangkat tidak menjawab', r.detail);
      qc.invalidateQueries({ queryKey: ['alarms'] });
    } catch (e: any) {
      toast.err('Gagal mengirim perintah', e.message);
    } finally {
      setMenguji(null);
    }
  };

  const hapus = async () => {
    if (!del) return;
    const jalur =
      del.jenis === 'divisi' ? '/master/divisions' : del.jenis === 'rute' ? '/master/panic-routes' : '/master/alarms';
    try {
      await api.del(`${jalur}/${del.id}`);
      toast.ok('Data dihapus');
      qc.invalidateQueries({ queryKey: [del.jenis === 'divisi' ? 'divisi' : del.jenis === 'rute' ? 'panic-routes' : 'alarms'] });
    } catch (e: any) {
      toast.err('Gagal menghapus', e.message);
    } finally {
      setDel(null);
    }
  };

  const perJenis = (k: string) => (rute.data || []).filter((r: any) => r.type === k);

  return (
    <>
      <PageHead
        crumb="Konfigurasi"
        title="Darurat & Sirene"
        desc="Siapa yang datang saat tombol darurat ditekan, dan pengeras suara mana yang berbunyi."
      >
        {bolehUbah && tab === 'divisi' && (
          <button className="btn-primary btn-sm" onClick={() => { setFormDivisi({ memberIds: [] }); setOpenDivisi(true); }}>
            <Plus size={14} /> Divisi Baru
          </button>
        )}
        {bolehUbah && tab === 'perutean' && (
          <button className="btn-primary btn-sm" onClick={() => { setFormRute({ type: 'KEBAKARAN' }); setOpenRute(true); }}>
            <Plus size={14} /> Perutean Baru
          </button>
        )}
        {bolehUbah && tab === 'sirene' && (
          <button className="btn-primary btn-sm" onClick={() => { setFormSirene({ driver: 'HTTP_GET', durationS: 60 }); setOpenSirene(true); }}>
            <Plus size={14} /> Sirene Baru
          </button>
        )}
      </PageHead>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { k: 'divisi', l: 'Divisi Penanggap', i: Users2, n: divisi.data?.length },
          { k: 'perutean', l: 'Perutean Darurat', i: Route, n: rute.data?.length },
          { k: 'sirene', l: 'Sirene Tiang', i: Siren, n: sirene.data?.length },
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

      {/* ── Divisi penanggap ── */}
      {tab === 'divisi' && (
        <Panel title="Divisi Penanggap" icon={Users2} bodyClass="p-0">
          {divisi.isLoading ? (
            <Loading />
          ) : !divisi.data?.length ? (
            <Empty text="Belum ada divisi" hint="Tambahkan pemadam, klinik, K3, dan divisi lain yang menangani keadaan darurat." />
          ) : (
            <Table head={['Divisi', 'Cakupan', 'Kontak', 'Anggota berakun', 'Menangani', '']}>
              {divisi.data.map((d: any) => (
                <tr key={d.id} className="transition hover:bg-white/[.025]">
                  <td>
                    <p className="text-[13px] font-semibold">{d.name}</p>
                    <p className="num text-[10.5px] text-muted">{d.code}</p>
                  </td>
                  <td className="text-[12px] text-muted">{d.site?.name || 'Seluruh site'}</td>
                  <td className="num text-[12px]">{d.phone || '—'}</td>
                  <td className="num text-[12.5px]">{d.members?.length ?? 0}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {[...new Set((d.routes || []).map((r: any) => r.type))].map((t: any) => (
                        <span key={t} className={`chip ${toneJenis(t)}`}>{labelJenis(t)}</span>
                      ))}
                      {!d.routes?.length && <span className="text-[11px] text-muted">belum diarahkan</span>}
                    </div>
                  </td>
                  <td>
                    {bolehUbah && (
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            setFormDivisi({ ...d, siteId: d.site?.id || '', memberIds: (d.members || []).map((m: any) => m.id) });
                            setOpenDivisi(true);
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setDel({ jenis: 'divisi', id: d.id, nama: d.name })}>
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
      )}

      {/* ── Perutean jenis darurat ── */}
      {tab === 'perutean' && (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {JENIS.map((j) => (
            <Panel key={j.k} title={j.l} icon={Siren}>
              {perJenis(j.k).length === 0 ? (
                <p className="text-[12.5px] text-muted">
                  Belum ada divisi penanggap. Sinyal jenis ini hanya sampai ke pusat komando dan klien.
                </p>
              ) : (
                <div className="space-y-2">
                  {perJenis(j.k).map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-xl border border-line/70 bg-abyss/40 px-3 py-2">
                      <Radio size={13} className="text-amber" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-semibold">{r.division?.name}</p>
                        <p className="num text-[10.5px] text-muted">
                          {r.division?.phone || '—'} · {r.site?.name || 'seluruh site'}
                        </p>
                      </div>
                      {bolehUbah && (
                        <button className="btn-ghost btn-sm" onClick={() => setDel({ jenis: 'rute', id: r.id, nama: `${j.l} → ${r.division?.name}` })}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}

      {/* ── Sirene tiang ── */}
      {tab === 'sirene' && (
        <Panel title="Sirene & Pengeras Suara" icon={Siren} bodyClass="p-0">
          {sirene.isLoading ? (
            <Loading />
          ) : !sirene.data?.length ? (
            <Empty text="Belum ada sirene terdaftar" hint="Daftarkan papan relai sirene agar berbunyi otomatis saat tombol darurat ditekan." />
          ) : (
            <Table head={['Sirene', 'Penempatan', 'Antarmuka', 'Keadaan terakhir', '']}>
              {sirene.data.map((d: any) => (
                <tr key={d.id} className="transition hover:bg-white/[.025]">
                  <td>
                    <p className="text-[13px] font-semibold">{d.name}</p>
                    <p className="num text-[10.5px] text-muted">{d.code}</p>
                  </td>
                  <td className="text-[12px] text-muted">
                    {d.site?.name}
                    {d.floor ? ` · ${d.floor.name}` : ' · seluruh area'}
                    {d.location ? <span className="block text-[10.5px]">{d.location}</span> : null}
                  </td>
                  <td>
                    <span className="chip border-line text-muted">{d.driver === 'HTTP_JSON' ? 'HTTP JSON' : 'HTTP GET'}</span>
                    <p className="num mt-1 max-w-[240px] truncate text-[10.5px] text-muted" title={d.endpointOn}>
                      {d.endpointOn}
                    </p>
                  </td>
                  <td>
                    {d.lastState ? (
                      <>
                        <Chip value={d.lastState === 'ON' ? 'CRITICAL' : 'LOW'} tone="severity">
                          {d.lastState === 'ON' ? 'Berbunyi' : 'Padam'}
                        </Chip>
                        <p className="num mt-1 text-[10.5px] text-muted">
                          {d.lastSeenAt ? dayjs(d.lastSeenAt).format('DD MMM HH:mm') : '—'}
                        </p>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted">belum pernah diuji</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {bolehUji && (
                        <>
                          <button className="btn-ghost btn-sm" disabled={menguji === d.id} onClick={() => uji(d, 'ON')}>
                            <Volume2 size={12} /> Bunyikan
                          </button>
                          <button className="btn-ghost btn-sm" disabled={menguji === d.id} onClick={() => uji(d, 'OFF')}>
                            <VolumeX size={12} />
                          </button>
                        </>
                      )}
                      {bolehUbah && (
                        <>
                          <button className="btn-ghost btn-sm" onClick={() => { setFormSirene({ ...d, floorId: d.floor?.id || '', siteId: d.site?.id }); setOpenSirene(true); }}>
                            <Pencil size={12} />
                          </button>
                          <button className="btn-ghost btn-sm" onClick={() => setDel({ jenis: 'sirene', id: d.id, nama: d.name })}>
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {/* ── Formulir divisi ── */}
      <Modal
        open={openDivisi}
        onClose={() => setOpenDivisi(false)}
        title={formDivisi.id ? `Ubah Divisi — ${formDivisi.name}` : 'Divisi Penanggap Baru'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenDivisi(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanDivisi}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kode">
            <Input value={formDivisi.code || ''} onChange={(e) => setFormDivisi({ ...formDivisi, code: e.target.value.toUpperCase() })} placeholder="DAMKAR" />
          </Field>
          <Field label="Nama divisi">
            <Input value={formDivisi.name || ''} onChange={(e) => setFormDivisi({ ...formDivisi, name: e.target.value })} placeholder="Pemadam Kebakaran" />
          </Field>
          <Field label="Nomor telepon" hint="Dipakai bila divisi belum punya akun di sistem.">
            <Input value={formDivisi.phone || ''} onChange={(e) => setFormDivisi({ ...formDivisi, phone: e.target.value })} placeholder="113" />
          </Field>
          <Field label="Cakupan site" hint="Kosongkan bila berlaku untuk seluruh site.">
            <Select value={formDivisi.siteId || ''} onChange={(e) => setFormDivisi({ ...formDivisi, siteId: e.target.value })}>
              <option value="">Seluruh site</option>
              {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Anggota divisi yang diberi tahu" className="sm:col-span-2">
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {(orang.data?.data || []).map((u: any) => {
                const on = formDivisi.memberIds?.includes(u.id);
                return (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[.04]">
                    <input
                      type="checkbox"
                      checked={!!on}
                      className="!w-auto"
                      onChange={() =>
                        setFormDivisi({
                          ...formDivisi,
                          memberIds: on
                            ? formDivisi.memberIds.filter((x: string) => x !== u.id)
                            : [...(formDivisi.memberIds || []), u.id],
                        })
                      }
                    />
                    <span className="text-[13px] normal-case tracking-normal text-ink">{u.name}</span>
                    <span className="num ml-auto text-[10px] text-muted">{u.role}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
      </Modal>

      {/* ── Formulir perutean ── */}
      <Modal
        open={openRute}
        onClose={() => setOpenRute(false)}
        title="Perutean Darurat Baru"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenRute(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanRute}>Simpan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Jenis kejadian">
            <Select value={formRute.type} onChange={(e) => setFormRute({ ...formRute, type: e.target.value })}>
              {JENIS.map((j) => <option key={j.k} value={j.k}>{j.l}</option>)}
            </Select>
          </Field>
          <Field label="Divisi penanggap">
            <Select value={formRute.divisionId || ''} onChange={(e) => setFormRute({ ...formRute, divisionId: e.target.value })}>
              <option value="">Pilih divisi…</option>
              {(divisi.data || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Berlaku untuk site" hint="Aturan khusus site menimpa aturan umum.">
            <Select value={formRute.siteId || ''} onChange={(e) => setFormRute({ ...formRute, siteId: e.target.value })}>
              <option value="">Seluruh site</option>
              {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      {/* ── Formulir sirene ── */}
      <Modal
        open={openSirene}
        onClose={() => setOpenSirene(false)}
        title={formSirene.id ? `Ubah Sirene — ${formSirene.name}` : 'Sirene Tiang Baru'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenSirene(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanSirene}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site">
            <Select value={formSirene.siteId || ''} onChange={(e) => setFormSirene({ ...formSirene, siteId: e.target.value, floorId: '' })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Lantai" hint="Kosongkan untuk sirene luar ruang yang selalu ikut berbunyi.">
            <Select value={formSirene.floorId || ''} onChange={(e) => setFormSirene({ ...formSirene, floorId: e.target.value })}>
              <option value="">Seluruh area site</option>
              {(lantai.data || []).filter((f: any) => f.siteId === formSirene.siteId).map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Kode perangkat">
            <Input value={formSirene.code || ''} onChange={(e) => setFormSirene({ ...formSirene, code: e.target.value.toUpperCase() })} placeholder="SRN-GATE-01" />
          </Field>
          <Field label="Nama">
            <Input value={formSirene.name || ''} onChange={(e) => setFormSirene({ ...formSirene, name: e.target.value })} placeholder="Sirene tiang gerbang utama" />
          </Field>
          <Field label="Letak fisik" className="sm:col-span-2">
            <Input value={formSirene.location || ''} onChange={(e) => setFormSirene({ ...formSirene, location: e.target.value })} placeholder="Tiang setinggi 6 m di sisi timur gerbang" />
          </Field>
          <Field label="Antarmuka perangkat" hint="Papan relai Shelly dan Tasmota memakai HTTP GET.">
            <Select value={formSirene.driver || 'HTTP_GET'} onChange={(e) => setFormSirene({ ...formSirene, driver: e.target.value })}>
              <option value="HTTP_GET">HTTP GET</option>
              <option value="HTTP_JSON">HTTP JSON</option>
            </Select>
          </Field>
          <Field label="Lama bunyi (detik)" hint="0 berarti berbunyi sampai dimatikan.">
            <Input type="number" value={formSirene.durationS ?? 60} onChange={(e) => setFormSirene({ ...formSirene, durationS: e.target.value })} />
          </Field>
          <Field label="Alamat menyalakan" className="sm:col-span-2" hint="Boleh memuat {reason} dan {duration} yang diisi sistem.">
            <Input value={formSirene.endpointOn || ''} onChange={(e) => setFormSirene({ ...formSirene, endpointOn: e.target.value })} placeholder="http://192.168.1.50/relay/0?turn=on" />
          </Field>
          <Field label="Alamat mematikan" className="sm:col-span-2">
            <Input value={formSirene.endpointOff || ''} onChange={(e) => setFormSirene({ ...formSirene, endpointOff: e.target.value })} placeholder="http://192.168.1.50/relay/0?turn=off" />
          </Field>
          <Field label="Token perangkat (opsional)" className="sm:col-span-2">
            <Input value={formSirene.authToken || ''} onChange={(e) => setFormSirene({ ...formSirene, authToken: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={hapus}
        message={`Hapus ${del?.nama ?? ''}? Riwayat kejadian yang sudah tercatat tidak ikut terhapus.`}
        danger
      />
    </>
  );
}
