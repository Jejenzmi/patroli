import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Fingerprint, Download, Camera, MapPin, ShieldAlert, ScanFace } from 'lucide-react';
import { api, qs } from '../lib/api';
import { Panel, PageHead, Table, Chip, Avatar, Loading, Empty, Select, Stat } from '../components/ui';
import { dt, t, num, dayjs } from '../lib/format';

export default function Attendance() {
  const [tab, setTab] = useState<'catatan' | 'ditolak'>('catatan');
  const [siteId, setSiteId] = useState('');
  const [from, setFrom] = useState(dayjs().subtract(6, 'day').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const { data, isLoading } = useQuery({
    queryKey: ['attendance', siteId, from, to],
    queryFn: () => api.get('/schedules/attendance' + qs({ siteId, from, to, limit: 400 })),
  });
  const ditolak = useQuery({
    queryKey: ['attempts', siteId],
    queryFn: () => api.get('/schedules/attendance/attempts' + qs({ siteId, limit: 200 })),
  });

  const rows = data || [];
  const late = rows.filter((r: any) => r.status === 'LATE').length;
  const open = rows.filter((r: any) => !r.checkOutAt).length;
  const avgWorked = rows.filter((r: any) => r.workedMinutes).reduce((a: number, r: any) => a + r.workedMinutes, 0) /
    Math.max(1, rows.filter((r: any) => r.workedMinutes).length);

  return (
    <>
      <PageHead crumb="Personel" title="Presensi Anggota" desc="Catatan masuk dan pulang jaga dengan verifikasi geofence.">
        <button className="btn-ghost btn-sm" onClick={() => api.downloadCsv('attendance', { from, to })}>
          <Download size={14} /> Ekspor CSV
        </button>
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Presensi" value={num(rows.length)} icon={Fingerprint} tone="cyan" />
        <Stat label="Terlambat" value={num(late)} sub={`${((late / Math.max(1, rows.length)) * 100).toFixed(1)}% dari total`} icon={Fingerprint} tone="amber" />
        <Stat label="Masih Bertugas" value={num(open)} icon={Fingerprint} tone="emerald" />
        <Stat label="Rata-rata Jam Kerja" value={`${(avgWorked / 60).toFixed(1)} jam`} icon={Fingerprint} tone="violet" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { k: 'catatan', l: 'Catatan Presensi', i: Fingerprint, n: rows.length },
          { k: 'ditolak', l: 'Percobaan Ditolak', i: ShieldAlert, n: ditolak.data?.length },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`btn btn-sm ${tab === t.k ? 'bg-amber/15 text-amber shadow-[inset_0_0_0_1px_rgba(255,176,32,.35)]' : 'border border-line text-muted hover:text-ink'}`}
          >
            <t.i size={13} /> {t.l}
            <span className="num ml-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px]">{t.n ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {tab === 'ditolak' ? (
        <Panel
          title="Percobaan Presensi yang Ditolak"
          icon={ShieldAlert}
          bodyClass="p-0"
          action={
            <button className="btn-ghost btn-sm" onClick={() => api.downloadCsv('attempts', { from, to })}>
              <Download size={13} /> Ekspor
            </button>
          }
        >
          {ditolak.isLoading ? (
            <Loading />
          ) : !ditolak.data?.length ? (
            <Empty text="Tidak ada percobaan yang ditolak" hint="Setiap penolakan presensi tersimpan lengkap dengan foto dan koordinatnya." />
          ) : (
            <Table head={['Waktu', 'Anggota', 'Site', 'Sebab', 'Jarak', 'Kemiripan wajah', 'Bukti']}>
              {ditolak.data.map((a: any) => (
                <tr key={a.id} className="transition hover:bg-white/[.025]">
                  <td className="num text-[12.5px]">{dt(a.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.guard?.name} url={a.guard?.avatarUrl} size={28} />
                      <div>
                        <p className="text-[13px] font-semibold">{a.guard?.name}</p>
                        <p className="num text-[10.5px] text-muted">{a.guard?.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-[12px] text-muted">{a.site?.name}</td>
                  <td>
                    <span className={`chip ${a.result === 'DILUAR_RADIUS' ? 'border-amber/40 bg-amber/10 text-amber' : 'border-danger/45 bg-danger/12 text-danger'}`}>
                      {a.result === 'DILUAR_RADIUS' ? 'Di luar radius' : a.result === 'WAJAH_TIDAK_COCOK' ? 'Wajah tidak cocok' : a.result === 'WAJAH_TIDAK_TERDETEKSI' ? 'Wajah tak terdeteksi' : 'Sudah presensi'}
                    </span>
                    <p className="mt-1 max-w-[260px] text-[11px] text-muted">{a.reason}</p>
                  </td>
                  <td className="num text-[12.5px]">{a.distanceM != null ? `${a.distanceM} m` : '—'}</td>
                  <td className="num text-[12.5px]">
                    {a.faceScore != null ? (
                      <span className="flex items-center gap-1 text-danger"><ScanFace size={12} /> {a.faceScore}%</span>
                    ) : '—'}
                  </td>
                  <td>
                    {a.photoUrl ? (
                      <a href={a.photoUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                        <Camera size={12} /> Foto
                      </a>
                    ) : <span className="text-[11px] text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      ) : (
      <Panel title="Catatan Presensi" icon={Fingerprint} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada presensi pada rentang ini" />
        ) : (
          <Table head={['Anggota', 'Site & Shift', 'Masuk', 'Pulang', 'Durasi', 'Status', 'Bukti']}>
            {rows.map((a: any) => (
              <tr key={a.id} className="transition hover:bg-white/[.025]">
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.guard?.name} url={a.guard?.avatarUrl} size={30} />
                    <div>
                      <p className="text-[13px] font-semibold">{a.guard?.name}</p>
                      <p className="num text-[10.5px] text-muted">{a.guard?.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <p className="text-[13px]">{a.site?.name}</p>
                  <p className="num text-[10.5px] text-muted">
                    {a.schedule?.shift ? `${a.schedule.shift.name} ${a.schedule.shift.startTime}–${a.schedule.shift.endTime}` : 'Tanpa jadwal'}
                  </p>
                </td>
                <td>
                  <p className="num text-[13px]">{dt(a.checkInAt, 'DD MMM · HH:mm')}</p>
                  {a.checkInDistanceM != null && (
                    <p className="num flex items-center gap-1 text-[10px] text-muted">
                      <MapPin size={9} /> {a.checkInDistanceM} m dari pos
                    </p>
                  )}
                </td>
                <td className="num text-[13px]">{a.checkOutAt ? t(a.checkOutAt) : <span className="text-emerald">bertugas</span>}</td>
                <td className="num text-[13px]">{a.workedMinutes ? `${(a.workedMinutes / 60).toFixed(1)} jam` : '—'}</td>
                <td>
                  <Chip value={a.status} />
                  {a.lateMinutes > 0 && <p className="num mt-1 text-[10px] text-amber">+{a.lateMinutes} mnt</p>}
                </td>
                <td>
                  {a.checkInPhoto ? (
                    <a href={a.checkInPhoto} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                      <Camera size={12} /> Foto
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted">—</span>
                  )}
                  {a.faceScore != null && (
                    <p className="num mt-1 flex items-center gap-1 text-[10.5px] text-emerald">
                      <ScanFace size={10} /> {a.faceScore}%
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      )}
    </>
  );
}
