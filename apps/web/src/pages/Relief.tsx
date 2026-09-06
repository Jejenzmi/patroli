import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, TriangleAlert, Users, Wallet, Send, Save, Ban, Timer, Gauge,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Input, Table, Stat, Avatar, Bar } from '../components/ui';
import { ask } from '../components/confirm';
import { d, num, rupiah } from '../lib/format';

const STATUS: Record<string, { label: string; tone: string }> = {
  TERBUKA: { label: 'Terbuka', tone: 'text-amber border-amber/40 bg-amber/10' },
  DIAMBIL: { label: 'Terisi', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
  DIBATALKAN: { label: 'Dibatalkan', tone: 'text-muted border-line bg-white/5' },
  KEDALUWARSA: { label: 'Lewat waktu', tone: 'text-danger border-danger/40 bg-danger/10' },
};

export default function Relief() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const komando = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');

  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ beritahu: 5 });
  const [calon, setCalon] = useState<any[] | null>(null);
  const [rincian, setRincian] = useState<any>(null);
  const [pagar, setPagar] = useState<any>(null);

  const { data: papan, isLoading } = useQuery({
    queryKey: ['pos-kosong', tanggal],
    queryFn: () => api.get(`/relief/pos-kosong?tanggal=${tanggal}`),
  });
  const { data: tawaran } = useQuery({
    queryKey: ['tawaran'],
    queryFn: () => api.get('/relief'),
    enabled: komando,
  });
  const { data: konfig } = useQuery({
    queryKey: ['kelelahan'],
    queryFn: () => api.get('/relief/kelelahan/config'),
    enabled: komando,
  });

  const bukaTawaran = (baris: any) => {
    setForm({
      siteId: baris.siteId,
      shiftId: baris.shiftId,
      tanggal,
      reason: `Pos ${baris.positionName} kosong ${baris.kurang} orang`,
      beritahu: 5,
      siteName: baris.siteName,
      shiftName: baris.shiftName,
    });
    setCalon(null);
    setOpen(true);
  };

  const lihatCalon = async () => {
    if (!form.siteId || !form.shiftId) return toast.err('Pos ini tidak terikat shift tertentu — pilih shift dulu di manning table');
    try {
      setCalon(await api.get(`/relief/calon?siteId=${form.siteId}&shiftId=${form.shiftId}&tanggal=${form.tanggal}`));
    } catch (e: any) {
      toast.err('Gagal memuat calon', e.message);
    }
  };

  const kirim = async () => {
    if (!form.siteId || !form.shiftId || !form.reason) return toast.err('Site, shift, dan alasan wajib diisi');
    if (!(await ask.create('tawaran shift', `${form.siteName} — ${form.shiftName}`))) return;
    try {
      const r = await api.post('/relief', {
        siteId: form.siteId,
        shiftId: form.shiftId,
        tanggal: form.tanggal,
        reason: form.reason,
        note: form.note || null,
        beritahu: Number(form.beritahu) || 5,
      });
      toast.ok('Tawaran dikirim', `${Math.min(r.calon?.length || 0, Number(form.beritahu))} personel diberi tahu`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['tawaran'] });
    } catch (e: any) {
      toast.err('Gagal mengirim tawaran', e.message);
    }
  };

  const tugaskan = async (offer: any, kandidat: any) => {
    if (
      !(await ask.action(
        `Tugaskan ${kandidat.guard.name}?`,
        'Yang bersangkutan langsung masuk roster tanpa menunggu kesanggupannya, dan menerima notifikasi penugasan.',
        'Ya, tugaskan'
      ))
    )
      return;
    try {
      await api.post(`/relief/${offer.id}/tugaskan`, { guardId: kandidat.guardId });
      toast.ok('Pos terisi', `${kandidat.guard.name} masuk roster`);
      setRincian(null);
      qc.invalidateQueries({ queryKey: ['tawaran'] });
      qc.invalidateQueries({ queryKey: ['pos-kosong', tanggal] });
    } catch (e: any) {
      toast.err('Gagal menugaskan', e.message);
    }
  };

  const simpanPagar = async () => {
    if (!(await ask.save('pagar jam kerja'))) return;
    try {
      await api.put('/relief/kelelahan/config', {
        maksHariBerturut: Number(pagar.maksHariBerturut),
        maksJamPekan: Number(pagar.maksJamPekan),
        minJedaJam: Number(pagar.minJedaJam),
        tegakkan: !!pagar.tegakkan,
      });
      toast.ok('Pagar jam kerja disimpan');
      setPagar(null);
      qc.invalidateQueries({ queryKey: ['kelelahan'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const kosong = (papan?.baris || []).filter((b: any) => b.kurang > 0);

  return (
    <>
      <PageHead
        crumb="Personel"
        title="Pos Kosong & Pengganti"
        desc="Pos yang belum terisi hari ini, berikut nilai potongan tagihan yang akan timbul bila dibiarkan."
      >
        <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="!w-auto" />
        {komando && konfig && (
          <button className="btn-ghost btn-sm" onClick={() => setPagar(konfig)}>
            <Gauge size={14} /> Pagar Jam Kerja
          </button>
        )}
      </PageHead>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pos Kosong" value={num(papan.posKosong)} sub={`dari ${num(papan.total)} pos kontrak`} icon={TriangleAlert} tone={papan.posKosong ? 'danger' : 'emerald'} />
            <Stat label="Kekurangan Orang" value={`${num(papan.orangKurang)} orang`} icon={Users} tone="amber" />
            <Stat
              label="Potongan Hari Ini"
              value={rupiah(papan.potonganHariIni)}
              sub="pro-rata tagihan bila dibiarkan"
              icon={Wallet}
              tone="danger"
            />
            <Stat
              label="Tawaran Terbuka"
              value={num((tawaran || []).filter((t: any) => t.status === 'TERBUKA').length)}
              icon={Send}
              tone="cyan"
            />
          </div>

          <Panel title={`Papan Pos — ${d(tanggal)}`} icon={Users} bodyClass="p-0" className="mb-4">
            {!kosong.length ? (
              <Empty text="Seluruh pos terisi" hint="Tidak ada potongan tagihan dari pos kosong pada tanggal ini" />
            ) : (
              <Table head={['Site', 'Klien', 'Pos', 'Shift', 'Wajib', 'Terisi', 'Kurang', 'Potongan', '']}>
                {kosong.map((b: any) => (
                  <tr key={b.postId} className="transition hover:bg-white/[.025]">
                    <td className="text-[13px] font-semibold">{b.siteName}</td>
                    <td className="text-[12px] text-muted">{b.clientName}</td>
                    <td className="text-[12.5px]">{b.positionName}</td>
                    <td className="text-[12px] text-muted">{b.shiftName}</td>
                    <td className="num">{b.wajib}</td>
                    <td className="num text-emerald">{b.terisi}</td>
                    <td className="num font-semibold text-danger">{b.kurang}</td>
                    <td className="num text-danger">{rupiah(b.potongan)}</td>
                    <td className="text-right">
                      {komando && (
                        <button className="btn-primary btn-sm" onClick={() => bukaTawaran(b)}>
                          <UserPlus size={12} /> Cari Pengganti
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          {komando && (
            <Panel title="Tawaran Pengganti" icon={Send} bodyClass="p-0">
              {!(tawaran || []).length ? (
                <Empty text="Belum ada tawaran" hint="Tawaran dikirim ke personel cadangan yang paling layak" />
              ) : (
                <Table head={['Tanggal', 'Site', 'Shift', 'Alasan', 'Calon', 'Diambil', 'Status', '']}>
                  {tawaran.map((t: any) => (
                    <tr key={t.id} className="transition hover:bg-white/[.025]">
                      <td className="num text-[12.5px]">{d(t.date)}</td>
                      <td className="text-[13px] font-semibold">{t.site?.name}</td>
                      <td className="text-[12px] text-muted">
                        {t.shift?.name} · {t.shift?.startTime}–{t.shift?.endTime}
                      </td>
                      <td className="max-w-[200px] text-[12.5px]">{t.reason}</td>
                      <td className="num text-[12.5px]">
                        {t.candidates?.length || 0}
                        <span className="text-muted"> · {t.candidates?.filter((c: any) => c.response === 'TIDAK_BISA').length || 0} menolak</span>
                      </td>
                      <td className="text-[12.5px]">
                        {t.takenBy ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={t.takenBy.name} url={t.takenBy.avatarUrl} size={24} />
                            {t.takenBy.name}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className={`chip ${STATUS[t.status]?.tone}`}>{STATUS[t.status]?.label}</span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <button className="btn-ghost btn-sm" onClick={() => setRincian(t)}>
                            Calon
                          </button>
                          {t.status === 'TERBUKA' && (
                            <button
                              className="btn-ghost btn-sm"
                              onClick={async () => {
                                if (!(await ask.action('Batalkan tawaran ini?', 'Personel yang sudah diberi tahu tidak akan bisa mengambilnya lagi.', 'Ya, batalkan'))) return;
                                await api.post(`/relief/${t.id}/batal`);
                                qc.invalidateQueries({ queryKey: ['tawaran'] });
                              }}
                            >
                              <Ban size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Panel>
          )}
        </>
      )}

      {/* Tawaran baru */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cari Pengganti"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-ghost" onClick={lihatCalon}><Users size={14} /> Lihat Calon</button>
            <button className="btn-primary" onClick={kirim}><Send size={14} /> Kirim Tawaran</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-panel2/40 p-3 text-[12.5px]">
            <span className="text-muted">Pos:</span> <b>{form.siteName}</b> · {form.shiftName} · {d(form.tanggal)}
          </div>
          <Field label="Alasan pos kosong">
            <Input value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah calon yang diberi tahu" hint="Diambil dari peringkat teratas">
              <Input type="number" value={form.beritahu} onChange={(e) => setForm({ ...form, beritahu: e.target.value })} />
            </Field>
            <Field label="Catatan untuk personel">
              <Input value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>

          {calon && (
            <div className="rounded-xl border border-line">
              <p className="border-b border-line/70 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-amber">
                Peringkat Calon ({calon.length})
              </p>
              {!calon.length ? (
                <Empty
                  text="Tidak ada calon yang layak"
                  hint="Semua personel sudah terjadwal, sedang cuti, berkasnya mati, atau melewati batas jam kerja"
                />
              ) : (
                <div className="max-h-[300px] divide-y divide-line/60 overflow-y-auto">
                  {calon.map((c) => (
                    <div key={c.guardId} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} url={c.avatarUrl} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold">{c.name}</p>
                          <p className="text-[10.5px] text-muted">
                            {c.homeSite || 'tanpa penempatan'}
                            {c.distanceM !== null && ` · ${(c.distanceM / 1000).toFixed(1)} km`}
                          </p>
                        </div>
                        <div className="w-24">
                          <p className="num text-right text-[13px] font-bold text-amber">{c.score}</p>
                          <Bar value={c.score} tone="amber" />
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.reasons.map((r: any, i: number) => (
                          <span key={i} className="chip border-line bg-white/5 text-[10px] text-muted">
                            {r.faktor} +{r.nilai} · {r.catatan}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Rincian calon satu tawaran */}
      <Modal open={!!rincian} onClose={() => setRincian(null)} title="Calon Pengganti" wide>
        {rincian && (
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-panel2/40 p-3 text-[12.5px]">
              <b>{rincian.site?.name}</b> · {rincian.shift?.name} · {d(rincian.date)} — {rincian.reason}
            </div>
            {!rincian.candidates?.length ? (
              <Empty text="Tidak ada calon" />
            ) : (
              <div className="divide-y divide-line/60">
                {rincian.candidates.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 py-3">
                    <Avatar name={c.guard?.name} url={c.guard?.avatarUrl} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{c.guard?.name}</p>
                      <p className="text-[10.5px] text-muted">
                        skor {c.score}
                        {c.distanceM !== null && ` · ${(c.distanceM / 1000).toFixed(1)} km`}
                        {c.notifiedAt && ' · sudah diberi tahu'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(c.reasons || []).map((r: any, i: number) => (
                          <span key={i} className="chip border-line bg-white/5 text-[10px] text-muted">
                            {r.faktor} +{r.nilai}
                          </span>
                        ))}
                      </div>
                    </div>
                    {c.response === 'TIDAK_BISA' ? (
                      <span className="chip border-danger/40 bg-danger/10 text-danger">Tidak bisa</span>
                    ) : c.response === 'BERSEDIA' ? (
                      <span className="chip border-emerald/40 bg-emerald/10 text-emerald">Bersedia</span>
                    ) : rincian.status === 'TERBUKA' ? (
                      <button className="btn-ghost btn-sm" onClick={() => tugaskan(rincian, c)}>
                        Tugaskan
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Pagar jam kerja */}
      <Modal
        open={!!pagar}
        onClose={() => setPagar(null)}
        title="Pagar Jam Kerja"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPagar(null)}>Batal</button>
            <button className="btn-primary" onClick={simpanPagar}><Save size={14} /> Simpan</button>
          </>
        }
      >
        {pagar && (
          <div className="space-y-4">
            <p className="rounded-xl border border-line bg-panel2/50 p-3 text-[12px] text-muted">
              Batas ini diperiksa saat penjadwalan, penjadwalan massal, dan saat anggota mengambil tawaran shift —
              bukan sekadar peringatan di layar.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Maks hari berturut">
                <Input type="number" value={pagar.maksHariBerturut} onChange={(e) => setPagar({ ...pagar, maksHariBerturut: e.target.value })} />
              </Field>
              <Field label="Maks jam per pekan">
                <Input type="number" value={pagar.maksJamPekan} onChange={(e) => setPagar({ ...pagar, maksJamPekan: e.target.value })} />
              </Field>
              <Field label="Jeda minimal (jam)">
                <Input type="number" value={pagar.minJedaJam} onChange={(e) => setPagar({ ...pagar, minJedaJam: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={!!pagar.tegakkan} onChange={(e) => setPagar({ ...pagar, tegakkan: e.target.checked })} />
              <span>
                <Timer size={12} className="mr-1 inline text-amber" />
                Tolak penjadwalan yang melanggar batas (bila dimatikan, hanya dicatat sebagai peringatan)
              </span>
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
