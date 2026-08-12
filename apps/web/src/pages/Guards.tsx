import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Pencil, UserMinus } from 'lucide-react';
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

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/master/clients') });
  const { data, isLoading } = useQuery({
    queryKey: ['users', q, role],
    queryFn: () => api.get('/users' + qs({ q, role, pageSize: 200 })),
  });

  const save = async () => {
    if (!form.name || !form.username) return toast.err('Nama dan nama pengguna wajib diisi');
    if (!(await (form.id ? ask.save(`data personel ${form.name}`) : ask.create('personel', form.name)))) return;
    try {
      if (form.id) await api.put(`/users/${form.id}`, form);
      else await api.post('/users', form);
      toast.ok(form.id ? 'Data personel diperbarui' : 'Personel ditambahkan');
      setOpen(false);
      setForm({ role: 'GUARD' });
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
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
          <Table head={['Personel', 'Peran', 'Penempatan', 'Kontak', 'Bergabung', 'Status', '']}>
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
                <td className="text-[12px]">{d(u.joinedAt)}</td>
                <td><Chip value={u.status === 'ACTIVE' ? 'DONE' : 'ABSENT'}>{u.status === 'ACTIVE' ? 'Aktif' : u.status === 'SUSPENDED' ? 'Ditangguhkan' : 'Berhenti'}</Chip></td>
                <td className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost btn-sm" onClick={() => { setForm({ ...u, homeSiteId: u.homeSite?.id, clientId: u.client?.id, password: '' }); setOpen(true); }}>
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
