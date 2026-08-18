import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Check, X, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Select, Textarea, Avatar, Stat, Table } from '../components/ui';
import { ask } from '../components/confirm';
import { d, dt, num } from '../lib/format';

const JENIS: Record<string, string> = { CUTI: 'Cuti', IZIN: 'Izin', LEMBUR: 'Lembur' };
const STATUS: Record<string, { label: string; tone: string }> = {
  DIAJUKAN: { label: 'Menunggu', tone: 'text-amber border-amber/40 bg-amber/10' },
  DISETUJUI: { label: 'Disetujui', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
  DITOLAK: { label: 'Ditolak', tone: 'text-danger border-danger/40 bg-danger/10' },
};

export default function Leaves() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const bolehMemutus = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(me?.role || '');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ type: 'CUTI' });

  const { data, isLoading } = useQuery({ queryKey: ['leaves'], queryFn: () => api.get('/tasks/leaves/list') });

  const ajukan = async () => {
    if (!form.startDate || !form.endDate || !form.reason) return toast.err('Tanggal dan alasan wajib diisi');
    if (!(await ask.create('pengajuan', `${JENIS[form.type]} ${form.startDate} s.d. ${form.endDate}`))) return;
    try {
      await api.post('/tasks/leaves', { ...form, hours: form.hours ? Number(form.hours) : undefined });
      toast.ok('Pengajuan terkirim', 'Menunggu persetujuan pengawas');
      setOpen(false);
      setForm({ type: 'CUTI' });
      qc.invalidateQueries({ queryKey: ['leaves'] });
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const putuskan = async (l: any, status: 'DISETUJUI' | 'DITOLAK') => {
    const ok = await ask.action(
      status === 'DISETUJUI' ? 'Setujui pengajuan ini?' : 'Tolak pengajuan ini?',
      status === 'DISETUJUI'
        ? 'Pemohon akan menerima notifikasi bahwa pengajuannya disetujui.'
        : 'Pemohon akan menerima notifikasi penolakan beserta catatan Anda.',
      status === 'DISETUJUI' ? 'Ya, setujui' : 'Ya, tolak',
      `${l.user?.name} — ${JENIS[l.type]}`
    );
    if (!ok) return;
    await api.post(`/tasks/leaves/${l.id}/decide`, { status });
    toast.ok(`Pengajuan ${status.toLowerCase()}`);
    qc.invalidateQueries({ queryKey: ['leaves'] });
  };

  const rows = data || [];

  return (
    <>
      <PageHead crumb="Personel" title="Cuti, Izin & Lembur" desc="Pengajuan anggota beserta persetujuan pengawas.">
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Ajukan
        </button>
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Menunggu Keputusan" value={num(rows.filter((r: any) => r.status === 'DIAJUKAN').length)} icon={Clock} tone="amber" />
        <Stat label="Disetujui" value={num(rows.filter((r: any) => r.status === 'DISETUJUI').length)} icon={Check} tone="emerald" />
        <Stat label="Ditolak" value={num(rows.filter((r: any) => r.status === 'DITOLAK').length)} icon={X} tone="danger" />
      </div>

      <Panel title="Daftar Pengajuan" icon={CalendarClock} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada pengajuan" />
        ) : (
          <Table head={['Pemohon', 'Jenis', 'Periode', 'Alasan', 'Status', 'Penyetuju', '']}>
            {rows.map((l: any) => (
              <tr key={l.id} className="transition hover:bg-white/[.025]">
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={l.user?.name} url={l.user?.avatarUrl} size={30} />
                    <div>
                      <p className="text-[13px] font-semibold">{l.user?.name}</p>
                      <p className="num text-[10.5px] text-muted">{l.user?.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="chip border-cyan/40 bg-cyan/10 text-cyan">{JENIS[l.type]}</span>
                  {l.hours && <p className="num mt-1 text-[10.5px] text-muted">{l.hours} jam</p>}
                </td>
                <td className="num text-[12.5px]">
                  {d(l.startDate)}
                  {l.startDate !== l.endDate && <> – {d(l.endDate)}</>}
                </td>
                <td className="max-w-[240px] text-[12.5px]">
                  {l.reason}
                  {l.decisionNote && <p className="mt-1 text-[11px] text-danger">Catatan: {l.decisionNote}</p>}
                </td>
                <td><span className={`chip ${STATUS[l.status]?.tone}`}>{STATUS[l.status]?.label}</span></td>
                <td className="text-[12px] text-muted">
                  {l.approver?.name || '—'}
                  {l.decidedAt && <p className="num text-[10px]">{dt(l.decidedAt)}</p>}
                </td>
                <td className="text-right">
                  {bolehMemutus && l.status === 'DIAJUKAN' && (
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-ghost btn-sm" onClick={() => putuskan(l, 'DISETUJUI')}>
                        <Check size={12} /> Setujui
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => putuskan(l, 'DITOLAK')}>
                        <X size={12} /> Tolak
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Pengajuan Cuti / Izin / Lembur"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>Batal</button>
            <button className="btn-primary" onClick={ajukan}>Kirim Pengajuan</button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Jenis pengajuan">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal mulai">
              <input type="date" className="w-full" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="Tanggal selesai">
              <input type="date" className="w-full" value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          {form.type === 'LEMBUR' && (
            <Field label="Jumlah jam lembur">
              <input type="number" step="0.5" className="w-full" value={form.hours || ''} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            </Field>
          )}
          <Field label="Alasan">
            <Textarea value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Jelaskan keperluan secara singkat…" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
