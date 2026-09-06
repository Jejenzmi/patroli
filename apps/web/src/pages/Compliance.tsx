import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Plus, Trash2, Save, TriangleAlert, FileBadge, Grid3x3, Gavel, FileSignature, UserX, CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Input, Select, Textarea, Table, Stat, Avatar } from '../components/ui';
import { ask } from '../components/confirm';
import { d, num } from '../lib/format';

const TABS = [
  { key: 'berkas', label: 'Berkas & Masa Berlaku', icon: FileBadge },
  { key: 'matriks', label: 'Matriks Kelengkapan', icon: Grid3x3 },
  { key: 'syarat', label: 'Syarat Kompetensi', icon: ShieldCheck },
  { key: 'disiplin', label: 'Disiplin & Daftar Hitam', icon: Gavel },
  { key: 'pkwt', label: 'Perjanjian Kerja', icon: FileSignature },
];

const JENIS_BERKAS: Record<string, string> = {
  KTA_POLRI: 'KTA Polri',
  GADA_PRATAMA: 'Gada Pratama',
  GADA_MADYA: 'Gada Madya',
  GADA_UTAMA: 'Gada Utama',
  SKCK: 'SKCK',
  MCU: 'MCU',
  KTP: 'KTP',
  SIM_A: 'SIM A',
  SIM_C: 'SIM C',
  DAMKAR: 'Damkar',
  P3K: 'P3K',
  IJAZAH: 'Ijazah',
  SERTIFIKAT_LAIN: 'Sertifikat lain',
};

function warnaSisa(sisa: number | null) {
  if (sisa === null) return 'text-muted';
  if (sisa < 0) return 'text-danger';
  if (sisa <= 30) return 'text-danger';
  if (sisa <= 60) return 'text-orange-400';
  return 'text-amber';
}

/* ═══════════ BERKAS ═══════════ */

