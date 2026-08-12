import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Layers, Trash2 } from 'lucide-react';
import { api, qs } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Chip, Avatar, Loading, Modal, Field, Select, Confirm } from '../components/ui';
import { dayjs, label } from '../lib/format';

export default function Schedule() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const isCommand = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');

  const [weekStart, setWeekStart] = useState(dayjs().startOf('week'));
  const [siteId, setSiteId] = useState('');
  const [open, setOpen] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [form, setForm] = useState<any>({});
  const [del, setDel] = useState<string | null>(null);

  const from = weekStart.format('YYYY-MM-DD');
  const to = weekStart.add(6, 'day').format('YYYY-MM-DD');

  const sites = useQuery({ queryKey: ['sites'], queryFn: () => api.get('/master/sites') });
  const shifts = useQuery({
    queryKey: ['shifts', form.siteId || siteId],
    queryFn: () => api.get('/master/shifts' + qs({ siteId: form.siteId || siteId })),
    enabled: !!(form.siteId || siteId),
  });
  const guards = useQuery({ queryKey: ['guards'], queryFn: () => api.get('/users?role=GUARD&pageSize=200') });
  const routes = useQuery({
    queryKey: ['routes', form.siteId],
    queryFn: () => api.get('/master/routes' + qs({ siteId: form.siteId })),
    enabled: !!form.siteId,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['schedules', from, to, siteId],
    queryFn: () => api.get('/schedules' + qs({ from, to, siteId })),
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart]);

  const byDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    (data || []).forEach((s: any) => {
      const k = dayjs(s.date).format('YYYY-MM-DD');
      (m[k] ||= []).push(s);
    });
    return m;
  }, [data]);

  const save = async () => {
    try {
      if (bulk) {
        if (!form.siteId || !form.shiftId || !form.guardIds?.length) return toast.err('Lengkapi site, shift, dan anggota');
        const r = await api.post('/schedules/bulk', {
          ...form,
          from: form.from || from,
          to: form.to || to,
        });
        toast.ok('Roster dibuat', `${r.created} jadwal ditambahkan`);
      } else {
        if (!form.siteId || !form.shiftId || !form.guardId || !form.date) return toast.err('Lengkapi seluruh isian');
        await api.post('/schedules', form);
        toast.ok('Jadwal ditambahkan');
      }
      setOpen(false);
      setForm({});
      qc.invalidateQueries({ queryKey: ['schedules'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const remove = async (id: string) => {
    await api.del(`/schedules/${id}`);
    toast.ok('Jadwal dihapus');
    qc.invalidateQueries({ queryKey: ['schedules'] });
  };

  return (
    <>
      <PageHead crumb="Personel" title="Jadwal Jaga" desc="Roster mingguan per site dan shift, lengkap dengan status kehadiran.">
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-auto">
          <option value="">Semua site</option>
          {(sites.data || []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        {isCommand && (
          <>
            <button className="btn-ghost btn-sm" onClick={() => { setBulk(true); setForm({ weekdays: [] }); setOpen(true); }}>
              <Layers size={14} /> Roster Massal
            </button>
            <button className="btn-primary btn-sm" onClick={() => { setBulk(false); setForm({}); setOpen(true); }}>
              <Plus size={14} /> Tambah Jadwal
            </button>
          </>
        )}
      </PageHead>

      <Panel
        title={`Pekan ${weekStart.format('DD MMM')} – ${weekStart.add(6, 'day').format('DD MMM YYYY')}`}
        icon={CalendarDays}
        bodyClass="p-3"
        action={
          <div className="flex gap-1.5">
            <button className="btn-ghost btn-sm" onClick={() => setWeekStart(weekStart.subtract(7, 'day'))}>
              <ChevronLeft size={14} />
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setWeekStart(dayjs().startOf('week'))}>
              Pekan ini
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setWeekStart(weekStart.add(7, 'day'))}>
              <ChevronRight size={14} />
            </button>
          </div>
        }
      >
        {isLoading ? (
          <Loading />
        ) : (
          <div className="grid gap-2.5 md:grid-cols-7">
            {days.map((d) => {
              const key = d.format('YYYY-MM-DD');
              const items = byDay[key] || [];
              const today = d.isSame(dayjs(), 'day');
              return (
                <div
                  key={key}
                  className={`min-h-[240px] rounded-xl border p-2.5 ${today ? 'border-amber/40 bg-amber/[.05]' : 'border-line/70 bg-abyss/30'}`}
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${today ? 'text-amber' : 'text-muted'}`}>
                      {d.format('ddd')}
                    </span>
                    <span className="num text-base font-extrabold">{d.format('DD')}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((s: any) => (
                      <div
                        key={s.id}
                        className="group rounded-lg border border-line/70 bg-panel/70 p-2 transition hover:border-amber/40"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: s.shift?.color || '#FFB020' }}
                          />
                          <span className="num text-[10px] font-bold text-ink">
                            {s.shift?.startTime}–{s.shift?.endTime}
                          </span>
                          {isCommand && (
                            <button
                              onClick={() => setDel(s.id)}
                              className="ml-auto opacity-0 transition group-hover:opacity-100"
                            >
                              <Trash2 size={11} className="text-muted hover:text-danger" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Avatar name={s.guard?.name} url={s.guard?.avatarUrl} size={20} />
                          <p className="truncate text-[11px] font-semibold">{s.guard?.name}</p>
                        </div>
                        <p className="mt-1 truncate text-[9.5px] text-muted">{s.site?.name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Chip value={s.status} className="!px-1.5 !py-0.5 !text-[8.5px]" />
                          {s.attendance && (
                            <Chip value={s.attendance.status} className="!px-1.5 !py-0.5 !text-[8.5px]" />
                          )}
                        </div>
                      </div>
                    ))}
                    {!items.length && <p className="pt-6 text-center text-[10px] text-muted/60">Kosong</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={bulk ? 'Roster Massal' : 'Tambah Jadwal Jaga'}
        wide={bulk}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site">
            <Select value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value, shiftId: '', routeId: '' })}>
              <option value="">Pilih site…</option>
              {(sites.data || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Shift">
            <Select value={form.shiftId || ''} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}>
              <option value="">Pilih shift…</option>
              {(shifts.data || []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
              ))}
            </Select>
          </Field>
          <Field label="Rute patroli (opsional)">
            <Select value={form.routeId || ''} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">Tanpa rute tetap</option>
              {(routes.data || []).map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>

          {bulk ? (
            <>
              <Field label="Rentang tanggal">
                <div className="flex gap-2">
                  <input type="date" className="w-full" value={form.from || from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                  <input type="date" className="w-full" value={form.to || to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                </div>
              </Field>
              <Field label="Hari yang dipilih" hint="Kosongkan untuk seluruh hari." className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => {
                    const on = form.weekdays?.includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            weekdays: on ? form.weekdays.filter((x: number) => x !== i) : [...(form.weekdays || []), i],
                          })
                        }
                        className={`chip ${on ? 'border-amber/50 bg-amber/15 text-amber' : 'border-line text-muted'}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Anggota yang dijadwalkan" className="sm:col-span-2">
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                  {(guards.data?.data || []).map((g: any) => {
                    const on = form.guardIds?.includes(g.id);
                    return (
                      <label key={g.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[.04]">
                        <input
                          type="checkbox"
                          checked={!!on}
                          onChange={() =>
                            setForm({
                              ...form,
                              guardIds: on
                                ? form.guardIds.filter((x: string) => x !== g.id)
                                : [...(form.guardIds || []), g.id],
                            })
                          }
                          className="!w-auto"
                        />
                        <Avatar name={g.name} url={g.avatarUrl} size={22} />
                        <span className="text-[13px] normal-case tracking-normal text-ink">{g.name}</span>
                        <span className="num ml-auto text-[10px] text-muted">{g.employeeId}</span>
                      </label>
                    );
                  })}
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label="Tanggal">
                <input type="date" className="w-full" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Anggota" className="sm:col-span-2">
                <Select value={form.guardId || ''} onChange={(e) => setForm({ ...form, guardId: e.target.value })}>
                  <option value="">Pilih anggota…</option>
                  {(guards.data?.data || []).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.name} — {g.employeeId}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
      </Modal>

      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={() => del && remove(del)}
        message="Hapus jadwal jaga ini? Presensi yang sudah tercatat tidak ikut terhapus."
        danger
        confirmLabel="Hapus"
      />
    </>
  );
}
