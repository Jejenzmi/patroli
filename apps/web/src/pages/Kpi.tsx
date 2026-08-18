import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, LineChart, Line,
} from 'recharts';
import { Trophy, SlidersHorizontal, Star, TrendingUp, Medal } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import {
  Panel, PageHead, Loading, Empty, Modal, Field, Avatar, Table, Bar as ProgressBar, Stat,
} from '../components/ui';
import { ask } from '../components/confirm';
import { dayjs, num, pct } from '../lib/format';

const KOMPONEN = [
  { key: 'kehadiran', label: 'Kehadiran & ketepatan', bobotKey: 'kehadiran' },
  { key: 'patroli', label: 'Penyelesaian patroli', bobotKey: 'patroli' },
  { key: 'ronde', label: 'Ronde tuntas 100%', bobotKey: 'ronde' },
  { key: 'pelaporan', label: 'Aktivitas pelaporan', bobotKey: 'pelaporan' },
  { key: 'penilaian', label: 'Penilaian Danru & Klien', bobotKey: 'penilaian' },
] as const;

const WARNA_PREDIKAT: Record<string, string> = {
  A: 'text-emerald border-emerald/45 bg-emerald/12',
  B: 'text-cyan border-cyan/45 bg-cyan/12',
  C: 'text-amber border-amber/45 bg-amber/12',
  D: 'text-orange-400 border-orange-400/45 bg-orange-400/12',
  E: 'text-danger border-danger/45 bg-danger/12',
};

const ASPEK = [
  { key: 'disiplin', label: 'Disiplin' },
  { key: 'penampilan', label: 'Penampilan' },
  { key: 'responsif', label: 'Kecepatan respons' },
  { key: 'kualitasLaporan', label: 'Kualitas laporan' },
  { key: 'komunikasi', label: 'Komunikasi' },
] as const;

