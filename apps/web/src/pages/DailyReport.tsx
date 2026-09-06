import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck, Download, Printer, Users, Route as RouteIcon, TriangleAlert, ClipboardList,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Select, Table, Stat, Avatar } from '../components/ui';
import { d, num, t as jam } from '../lib/format';

const TONE_PRESENSI: Record<string, string> = {
  ON_TIME: 'border-emerald/40 bg-emerald/10 text-emerald',
  LATE: 'border-amber/40 bg-amber/10 text-amber',
  EARLY_LEAVE: 'border-orange-400/40 bg-orange-400/10 text-orange-400',
  ABSENT: 'border-danger/40 bg-danger/10 text-danger',
};

const LABEL_PRESENSI: Record<string, string> = {
  ON_TIME: 'Tepat waktu',
  LATE: 'Terlambat',
  EARLY_LEAVE: 'Pulang awal',
  ABSENT: 'Absen',
};

export default function DailyReport() {
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [guardId, setGuardId] = useState('');
  const [siteId, setSiteId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['laporan-harian', tanggal, guardId, siteId],
    queryFn: () => api.get('/reports/harian' + qs({ tanggal, guardId, siteId })),
  });
  const { data: orang } = useQuery({
    queryKey: ['users-ringkas'],
    queryFn: () => api.get('/users?pageSize=300'),
  });
  const { data: sites } = useQuery({ queryKey: ['sites-ringkas'], queryFn: () => api.get('/master/sites') });

  const daftarOrang = orang?.data || [];
  const daftarSite = sites?.data || sites || [];
  const rows = data?.rows || [];

  const unduh = async () => {
    const res = await fetch('/api/reports/harian.csv' + qs({ tanggal, guardId, siteId }), {
      headers: { Authorization: `Bearer ${localStorage.getItem('patroli_token')}` },
    });
    if (!res.ok) return toast.err('Gagal mengunduh laporan');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-harian-${tanggal}${guardId ? '-perorangan' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHead
        crumb="Analitik"
        title="Laporan Harian"
        desc="Rekap satu hari: kehadiran, putaran patroli, laporan titik, temuan, dan catatan pos jaga."
      >
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="!w-auto" />
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="!w-auto">
          <option value="">Semua site</option>
          {daftarSite.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={guardId} onChange={(e) => setGuardId(e.target.value)} className="!w-auto">
          <option value="">Semua personel</option>
          {daftarOrang.map((u: any) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </Select>
        <button className="btn-ghost btn-sm" onClick={() => window.print()}>
          <Printer size={14} /> Cetak
        </button>
        <button className="btn-primary btn-sm" onClick={unduh}>
          <Download size={14} /> Unduh CSV
        </button>
      </PageHead>

      {isLoading ? (
        <Loading label="Menyusun laporan harian…" />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Kehadiran"
              value={`${num(data.total.hadir)}/${num(data.total.personel)}`}
              sub={data.total.tidakHadir ? `${data.total.tidakHadir} belum/tidak hadir` : 'seluruh personel hadir'}
              icon={Users}
              tone={data.total.tidakHadir ? 'amber' : 'emerald'}
            />
            <Stat
              label="Putaran Patroli"
              value={num(data.total.sesiPatroli)}
              sub={`${num(data.total.titikTerpindai)} titik terpindai`}
              icon={RouteIcon}
              tone="cyan"
            />
            <Stat
              label="Temuan Titik"
              value={num(data.total.temuan)}
              sub={`${num(data.total.insiden)} insiden dilaporkan`}
              icon={TriangleAlert}
              tone={data.total.temuan ? 'danger' : 'emerald'}
            />
            <Stat
              label="Laporan Tertunda"
              value={num(data.total.laporanTertunda)}
              sub="titik dipindai tapi belum dilaporkan"
              icon={ClipboardList}
              tone={data.total.laporanTertunda ? 'danger' : 'emerald'}
            />
          </div>

          <Panel title={`Rekap ${d(tanggal)}`} icon={CalendarCheck} bodyClass="p-0">
            {!rows.length ? (
              <Empty
                text="Tidak ada personel bertugas pada tanggal ini"
                hint="Periksa roster, atau pilih tanggal lain"
              />
            ) : (
              <Table
                head={[
                  'Personel', 'Site / Shift', 'Masuk', 'Keluar', 'Status', 'Patroli',
                  'Titik', 'Kepatuhan', 'Laporan', 'Temuan', 'Pos Jaga',
                ]}
              >
                {rows.map((r: any) => (
                  <tr key={r.guardId} className="align-top transition hover:bg-white/[.025]">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.name} url={r.avatarUrl} size={30} />
                        <div>
                          <p className="text-[13px] font-semibold">{r.name}</p>
                          <p className="num text-[10.5px] text-muted">{r.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-[12px]">
                      {r.siteName || '—'}
                      <p className="text-[10.5px] text-muted">{r.shiftName || 'tanpa shift'}</p>
                    </td>
                    <td className="num text-[12.5px]">{jam(r.masuk)}</td>
                    <td className="num text-[12.5px]">{jam(r.keluar)}</td>
                    <td>
                      {r.masuk ? (
                        <span className={`chip ${TONE_PRESENSI[r.statusPresensi] || ''}`}>
                          {LABEL_PRESENSI[r.statusPresensi] || r.statusPresensi}
                        </span>
                      ) : (
                        <span className="chip border-danger/40 bg-danger/10 text-danger">Tidak hadir</span>
                      )}
                      {r.telatMenit > 0 && <p className="num text-[10.5px] text-amber">telat {r.telatMenit} mnt</p>}
                    </td>
                    <td className="num text-[12.5px]">
                      {r.sesiPatroli}
                      <p className="text-[10.5px] text-muted">{r.jamKerja} jam kerja</p>
                    </td>
                    <td className="num text-[12.5px]">
                      {r.titikTerpindai}/{r.titikSeharusnya}
                      {r.titikTerlewat > 0 && <p className="text-[10.5px] text-danger">{r.titikTerlewat} terlewat</p>}
                    </td>
                    <td className={`num text-[12.5px] font-semibold ${r.kepatuhan >= 90 ? 'text-emerald' : r.kepatuhan >= 70 ? 'text-amber' : 'text-danger'}`}>
                      {r.titikSeharusnya ? `${r.kepatuhan}%` : '—'}
                    </td>
                    <td className="num text-[12.5px]">
                      {r.laporanTitik}
                      {r.laporanTertunda > 0 && (
                        <p className="text-[10.5px] text-danger">{r.laporanTertunda} tertunda</p>
                      )}
                    </td>
                    <td className="max-w-[280px] text-[11.5px]">
                      {!r.temuan.length ? (
                        <span className="text-muted">—</span>
                      ) : (
                        r.temuan.map((t: any, i: number) => (
                          <p key={i} className={t.condition === 'BERMASALAH' ? 'text-danger' : 'text-amber'}>
                            <b>{t.checkpoint}</b>
                            {t.note ? ` — ${t.note}` : ''}
                          </p>
                        ))
                      )}
                    </td>
                    <td className="num text-[11.5px] text-muted">
                      {r.tamu} tamu · {r.kendaraan} kendaraan
                      {r.insiden > 0 && <p className="text-danger">{r.insiden} insiden</p>}
                      {r.darurat > 0 && <p className="text-danger">{r.darurat} sinyal darurat</p>}
                      {r.tugasSelesai > 0 && <p className="text-emerald">{r.tugasSelesai} tugas selesai</p>}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