function Berkas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ type: 'KTA_POLRI' });

  const { data: papan, isLoading } = useQuery({
    queryKey: ['dok-kedaluwarsa'],
    queryFn: () => api.get('/compliance/documents/kedaluwarsa?hari=90'),
  });
  const { data: semua } = useQuery({ queryKey: ['dokumen'], queryFn: () => api.get('/compliance/documents') });
  const { data: orang } = useQuery({ queryKey: ['users-ringkas'], queryFn: () => api.get('/users?pageSize=300') });
  const { data: konfig } = useQuery({ queryKey: ['kepatuhan-config'], queryFn: () => api.get('/compliance/config') });

  const daftarOrang = orang?.data || [];

  const simpan = async () => {
    if (!form.guardId || !form.type) return toast.err('Personel dan jenis berkas wajib dipilih');
    const ubah = !!form.id;
    if (!(await (ubah ? ask.save('berkas personel') : ask.create('berkas personel', JENIS_BERKAS[form.type])))) return;
    try {
      const body = {
        guardId: form.guardId,
        type: form.type,
        number: form.number || null,
        issuedAt: form.issuedAt || null,
        expiresAt: form.expiresAt || null,
        note: form.note || null,
      };
      if (ubah) await api.put(`/compliance/documents/${form.id}`, body);
      else await api.post('/compliance/documents', body);
      toast.ok('Berkas tersimpan', 'Pengingat masa berlaku dihitung ulang');
      setOpen(false);
      setForm({ type: 'KTA_POLRI' });
      qc.invalidateQueries({ queryKey: ['dokumen'] });
      qc.invalidateQueries({ queryKey: ['dok-kedaluwarsa'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
    }
  };

  const ubahBlokir = async (aktif: boolean) => {
    if (
      !(await ask.action(
        aktif ? 'Aktifkan penolakan penjadwalan?' : 'Matikan penolakan penjadwalan?',
        aktif
          ? 'Personel dengan KTA atau sertifikat Gada yang sudah mati tidak akan bisa dimasukkan ke roster.'
          : 'Penjadwalan tetap diizinkan meski berkas wajib sudah kedaluwarsa. Risiko audit ada pada perusahaan.',
        'Ya, terapkan'
      ))
    )
      return;
    await api.put('/compliance/config', { blokirBerkasMati: aktif });
    qc.invalidateQueries({ queryKey: ['kepatuhan-config'] });
    toast.ok('Pengaturan diperbarui');
  };

  if (isLoading) return <Loading />;

  const mati = papan?.mati || [];
  const h30 = papan?.h30 || [];

  return (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Berkas Mati" value={num(mati.length)} sub="tidak boleh dijadwalkan" icon={TriangleAlert} tone="danger" />
        <Stat label="Berakhir ≤ 30 Hari" value={num(h30.length)} icon={TriangleAlert} tone="amber" />
        <Stat label="31–60 Hari" value={num(papan?.h60?.length)} icon={FileBadge} tone="cyan" />
        <Stat label="61–90 Hari" value={num(papan?.h90?.length)} icon={FileBadge} tone="violet" />
      </div>

      <Panel
        title="Penolakan Penjadwalan Otomatis"
        icon={ShieldCheck}
        className="mb-4"
        action={
          <button
            className={konfig?.blokirBerkasMati ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
            onClick={() => ubahBlokir(!konfig?.blokirBerkasMati)}
          >
            {konfig?.blokirBerkasMati ? 'Matikan' : 'Aktifkan'}
          </button>
        }
      >
        <p className="text-[12.5px] text-muted">
          {konfig?.blokirBerkasMati ? (
            <>
              <span className="font-semibold text-emerald">Aktif.</span> Personel dengan KTA Polri atau sertifikat
              Gada Pratama yang sudah kedaluwarsa ditolak saat dimasukkan ke roster, baik satuan maupun massal.
            </>
          ) : (
            <>
              <span className="font-semibold text-danger">Nonaktif.</span> Penjadwalan tetap berjalan meski berkas
              wajib sudah mati — periksa sendiri sebelum audit klien atau Baharkam.
            </>
          )}
        </p>
      </Panel>

      <Panel
        title="Berkas Personel"
        icon={FileBadge}
        bodyClass="p-0"
        action={
          <button className="btn-primary btn-sm" onClick={() => { setForm({ type: 'KTA_POLRI' }); setOpen(true); }}>
            <Plus size={14} /> Berkas
          </button>
        }
      >
        {!(semua || []).length ? (
          <Empty text="Belum ada berkas tercatat" hint="Mulai dari KTA Polri dan sertifikat Gada seluruh anggota" />
        ) : (
          <Table head={['Personel', 'Jenis', 'Nomor', 'Terbit', 'Berakhir', 'Sisa', '']}>
            {semua.map((b: any) => (
              <tr key={b.id} className="transition hover:bg-white/[.025]">
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={b.guard?.name} url={b.guard?.avatarUrl} size={28} />
                    <div>
                      <p className="text-[13px] font-semibold">{b.guard?.name}</p>
                      <p className="num text-[10.5px] text-muted">
                        {b.guard?.employeeId} · {b.guard?.homeSite?.name || 'tanpa penempatan'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-[12.5px]">{b.label}</td>
                <td className="num text-[12px] text-muted">{b.number || '—'}</td>
                <td className="num text-[12px]">{b.issuedAt ? d(b.issuedAt) : '—'}</td>
                <td className="num text-[12px]">{b.expiresAt ? d(b.expiresAt) : 'tanpa batas'}</td>
                <td className={`num text-[12.5px] font-semibold ${warnaSisa(b.sisaHari)}`}>
                  {b.sisaHari === null ? '—' : b.sisaHari < 0 ? `mati ${Math.abs(b.sisaHari)} hari` : `${b.sisaHari} hari`}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        setForm({
                          id: b.id,
                          guardId: b.guardId,
                          type: b.type,
                          number: b.number,
                          issuedAt: b.issuedAt?.slice(0, 10),
                          expiresAt: b.expiresAt?.slice(0, 10),
                          note: b.note,
                        });
                        setOpen(true);
                      }}
                    >
                      Ubah
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        if (!(await ask.remove('berkas', `${b.label} — ${b.guard?.name}`))) return;
                        await api.del(`/compliance/documents/${b.id}`);
                        qc.invalidateQueries({ queryKey: ['dokumen'] });
                        qc.invalidateQueries({ queryKey: ['dok-kedaluwarsa'] });
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? 'Ubah Berkas' : 'Berkas Personel Baru'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={simpan}><Save size={14} /> Simpan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Personel">
            <Select value={form.guardId || ''} onChange={(e) => setForm({ ...form, guardId: e.target.value })}>
              <option value="">— pilih personel —</option>
              {daftarOrang.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} {u.employeeId ? `(${u.employeeId})` : ''}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis berkas">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(JENIS_BERKAS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Nomor berkas">
              <Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </Field>
            <Field label="Tanggal terbit">
              <Input type="date" value={form.issuedAt || ''} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} />
            </Field>
            <Field label="Berlaku sampai" hint="Kosongkan bila tidak punya masa berlaku">
              <Input type="date" value={form.expiresAt || ''} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </Field>
          </div>
          <Field label="Catatan">
            <Textarea value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* ═══════════ MATRIKS ═══════════ */

function Matriks() {
  const { data: sites } = useQuery({ queryKey: ['sites-ringkas'], queryFn: () => api.get('/master/sites') });
  const [siteId, setSiteId] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['dok-matriks', siteId],
    queryFn: () => api.get(`/compliance/documents/matriks${siteId ? `?siteId=${siteId}` : ''}`),
  });

  const daftarSite = sites?.data || sites || [];

  return (
    <Panel
      title="Matriks Kelengkapan Berkas"
      icon={Grid3x3}
      bodyClass="p-0"
      action={
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="!w-auto">
          <option value="">Semua site</option>
          {daftarSite.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      }
    >
      {isLoading ? (
        <Loading />
      ) : !data?.data?.length ? (
        <Empty text="Belum ada personel" />
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Personel</th>
                {data.jenis.map((j: any) => (
                  <th key={j.type} className="whitespace-nowrap text-center">
                    {j.label}
                    {j.wajib && <span className="text-danger"> *</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((r: any) => (
                <tr key={r.guardId} className="transition hover:bg-white/[.025]">
                  <td>
                    <p className="text-[13px] font-semibold">{r.name}</p>
                    <p className="num text-[10.5px] text-muted">{r.employeeId} · {r.site || '—'}</p>
                  </td>
                  {data.jenis.map((j: any) => {
                    const b = r.berkas[j.type];
                    return (
                      <td key={j.type} className="text-center">
                        {!b ? (
                          <span className={j.wajib ? 'text-danger' : 'text-muted'}>—</span>
                        ) : b.mati ? (
                          <span className="chip border-danger/40 bg-danger/10 text-danger">mati</span>
                        ) : (
                          <CheckCircle2 size={15} className="mx-auto text-emerald" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-[11.5px] text-muted">
            <span className="text-danger">*</span> berkas wajib — bila mati, personel ditolak saat penjadwalan.
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ═══════════ SYARAT KOMPETENSI ═══════════ */

function Syarat() {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ docType: 'DAMKAR', minCount: 1, perShift: false });
  const [periksa, setPeriksa] = useState<any>({ tanggal: new Date().toISOString().slice(0, 10) });

  const { data: sites } = useQuery({ queryKey: ['sites-ringkas'], queryFn: () => api.get('/master/sites') });
  const { data: rows } = useQuery({ queryKey: ['syarat'], queryFn: () => api.get('/compliance/requirements') });
  const { data: hasil, refetch } = useQuery({
    queryKey: ['syarat-periksa', periksa.siteId, periksa.tanggal],
    queryFn: () => api.get(`/compliance/requirements/periksa?siteId=${periksa.siteId}&tanggal=${periksa.tanggal}`),
    enabled: !!periksa.siteId,
  });

  const daftarSite = sites?.data || sites || [];

  const simpan = async () => {
    if (!form.siteId) return toast.err('Pilih site lebih dulu');
    if (!(await ask.create('syarat kompetensi', JENIS_BERKAS[form.docType]))) return;
    await api.post('/compliance/requirements', {
      siteId: form.siteId,
      docType: form.docType,
      minCount: Number(form.minCount),
      perShift: !!form.perShift,
      note: form.note || null,
    });
    toast.ok('Syarat kompetensi disimpan');
    qc.invalidateQueries({ queryKey: ['syarat'] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Syarat Kompetensi per Site" icon={ShieldCheck} bodyClass="p-0">
        <div className="grid gap-2 border-b border-line/70 p-4 sm:grid-cols-2">
          <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
            <option value="">— pilih site —</option>
            {daftarSite.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
            {Object.entries(JENIS_BERKAS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input
            type="number"
            value={form.minCount}
            onChange={(e) => setForm({ ...form, minCount: e.target.value })}
            placeholder="Jumlah minimal"
          />
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={!!form.perShift} onChange={(e) => setForm({ ...form, perShift: e.target.checked })} />
            Wajib terpenuhi tiap shift
          </label>
          <button className="btn-primary btn-sm sm:col-span-2" onClick={simpan}>
            <Plus size={13} /> Simpan Syarat
          </button>
        </div>
        {!(rows || []).length ? (
          <Empty text="Belum ada syarat" hint='Misalnya: "dua orang bersertifikat damkar tiap shift"' />
        ) : (
          <Table head={['Site', 'Kompetensi', 'Minimal', 'Lingkup', '']}>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="text-[12.5px]">{r.site?.name}</td>
                <td className="text-[13px] font-semibold">{r.label}</td>
                <td className="num">{r.minCount} orang</td>
                <td className="text-[12px] text-muted">{r.perShift ? 'tiap shift' : 'per site'}</td>
                <td className="text-right">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={async () => {
                      if (!(await ask.remove('syarat kompetensi', r.label))) return;
                      await api.del(`/compliance/requirements/${r.id}`);
                      qc.invalidateQueries({ queryKey: ['syarat'] });
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Pemeriksaan Roster" icon={CheckCircle2} bodyClass="p-0">
        <div className="grid gap-2 border-b border-line/70 p-4 sm:grid-cols-[1fr_150px_auto]">
          <Select value={periksa.siteId || ''} onChange={(e) => setPeriksa({ ...periksa, siteId: e.target.value })}>
            <option value="">— pilih site —</option>
            {daftarSite.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Input type="date" value={periksa.tanggal} onChange={(e) => setPeriksa({ ...periksa, tanggal: e.target.value })} />
          <button className="btn-ghost btn-sm" onClick={() => refetch()}>Periksa</button>
        </div>
        {!periksa.siteId ? (
          <Empty text="Pilih site dan tanggal" hint="Sistem membandingkan syarat kontrak dengan roster hari itu" />
        ) : !hasil?.hasil?.length ? (
          <Empty text="Site ini belum punya syarat kompetensi" />
        ) : (
          <Table head={['Kompetensi', 'Lingkup', 'Wajib', 'Ada', 'Status']}>
            {hasil.hasil.map((h: any, i: number) => (
              <tr key={i}>
                <td className="text-[13px] font-semibold">{h.label}</td>
                <td className="text-[12px] text-muted">{h.shift || 'seluruh site'}</td>
                <td className="num">{h.wajib}</td>
                <td className={`num font-semibold ${h.memenuhi ? 'text-emerald' : 'text-danger'}`}>{h.ada}</td>
                <td>
                  <span className={`chip ${h.memenuhi ? 'border-emerald/40 bg-emerald/10 text-emerald' : 'border-danger/40 bg-danger/10 text-danger'}`}>
                    {h.memenuhi ? 'Terpenuhi' : 'Kurang'}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}

/* ═══════════ DISIPLIN ═══════════ */

function Disiplin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ level: 'SP1' });

  const { data: rows } = useQuery({ queryKey: ['disiplin'], queryFn: () => api.get('/compliance/disciplines') });
  const { data: hitam } = useQuery({ queryKey: ['blacklist'], queryFn: () => api.get('/compliance/blacklist') });
  const { data: orang } = useQuery({ queryKey: ['users-ringkas'], queryFn: () => api.get('/users?pageSize=300') });
  const daftarOrang = orang?.data || [];

  const simpan = async () => {
    if (!form.guardId || !form.reason) return toast.err('Personel dan alasan wajib diisi');
    if (!(await ask.create('sanksi', form.level))) return;
    try {
      await api.post('/compliance/disciplines', {
        guardId: form.guardId,
        level: form.level,
        reason: form.reason,
        date: form.date || undefined,
        note: form.note || null,
      });
      toast.ok('Sanksi tercatat', 'Yang bersangkutan menerima notifikasi');
      setOpen(false);
      setForm({ level: 'SP1' });
      qc.invalidateQueries({ queryKey: ['disiplin'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const ubahHitam = async (u: any, aktif: boolean) => {
    const alasan = aktif ? window.prompt(`Alasan memasukkan ${u.name || u.guard?.name} ke daftar hitam:`) : null;
    if (aktif && !alasan) return;
    if (
      !(await ask.action(
        aktif ? 'Masukkan ke daftar hitam?' : 'Keluarkan dari daftar hitam?',
        aktif
          ? 'Yang bersangkutan tidak akan bisa dijadwalkan bertugas di site mana pun.'
          : 'Yang bersangkutan boleh dijadwalkan kembali.',
        'Ya, lanjutkan'
      ))
    )
      return;
    await api.put(`/compliance/blacklist/${u.id || u.guardId}`, { blacklisted: aktif, reason: alasan });
    qc.invalidateQueries({ queryKey: ['blacklist'] });
    qc.invalidateQueries({ queryKey: ['disiplin'] });
    toast.ok(aktif ? 'Masuk daftar hitam' : 'Keluar dari daftar hitam');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel
        title="Rekam Jejak Kedisiplinan"
        icon={Gavel}
        bodyClass="p-0"
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Sanksi
          </button>
        }
      >
        {!(rows || []).length ? (
          <Empty text="Belum ada catatan sanksi" />
        ) : (
          <Table head={['Personel', 'Sanksi', 'Alasan', 'Tanggal', 'Gugur', 'Pemberi', '']}>
            {rows.map((r: any) => (
              <tr key={r.id} className="transition hover:bg-white/[.025]">
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.guard?.name} url={r.guard?.avatarUrl} size={28} />
                    <div>
                      <p className="text-[13px] font-semibold">{r.guard?.name}</p>
                      <p className="num text-[10.5px] text-muted">{r.guard?.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`chip ${r.level === 'PHK' || r.level === 'SP3' ? 'border-danger/40 bg-danger/10 text-danger' : r.level === 'TEGURAN' ? 'border-line bg-white/5 text-muted' : 'border-amber/40 bg-amber/10 text-amber'}`}>
                    {r.level}
                  </span>
                </td>
                <td className="max-w-[220px] text-[12.5px]">{r.reason}</td>
                <td className="num text-[12px]">{d(r.date)}</td>
                <td className="num text-[12px] text-muted">{r.expiresAt ? d(r.expiresAt) : '—'}</td>
                <td className="text-[12px] text-muted">{r.issuedBy?.name || '—'}</td>
                <td className="text-right">
                  {!r.guard?.blacklisted && (
                    <button className="btn-ghost btn-sm" onClick={() => ubahHitam(r.guard, true)}>
                      <UserX size={12} /> Daftar hitam
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Daftar Hitam" icon={UserX} bodyClass="p-0">
        {!(hitam || []).length ? (
          <Empty text="Tidak ada personel dalam daftar hitam" />
        ) : (
          <div className="divide-y divide-line/60">
            {hitam.map((u: any) => (
              <div key={u.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold">{u.name}</p>
                  <p className="num text-[10.5px] text-muted">{u.employeeId}</p>
                  <p className="mt-1 text-[11.5px] text-danger">{u.blacklistReason}</p>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => ubahHitam(u, false)}>
                  Cabut
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Catat Sanksi"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={simpan}><Save size={14} /> Simpan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Personel">
            <Select value={form.guardId || ''} onChange={(e) => setForm({ ...form, guardId: e.target.value })}>
              <option value="">— pilih personel —</option>
              {daftarOrang.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} {u.employeeId ? `(${u.employeeId})` : ''}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis sanksi" hint="SP gugur otomatis setelah enam bulan">
              <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {['TEGURAN', 'SP1', 'SP2', 'SP3', 'PHK'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tanggal">
              <Input type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
          </div>
          <Field label="Alasan">
            <Textarea value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Uraikan pelanggaran secara ringkas dan faktual…" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ PKWT ═══════════ */

function Pkwt() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ type: 'PKWT' });

  const { data: rows } = useQuery({ queryKey: ['pkwt'], queryFn: () => api.get('/compliance/employment') });
  const { data: orang } = useQuery({ queryKey: ['users-ringkas'], queryFn: () => api.get('/users?pageSize=300') });
  const daftarOrang = orang?.data || [];

  const simpan = async () => {
    if (!form.guardId || !form.number || !form.startDate) return toast.err('Personel, nomor, dan tanggal mulai wajib diisi');
    if (!(await ask.create('perjanjian kerja', form.number))) return;
    try {
      await api.post('/compliance/employment', {
        guardId: form.guardId,
        type: form.type,
        number: form.number,
        startDate: form.startDate,
        endDate: form.endDate || null,
        note: form.note || null,
      });
      toast.ok('Perjanjian kerja tersimpan');
      setOpen(false);
      setForm({ type: 'PKWT' });
      qc.invalidateQueries({ queryKey: ['pkwt'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  return (
    <>
      <Panel
        title="Perjanjian Kerja"
        icon={FileSignature}
        bodyClass="p-0"
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Perjanjian
          </button>
        }
      >
        {!(rows || []).length ? (
          <Empty text="Belum ada perjanjian kerja tercatat" hint="PKWT yang lewat tanpa perpanjangan berisiko berubah menjadi PKWTT" />
        ) : (
          <Table head={['Personel', 'Jenis', 'Nomor', 'Mulai', 'Berakhir', 'Sisa', 'Status', '']}>
            {rows.map((r: any) => (
              <tr key={r.id} className="transition hover:bg-white/[.025]">
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.guard?.name} url={r.guard?.avatarUrl} size={28} />
                    <div>
                      <p className="text-[13px] font-semibold">{r.guard?.name}</p>
                      <p className="num text-[10.5px] text-muted">{r.guard?.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td className="text-[12.5px]">{r.type}</td>
                <td className="num text-[12px]">{r.number}</td>
                <td className="num text-[12px]">{d(r.startDate)}</td>
                <td className="num text-[12px]">{r.endDate ? d(r.endDate) : 'tanpa batas'}</td>
                <td className={`num text-[12.5px] font-semibold ${warnaSisa(r.sisaHari)}`}>
                  {r.sisaHari === null ? '—' : r.sisaHari < 0 ? `lewat ${Math.abs(r.sisaHari)} hari` : `${r.sisaHari} hari`}
                </td>
                <td><span className="chip border-cyan/40 bg-cyan/10 text-cyan">{r.status}</span></td>
                <td className="text-right">
                  <Select
                    className="!w-auto !py-1 text-[11.5px]"
                    value={r.status}
                    onChange={async (e) => {
                      await api.put(`/compliance/employment/${r.id}`, { status: e.target.value });
                      qc.invalidateQueries({ queryKey: ['pkwt'] });
                    }}
                  >
                    {['BERJALAN', 'DIPERPANJANG', 'BERAKHIR', 'DIPUTUS'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Perjanjian Kerja Baru"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={simpan}><Save size={14} /> Simpan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Personel">
            <Select value={form.guardId || ''} onChange={(e) => setForm({ ...form, guardId: e.target.value })}>
              <option value="">— pilih personel —</option>
              {daftarOrang.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} {u.employeeId ? `(${u.employeeId})` : ''}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="PROBATION">Masa percobaan</option>
                <option value="PKWT">PKWT</option>
                <option value="PKWTT">PKWTT</option>
              </Select>
            </Field>
            <Field label="Nomor perjanjian">
              <Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </Field>
            <Field label="Mulai">
              <Input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="Berakhir" hint="Wajib untuk PKWT dan masa percobaan">
              <Input type="date" value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function Compliance() {
  const [tab, setTab] = useState('berkas');
  const { me } = useAuth();
  if (!['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || ''))
    return <Empty text="Halaman ini hanya untuk pengawas" />;

  return (
    <>
      <PageHead
        crumb="Personel"
        title="Kepatuhan & Berkas"
        desc="Masa berlaku KTA, Gada, SKCK, dan MCU — beserta syarat kompetensi site, kedisiplinan, dan perjanjian kerja."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'berkas' && <Berkas />}
      {tab === 'matriks' && <Matriks />}
      {tab === 'syarat' && <Syarat />}
      {tab === 'disiplin' && <Disiplin />}
      {tab === 'pkwt' && <Pkwt />}
    </>
  );
}
