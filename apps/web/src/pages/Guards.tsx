import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Pencil, UserMinus, ScanFace } from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Table, Chip, Avatar, Loading, Empty, Modal, Field, Select, SearchBox, Confirm } from '../components/ui';
import { d, label } from '../lib/format';
import { ask } from '../components/confirm';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'GUARD', 'CLIENT'];

export default function Guards() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const canEdit = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');

  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ role: 'GUARD' });
  const [del, setDel] = useState<string | null>(null);
  const [daftarWajah, setDaftarWajah] = useState<any>(null);
  const [fotoWajah, setFotoWajah] = useState<string | null>(null);
  const [prosesWajah, setProsesWajah] = useState(false);

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/master/clients') });
  // Golongan upah hanya boleh dibaca administrator — dipakai pada bagian penggajian.
  const grades = useQuery({
    queryKey: ['pay-grades'],
    queryFn: () => api.get('/payroll/grades'),
    enabled: canEdit,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['users', q, role],
    queryFn: () => api.get('/users' + qs({ q, role, pageSize: 200 })),
  });

  const save = async () => {
    if (!form.name || !form.username) return toast.err('Nama dan nama pengguna wajib diisi');
    if (!(await (form.id ? ask.save(`data personel ${form.name}`) : ask.create('personel', form.name)))) return;
    try {
      // Sandi kosong berarti "jangan diubah" — bila ikut terkirim, penyaringan
      // panjang minimal di server akan menolak seluruh penyimpanan.
      const { password, ...sisa } = form;
      const body = password ? form : sisa;
      if (form.id) await api.put(`/users/${form.id}`, body);
      else await api.post('/users', body);
      toast.ok(form.id ? 'Data personel diperbarui' : 'Personel ditambahkan');
      setOpen(false);
      setForm({ role: 'GUARD' });
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
    }
  };

  const unggahWajah = async (file: File) => {
    setProsesWajah(true);
    try {
      const { url } = await api.upload(file, 'wajah');
      setFotoWajah(url);
    } catch (e: any) {
      toast.err('Gagal mengunggah foto', e.message);
    } finally {
      setProsesWajah(false);
    }
  };

  const simpanWajah = async () => {
    if (!fotoWajah) return toast.err('Unggah foto wajah lebih dulu');
    if (!(await ask.save(`data wajah ${daftarWajah.name}`, 'Foto ini menjadi acuan verifikasi setiap kali yang bersangkutan melakukan presensi.'))) return;
    setProsesWajah(true);
    try {
      await api.post(`/users/${daftarWajah.id}/face`, { photoUrl: fotoWajah });
      toast.ok('Wajah terdaftar', 'Presensi kini diverifikasi dengan pencocokan wajah');
      setDaftarWajah(null);
      setFotoWajah(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e: any) {
      toast.err('Gagal mendaftarkan wajah', e.message);
    } finally {
      setProsesWajah(false);
    }
  };

  const rows = data?.data || [];

  return (
    <>
      <PageHead crumb="Personel" title="Data Personel" desc="Anggota satuan pengamanan, supervisor, dan akun klien.">
        {canEdit && (
          <button className="btn-primary btn-sm" onClick={() => { setForm({ role: 'GUARD' }); setOpen(true); }}>
            <Plus size={14} /> Tambah Personel
          </button>
        )}
      </PageHead>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama, NIP, atau nama pengguna…" />
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Semua peran</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{label(r)}</option>
          ))}
        </Select>
      </div>

      <Panel title={`Daftar Personel · ${data?.total ?? 0}`} icon={Users} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Tidak ada personel yang cocok" />
        ) : (
          <Table head={['Personel', 'Peran', 'Penempatan', 'Kontak', 'Wajah', 'Status', '']}>
            {rows.map((u: any) => (
              <tr key={u.id} className="transition hover:bg-white/[.025]">
                <td>
                  <Link to={`/personel/${u.id}`} className="flex items-center gap-2.5 group">
                    <Avatar name={u.name} url={u.avatarUrl} size={34} />
                    <div>
                      <p className="text-[13px] font-semibold group-hover:text-amber">{u.name}</p>
                      <p className="num text-[10.5px] text-muted">{u.employeeId || u.username}</p>
                    </div>
                  </Link>
                </td>
                <td>
                  <p className="text-[12.5px]">{label(u.role)}</p>
                  {u.rank && <p className="text-[10.5px] text-muted">{u.rank}</p>}
                </td>
                <td className="text-[12.5px]">{u.homeSite?.name || u.client?.name || '—'}</td>
                <td className="num text-[12px] text-muted">{u.phone || u.email || '—'}</td>
                <td>
                  {u.faceEnrolledAt ? (
                    <span className="chip border-emerald/40 bg-emerald/10 text-emerald">
                      <ScanFace size={11} /> Terdaftar
                    </span>
                  ) : (
                    <span className="chip border-line text-muted">Belum</span>
                  )}
                </td>
                <td><Chip value={u.status === 'ACTIVE' ? 'DONE' : 'ABSENT'}>{u.status === 'ACTIVE' ? 'Aktif' : u.status === 'SUSPENDED' ? 'Ditangguhkan' : 'Berhenti'}</Chip></td>
                <td className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="btn-ghost btn-sm"
                        title="Daftarkan wajah"
                        onClick={() => { setDaftarWajah(u); setFotoWajah(null); }}
                      >
                        <ScanFace size={12} />
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => { setForm({ ...u, homeSiteId: u.homeSite?.id, clientId: u.client?.id, gradeId: u.grade?.id, password: '' }); setOpen(true); }}>
                        <Pencil size={12} />
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setDel(u.id)}>
                        <UserMinus size={12} />
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
        title={form.id ? 'Ubah Data Personel' : 'Tambah Personel'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap">
            <input className="w-full" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="NIP / Nomor anggota">
            <input className="w-full" value={form.employeeId || ''} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
          </Field>
          <Field label="Nama pengguna">
            <input className="w-full" value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label={form.id ? 'Kata sandi baru (opsional)' : 'Kata sandi'} hint={form.id ? 'Kosongkan bila tidak diubah.' : 'Bawaan: patroli123'}>
            <input type="password" className="w-full" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Peran">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{label(r)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Pangkat / Jabatan">
            <input className="w-full" value={form.rank || ''} onChange={(e) => setForm({ ...form, rank: e.target.value })} />
          </Field>
          <Field label="Telepon">
            <input className="w-full" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Surel">
            <input className="w-full" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          {form.role === 'CLIENT' ? (
            <Field label="Perusahaan klien" className="sm:col-span-2">
              <Select value={form.clientId || ''} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">Pilih klien…</option>
                {(clients.data || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Penempatan utama" className="sm:col-span-2">
              <Select value={form.homeSiteId || ''} onChange={(e) => setForm({ ...form, homeSiteId: e.target.value })}>
                <option value="">Belum ditentukan</option>
                {(sites.data || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          )}
          {form.id && (
            <Field label="Status kepegawaian" className="sm:col-span-2">
              <Select value={form.status || 'ACTIVE'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Aktif</option>
                <option value="SUSPENDED">Ditangguhkan</option>
                <option value="RESIGNED">Berhenti</option>
              </Select>
            </Field>
          )}

          {/* Data penggajian — tanpa golongan upah, personel tidak ikut dihitung gajinya. */}
          {canEdit && form.role !== 'CLIENT' && (
            <>
              <div className="sm:col-span-2 mt-1 border-t border-line/70 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-[.15em] text-amber">Data Penggajian</p>
              </div>
              <Field label="Golongan upah" hint="Menentukan gaji pokok, tunjangan, dan iuran">
                <Select value={form.gradeId || ''} onChange={(e) => setForm({ ...form, gradeId: e.target.value })}>
                  <option value="">Belum bergolongan</option>
                  {(grades.data || []).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status PTKP" hint="Menentukan kategori tarif efektif PPh 21">
                <Select value={form.ptkp || 'TK0'} onChange={(e) => setForm({ ...form, ptkp: e.target.value })}>
                  {['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3'].map((k) => (
                    <option key={k} value={k}>{k.replace(/^(TK|K)(\d)$/, '$1/$2')}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Bank">
                <Select value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })}>
                  <option value="">— pilih bank —</option>
                  {['BCA', 'MANDIRI', 'BRI', 'BNI', 'BSI', 'BJB', 'CIMB', 'PERMATA'].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nomor rekening">
                <input className="w-full" value={form.bankAccount || ''} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
              </Field>
              <Field label="Nama pemilik rekening" className="sm:col-span-2" hint="Kosongkan bila sama dengan nama personel">
                <input className="w-full" value={form.bankAccountName || ''} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} />
              </Field>
              <Field label="NPWP">
                <input className="w-full" value={form.npwp || ''} onChange={(e) => setForm({ ...form, npwp: e.target.value })} />
              </Field>
              <Field label="Nomor BPJS Ketenagakerjaan">
                <input className="w-full" value={form.bpjsTkNo || ''} onChange={(e) => setForm({ ...form, bpjsTkNo: e.target.value })} />
              </Field>
              <Field label="Nomor BPJS Kesehatan">
                <input className="w-full" value={form.bpjsKesNo || ''} onChange={(e) => setForm({ ...form, bpjsKesNo: e.target.value })} />
              </Field>
              <Field label="Tanggal berhenti" hint="Diisi bila berhenti di tengah periode — gaji dihitung pro-rata">
                <input type="date" className="w-full" value={(form.resignedAt || '').slice(0, 10)} onChange={(e) => setForm({ ...form, resignedAt: e.target.value })} />
              </Field>
            </>
          )}
        </div>
      </Modal>

      {/* Pendaftaran wajah untuk verifikasi presensi */}
      <Modal
        open={!!daftarWajah}
        onClose={() => { setDaftarWajah(null); setFotoWajah(null); }}
        title={`Pendaftaran Wajah — ${daftarWajah?.name ?? ''}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => { setDaftarWajah(null); setFotoWajah(null); }}>Batal</button>
            <button className="btn-primary" onClick={simpanWajah} disabled={!fotoWajah || prosesWajah}>
              {prosesWajah ? 'Memproses…' : 'Daftarkan Wajah'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Unggah satu foto wajah yang menghadap kamera dengan pencahayaan cukup. Sistem mengambil
            ciri wajah dari foto tersebut, lalu mencocokkannya setiap kali yang bersangkutan
            melakukan presensi masuk.
          </p>
          {fotoWajah ? (
            <div className="flex items-center gap-4">
              <img src={fotoWajah} alt="Foto wajah" className="h-32 w-32 rounded-2xl border border-line object-cover" />
              <button className="btn-ghost btn-sm" onClick={() => setFotoWajah(null)}>Ganti foto</button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-abyss/50 px-6 py-10 text-center transition hover:border-amber/50">
              <ScanFace size={26} className="text-amber" />
              <span className="text-[13px] font-semibold">Pilih foto wajah</span>
              <span className="text-[11px] text-muted">Format JPG atau PNG, wajah terlihat jelas</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && unggahWajah(e.target.files[0])}
              />
            </label>
          )}
          {daftarWajah?.faceEnrolledAt && (
            <div className="rounded-xl border border-line/70 bg-abyss/40 px-4 py-3 text-[12px] text-muted">
              Wajah sudah terdaftar sebelumnya. Mengunggah foto baru akan menggantikan data lama.
            </div>
          )}
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await api.del(`/users/${del}`);
          toast.ok('Personel dinonaktifkan');
          qc.invalidateQueries({ queryKey: ['users'] });
        }}
        message="Nonaktifkan personel ini? Riwayat patroli dan presensi tetap tersimpan."
        danger
        confirmLabel="Nonaktifkan"
      />
    </>
  );
}
