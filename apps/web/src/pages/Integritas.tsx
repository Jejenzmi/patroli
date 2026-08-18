import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Smartphone, MapPinOff, Gauge, Unlink, Ban, CheckCircle2, Monitor } from 'lucide-react';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Avatar, Table, Confirm, Stat } from '../components/ui';
import { ask } from '../components/confirm';

/**
 * Integritas data lapangan: percobaan lokasi palsu, perpindahan mustahil,
 * dan perangkat yang terikat pada tiap akun.
 *
 * Tindakannya sudah ditolak sistem; halaman ini yang memperlihatkan siapa
 * mencoba apa, kapan, dan dari perangkat mana.
 */

const JENIS: Record<string, { l: string; i: any; tone: string }> = {
  LOKASI_PALSU: { l: 'Lokasi palsu (fake GPS)', i: MapPinOff, tone: 'border-danger/45 bg-danger/12 text-danger' },
  KECEPATAN_TIDAK_WAJAR: { l: 'Perpindahan mustahil', i: Gauge, tone: 'border-amber/45 bg-amber/12 text-amber' },
  EMULATOR: { l: 'Emulator', i: Monitor, tone: 'border-violet/45 bg-violet/12 text-violet' },
  PERANGKAT_ASING: { l: 'Perangkat tidak terdaftar', i: Smartphone, tone: 'border-cyan/45 bg-cyan/12 text-cyan' },
  PERANGKAT_ROOT: { l: 'Perangkat di-root', i: ShieldAlert, tone: 'border-danger/45 bg-danger/12 text-danger' },
};

