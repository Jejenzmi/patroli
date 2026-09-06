import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, Trash2, Save, Percent, CalendarDays, HandCoins, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Input, Select, Table, Avatar } from '../components/ui';
import { ask } from '../components/confirm';
import { d, num, rupiah } from '../lib/format';

const TABS = [
  { key: 'golongan', label: 'Golongan Upah', icon: Coins },
  { key: 'iuran', label: 'Iuran & Pajak', icon: Percent },
  { key: 'umk', label: 'UMK & Hari Libur', icon: CalendarDays },
  { key: 'kasbon', label: 'Kasbon', icon: HandCoins },
];

/* ═══════════ GOLONGAN UPAH ═══════════ */

const KOSONG = {
  code: '',
  name: '',
  region: '',
  baseSalary: 0,
  positionAllowance: 0,
  mealPerDay: 0,
  transportPerDay: 0,
  attendanceBonus: 0,
  absentDeduction: 0,
  latePenaltyPerMin: 0,
  jkkRatePct: 0.54,
  bpjsTkEnrolled: true,
  bpjsKesEnrolled: true,
  overtimeEligible: true,
  isActive: true,
};

function Golongan() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(KOSONG);

  const { data, isLoading } = useQuery({ queryKey: ['pay-grades'], queryFn: () => api.get('/payroll/grades') });
  const rows = data || [];

  const angka = (k: string) => (e: any) => setForm({ ...form, [k]: Number(e.target.value) || 0 });

  const simpan = async () => {
    if (!form.code || !form.name || !form.baseSalary) return toast.err('Kode, nama, dan gaji pokok wajib diisi');
    const ubah = !!form.id;
    if (!(await (ubah ? ask.save('golongan upah', form.name) : ask.create('golongan upah', form.name)))) return;
    try {
      const { id, _count, createdAt, updatedAt, ...body } = form;
      if (ubah) await api.put(`/payroll/grades/${id}`, body);
      else await api.post('/payroll/grades', body);
      toast.ok('Golongan upah disimpan');
      setOpen(false);
      setForm(KOSONG);
      qc.invalidateQueries({ queryKey: ['pay-grades'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
    }
  };

  const hapus = async (g: any) => {
    if (!(await ask.remove('golongan upah', g.name))) return;
    try {
      await api.del(`/payroll/grades/${g.id}`);
      toast.ok('Golongan dihapus');
      qc.invalidateQueries({ queryKey: ['pay-grades'] });
    } catch (e: any) {
      toast.err('Tidak dapat dihapus', e.message);
    }
  };

  return (
    <>
      <Panel
        title="Golongan Upah"
        icon={Coins}
        bodyClass="p-0"
        action={
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              setForm(KOSONG);
              setOpen(true);
            }}
          >
            <Plus size={14} /> Golongan
          </button>
        }
      >
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada golongan upah" hint="Golongan menentukan gaji pokok, tunjangan, dan iuran tiap personel" />
        ) : (
          <Table head={['Kode', 'Nama', 'Gaji Pokok', 'Tunj. Jabatan', 'Makan/Hari', 'Transport/Hari', 'JKK', 'Personel', '']}>
            {rows.map((g: any) => (
              <tr key={g.id} className="transition hover:bg-white/[.025]">
                <td className="num font-semibold text-amber">{g.code}</td>
                <td>
                  <p className="text-[13px] font-semibold">{g.name}</p>
                  <p className="text-[10.5px] text-muted">{g.region || 'tanpa wilayah acuan'}</p>
                </td>
                <td className="num">{rupiah(g.baseSalary)}</td>
                <td className="num">{rupiah(g.positionAllowance)}</td>
                <td className="num">{rupiah(g.mealPerDay)}</td>
                <td className="num">{rupiah(g.transportPerDay)}</td>
                <td className="num">{g.jkkRatePct}%</td>
                <td className="num">{num(g._count?.users)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        setForm(g);
                        setOpen(true);
                      }}
                    >
                      Ubah
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => hapus(g)}>
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
        title={form.id ? 'Ubah Golongan Upah' : 'Golongan Upah Baru'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={simpan}>
              <Save size={14} /> Simpan
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kode">
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SEC-1" />
          </Field>
          <Field label="Nama golongan">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Anggota Security" />
          </Field>
          <Field label="Wilayah UMK acuan" hint="Sekadar penanda, tidak ikut menghitung">
            <Input value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </Field>
          <Field label="Gaji pokok (per bulan)">
            <Input type="number" value={form.baseSalary} onChange={angka('baseSalary')} />
          </Field>
          <Field label="Tunjangan jabatan" hint="Tunjangan tetap — ikut jadi dasar lembur dan iuran">
            <Input type="number" value={form.positionAllowance} onChange={angka('positionAllowance')} />
          </Field>
          <Field label="Bonus kehadiran penuh">
            <Input type="number" value={form.attendanceBonus} onChange={angka('attendanceBonus')} />
          </Field>
          <Field label="Uang makan per hari hadir">
            <Input type="number" value={form.mealPerDay} onChange={angka('mealPerDay')} />
          </Field>
          <Field label="Uang transport per hari hadir">
            <Input type="number" value={form.transportPerDay} onChange={angka('transportPerDay')} />
          </Field>
          <Field label="Potongan per hari mangkir" hint="Kosongkan (0) untuk memakai upah sebulan ÷ hari kerja standar">
            <Input type="number" value={form.absentDeduction} onChange={angka('absentDeduction')} />
          </Field>
          <Field label="Potongan per menit terlambat">
            <Input type="number" value={form.latePenaltyPerMin} onChange={angka('latePenaltyPerMin')} />
          </Field>
          <Field label="Tarif JKK (%)" hint="Menurut kelompok risiko usaha, lazimnya 0,24–1,74">
            <Input type="number" step="0.01" value={form.jkkRatePct} onChange={angka('jkkRatePct')} />
          </Field>
          <Field label="Kepesertaan & lembur">
            <div className="space-y-1.5 pt-1 text-[12.5px]">
              {[
                ['bpjsTkEnrolled', 'Peserta BPJS Ketenagakerjaan'],
                ['bpjsKesEnrolled', 'Peserta BPJS Kesehatan'],
                ['overtimeEligible', 'Berhak upah lembur'],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!form[k as string]}
                    onChange={(e) => setForm({ ...form, [k as string]: e.target.checked })}
                  />
                  {l}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* ═══════════ IURAN & PAJAK ═══════════ */

/**
 * Kolom angka bertingkat. Sengaja didefinisikan di tingkat modul: komponen
 * yang dibuat ulang di dalam render akan dianggap tipe baru oleh React,
 * sehingga kolom isian kehilangan fokus setiap kali satu huruf diketik.
 */
function NumField({
  label,
  k,
  obj,
  set,
  step = '0.01',
}: {
  label: string;
  k: string;
  obj: any;
  set: (v: any) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <Input type="number" step={step} value={obj[k]} onChange={(e) => set({ ...obj, [k]: Number(e.target.value) || 0 })} />
    </Field>
  );
}

function IuranPajak() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['payroll-config'], queryFn: () => api.get('/payroll/config') });
  const [bpjs, setBpjs] = useState<any>(null);
  const [upah, setUpah] = useState<any>(null);
  const [kategori, setKategori] = useState<'A' | 'B' | 'C'>('A');

  useEffect(() => {
    if (data) {
      setBpjs(data.bpjs);
      setUpah(data.upah);
    }
  }, [data]);

  const { data: ter } = useQuery({
    queryKey: ['ter', kategori],
    queryFn: () => api.get(`/payroll/config/ter/${kategori}`),
  });

  if (isLoading || !bpjs || !upah) return <Loading />;

  const simpanBpjs = async () => {
    if (!(await ask.save('tarif iuran BPJS'))) return;
    try {
      await api.put('/payroll/config/bpjs', bpjs);
      toast.ok('Tarif iuran disimpan');
      qc.invalidateQueries({ queryKey: ['payroll-config'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const simpanUpah = async () => {
    if (!(await ask.save('pengaturan upah'))) return;
    try {
      await api.put('/payroll/config/upah', upah);
      toast.ok('Pengaturan upah disimpan');
      qc.invalidateQueries({ queryKey: ['payroll-config'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Iuran BPJS"
        icon={Percent}
        action={
          <button className="btn-primary btn-sm" onClick={simpanBpjs}>
            <Save size={13} /> Simpan
          </button>
        }
      >
        <p className="mb-4 text-[11.5px] text-muted">
          Persentase dari upah sebulan (gaji pokok + tunjangan tetap). Batas upah diperbarui pemerintah tiap tahun —
          periksa nilainya setiap awal tahun.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="JKM — perusahaan (%)" k="jkm" obj={bpjs} set={setBpjs} />
          <NumField label="JHT — perusahaan (%)" k="jhtPerusahaan" obj={bpjs} set={setBpjs} />
          <NumField label="JHT — pekerja (%)" k="jhtPekerja" obj={bpjs} set={setBpjs} />
          <NumField label="JP — perusahaan (%)" k="jpPerusahaan" obj={bpjs} set={setBpjs} />
          <NumField label="JP — pekerja (%)" k="jpPekerja" obj={bpjs} set={setBpjs} />
          <NumField label="Kesehatan — perusahaan (%)" k="kesPerusahaan" obj={bpjs} set={setBpjs} />
          <NumField label="Kesehatan — pekerja (%)" k="kesPekerja" obj={bpjs} set={setBpjs} />
          <NumField label="Batas upah JP (Rp)" k="batasUpahJp" obj={bpjs} set={setBpjs} step="1" />
          <NumField label="Batas upah Kesehatan (Rp)" k="batasUpahKes" obj={bpjs} set={setBpjs} step="1" />
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel
          title="Dasar Perhitungan Upah"
          icon={Coins}
          action={
            <button className="btn-primary btn-sm" onClick={simpanUpah}>
              <Save size={13} /> Simpan
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <NumField label="Hari kerja standar" k="hariKerjaStandar" obj={upah} set={setUpah} step="1" />
            <NumField label="Hari kerja seminggu" k="hariKerjaSeminggu" obj={upah} set={setUpah} step="1" />
            <NumField label="Pembagi lembur" k="pembagiLembur" obj={upah} set={setUpah} step="1" />
          </div>
          <p className="mt-3 text-[11.5px] text-muted">
            Upah lembur mengikuti Kepmen 102/2004: upah sejam = upah sebulan ÷ {upah.pembagiLembur}. Hari kerja jam
            pertama 1,5× lalu 2×; hari libur 2× sampai jam ke-{upah.hariKerjaSeminggu >= 6 ? 7 : 8}, lalu 3× dan 4×.
          </p>
        </Panel>

        <Panel
          title="Tarif Efektif PPh 21 (TER)"
          icon={ShieldAlert}
          action={
            <Select value={kategori} onChange={(e) => setKategori(e.target.value as any)} className="!w-auto">
              <option value="A">Kategori A</option>
              <option value="B">Kategori B</option>
              <option value="C">Kategori C</option>
            </Select>
          }
        >
          <div className="mb-3 rounded-xl border border-amber/30 bg-amber/[.07] p-3 text-[11.5px] text-amber">
            Lapisan tarif ini adalah data awal dari PMK 168/2023. Cocokkan dengan lampiran peraturan yang berlaku
            sebelum dipakai menghitung gaji sungguhan — satu lapisan yang keliru berarti salah potong pajak seluruh
            karyawan. Kategori A: TK/0, TK/1, K/0 · B: TK/2, TK/3, K/1, K/2 · C: K/3.
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            <Table head={['Bruto sebulan dari', 'sampai', 'Tarif']}>
              {(ter || []).map((r: any) => (
                <tr key={r.id}>
                  <td className="num">{rupiah(r.minGross)}</td>
                  <td className="num">{r.maxGross ? rupiah(r.maxGross) : 'ke atas'}</td>
                  <td className="num font-semibold text-amber">{r.ratePct}%</td>
                </tr>
              ))}
            </Table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════ UMK & HARI LIBUR ═══════════ */

function UmkLibur() {
  const qc = useQueryClient();
  const tahun = new Date().getFullYear();
  const [umk, setUmk] = useState<any>({ region: '', amount: 0, year: tahun });
  const [libur, setLibur] = useState<any>({ date: '', name: '' });

  const { data: umkRows } = useQuery({ queryKey: ['umk', tahun], queryFn: () => api.get(`/payroll/umk?year=${tahun}`) });
  const { data: liburRows } = useQuery({
    queryKey: ['holidays', tahun],
    queryFn: () => api.get(`/payroll/holidays?year=${tahun}`),
  });

  const simpanUmk = async () => {
    if (!umk.region || !umk.amount) return toast.err('Wilayah dan nilai UMK wajib diisi');
    await api.post('/payroll/umk', { ...umk, amount: Number(umk.amount), year: Number(umk.year) });
    toast.ok('UMK disimpan');
    setUmk({ region: '', amount: 0, year: tahun });
    qc.invalidateQueries({ queryKey: ['umk', tahun] });
  };

  const simpanLibur = async () => {
    if (!libur.date || !libur.name) return toast.err('Tanggal dan nama hari libur wajib diisi');
    await api.post('/payroll/holidays', libur);
    toast.ok('Hari libur disimpan');
    setLibur({ date: '', name: '' });
    qc.invalidateQueries({ queryKey: ['holidays', tahun] });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={`Upah Minimum ${tahun}`} icon={Coins} bodyClass="p-0">
        <div className="grid gap-2 border-b border-line/70 p-4 sm:grid-cols-[1fr_140px_auto]">
          <Input placeholder="Kabupaten/Kota" value={umk.region} onChange={(e) => setUmk({ ...umk, region: e.target.value })} />
          <Input type="number" placeholder="Nilai" value={umk.amount || ''} onChange={(e) => setUmk({ ...umk, amount: e.target.value })} />
          <button className="btn-primary btn-sm" onClick={simpanUmk}>
            <Plus size={13} /> Simpan
          </button>
        </div>
        {!(umkRows || []).length ? (
          <Empty text="Belum ada data UMK" />
        ) : (
          <Table head={['Wilayah', 'UMK', '']}>
            {umkRows.map((u: any) => (
              <tr key={u.id}>
                <td className="text-[13px]">{u.region}</td>
                <td className="num font-semibold">{rupiah(u.amount)}</td>
                <td className="text-right">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={async () => {
                      if (!(await ask.remove('data UMK', u.region))) return;
                      await api.del(`/payroll/umk/${u.id}`);
                      qc.invalidateQueries({ queryKey: ['umk', tahun] });
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

      <Panel title={`Hari Libur ${tahun}`} icon={CalendarDays} bodyClass="p-0">
        <div className="grid gap-2 border-b border-line/70 p-4 sm:grid-cols-[150px_1fr_auto]">
          <Input type="date" value={libur.date} onChange={(e) => setLibur({ ...libur, date: e.target.value })} />
          <Input placeholder="Nama hari libur" value={libur.name} onChange={(e) => setLibur({ ...libur, name: e.target.value })} />
          <button className="btn-primary btn-sm" onClick={simpanLibur}>
            <Plus size={13} /> Simpan
          </button>
        </div>
        <p className="px-4 pt-3 text-[11.5px] text-muted">
          Lembur pada tanggal berikut memakai pengali hari libur. Tanggal keagamaan mengikuti SKB tiga menteri dan
          harus dimasukkan sendiri tiap tahun.
        </p>
        {!(liburRows || []).length ? (
          <Empty text="Belum ada hari libur" />
        ) : (
          <Table head={['Tanggal', 'Keterangan', '']}>
            {liburRows.map((h: any) => (
              <tr key={h.id}>
                <td className="num text-[12.5px]">{d(h.date)}</td>
                <td className="text-[13px]">{h.name}</td>
                <td className="text-right">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={async () => {
                      if (!(await ask.remove('hari libur', h.name))) return;
                      await api.del(`/payroll/holidays/${h.id}`);
                      qc.invalidateQueries({ queryKey: ['holidays', tahun] });
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
    </div>
  );
}

/* ═══════════ KASBON ═══════════ */

function Kasbon() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ installmentCount: 3 });

  const { data, isLoading } = useQuery({ queryKey: ['loans'], queryFn: () => api.get('/payroll/loans') });
  const { data: personel } = useQuery({ queryKey: ['guards-ringkas'], queryFn: () => api.get('/users?pageSize=200') });

  const rows = data || [];
  const orang = personel?.data || personel || [];

  const ajukan = async () => {
    if (!form.guardId || !form.amount) return toast.err('Personel dan jumlah kasbon wajib diisi');
    if (!(await ask.create('kasbon', rupiah(Number(form.amount))))) return;
    try {
      await api.post('/payroll/loans', {
        guardId: form.guardId,
        amount: Number(form.amount),
        installmentCount: Number(form.installmentCount),
        startPeriod: form.startPeriod || new Date().toISOString().slice(0, 7),
        reason: form.reason,
      });
      toast.ok('Kasbon dicatat', 'Cicilan otomatis dipotong saat penggajian');
      setOpen(false);
      setForm({ installmentCount: 3 });
      qc.invalidateQueries({ queryKey: ['loans'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  return (
    <>
      <Panel
        title="Kasbon Karyawan"
        icon={HandCoins}
        bodyClass="p-0"
        action={
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Kasbon
          </button>
        }
      >
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada kasbon" hint="Cicilan kasbon dipotong otomatis saat periode penggajian dikunci" />
        ) : (
          <Table head={['Personel', 'Jumlah', 'Cicilan', 'Sudah dipotong', 'Sisa', 'Mulai', 'Status', '']}>
            {rows.map((l: any) => (
              <tr key={l.id} className="transition hover:bg-white/[.025]">
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={l.guard?.name} url={l.guard?.avatarUrl} size={28} />
                    <div>
                      <p className="text-[13px] font-semibold">{l.guard?.name}</p>
                      <p className="num text-[10.5px] text-muted">{l.guard?.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td className="num">{rupiah(l.amount)}</td>
                <td className="num text-[12.5px]">
                  {l.installmentCount}× {rupiah(l.installmentAmount)}
                </td>
                <td className="num">{rupiah(l.paidAmount)}</td>
                <td className="num font-semibold text-amber">{rupiah(l.amount - l.paidAmount)}</td>
                <td className="num text-[12.5px]">{l.startPeriod}</td>
                <td>
                  <span
                    className={`chip ${
                      l.status === 'LUNAS'
                        ? 'border-emerald/40 bg-emerald/10 text-emerald'
                        : l.status === 'AKTIF'
                        ? 'border-cyan/40 bg-cyan/10 text-cyan'
                        : 'border-line bg-white/5 text-muted'
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="text-right">
                  {l.status === 'AKTIF' && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        if (!(await ask.action('Batalkan kasbon ini?', 'Sisa cicilan tidak akan dipotong lagi pada periode berikutnya.', 'Ya, batalkan'))) return;
                        await api.put(`/payroll/loans/${l.id}`, { status: 'DIBATALKAN' });
                        qc.invalidateQueries({ queryKey: ['loans'] });
                      }}
                    >
                      Batalkan
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
        title="Kasbon Baru"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={ajukan}>
              <Save size={14} /> Simpan
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Personel">
            <Select value={form.guardId || ''} onChange={(e) => setForm({ ...form, guardId: e.target.value })}>
              <option value="">— pilih personel —</option>
              {orang.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.employeeId ? `(${u.employeeId})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah kasbon">
              <Input type="number" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Jumlah cicilan (bulan)">
              <Input
                type="number"
                value={form.installmentCount}
                onChange={(e) => setForm({ ...form, installmentCount: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Mulai dipotong periode" hint="Format YYYY-MM">
            <Input
              placeholder={new Date().toISOString().slice(0, 7)}
              value={form.startPeriod || ''}
              onChange={(e) => setForm({ ...form, startPeriod: e.target.value })}
            />
          </Field>
          <Field label="Keperluan">
            <Input value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          {form.amount && form.installmentCount ? (
            <p className="rounded-xl border border-line bg-panel2/50 p-3 text-[12px] text-muted">
              Potongan per bulan: <span className="num font-semibold text-ink">{rupiah(Number(form.amount) / Number(form.installmentCount))}</span>
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

export default function PayrollConfig() {
  const [tab, setTab] = useState('golongan');

  return (
    <>
      <PageHead
        crumb="Keuangan"
        title="Pengaturan Upah"
        desc="Golongan upah, tarif iuran BPJS, tabel pajak, upah minimum, hari libur, dan kasbon."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'golongan' && <Golongan />}
      {tab === 'iuran' && <IuranPajak />}
      {tab === 'umk' && <UmkLibur />}
      {tab === 'kasbon' && <Kasbon />}
    </>
  );
}
