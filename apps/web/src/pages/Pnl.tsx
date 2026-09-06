import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { Scale, TrendingUp, TriangleAlert, Plus, Trash2, Wallet, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Input, Select, Table, Stat, Bar as BarUi } from '../components/ui';
import { ask } from '../components/confirm';
import { num, rupiah } from '../lib/format';

function periodePilihan() {
  const out: string[] = [];
  const dt = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
    dt.setMonth(dt.getMonth() - 1);
  }
  return out;
}

const juta = (v: number) => `${Math.round(v / 1_000_000)}jt`;

export default function Pnl() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState(periodePilihan()[0]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ category: 'SERAGAM' });

  const { data, isLoading } = useQuery({ queryKey: ['pnl', period], queryFn: () => api.get(`/finance/pnl?period=${period}`) });
  const { data: tren } = useQuery({ queryKey: ['pnl-tren', period], queryFn: () => api.get(`/finance/pnl/tren?period=${period}`) });
  const { data: biaya } = useQuery({ queryKey: ['expenses', period], queryFn: () => api.get(`/finance/expenses?period=${period}`) });
  const { data: sites } = useQuery({ queryKey: ['sites-ringkas'], queryFn: () => api.get('/master/sites') });

  const daftarSite = sites?.data || sites || [];
  const rows = data?.rows || [];

  const simpanBiaya = async () => {
    if (!form.siteId || !form.description || !form.amount) return toast.err('Site, uraian, dan nilai wajib diisi');
    if (!(await ask.create('biaya site', `${form.description} — ${rupiah(Number(form.amount))}`))) return;
    try {
      await api.post('/finance/expenses', {
        siteId: form.siteId,
        period,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
      });
      toast.ok('Biaya dicatat');
      setOpen(false);
      setForm({ category: 'SERAGAM' });
      qc.invalidateQueries({ queryKey: ['expenses', period] });
      qc.invalidateQueries({ queryKey: ['pnl', period] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  return (
    <>
      <PageHead
        crumb="Keuangan"
        title="Laba-Rugi per Site"
        desc="Pendapatan tagihan dibandingkan beban gaji dan biaya langsung, site demi site."
      >
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto">
          {periodePilihan().map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Biaya Site
        </button>
      </PageHead>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pendapatan" value={rupiah(data.total.pendapatan)} icon={Wallet} tone="emerald" />
            <Stat
              label="Beban"
              value={rupiah(data.total.totalBiaya)}
              sub={`gaji ${rupiah(data.total.biayaGaji)} · lain ${rupiah(data.total.biayaLain)}`}
              icon={Building2}
              tone="amber"
            />
            <Stat
              label="Margin Kotor"
              value={rupiah(data.total.margin)}
              sub={`${data.total.marginPct}% dari pendapatan`}
              icon={TrendingUp}
              tone={data.total.margin >= 0 ? 'cyan' : 'danger'}
            />
            <Stat
              label="Site Merugi"
              value={num(data.rugi)}
              sub={data.rugi ? 'periksa tarif atau jumlah pos' : 'seluruh site untung'}
              icon={TriangleAlert}
              tone={data.rugi ? 'danger' : 'emerald'}
            />
          </div>

          {data.total.biayaGaji === 0 && (
            <div className="mb-4 rounded-xl border border-amber/30 bg-amber/[.07] p-3 text-[12px] text-amber">
              Beban gaji periode ini masih nol — angka baru muncul setelah periode penggajian {period} dikunci.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Panel title="Laba-Rugi per Site" icon={Scale} bodyClass="p-0">
              {!rows.length ? (
                <Empty text="Belum ada angka pada periode ini" hint="Perlu tagihan terbit atau penggajian terkunci" />
              ) : (
                <Table head={['Site', 'Klien', 'Personel', 'Pendapatan', 'Beban Gaji', 'Biaya Lain', 'Margin', '%']}>
                  {rows.map((r: any) => (
                    <tr key={r.siteId} className="transition hover:bg-white/[.025]">
                      <td className="text-[13px] font-semibold">{r.siteName}</td>
                      <td className="text-[12px] text-muted">{r.clientName}</td>
                      <td className="num">{num(r.orang)}</td>
                      <td className="num">{rupiah(r.pendapatan)}</td>
                      <td className="num text-muted">{rupiah(r.biayaGaji)}</td>
                      <td className="num text-muted">{rupiah(r.biayaLain)}</td>
                      <td className={`num font-semibold ${r.margin < 0 ? 'text-danger' : 'text-emerald'}`}>
                        {rupiah(r.margin)}
                      </td>
                      <td className="w-24">
                        <p className={`num mb-1 text-[11.5px] ${r.margin < 0 ? 'text-danger' : 'text-emerald'}`}>
                          {r.marginPct}%
                        </p>
                        <BarUi value={Math.max(0, Math.min(100, r.marginPct))} tone={r.margin < 0 ? 'danger' : 'emerald'} />
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Panel>

            <div className="space-y-4">
              <Panel title="Tren Enam Periode" icon={TrendingUp}>
                {!tren?.length ? (
                  <Empty text="Belum ada tren" />
                ) : (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tren} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
                        <XAxis dataKey="periode" tick={{ fontSize: 10, fill: '#8A93A6' }} />
                        <YAxis tickFormatter={juta} tick={{ fontSize: 10, fill: '#8A93A6' }} width={44} />
                        <Tooltip
                          formatter={(v: any) => rupiah(Number(v))}
                          contentStyle={{ background: '#12161F', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="pendapatan" name="Pendapatan" fill="#22D3EE" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="biaya" name="Beban" fill="#FFB020" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="margin" name="Margin" fill="#34D399" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <Panel title={`Biaya Langsung Site — ${period}`} icon={Wallet} bodyClass="p-0">
                {!(biaya || []).length ? (
                  <Empty text="Belum ada biaya dicatat" hint="Seragam, APD, perlengkapan, transport" />
                ) : (
                  <div className="divide-y divide-line/60">
                    {biaya.map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-[12.5px] font-semibold">{b.description}</p>
                          <p className="text-[10.5px] text-muted">
                            {b.site?.name} · {b.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="num text-[12.5px] font-semibold">{rupiah(b.amount)}</span>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={async () => {
                              if (!(await ask.remove('catatan biaya', b.description))) return;
                              await api.del(`/finance/expenses/${b.id}`);
                              qc.invalidateQueries({ queryKey: ['expenses', period] });
                              qc.invalidateQueries({ queryKey: ['pnl', period] });
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Biaya Langsung Site — ${period}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={simpanBiaya}>
              Simpan
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Site">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <option value="">— pilih site —</option>
              {daftarSite.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kategori">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['SERAGAM', 'APD', 'PERLENGKAPAN', 'TRANSPORT', 'PELATIHAN', 'LAINNYA'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nilai">
              <Input type="number" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
          </div>
          <Field label="Uraian">
            <Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Seragam PDL 12 stel" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
