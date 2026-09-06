import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Wallet, Plus, Lock, BadgeCheck, Trash2, FileSpreadsheet, Users } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Select, Table, Stat } from '../components/ui';
import { ask } from '../components/confirm';
import { dt, num, rupiah } from '../lib/format';

const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: 'Draf', tone: 'text-muted border-line bg-white/5' },
  TERKUNCI: { label: 'Terkunci', tone: 'text-cyan border-cyan/40 bg-cyan/10' },
  DIBAYAR: { label: 'Dibayar', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
};

/** Dua belas periode terakhir sebagai pilihan. */
function periodePilihan() {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export default function Payroll() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ period: periodePilihan()[0], type: 'BULANAN' });

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs?pageSize=50'),
  });

  const rows = data?.data || [];

  const buat = async () => {
    if (!(await ask.create('periode penggajian', `${form.period} · ${form.type}`))) return;
    try {
      await api.post('/payroll/runs', form);
      toast.ok('Periode dibuat', 'Slip sudah dihitung sebagai draf, silakan diperiksa');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (e: any) {
      toast.err('Gagal membuat periode', e.message);
    }
  };

  const hapus = async (r: any) => {
    if (!(await ask.remove('periode penggajian', `${r.period} · ${r.type}`))) return;
    try {
      await api.del(`/payroll/runs/${r.id}`);
      toast.ok('Periode dihapus');
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (e: any) {
      toast.err('Gagal menghapus', e.message);
    }
  };

  const terakhir = rows[0];

  return (
    <>
      <PageHead
        crumb="Keuangan"
        title="Penggajian"
        desc="Gaji dihitung dari roster, presensi bergeofence, dan lembur yang disetujui — bukan dari entri manual."
      >
        <Link to="/pengupahan" className="btn-ghost btn-sm">
          Pengaturan Upah
        </Link>
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Periode Baru
        </button>
      </PageHead>

      {terakhir && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={`Bruto ${terakhir.period}`} value={rupiah(terakhir.totalGross)} icon={Wallet} tone="amber" />
          <Stat label="Dibayarkan (Netto)" value={rupiah(terakhir.totalNet)} icon={BadgeCheck} tone="emerald" />
          <Stat
            label="Beban Perusahaan"
            value={rupiah(terakhir.totalEmployerCost)}
            sub="termasuk iuran BPJS porsi perusahaan"
            icon={Users}
            tone="cyan"
          />
          <Stat label="Jumlah Slip" value={num(terakhir._count?.payslips)} icon={FileSpreadsheet} tone="violet" />
        </div>
      )}

      <Panel title="Periode Penggajian" icon={Wallet} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada periode penggajian" hint="Buat periode baru untuk menghitung gaji bulan berjalan" />
        ) : (
          <Table head={['Periode', 'Jenis', 'Slip', 'Bruto', 'Potongan', 'Netto', 'Beban', 'Status', '']}>
            {rows.map((r: any) => (
              <tr key={r.id} className="transition hover:bg-white/[.025]">
                <td>
                  <Link to={`/penggajian/${r.id}`} className="text-[13px] font-semibold text-amber hover:underline">
                    {r.period}
                  </Link>
                  <p className="text-[10.5px] text-muted">{r.createdBy?.name}</p>
                </td>
                <td>
                  <span className="chip border-violet/40 bg-violet/10 text-violet">{r.type}</span>
                </td>
                <td className="num">{num(r._count?.payslips)}</td>
                <td className="num">{rupiah(r.totalGross)}</td>
                <td className="num text-danger">{rupiah(r.totalDeduction)}</td>
                <td className="num font-semibold">{rupiah(r.totalNet)}</td>
                <td className="num text-muted">{rupiah(r.totalEmployerCost)}</td>
                <td>
                  <span className={`chip ${STATUS[r.status]?.tone}`}>{STATUS[r.status]?.label}</span>
                  {r.lockedAt && <p className="num mt-1 text-[10px] text-muted">{dt(r.lockedAt)}</p>}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Link to={`/penggajian/${r.id}`} className="btn-ghost btn-sm">
                      Rincian
                    </Link>
                    {r.status === 'DRAFT' && (
                      <button className="btn-ghost btn-sm" onClick={() => hapus(r)}>
                        <Trash2 size={12} />
                      </button>
                    )}
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
        title="Buat Periode Penggajian"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={buat}>
              <Lock size={14} /> Hitung Draf
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Periode" hint="Slip dihitung dari data presensi bulan tersebut">
            <Select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
              {periodePilihan().map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jenis" hint="THR dihitung dari upah sebulan dan masa kerja, pro-rata di bawah 12 bulan">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="BULANAN">Gaji Bulanan</option>
              <option value="THR">Tunjangan Hari Raya</option>
            </Select>
          </Field>
          <p className="rounded-xl border border-line bg-panel2/50 p-3 text-[12px] text-muted">
            Draf boleh dihitung ulang berkali-kali. Angka baru mengikat setelah periode dikunci — saat itu pula
            cicilan kasbon tercatat.
          </p>
        </div>
      </Modal>
    </>
  );
}
