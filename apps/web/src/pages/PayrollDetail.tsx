import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, RefreshCw, Lock, BadgeCheck, Download, ArrowLeft, Building2, Receipt,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Table, Stat, Avatar } from '../components/ui';
import { ask } from '../components/confirm';
import { dt, num, rupiah } from '../lib/format';

const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: 'Draf', tone: 'text-muted border-line bg-white/5' },
  TERKUNCI: { label: 'Terkunci', tone: 'text-cyan border-cyan/40 bg-cyan/10' },
  DIBAYAR: { label: 'Dibayar', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
};

function Baris({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/50 py-1.5 text-[12.5px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className={`num font-semibold ${tone || ''}`}>{rupiah(value)}</span>
    </div>
  );
}

export default function PayrollDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [slip, setSlip] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: () => api.get(`/payroll/runs/${id}`),
  });

  const run = data?.run;
  const slips = data?.slips || [];
  const perSite = data?.perSite || [];

  const segarkan = () => qc.invalidateQueries({ queryKey: ['payroll-run', id] });

  const hitungUlang = async () => {
    if (
      !(await ask.action(
        'Hitung ulang seluruh slip?',
        'Slip pada periode ini akan disusun ulang dari data presensi, lembur, dan kasbon terbaru. Perubahan manual pada draf akan hilang.',
        'Ya, hitung ulang'
      ))
    )
      return;
    try {
      await api.post(`/payroll/runs/${id}/hitung`);
      toast.ok('Slip dihitung ulang');
      segarkan();
    } catch (e: any) {
      toast.err('Gagal menghitung', e.message);
    }
  };

  const kunci = async () => {
    if (
      !(await ask.action(
        'Kunci periode penggajian?',
        'Setelah dikunci, angka slip tidak dapat diubah lagi dan cicilan kasbon tercatat sebagai pembayaran. Beban gaji periode ini mulai dihitung pada laba-rugi per site.',
        'Ya, kunci periode'
      ))
    )
      return;
    try {
      await api.post(`/payroll/runs/${id}/kunci`);
      toast.ok('Periode dikunci');
      segarkan();
    } catch (e: any) {
      toast.err('Gagal mengunci', e.message);
    }
  };

  const bayar = async () => {
    if (
      !(await ask.action(
        'Tandai sudah dibayarkan?',
        'Seluruh anggota akan menerima notifikasi bahwa slip gajinya sudah terbit dan dapat dibuka di aplikasi.',
        'Ya, tandai dibayar'
      ))
    )
      return;
    try {
      await api.post(`/payroll/runs/${id}/bayar`);
      toast.ok('Ditandai dibayar', 'Notifikasi slip gaji terkirim ke anggota');
      segarkan();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const unduhBank = async (bank: string) => {
    const res = await fetch(`/api/payroll/runs/${id}/bank?bank=${bank}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('patroli_token')}` },
    });
    if (!res.ok) return toast.err('Gagal mengunduh berkas transfer');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transfer-${run?.period}-${bank.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (isLoading) return <Loading label="Memuat periode penggajian…" />;
  if (!run) return <Empty text="Periode penggajian tidak ditemukan" />;

  const bank = [...new Set(slips.map((s: any) => s.bankName).filter(Boolean))] as string[];

  return (
    <>
      <PageHead crumb="Keuangan · Penggajian" title={`Periode ${run.period}`} desc={`${run.type === 'THR' ? 'Tunjangan Hari Raya' : 'Gaji bulanan'} · ${slips.length} slip · hari kerja standar ${run.workingDays}`}>
        <Link to="/penggajian" className="btn-ghost btn-sm">
          <ArrowLeft size={14} /> Kembali
        </Link>
        {run.status === 'DRAFT' && (
          <>
            <button className="btn-ghost btn-sm" onClick={hitungUlang}>
              <RefreshCw size={14} /> Hitung Ulang
            </button>
            <button className="btn-primary btn-sm" onClick={kunci}>
              <Lock size={14} /> Kunci Periode
            </button>
          </>
        )}
        {run.status === 'TERKUNCI' && (
          <button className="btn-primary btn-sm" onClick={bayar}>
            <BadgeCheck size={14} /> Tandai Dibayar
          </button>
        )}
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bruto" value={rupiah(run.totalGross)} icon={Wallet} tone="amber" />
        <Stat label="Total Potongan" value={rupiah(run.totalDeduction)} icon={Receipt} tone="danger" />
        <Stat label="Netto Dibayarkan" value={rupiah(run.totalNet)} icon={BadgeCheck} tone="emerald" />
        <Stat
          label="Beban Perusahaan"
          value={rupiah(run.totalEmployerCost)}
          sub="bruto + iuran porsi perusahaan"
          icon={Building2}
          tone="cyan"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`chip ${STATUS[run.status]?.tone}`}>{STATUS[run.status]?.label}</span>
        {run.calculatedAt && <span className="text-[11.5px] text-muted">Dihitung {dt(run.calculatedAt)}</span>}
        {run.status !== 'DRAFT' && (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button className="btn-ghost btn-sm" onClick={() => unduhBank('SEMUA')}>
              <Download size={13} /> Berkas Transfer (semua bank)
            </button>
            {bank.map((b) => (
              <button key={b} className="btn-ghost btn-sm" onClick={() => unduhBank(b)}>
                <Download size={13} /> {b}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Slip Gaji" icon={Wallet} bodyClass="p-0">
          {!slips.length ? (
            <Empty
              text="Belum ada slip"
              hint="Pastikan personel sudah dipasangi golongan upah di menu Pengaturan Upah"
            />
          ) : (
            <Table head={['Personel', 'Penempatan', 'Hadir', 'Lembur', 'Bruto', 'Potongan', 'PPh 21', 'Netto', '']}>
              {slips.map((s: any) => (
                <tr key={s.id} className="transition hover:bg-white/[.025]">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.guard?.name} url={s.guard?.avatarUrl} size={30} />
                      <div>
                        <p className="text-[13px] font-semibold">{s.guard?.name}</p>
                        <p className="num text-[10.5px] text-muted">
                          {s.guard?.employeeId} · {s.grade?.code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-[12px] text-muted">{s.site?.name || '—'}</td>
                  <td className="num text-[12.5px]">
                    {s.hariHadir}/{s.hariJadwal}
                    {s.hariMangkir > 0 && <span className="text-danger"> · {s.hariMangkir} mangkir</span>}
                  </td>
                  <td className="num text-[12.5px]">{s.jamLembur ? `${num(s.jamLembur, 1)} jam` : '—'}</td>
                  <td className="num">{rupiah(s.bruto)}</td>
                  <td className="num text-danger">{rupiah(s.totalPotongan)}</td>
                  <td className="num text-muted">{rupiah(s.pph21)}</td>
                  <td className="num font-semibold text-emerald">{rupiah(s.netto)}</td>
                  <td className="text-right">
                    <button className="btn-ghost btn-sm" onClick={() => setSlip(s)}>
                      Slip
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel title="Beban per Site" icon={Building2}>
          {!perSite.length ? (
            <Empty text="Belum ada beban" />
          ) : (
            <div className="space-y-3">
              {perSite.map((p: any) => (
                <div key={p.siteId || '-'} className="rounded-xl border border-line bg-panel2/40 p-3">
                  <p className="text-[13px] font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted">{p.orang} personel</p>
                  <p className="num mt-1.5 text-[15px] font-bold text-amber">{rupiah(p.biaya)}</p>
                </div>
              ))}
              <Link to="/laba-rugi" className="btn-ghost btn-sm w-full justify-center">
                Lihat laba-rugi per site
              </Link>
            </div>
          )}
        </Panel>
      </div>

      <Modal open={!!slip} onClose={() => setSlip(null)} title={`Slip Gaji — ${slip?.guard?.name || ''}`} wide>
        {slip && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[10.5px] uppercase tracking-widest text-muted">Golongan</p>
                <p className="text-[13px] font-semibold">{slip.grade?.name}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-widest text-muted">Penempatan</p>
                <p className="text-[13px] font-semibold">{slip.site?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-widest text-muted">Upah sebulan</p>
                <p className="num text-[13px] font-semibold">{rupiah(slip.upahDasar)}</p>
              </div>
              <div>
                <p className="text-[10.5px] uppercase tracking-widest text-muted">Dasar PPh 21</p>
                <p className="text-[13px] font-semibold">{slip.pph21Basis || '—'}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[.15em] text-emerald">Pendapatan</h4>
                {(slip.earnings || []).map((e: any, i: number) => (
                  <div key={i} className="border-b border-line/50 py-1.5 last:border-0">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span>{e.label}</span>
                      <span className="num font-semibold">{rupiah(e.jumlah)}</span>
                    </div>
                    {e.catatan && <p className="text-[10.5px] text-muted">{e.catatan}</p>}
                  </div>
                ))}
                <Baris label="Bruto" value={slip.bruto} tone="text-emerald" />
              </div>
              <div>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[.15em] text-danger">Potongan</h4>
                {(slip.deductions || []).length === 0 && <p className="py-2 text-[12px] text-muted">Tidak ada potongan</p>}
                {(slip.deductions || []).map((e: any, i: number) => (
                  <div key={i} className="border-b border-line/50 py-1.5 last:border-0">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span>{e.label}</span>
                      <span className="num font-semibold text-danger">{rupiah(e.jumlah)}</span>
                    </div>
                    {e.catatan && <p className="text-[10.5px] text-muted">{e.catatan}</p>}
                  </div>
                ))}
                <Baris label="Total potongan" value={slip.totalPotongan} tone="text-danger" />
              </div>
            </div>

            <div className="rounded-xl border border-amber/30 bg-amber/[.07] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-widest text-amber">Diterima</span>
                <span className="num text-2xl font-extrabold text-amber">{rupiah(slip.netto)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {slip.bankName || 'Bank belum diisi'} · {slip.bankAccount || '—'} a.n. {slip.bankAccountName || slip.guard?.name}
              </p>
            </div>

            <div className="grid gap-3 text-[12px] sm:grid-cols-3">
              <div className="rounded-xl border border-line bg-panel2/40 p-3">
                <p className="text-muted">Iuran BPJS pekerja</p>
                <p className="num font-semibold">{rupiah(slip.bpjsPekerja)}</p>
              </div>
              <div className="rounded-xl border border-line bg-panel2/40 p-3">
                <p className="text-muted">Iuran BPJS perusahaan</p>
                <p className="num font-semibold">{rupiah(slip.bpjsPerusahaan)}</p>
              </div>
              <div className="rounded-xl border border-line bg-panel2/40 p-3">
                <p className="text-muted">Beban perusahaan</p>
                <p className="num font-semibold">{rupiah(slip.biayaPerusahaan)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
