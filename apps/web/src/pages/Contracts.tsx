import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileSignature, Plus, Save, AlarmClock, Users, Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Input, Select, Table, Stat } from '../components/ui';
import { ask } from '../components/confirm';
import { d, num, rupiah } from '../lib/format';

const STATUS: Record<string, string> = {
  DRAF: 'text-muted border-line bg-white/5',
  AKTIF: 'text-emerald border-emerald/40 bg-emerald/10',
  SELESAI: 'text-cyan border-cyan/40 bg-cyan/10',
  BATAL: 'text-danger border-danger/40 bg-danger/10',
};

export default function Contracts() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const admin = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    billingDay: 5,
    dueDays: 14,
    ppnPct: 11,
    pph23Pct: 2,
    pph23Dipotong: true,
    managementFeePct: 0,
    penaltyCapPct: 10,
    status: 'AKTIF',
  });

  const { data, isLoading } = useQuery({ queryKey: ['contracts'], queryFn: () => api.get('/billing/contracts') });
  const { data: klien } = useQuery({ queryKey: ['clients-ringkas'], queryFn: () => api.get('/master/clients') });
  const { data: dekat } = useQuery({
    queryKey: ['contracts-due'],
    queryFn: () => api.get('/billing/contracts-jatuh-tempo?hari=90'),
    enabled: admin,
  });

  const rows = data || [];
  const daftarKlien = klien?.data || klien || [];

  const simpan = async () => {
    if (!form.clientId || !form.number || !form.startDate || !form.endDate)
      return toast.err('Klien, nomor kontrak, dan masa berlaku wajib diisi');
    if (!(await ask.create('kontrak', form.number))) return;
    try {
      await api.post('/billing/contracts', {
        ...form,
        billingDay: Number(form.billingDay),
        dueDays: Number(form.dueDays),
        ppnPct: Number(form.ppnPct),
        pph23Pct: Number(form.pph23Pct),
        managementFeePct: Number(form.managementFeePct),
        penaltyCapPct: Number(form.penaltyCapPct),
      });
      toast.ok('Kontrak dibuat', 'Lanjutkan dengan menyusun manning table');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['contracts'] });
    } catch (e: any) {
      toast.err('Gagal menyimpan', e.message);
    }
  };

  const nilaiTotal = rows.reduce((a: number, c: any) => a + (c.status === 'AKTIF' ? c.nilaiBulanan : 0), 0);
  const posTotal = rows.reduce((a: number, c: any) => a + (c.status === 'AKTIF' ? c.totalPos : 0), 0);

  return (
    <>
      <PageHead
        crumb="Keuangan"
        title="Kontrak & Manning Table"
        desc="Susunan pos yang diperjanjikan tiap site — menjadi acuan roster sekaligus dasar tagihan bulanan."
      >
        {admin && (
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Plus size={14} /> Kontrak Baru
          </button>
        )}
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Kontrak Aktif" value={num(rows.filter((c: any) => c.status === 'AKTIF').length)} icon={FileSignature} tone="amber" />
        <Stat label="Nilai Kontrak / Bulan" value={rupiah(nilaiTotal)} icon={Building2} tone="emerald" />
        <Stat label="Pos Diperjanjikan" value={`${num(posTotal)} orang`} icon={Users} tone="cyan" />
      </div>

      {admin && !!dekat?.length && (
        <Panel title="Mendekati Berakhir" icon={AlarmClock} className="mb-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dekat.map((c: any) => (
              <Link
                key={c.id}
                to={`/kontrak/${c.id}`}
                className={`rounded-xl border p-3 transition hover:border-amber/50 ${
                  c.sisaHari <= 30 ? 'border-danger/40 bg-danger/[.07]' : 'border-line bg-panel2/40'
                }`}
              >
                <p className="text-[13px] font-semibold">{c.client}</p>
                <p className="num text-[11px] text-muted">{c.number}</p>
                <p className={`mt-1.5 text-[12px] font-semibold ${c.sisaHari <= 30 ? 'text-danger' : 'text-amber'}`}>
                  {c.sisaHari < 0 ? `Lewat ${Math.abs(c.sisaHari)} hari` : `Sisa ${c.sisaHari} hari`} · berakhir {d(c.endDate)}
                </p>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Daftar Kontrak" icon={FileSignature} bodyClass="p-0">
        {isLoading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty text="Belum ada kontrak" hint="Kontrak menghubungkan klien, pos, tarif, dan aturan denda SLA" />
        ) : (
          <Table head={['Nomor', 'Klien', 'Masa Berlaku', 'Pos', 'Nilai / Bulan', 'PPN', 'Tagihan', 'Status', '']}>
            {rows.map((c: any) => (
              <tr key={c.id} className="transition hover:bg-white/[.025]">
                <td>
                  <Link to={`/kontrak/${c.id}`} className="num text-[12.5px] font-semibold text-amber hover:underline">
                    {c.number}
                  </Link>
                  <p className="text-[10.5px] text-muted">{c.title}</p>
                </td>
                <td className="text-[13px]">{c.client?.name}</td>
                <td className="num text-[12px]">
                  {d(c.startDate)} – {d(c.endDate)}
                  {c.status === 'AKTIF' && (
                    <p className={`text-[10.5px] ${c.sisaHari <= 30 ? 'text-danger' : 'text-muted'}`}>
                      sisa {c.sisaHari} hari
                    </p>
                  )}
                </td>
                <td className="num">{num(c.totalPos)}</td>
                <td className="num font-semibold">{rupiah(c.nilaiBulanan)}</td>
                <td className="num text-[12px] text-muted">{c.ppnPct}%</td>
                <td className="num text-[12px]">{num(c._count?.invoices)}</td>
                <td>
                  <span className={`chip ${STATUS[c.status]}`}>{c.status}</span>
                </td>
                <td className="text-right">
                  <Link to={`/kontrak/${c.id}`} className="btn-ghost btn-sm">
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
        onClose={() => setOpen(false)}
        title="Kontrak Baru"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={simpan}>
              <Save size={14} /> Simpan
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Klien">
            <Select value={form.clientId || ''} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">— pilih klien —</option>
              {daftarKlien.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nomor kontrak">
            <Input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="KTR/ABC/2026" />
          </Field>
          <Field label="Judul pekerjaan" className="sm:col-span-2">
            <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Jasa Pengamanan — PT ABC" />
          </Field>
          <Field label="Mulai">
            <Input type="date" value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Berakhir">
            <Input type="date" value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
          <Field label="Tanggal terbit tagihan" hint="Tiap bulan pada tanggal ini">
            <Input type="number" value={form.billingDay} onChange={(e) => setForm({ ...form, billingDay: e.target.value })} />
          </Field>
          <Field label="Termin pembayaran (hari)">
            <Input type="number" value={form.dueDays} onChange={(e) => setForm({ ...form, dueDays: e.target.value })} />
          </Field>
          <Field label="Management fee (%)" hint="Isi 0 bila fee sudah termasuk dalam tarif pos">
            <Input type="number" step="0.1" value={form.managementFeePct} onChange={(e) => setForm({ ...form, managementFeePct: e.target.value })} />
          </Field>
          <Field label="Batas denda SLA (%)" hint="Denda sebulan tidak akan melampaui persentase ini dari nilai pos">
            <Input type="number" step="0.5" value={form.penaltyCapPct} onChange={(e) => setForm({ ...form, penaltyCapPct: e.target.value })} />
          </Field>
          <Field label="PPN (%)">
            <Input type="number" step="0.1" value={form.ppnPct} onChange={(e) => setForm({ ...form, ppnPct: e.target.value })} />
          </Field>
          <Field label="PPh 23 (%)" hint="Jasa keamanan lazimnya dipotong 2% oleh klien">
            <Input type="number" step="0.1" value={form.pph23Pct} onChange={(e) => setForm({ ...form, pph23Pct: e.target.value })} />
          </Field>
          <Field label="Pemotongan PPh 23">
            <label className="flex items-center gap-2 pt-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={form.pph23Dipotong}
                onChange={(e) => setForm({ ...form, pph23Dipotong: e.target.checked })}
              />
              Klien memotong PPh 23 saat membayar
            </label>
          </Field>
        </div>
      </Modal>
    </>
  );
}
