import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Trash2, Upload, MapPin, Users2, Pencil, Move } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import {
  Panel, PageHead, Loading, Empty, Modal, Field, Select, Confirm, Avatar, Table,
} from '../components/ui';
import { ask } from '../components/confirm';

/**
 * Lantai, denah skematik, dan regu jaga.
 * Titik patroli ditempatkan di atas denah dengan cara mengetuk posisinya.
 */
export default function Floors() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const bolehUbah = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');

  const [tab, setTab] = useState<'lantai' | 'regu'>('lantai');
  const [siteId, setSiteId] = useState('');
  const [lantaiAktif, setLantaiAktif] = useState<string | null>(null);
  const [pasangTitik, setPasangTitik] = useState<string | null>(null);
  const [openLantai, setOpenLantai] = useState(false);
  const [openRegu, setOpenRegu] = useState(false);
  const [form, setForm] = useState<any>({ level: 0 });
  const [reguForm, setReguForm] = useState<any>({ memberIds: [] });
  const [del, setDel] = useState<{ jenis: string; id: string } | null>(null);
  const berkas = useRef<HTMLInputElement>(null);

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const floors = useQuery({ queryKey: ['floors', siteId], queryFn: () => api.get('/master/floors' + (siteId ? `?siteId=${siteId}` : '')) });
  const teams = useQuery({ queryKey: ['teams', siteId], queryFn: () => api.get('/master/teams' + (siteId ? `?siteId=${siteId}` : '')) });
  const guards = useQuery({ queryKey: ['guards'], queryFn: () => api.get('/users?role=GUARD&pageSize=200') });
  const checkpoints = useQuery({
    queryKey: ['cp', siteId],
    queryFn: () => api.get('/master/checkpoints' + (siteId ? `?siteId=${siteId}` : '')),
  });

  const daftarLantai = floors.data || [];
  const lantai = daftarLantai.find((f: any) => f.id === lantaiAktif) || daftarLantai[0];

  const unggahDenah = async (file: File, floorId: string) => {
    try {
      const { url } = await api.upload(file, 'denah');
      await api.put(`/master/floors/${floorId}`, { planUrl: url });
      toast.ok('Denah diunggah');
      qc.invalidateQueries({ queryKey: ['floors'] });
    } catch (e: any) {
      toast.err('Gagal mengunggah denah', e.message);
    }
  };

  /** Menempatkan titik pada denah berdasarkan posisi klik. */
  const klikDenah = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pasangTitik || !lantai) return;
    const kotak = e.currentTarget.getBoundingClientRect();
    const planX = Math.round(((e.clientX - kotak.left) / kotak.width) * 1000) / 10;
    const planY = Math.round(((e.clientY - kotak.top) / kotak.height) * 1000) / 10;
    try {
      await api.put(`/master/floors/${lantai.id}/place`, { checkpointId: pasangTitik, planX, planY });
      toast.ok('Titik ditempatkan pada denah');
      setPasangTitik(null);
      qc.invalidateQueries({ queryKey: ['floors'] });
      qc.invalidateQueries({ queryKey: ['cp'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const simpanLantai = async () => {
    if (!form.siteId || !form.name) return toast.err('Site dan nama lantai wajib diisi');
    if (!(await (form.id ? ask.save(`lantai ${form.name}`) : ask.create('lantai', form.name)))) return;
    try {
      const body = { ...form, level: Number(form.level) || 0 };
      if (form.id) await api.put(`/master/floors/${form.id}`, body);
      else await api.post('/master/floors', body);
      toast.ok('Lantai tersimpan');
      setOpenLantai(false);
      setForm({ level: 0 });
      qc.invalidateQueries({ queryKey: ['floors'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const simpanRegu = async () => {
    if (!reguForm.siteId || !reguForm.code || !reguForm.name) return toast.err('Site, kode, dan nama regu wajib diisi');
    if (!(await (reguForm.id ? ask.save(`regu ${reguForm.name}`) : ask.create('regu', reguForm.name)))) return;
    try {
      if (reguForm.id) await api.put(`/master/teams/${reguForm.id}`, reguForm);
      else await api.post('/master/teams', reguForm);
      toast.ok('Regu tersimpan');
      setOpenRegu(false);
      setReguForm({ memberIds: [] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const titikTanpaDenah = (checkpoints.data || []).filter(
    (c: any) => !daftarLantai.some((f: any) => f.checkpoints?.some((x: any) => x.id === c.id && x.planX != null))
  );

  return (
    <>
      <PageHead crumb="Konfigurasi" title="Lantai, Denah & Regu" desc="Denah skematik per lantai beserta posisi titik patroli, dan pembagian regu jaga.">
        <Select value={siteId} onChange={(e) => { setSiteId(e.target.value); setLantaiAktif(null); }} className="w-auto">
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {bolehUbah && tab === 'lantai' && (
          <button className="btn-primary btn-sm" onClick={() => { setForm({ level: 0, siteId }); setOpenLantai(true); }}>
            <Plus size={14} /> Tambah Lantai
          </button>
        )}
        {bolehUbah && tab === 'regu' && (
          <button className="btn-primary btn-sm" onClick={() => { setReguForm({ memberIds: [], siteId }); setOpenRegu(true); }}>
            <Plus size={14} /> Tambah Regu
          </button>
        )}
      </PageHead>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { k: 'lantai', l: 'Lantai & Denah', i: Layers, n: daftarLantai.length },
          { k: 'regu', l: 'Regu Jaga', i: Users2, n: teams.data?.length },
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

      {tab === 'lantai' && (
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <Panel title="Daftar Lantai" icon={Layers} bodyClass="p-0">
            {floors.isLoading ? (
              <Loading />
            ) : !daftarLantai.length ? (
              <Empty text="Belum ada lantai" hint="Tambahkan lantai lalu unggah denah skematiknya." />
            ) : (
              <div className="divide-y divide-line/60">
                {daftarLantai.map((f: any) => (
                  <button
                    key={f.id}
                    onClick={() => setLantaiAktif(f.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[.03] ${lantai?.id === f.id ? 'bg-amber/[.07]' : ''}`}
                  >
                    <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber/12 text-[11px] font-bold text-amber">
                      {f.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{f.name}</p>
                      <p className="truncate text-[10.5px] text-muted">
                        {f.site?.name} · {f.checkpoints?.filter((c: any) => c.planX != null).length || 0}/{f.checkpoints?.length || 0} titik terpasang
                      </p>
                    </div>
                    {bolehUbah && (
                      <span className="flex gap-1">
                        <span
                          className="rounded-lg p-1.5 text-muted hover:text-amber"
                          onClick={(e) => { e.stopPropagation(); setForm({ ...f }); setOpenLantai(true); }}
                        >
                          <Pencil size={12} />
                        </span>
                        <span
                          className="rounded-lg p-1.5 text-muted hover:text-danger"
                          onClick={(e) => { e.stopPropagation(); setDel({ jenis: 'floors', id: f.id }); }}
                        >
                          <Trash2 size={12} />
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={lantai ? `Denah — ${lantai.name}` : 'Denah Lantai'}
            icon={MapPin}
            action={
              bolehUbah && lantai ? (
                <div className="flex gap-2">
                  <input
                    ref={berkas}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && unggahDenah(e.target.files[0], lantai.id)}
                  />
                  <button className="btn-ghost btn-sm" onClick={() => berkas.current?.click()}>
                    <Upload size={13} /> Unggah denah
                  </button>
                </div>
              ) : undefined
            }
          >
            {!lantai ? (
              <Empty text="Pilih lantai di sebelah kiri" />
            ) : (
              <>
                {pasangTitik && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-4 py-2.5 text-[12.5px] text-amber">
                    <Move size={14} /> Ketuk posisi pada denah untuk menempatkan titik.
                    <button className="btn-ghost btn-sm ml-auto" onClick={() => setPasangTitik(null)}>Batal</button>
                  </div>
                )}
                <div
                  onClick={klikDenah}
                  className={`relative overflow-hidden rounded-2xl border border-line bg-abyss ${pasangTitik ? 'cursor-crosshair' : ''}`}
                  style={{ aspectRatio: '16 / 10' }}
                >
                  {lantai.planUrl ? (
                    <img src={lantai.planUrl} alt={lantai.name} className="h-full w-full object-contain opacity-90" />
                  ) : (
                    <div className="absolute inset-0 bg-grid [background-size:34px_34px]" />
                  )}
                  {!lantai.planUrl && (
                    <div className="absolute inset-0 grid place-items-center">
                      <p className="text-center text-xs text-muted">
                        Denah belum diunggah — titik tetap dapat ditempatkan di atas kisi.
                      </p>
                    </div>
                  )}
                  {(lantai.checkpoints || [])
                    .filter((c: any) => c.planX != null)
                    .map((c: any) => (
                      <div
                        key={c.id}
                        className="group absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${c.planX}%`, top: `${c.planY}%` }}
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-lg border border-amber/60 bg-panel text-[9px] font-bold text-amber shadow-[0_0_14px_rgba(255,176,32,.4)]">
                          QR
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-8 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-panel px-2 py-1 text-[10px] group-hover:block">
                          {c.name}
                        </span>
                      </div>
                    ))}
                </div>

                {bolehUbah && (
                  <div className="mt-4">
                    <p className="mb-2 text-[10px] uppercase tracking-[.16em] text-muted">Titik pada lantai ini</p>
                    <div className="flex flex-wrap gap-2">
                      {(lantai.checkpoints || []).map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => setPasangTitik(c.id)}
                          className={`chip ${c.planX != null ? 'border-emerald/40 bg-emerald/10 text-emerald' : 'border-line text-muted'} hover:border-amber/50`}
                        >
                          {c.name} {c.planX != null ? '✓' : '· belum dipasang'}
                        </button>
                      ))}
                      {!lantai.checkpoints?.length && (
                        <p className="text-xs text-muted">Belum ada titik patroli pada lantai ini.</p>
                      )}
                    </div>
                    {titikTanpaDenah.length > 0 && (
                      <p className="mt-3 text-[11px] text-muted">
                        {titikTanpaDenah.length} titik pada site ini belum ditautkan ke lantai mana pun.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      )}

      {tab === 'regu' && (
        <Panel title="Regu Jaga" icon={Users2} bodyClass="p-0">
          {teams.isLoading ? (
            <Loading />
          ) : !teams.data?.length ? (
            <Empty text="Belum ada regu" />
          ) : (
            <Table head={['Kode', 'Regu', 'Site', 'Anggota', '']}>
              {teams.data.map((t: any) => (
                <tr key={t.id} className="transition hover:bg-white/[.025]">
                  <td className="num text-[12px] font-bold text-amber">{t.code}</td>
                  <td>
                    <p className="text-[13px] font-semibold">{t.name}</p>
                    {t.notes && <p className="text-[10.5px] text-muted">{t.notes}</p>}
                  </td>
                  <td className="text-[12px] text-muted">{t.site?.name}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.members?.slice(0, 6).map((m: any) => (
                        <span key={m.id} title={m.name}><Avatar name={m.name} url={m.avatarUrl} size={24} /></span>
                      ))}
                      <span className="num ml-1 text-[11px] text-muted">{t.members?.length || 0} anggota</span>
                    </div>
                  </td>
                  <td className="text-right">
                    {bolehUbah && (
                      <div className="flex justify-end gap-1.5">
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => { setReguForm({ ...t, siteId: t.site?.id, memberIds: t.members?.map((m: any) => m.id) || [] }); setOpenRegu(true); }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => setDel({ jenis: 'teams', id: t.id })}>
                          <Trash2 size={12} />
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

      {/* Formulir lantai */}
      <Modal
        open={openLantai}
        onClose={() => setOpenLantai(false)}
        title={form.id ? 'Ubah Lantai' : 'Tambah Lantai'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenLantai(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanLantai}>Simpan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Site">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama lantai">
              <input className="w-full" placeholder="mis. Lantai 1" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Urutan lantai" hint="Basement boleh diisi 0 atau minus.">
              <input type="number" className="w-full" value={form.level ?? 0} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </Field>
          </div>
          <Field label="Keterangan">
            <input className="w-full" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {/* Formulir regu */}
      <Modal
        open={openRegu}
        onClose={() => setOpenRegu(false)}
        title={reguForm.id ? 'Ubah Regu' : 'Tambah Regu'}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpenRegu(false)}>Batal</button>
            <button className="btn-primary" onClick={simpanRegu}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site">
            <Select value={reguForm.siteId || ''} onChange={(e) => setReguForm({ ...reguForm, siteId: e.target.value })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Kode regu">
            <input className="w-full" value={reguForm.code || ''} onChange={(e) => setReguForm({ ...reguForm, code: e.target.value })} />
          </Field>
          <Field label="Nama regu">
            <input className="w-full" value={reguForm.name || ''} onChange={(e) => setReguForm({ ...reguForm, name: e.target.value })} />
          </Field>
          <Field label="Keterangan">
            <input className="w-full" value={reguForm.notes || ''} onChange={(e) => setReguForm({ ...reguForm, notes: e.target.value })} />
          </Field>
          <Field label="Anggota regu" className="sm:col-span-2">
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {(guards.data?.data || [])
                .filter((g: any) => !reguForm.siteId || g.homeSite?.id === reguForm.siteId)
                .map((g: any) => {
                  const on = reguForm.memberIds?.includes(g.id);
                  return (
                    <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[.04]">
                      <input
                        type="checkbox"
                        className="!w-auto"
                        checked={!!on}
                        onChange={() =>
                          setReguForm({
                            ...reguForm,
                            memberIds: on
                              ? reguForm.memberIds.filter((x: string) => x !== g.id)
                              : [...(reguForm.memberIds || []), g.id],
                          })
                        }
                      />
                      <Avatar name={g.name} url={g.avatarUrl} size={22} />
                      <span className="text-[13px] normal-case tracking-normal text-ink">{g.name}</span>
                      <span className="num ml-auto text-[10px] text-muted">{g.employeeId}</span>
                    </label>
                  );
                })}
            </div>
          </Field>
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await api.del(`/master/${del!.jenis}/${del!.id}`);
          toast.ok('Data dihapus');
          qc.invalidateQueries();
        }}
        message="Hapus data ini? Titik patroli yang tertaut akan kehilangan penempatan lantainya."
        danger
        confirmLabel="Hapus"
      />
    </>
  );
}