export default function Kpi() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');
  const bolehMenilai = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'CLIENT'].includes(me?.role || '');

  const [periode, setPeriode] = useState(dayjs().format('YYYY-MM'));
  const [detail, setDetail] = useState<string | null>(null);
  const [nilaiUntuk, setNilaiUntuk] = useState<any>(null);
  const [formNilai, setFormNilai] = useState<any>({ disiplin: 4, penampilan: 4, responsif: 4, kualitasLaporan: 4, komunikasi: 4 });
  const [openBobot, setOpenBobot] = useState(false);
  const [bobotForm, setBobotForm] = useState<any>(null);

  const kpi = useQuery({ queryKey: ['kpi', periode], queryFn: () => api.get(`/kpi?period=${periode}`) });
  const rinci = useQuery({
    queryKey: ['kpi-detail', detail, periode],
    queryFn: () => api.get(`/kpi/${detail}?period=${periode}`),
    enabled: !!detail,
  });

  const data = kpi.data?.data || [];
  const bobot = kpi.data?.bobot || {};

  const simpanNilai = async () => {
    if (!(await ask.save(`penilaian ${nilaiUntuk.name} periode ${periode}`))) return;
    try {
      await api.post('/kpi/assessments', { guardId: nilaiUntuk.guardId, period: periode, ...formNilai });
      toast.ok('Penilaian tersimpan', 'Nilai KPI ikut diperbarui');
      setNilaiUntuk(null);
      qc.invalidateQueries({ queryKey: ['kpi'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const simpanBobot = async () => {
    const total = Object.values(bobotForm).reduce((a: any, b: any) => a + Number(b), 0);
    if (total !== 100) return toast.err(`Jumlah bobot harus 100, sekarang ${total}`);
    if (!(await ask.save('bobot KPI', 'Nilai seluruh personel dihitung ulang memakai bobot baru.'))) return;
    try {
      await api.put('/kpi/config/bobot', bobotForm);
      toast.ok('Bobot KPI diperbarui');
      setOpenBobot(false);
      qc.invalidateQueries({ queryKey: ['kpi'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const rata = data.length ? data.reduce((a: number, d: any) => a + d.nilai, 0) / data.length : 0;

  return (
    <>
      <PageHead crumb="Analitik" title="Penilaian Kinerja (KPI)" desc="Nilai 0–100 dari lima komponen berbobot, ditambah penilaian manual Danru dan Klien.">
        <input type="month" value={periode} onChange={(e) => setPeriode(e.target.value)} />
        {isAdmin && (
          <button className="btn-ghost btn-sm" onClick={() => { setBobotForm({ ...bobot }); setOpenBobot(true); }}>
            <SlidersHorizontal size={14} /> Atur Bobot
          </button>
        )}
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Personel Dinilai" value={num(data.length)} icon={Medal} tone="cyan" />
        <Stat label="Rata-rata Nilai" value={rata.toFixed(1)} icon={TrendingUp} tone="amber" />
        <Stat label="Predikat A" value={num(data.filter((d: any) => d.predikat === 'A').length)} icon={Trophy} tone="emerald" />
        <Stat label="Perlu Pembinaan (D/E)" value={num(data.filter((d: any) => ['D', 'E'].includes(d.predikat)).length)} icon={Star} tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title={`Peringkat KPI ${periode}`} icon={Trophy} bodyClass="p-0">
          {kpi.isLoading ? (
            <Loading />
          ) : !data.length ? (
            <Empty text="Belum ada data pada periode ini" />
          ) : (
            <Table head={['#', 'Personel', 'Komponen', 'Nilai', 'Predikat', '']}>
              {data.map((d: any, i: number) => (
                <tr key={d.guardId} className="transition hover:bg-white/[.025]">
                  <td className="num w-10 text-[12px] font-bold text-muted">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={d.name} url={d.avatarUrl} size={30} />
                      <div>
                        <p className="text-[13px] font-semibold">{d.name}</p>
                        <p className="num text-[10.5px] text-muted">{d.employeeId} · {d.site?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="min-w-[190px]">
                    <div className="space-y-1">
                      {KOMPONEN.map((k) => (
                        <div key={k.key} className="flex items-center gap-2">
                          <span className="w-[86px] shrink-0 text-[9.5px] uppercase tracking-wider text-muted">{k.label.split(' ')[0]}</span>
                          <ProgressBar value={d.komponen[k.key]} tone={d.komponen[k.key] >= 80 ? 'emerald' : d.komponen[k.key] >= 60 ? 'amber' : 'danger'} />
                          <span className="num w-9 shrink-0 text-right text-[10px]">{d.komponen[k.key]}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="num text-lg font-extrabold text-amber">{d.nilai}</td>
                  <td><span className={`chip ${WARNA_PREDIKAT[d.predikat]}`}>{d.predikat}</span></td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost btn-sm" onClick={() => setDetail(d.guardId)}>Rincian</button>
                      {bolehMenilai && (
                        <button className="btn-ghost btn-sm" onClick={() => { setNilaiUntuk(d); setFormNilai({ disiplin: 4, penampilan: 4, responsif: 4, kualitasLaporan: 4, komunikasi: 4 }); }}>
                          <Star size={12} /> Nilai
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Bobot Komponen" icon={SlidersHorizontal}>
            <div className="space-y-2.5">
              {KOMPONEN.map((k) => (
                <div key={k.key}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span>{k.label}</span>
                    <span className="num font-bold text-amber">{bobot[k.bobotKey] ?? 0}%</span>
                  </div>
                  <div className="mt-1"><ProgressBar value={bobot[k.bobotKey] ?? 0} tone="amber" /></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              Nilai akhir adalah rata-rata tertimbang kelima komponen. Predikat: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, selebihnya E.
            </p>
          </Panel>

          <Panel title="Sebaran Nilai" icon={BarChart}>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={['A', 'B', 'C', 'D', 'E'].map((p) => ({ predikat: p, jumlah: data.filter((d: any) => d.predikat === p).length }))}>
                  <CartesianGrid stroke="#1F2A40" vertical={false} />
                  <XAxis dataKey="predikat" tick={{ fill: '#7A8AA6', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} width={26} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,.03)' }} />
                  <Bar dataKey="jumlah" radius={[6, 6, 0, 0]} barSize={34}>
                    {['A', 'B', 'C', 'D', 'E'].map((p, i) => (
                      <Cell key={i} fill={{ A: '#34D399', B: '#22D3EE', C: '#FFB020', D: '#FB923C', E: '#FF5A5A' }[p]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      {/* Rincian per personel */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Rincian KPI Personel" wide>
        {rinci.isLoading ? (
          <Loading />
        ) : !rinci.data?.kpi ? (
          <Empty text="Data belum tersedia" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={rinci.data.kpi.name} url={rinci.data.kpi.avatarUrl} size={54} ring="ring-2 ring-amber/30" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-extrabold">{rinci.data.kpi.name}</p>
                <p className="num text-xs text-muted">{rinci.data.kpi.employeeId} · peringkat {rinci.data.peringkat} dari {rinci.data.dari}</p>
              </div>
              <div className="text-right">
                <p className="num text-3xl font-extrabold text-amber">{rinci.data.kpi.nilai}</p>
                <span className={`chip ${WARNA_PREDIKAT[rinci.data.kpi.predikat]}`}>Predikat {rinci.data.kpi.predikat}</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={KOMPONEN.map((k) => ({ komponen: k.label.split(' ')[0], nilai: rinci.data.kpi.komponen[k.key] }))}>
                    <PolarGrid stroke="#1F2A40" />
                    <PolarAngleAxis dataKey="komponen" tick={{ fill: '#7A8AA6', fontSize: 10 }} />
                    <Radar dataKey="nilai" stroke="#FFB020" fill="#FFB020" fillOpacity={0.28} />
                    <Tooltip contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[230px]">
                <p className="mb-2 text-[10px] uppercase tracking-[.16em] text-muted">Tren enam bulan</p>
                <ResponsiveContainer width="100%" height="88%">
                  <LineChart data={rinci.data.tren}>
                    <CartesianGrid stroke="#1F2A40" vertical={false} />
                    <XAxis dataKey="periode" tickFormatter={(v) => String(v).slice(5)} tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#7A8AA6', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={{ background: '#111726', border: '1px solid #1F2A40', borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="nilai" stroke="#22D3EE" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { l: 'Presensi tepat waktu', v: `${rinci.data.kpi.rincian.presensiTepat}/${rinci.data.kpi.rincian.presensiTotal}` },
                { l: 'Presensi ditolak', v: rinci.data.kpi.rincian.presensiGagal },
                { l: 'Sesi patroli', v: rinci.data.kpi.rincian.sesiPatroli },
                { l: 'Ronde tuntas', v: rinci.data.kpi.rincian.rondeTuntas },
                { l: 'Laporan insiden', v: rinci.data.kpi.rincian.laporanInsiden },
                { l: 'Jumlah penilai', v: rinci.data.kpi.rincian.jumlahPenilai },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-line/70 bg-abyss/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[.14em] text-muted">{x.l}</p>
                  <p className="num mt-1 text-lg font-bold">{x.v}</p>
                </div>
              ))}
            </div>

            {rinci.data.penilaian?.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[.16em] text-muted">Penilaian manual periode ini</p>
                <Table head={['Penilai', 'Peran', 'Disiplin', 'Penampilan', 'Respons', 'Laporan', 'Komunikasi']}>
                  {rinci.data.penilaian.map((a: any) => (
                    <tr key={a.id}>
                      <td className="text-[12.5px]">{a.assessor?.name}</td>
                      <td><span className="chip border-line text-muted">{a.assessorRole}</span></td>
                      {ASPEK.map((k) => <td key={k.key} className="num text-[13px]">{a[k.key]}</td>)}
                    </tr>
                  ))}
                </Table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Formulir penilaian manual */}
      <Modal
        open={!!nilaiUntuk}
        onClose={() => setNilaiUntuk(null)}
        title={`Penilaian ${nilaiUntuk?.name ?? ''}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setNilaiUntuk(null)}>Batal</button>
            <button className="btn-primary" onClick={simpanNilai}>Simpan Penilaian</button>
          </>
        }
      >
        <p className="mb-4 text-[13px] text-muted">Beri nilai 1 sampai 5 pada setiap aspek untuk periode <strong className="text-ink">{periode}</strong>.</p>
        <div className="space-y-4">
          {ASPEK.map((a) => (
            <div key={a.key}>
              <div className="flex items-center justify-between">
                <label>{a.label}</label>
                <span className="num text-sm font-bold text-amber">{formNilai[a.key]}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setFormNilai({ ...formNilai, [a.key]: n })}
                    className={`flex-1 rounded-xl border py-2 text-sm font-bold transition ${
                      formNilai[a.key] === n ? 'border-amber/60 bg-amber/15 text-amber' : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Pengaturan bobot */}
      <Modal
        open={openBobot}
        onClose={() => setOpenBobot(false)}
        title="Bobot Komponen KPI"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenBobot(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanBobot}>Simpan Bobot</button>
          </>
        }
      >
        <p className="mb-4 text-[13px] text-muted">Jumlah seluruh bobot harus tepat 100%.</p>
        <div className="space-y-3">
          {KOMPONEN.map((k) => (
            <Field key={k.key} label={k.label}>
              <input
                type="number"
                className="w-full"
                value={bobotForm?.[k.bobotKey] ?? 0}
                onChange={(e) => setBobotForm({ ...bobotForm, [k.bobotKey]: Number(e.target.value) })}
              />
            </Field>
          ))}
          <div className="rounded-xl border border-line/70 bg-abyss/40 px-4 py-3 text-center">
            <span className="text-[11px] uppercase tracking-widest text-muted">Total</span>
            <p className={`num text-xl font-extrabold ${Object.values(bobotForm || {}).reduce((a: any, b: any) => a + Number(b), 0) === 100 ? 'text-emerald' : 'text-danger'}`}>
              {Object.values(bobotForm || {}).reduce((a: any, b: any) => a + Number(b), 0)}%
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
