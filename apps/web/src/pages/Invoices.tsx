import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Receipt, Plus, Wallet, TriangleAlert, Calculator, Send } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Select, Table, Stat } from '../components/ui';
import { ask } from '../components/confirm';
import { d, num, rupiah } from '../lib/format';

const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: 'Draf', tone: 'text-muted border-line bg-white/5' },
  TERKIRIM: { label: 'Terkirim', tone: 'text-cyan border-cyan/40 bg-cyan/10' },
  SEBAGIAN: { label: 'Dibayar Sebagian', tone: 'text-amber border-amber/40 bg-amber/10' },
  LUNAS: { label: 'Lunas', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
  BATAL: { label: 'Batal', tone: 'text-danger border-danger/40 bg-danger/10' },
};

function periodePilihan() {
  const out: string[] = [];
  const dt = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
    dt.setMonth(dt.getMonth() - 1);
  }
  return out;
}

export default function Invoices() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const admin = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ period: periodePilihan()[1] || periodePilihan()[0] });
  const [pratinjau, setPratinjau] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices?pageSize=100'),
  });
  const { data: kontrak } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/billing/contracts'),
    enabled: admin,
  });
  const { data: piutang } = useQuery({
    queryKey: ['piutang'],
    queryFn: () => api.get('/billing/piutang'),
    enabled: admin,
  });

  const rows = data?.data || [];

  const hitung = async () => {
    if (!form.contractId) return toast.err('Pilih kontrak dulu');
    try {
      setPratinjau(await api.post('/billing/invoices/pratinjau', form));
    } catch (e: any) {
      toast.err('Gagal menghitung', e.message);
    }
  };

  const terbitkan = async () => {
    if (!form.contractId) return toast.err('Pilih kontrak dulu');
    if (
      !(await ask.create(
        'tagihan',
        `${form.period} · ${pratinjau ? rupiah(pratinjau.total) : ''}`
      ))
    )
      return;
    try {
      const inv = await api.post('/billing/invoices', form);
      toast.ok('Tagihan dibuat sebagai draf', `Nomor ${inv.number}`);
      setOpen(false);
      setPratinjau(null);
      qc.invalidateQueries({ queryKey: ['invoices'] });
    } catch (e: any) {
      toast.err('Gagal membuat tagihan', e.message);
    }
  };

  const totalTerkirim = rows
    .filter((i: any) => ['TERKIRIM', 'SEBAGIAN'].includes(i.status))
    .reduce((a: number, i: any) => a + i.total, 0);

  return (
    <>
      <PageHead
        crumb="Keuangan"
        title="Tagihan Klien"
        desc="Nilai tagihan dihitung dari pos yang benar-benar terisi, bukan dari angka kontrak."
      >
        {admin && (
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Susun Tagihan
          </button>
        )}
      </PageHead>

      {admin && piutang && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Piutang Berjalan" value={rupiah(piutang.total)} icon={Wallet} tone="amber" />
          <Stat
            label="Lewat Jatuh Tempo"
            value={rupiah(piutang.ember.h1_30 + piutang.ember.h31_60 + piutang.ember.h61_90 + piutang.ember.lebih90)}
            icon={TriangleAlert}
            tone="danger"
          />
          <Stat label="Tagihan Beredar" value={rupiah(totalTerkirim)} icon={Receipt} tone="cyan" />
          <Stat label="Jumlah Tagihan" value={num(rows.length)} icon={Receipt} tone="violet" />
        </div>
      )}

      {admin && piutang && (
        <Panel title="Umur Piutang" icon={TriangleAlert} className="mb-4">
          <div className="grid gap-2 sm:grid-cols-5">
            {[
              ['Belum jatuh tempo', piutang.ember.belumJatuhTempo, 'text-muted'],
              ['1–30 hari', piutang.ember.h1_30, 'text-amber'],
              ['31–60 hari', piutang.ember.h31_60, 'text-orange-400'],
              ['61–90 hari', piutang.ember.h61_90, 'text-danger'],
              ['> 90 hari', piutang.ember.lebih90, 'text-danger'],
            ].map(([label, nilai, tone]: any) => (
              <div key={label} className="rounded-xl border border-line bg-panel2/40 p-3">
                <p className="text-[10.5px] uppercase tracking-widest text-muted">{label}</p>
                <p className={`num mt-1 text-[15px] font-bold ${tone}`}>{rupiah(nilai)}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Daftar Tagihan" icon={Receipt} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada tagihan" hint="Susun tagihan setelah periode berjalan selesai" />
        ) : (
          <Table head={['Nomor', 'Klien', 'Periode', 'Pos', 'Potongan', 'Denda', 'Total', 'Dibayar', 'Jatuh Tempo', 'Status', '']}>
            {rows.map((i: any) => (
              <tr key={i.id} className="transition hover:bg-white/[.025]">
                <td>
                  <Link to={`/tagihan/${i.id}`} className="num text-[12.5px] font-semibold text-amber hover:underline">
                    {i.number}
                  </Link>
                  <p className="num text-[10.5px] text-muted">{i.contract?.number}</p>
                </td>
                <td className="text-[13px]">{i.client?.name}</td>
                <td className="num text-[12.5px]">{i.period}</td>
                <td className="num">{rupiah(i.subtotal)}</td>
                <td className="num text-danger">{i.deductionTotal ? rupiah(i.deductionTotal) : '—'}</td>
                <td className="num text-danger">{i.penaltyTotal ? rupiah(i.penaltyTotal) : '—'}</td>
                <td className="num font-semibold">{rupiah(i.total)}</td>
                <td className="num text-emerald">{i.paidTotal ? rupiah(i.paidTotal) : '—'}</td>
                <td className="num text-[12px]">{d(i.dueDate)}</td>
                <td>
                  <span className={`chip ${STATUS[i.status]?.tone}`}>{STATUS[i.status]?.label}</span>
                </td>
                <td className="text-right">
                  <Link to={`/tagihan/${i.id}`} className="btn-ghost btn-sm">
                    Rincian
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setPratinjau(null);
        }}
        title="Susun Tagihan"
        wide
        footer={
          <>
            <button
              className="btn-ghost"
              onClick={() => {
                setOpen(false);
                setPratinjau(null);
              }}
            >
              Batal
            </button>
            <button className="btn-ghost" onClick={hitung}>
              <Calculator size={14} /> Hitung Ulang
            </button>
            <button className="btn-primary" onClick={terbitkan} disabled={!pratinjau}>
              <Send size={14} /> Buat Tagihan Draf
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kontrak">
              <Select
                value={form.contractId || ''}
                onChange={(e) => {
                  setForm({ ...form, contractId: e.target.value });
                  setPratinjau(null);
                }}
              >
                <option value="">— pilih kontrak —</option>
                {(kontrak || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.number} — {c.client?.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Periode">
              <Select
                value={form.period}
                onChange={(e) => {
                  setForm({ ...form, period: e.target.value });
                  setPratinjau(null);
                }}
              >
                {periodePilihan().map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {!pratinjau ? (
            <p className="rounded-xl border border-line bg-panel2/50 p-3 text-[12px] text-muted">
              Tekan <b>Hitung Ulang</b> untuk melihat rekonsiliasi: berapa hari-orang yang diperjanjikan, berapa yang
              benar-benar terisi menurut presensi, dan berapa potongan serta dendanya.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-line bg-panel2/40 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-amber">Rekonsiliasi Manning</p>
                <Table head={['Site', 'Hari-orang kontrak', 'Terisi', 'Kosong']}>
                  {pratinjau.rekap.map((r: any) => (
                    <tr key={r.siteId}>
                      <td className="text-[12.5px]">{r.siteName}</td>
                      <td className="num">{num(r.hariOrangKontrak)}</td>
                      <td className="num text-emerald">{num(r.hariOrangTerisi)}</td>
                      <td className={`num ${r.hariOrangKosong ? 'text-danger' : 'text-muted'}`}>
                        {num(r.hariOrangKosong)}
                      </td>
                    </tr>
                  ))}
                </Table>
              </div>

              <div className="max-h-[260px] overflow-y-auto rounded-xl border border-line">
                <Table head={['Uraian', 'Qty', 'Harga', 'Jumlah']}>
                  {pratinjau.lines.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="text-[12.5px]">
                        {l.description}
                        <p className="text-[10.5px] text-muted">{l.kind}</p>
                      </td>
                      <td className="num text-[12px]">
                        {num(l.qty)} {l.unit}
                      </td>
                      <td className="num text-[12px]">{rupiah(l.unitPrice)}</td>
                      <td className={`num font-semibold ${l.amount < 0 ? 'text-danger' : ''}`}>{rupiah(l.amount)}</td>
                    </tr>
                  ))}
                </Table>
              </div>

              <div className="grid gap-2 rounded-xl border border-amber/30 bg-amber/[.06] p-4 text-[12.5px] sm:grid-cols-2">
                {[
                  ['Nilai pos', pratinjau.subtotal],
                  ['Potongan pos kosong', pratinjau.deductionTotal],
                  ['Denda SLA', pratinjau.penaltyTotal],
                  ['Management fee', pratinjau.managementFee],
                  ['DPP', pratinjau.dpp],
                  ['PPN', pratinjau.ppn],
                  ['PPh 23 dipotong klien', -pratinjau.pph23],
                ].map(([l, v]: any) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-muted">{l}</span>
                    <span className={`num font-semibold ${v < 0 ? 'text-danger' : ''}`}>{rupiah(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-amber/30 pt-2 sm:col-span-2">
                  <span className="font-bold text-amber">Total tagihan</span>
                  <span className="num text-lg font-extrabold text-amber">{rupiah(pratinjau.total)}</span>
                </div>
                <div className="flex justify-between sm:col-span-2">
                  <span className="text-muted">Perkiraan diterima setelah PPh 23</span>
                  <span className="num font-semibold text-emerald">{rupiah(pratinjau.netReceivable)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