export default function Integritas() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const bolehKelola = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');

  const [tab, setTab] = useState<'pelanggaran' | 'perangkat'>('pelanggaran');
  const [saring, setSaring] = useState('');
  const [lepas, setLepas] = useState<any>(null);

  const kejadian = useQuery({
    queryKey: ['integrity', saring],
    queryFn: () => api.get('/users/integrity/events' + (saring ? `?type=${saring}` : '')),
    refetchInterval: 30000,
  });
  const ringkas = useQuery({ queryKey: ['integrity-sum'], queryFn: () => api.get('/users/integrity/summary') });
  const perangkat = useQuery({ queryKey: ['devices'], queryFn: () => api.get('/users/devices/list') });

  const jumlah = (t: string) =>
    (ringkas.data?.perJenis || []).find((x: any) => x.type === t)?.jumlah ?? 0;

  const lepaskan = async () => {
    if (!lepas) return;
    try {
      await api.del(`/users/devices/${lepas.id}`);
      toast.ok('Ikatan dilepaskan', `${lepas.user?.name} dapat masuk dari ponsel baru`);
      qc.invalidateQueries({ queryKey: ['devices'] });
    } catch (e: any) {
      toast.err('Gagal melepaskan', e.message);
    } finally {
      setLepas(null);
    }
  };

  const ubahStatus = async (d: any, status: 'AKTIF' | 'DIBLOKIR') => {
    const setuju = await ask.action(
      status === 'DIBLOKIR' ? 'Blokir perangkat ini?' : 'Aktifkan kembali perangkat ini?',
      status === 'DIBLOKIR'
        ? `${d.user?.name} tidak akan bisa masuk dari ponsel ini sampai diaktifkan lagi.`
        : `${d.user?.name} dapat kembali masuk dari ponsel ini.`,
      status === 'DIBLOKIR' ? 'Ya, blokir' : 'Ya, aktifkan',
    );
    if (!setuju) return;
    try {
      await api.put(`/users/devices/${d.id}`, { status });
      toast.ok(status === 'DIBLOKIR' ? 'Perangkat diblokir' : 'Perangkat diaktifkan');
      qc.invalidateQueries({ queryKey: ['devices'] });
    } catch (e: any) {
      toast.err('Gagal mengubah status', e.message);
    }
  };

  return (
    <>
      <PageHead
        crumb="Pengawasan"
        title="Integritas & Perangkat"
        desc="Percobaan pemalsuan lokasi, perpindahan mustahil, dan ponsel yang terikat pada tiap akun."
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Lokasi Palsu (30 hari)" value={jumlah('LOKASI_PALSU')} icon={MapPinOff} tone="danger" />
        <Stat label="Perpindahan Mustahil" value={jumlah('KECEPATAN_TIDAK_WAJAR')} icon={Gauge} tone="amber" />
        <Stat label="Perangkat Asing" value={jumlah('PERANGKAT_ASING')} icon={Smartphone} tone="cyan" />
        <Stat label="Emulator" value={jumlah('EMULATOR')} icon={Monitor} tone="amber" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { k: 'pelanggaran', l: 'Percobaan Pelanggaran', i: ShieldAlert, n: kejadian.data?.length },
          { k: 'perangkat', l: 'Perangkat Terikat', i: Smartphone, n: perangkat.data?.length },
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

      {tab === 'pelanggaran' && (
        <Panel
          title="Percobaan yang Ditolak Sistem"
          icon={ShieldAlert}
          bodyClass="p-0"
          action={
            <select className="w-auto" value={saring} onChange={(e) => setSaring(e.target.value)}>
              <option value="">Semua jenis</option>
              {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
            </select>
          }
        >
          {kejadian.isLoading ? (
            <Loading />
          ) : !kejadian.data?.length ? (
            <Empty
              text="Belum ada percobaan pelanggaran"
              hint="Setiap upaya memakai lokasi palsu, emulator, atau ponsel yang tidak terdaftar akan muncul di sini."
            />
          ) : (
            <Table head={['Waktu', 'Pelaku', 'Jenis', 'Tindakan', 'Keterangan', 'Perangkat']}>
              {kejadian.data.map((e: any) => {
                const j = JENIS[e.type] ?? { l: e.type, i: ShieldAlert, tone: 'border-line text-muted' };
                return (
                  <tr key={e.id} className="transition hover:bg-white/[.025]">
                    <td className="num text-[12px]">{dayjs(e.createdAt).format('DD MMM · HH:mm:ss')}</td>
                    <td>
                      {e.user ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={e.user.name} url={e.user.avatarUrl} size={28} />
                          <div>
                            <p className="text-[13px] font-semibold">{e.user.name}</p>
                            <p className="num text-[10.5px] text-muted">{e.user.employeeId ?? e.user.role}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`chip ${j.tone}`}><j.i size={11} /> {j.l}</span>
                    </td>
                    <td className="num text-[11.5px] text-muted">{e.action}</td>
                    <td>
                      <p className="max-w-[320px] text-[12px] leading-relaxed">{e.detail}</p>
                      {e.lat != null && (
                        <p className="num mt-1 text-[10.5px] text-muted">
                          {e.lat.toFixed(5)}, {e.lng?.toFixed(5)}
                          {e.speedKph ? ` · ${e.speedKph} km/jam` : ''}
                          {e.site?.name ? ` · ${e.site.name}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="num max-w-[150px] truncate text-[11px] text-muted" title={e.deviceId || ''}>
                      {e.deviceId || '—'}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
      )}

      {tab === 'perangkat' && (
        <Panel title="Perangkat Terikat pada Akun" icon={Smartphone} bodyClass="p-0">
          {perangkat.isLoading ? (
            <Loading />
          ) : !perangkat.data?.length ? (
            <Empty
              text="Belum ada perangkat terikat"
              hint="Ikatan terbentuk saat anggota masuk pertama kali dari aplikasi lapangan."
            />
          ) : (
            <Table head={['Pemilik', 'Ponsel', 'Sistem', 'Versi aplikasi', 'Terakhir dipakai', 'Status', '']}>
              {perangkat.data.map((d: any) => (
                <tr key={d.id} className="transition hover:bg-white/[.025]">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={d.user?.name} url={d.user?.avatarUrl} size={28} />
                      <div>
                        <p className="text-[13px] font-semibold">{d.user?.name}</p>
                        <p className="num text-[10.5px] text-muted">
                          {d.user?.employeeId ?? d.user?.role}
                          {d.user?.homeSite?.name ? ` · ${d.user.homeSite.name}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="text-[12.5px]">{d.label || '—'}</p>
                    <p className="num max-w-[180px] truncate text-[10.5px] text-muted" title={d.deviceId}>{d.deviceId}</p>
                  </td>
                  <td className="text-[12px] text-muted">
                    {d.osVersion || d.platform || '—'}
                    {!d.isPhysical && <span className="ml-1 chip border-violet/45 bg-violet/12 text-violet">emulator</span>}
                  </td>
                  <td className="num text-[12px]">{d.appVersion || '—'}</td>
                  <td className="num text-[12px]">{dayjs(d.lastSeenAt).format('DD MMM · HH:mm')}</td>
                  <td>
                    <span className={`chip ${d.status === 'AKTIF' ? 'border-emerald/40 bg-emerald/10 text-emerald' : 'border-danger/45 bg-danger/12 text-danger'}`}>
                      {d.status === 'AKTIF' ? 'Aktif' : 'Diblokir'}
                    </span>
                  </td>
                  <td>
                    {bolehKelola && (
                      <div className="flex justify-end gap-1">
                        {d.status === 'AKTIF' ? (
                          <button className="btn-ghost btn-sm" title="Blokir perangkat" onClick={() => ubahStatus(d, 'DIBLOKIR')}>
                            <Ban size={12} />
                          </button>
                        ) : (
                          <button className="btn-ghost btn-sm" title="Aktifkan kembali" onClick={() => ubahStatus(d, 'AKTIF')}>
                            <CheckCircle2 size={12} />
                          </button>
                        )}
                        <button className="btn-ghost btn-sm" title="Lepaskan ikatan" onClick={() => setLepas(d)}>
                          <Unlink size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      <Confirm
        open={!!lepas}
        onClose={() => setLepas(null)}
        onConfirm={lepaskan}
        message={`Lepaskan ikatan perangkat ${lepas?.label ?? ''} dari akun ${lepas?.user?.name ?? ''}? Masuk berikutnya akan mengikat ponsel yang dipakai saat itu — lakukan hanya bila yang bersangkutan memang berganti ponsel.`}
        danger
      />
    </>
  );
}
