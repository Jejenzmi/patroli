import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Users, Gavel, Receipt, Save, FileSignature } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Input, Select, Table, Stat } from '../components/ui';
import { ask } from '../components/confirm';
import { d, num, rupiah } from '../lib/format';

const JENIS_DENDA: Record<string, string> = {
  POS_KOSONG: 'Pos kosong',
  MANGKIR: 'Mangkir',
  RONDE: 'Ronde tidak tuntas',
  INSIDEN: 'Insiden lewat SLA',
  LAINNYA: 'Lainnya',
};

const SATUAN_DENDA: Record<string, string> = {
  PER_KEJADIAN: 'per kejadian',
  PER_HARI_ORANG: 'per hari-orang',
  PERSEN_TAGIHAN: '% dari nilai pos',
};

export default function ContractDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { me } = useAuth();
  const admin = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');

  const [posOpen, setPosOpen] = useState(false);
  const [pos, setPos] = useState<any>({ headcount: 1 });
  const [dendaOpen, setDendaOpen] = useState(false);
  const [denda, setDenda] = useState<any>({ kind: 'POS_KOSONG', unit: 'PER_KEJADIAN', threshold: 0 });

  const { data: c, isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get(`/billing/contracts/${id}`),
  });
  const { data: sites } = useQuery({ queryKey: ['sites-ringkas'], queryFn: () => api.get('/master/sites') });
  const { data: shifts } = useQuery({
    queryKey: ['shifts-ringkas', pos.siteId],
    queryFn: () => api.get(`/master/shifts?siteId=${pos.siteId}`),
    enabled: !!pos.siteId,
  });
  const { data: grades } = useQuery({
    queryKey: ['pay-grades'],
    queryFn: () => api.get('/payroll/grades'),
    enabled: admin,
  });

  const segarkan = () => qc.invalidateQueries({ queryKey: ['contract', id] });
  const daftarSite = sites?.data || sites || [];

  const simpanPos = async () => {
    if (!pos.siteId || !pos.positionName || !pos.ratePerPerson)
      return toast.err('Site, nama pos, dan tarif per orang wajib diisi');
    if (!(await ask.create('pos kontrak', `${pos.positionName} — ${pos.headcount} orang`))) return;
    try {
      await api.post(`/billing/contracts/${id}/posts`, {
        siteId: pos.siteId,
        shiftId: pos.shiftId || null,
        positionName: pos.positionName,
        headcount: Number(pos.headcount),
        ratePerPerson: Number(pos.ratePerPerson),
        gradeId: pos.gradeId || null,
        note: pos.note,
      });
      toast.ok('Pos ditambahkan');
      setPosOpen(false);
      setPos({ headcount: 1 });
      segarkan();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const hapusPos = async (p: any) => {
    if (!(await ask.remove('pos kontrak', p.positionName))) return;
    await api.del(`/billing/posts/${p.id}`);
    segarkan();
  };

  const simpanDenda = async () => {
    if (!denda.description || !denda.amount) return toast.err('Uraian dan nilai denda wajib diisi');
    if (!(await ask.create('aturan denda', denda.description))) return;
    try {
      await api.post(`/billing/contracts/${id}/penalties`, {
        ...denda,
        amount: Number(denda.amount),
        threshold: Number(denda.threshold) || 0,
      });
      toast.ok('Aturan denda ditambahkan');
      setDendaOpen(false);
      setDenda({ kind: 'POS_KOSONG', unit: 'PER_KEJADIAN', threshold: 0 });
      segarkan();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  if (isLoading) return <Loading label="Memuat kontrak…" />;
  if (!c) return <Empty text="Kontrak tidak ditemukan" />;

  // Perbandingan tarif jasa dengan beban gaji golongan yang dipasang pada pos.
  const bebanKasar = (p: any) =>
    p.grade ? Math.round((p.grade.baseSalary + p.grade.positionAllowance) * 1.1024) : null;

  return (
    <>
      <PageHead crumb="Keuangan · Kontrak" title={c.number} desc={`${c.client?.name} · ${d(c.startDate)} – ${d(c.endDate)}`}>
        <Link to="/kontrak" className="btn-ghost btn-sm">
          <ArrowLeft size={14} /> Kembali
        </Link>
      </PageHead>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Nilai Kontrak / Bulan" value={rupiah(c.nilaiBulanan)} icon={FileSignature} tone="amber" />
        <Stat label="Pos Diperjanjikan" value={`${num(c.totalPos)} orang`} icon={Users} tone="cyan" />
        <Stat label="Aturan Denda" value={num(c.penalties?.length)} icon={Gavel} tone="danger" />
        <Stat label="Tagihan Terbit" value={num(c.invoices?.length)} icon={Receipt} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Manning Table"
          icon={Users}
          bodyClass="p-0"
          action={
            admin && (
              <button className="btn-primary btn-sm" onClick={() => setPosOpen(true)}>
                <Plus size={13} /> Pos
              </button>
            )
          }
        >
          {!c.posts?.length ? (
            <Empty text="Belum ada pos" hint="Pos menentukan jumlah orang yang wajib ada dan tarif yang ditagihkan" />
          ) : (
            <Table head={['Site', 'Pos', 'Shift', 'Orang', 'Tarif/Orang', 'Nilai', 'Beban Gaji', '']}>
              {c.posts.map((p: any) => {
                const beban = bebanKasar(p);
                const marginPct = beban ? Math.round(((p.ratePerPerson - beban) / p.ratePerPerson) * 1000) / 10 : null;
                return (
                  <tr key={p.id} className="transition hover:bg-white/[.025]">
                    <td className="text-[12.5px]">{p.site?.name}</td>
                    <td className="text-[13px] font-semibold">{p.positionName}</td>
                    <td className="text-[12px] text-muted">{p.shift?.name || 'semua shift'}</td>
                    <td className="num">{p.headcount}</td>
                    <td className="num">{rupiah(p.ratePerPerson)}</td>
                    <td className="num font-semibold">{rupiah(p.headcount * p.ratePerPerson)}</td>
                    <td className="num text-[12px] text-muted">
                      {beban ? (
                        <>
                          {rupiah(beban)}
                          <p className={marginPct !== null && marginPct < 15 ? 'text-danger' : 'text-emerald'}>
                            margin {marginPct}%
                          </p>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-right">
                      {admin && (
                        <button className="btn-ghost btn-sm" onClick={() => hapusPos(p)}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Aturan Denda SLA"
            icon={Gavel}
            bodyClass="p-0"
            action={
              admin && (
                <button className="btn-primary btn-sm" onClick={() => setDendaOpen(true)}>
                  <Plus size={13} /> Aturan
                </button>
              )
            }
          >
            {!c.penalties?.length ? (
              <Empty text="Belum ada aturan denda" />
            ) : (
              <div className="divide-y divide-line/60">
                {c.penalties.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-[13px] font-semibold">{p.description}</p>
                      <p className="text-[11px] text-muted">
                        {JENIS_DENDA[p.kind]} · {rupiah(p.amount)} {SATUAN_DENDA[p.unit]}
                        {p.threshold > 0 && ` · toleransi ${p.threshold}`}
                      </p>
                    </div>
                    {admin && (
                      <button
                        className="btn-ghost btn-sm"
                        onClick={async () => {
                          if (!(await ask.remove('aturan denda', p.description))) return;
                          await api.del(`/billing/penalties/${p.id}`);
                          segarkan();
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Tagihan Kontrak Ini" icon={Receipt} bodyClass="p-0">
            {!c.invoices?.length ? (
              <Empty text="Belum ada tagihan" />
            ) : (
              <div className="divide-y divide-line/60">
                {c.invoices.map((i: any) => (
                  <Link key={i.id} to={`/tagihan/${i.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-white/[.025]">
                    <div>
                      <p className="num text-[12.5px] font-semibold text-amber">{i.number}</p>
                      <p className="text-[11px] text-muted">
                        {i.period} · jatuh tempo {d(i.dueDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-[13px] font-semibold">{rupiah(i.total)}</p>
                      <p className="text-[10.5px] text-muted">{i.status}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        open={posOpen}
        onClose={() => setPosOpen(false)}
        title="Pos Kontrak Baru"
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPosOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={simpanPos}>
              <Save size={14} /> Simpan
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site">
            <Select value={pos.siteId || ''} onChange={(e) => setPos({ ...pos, siteId: e.target.value, shiftId: '' })}>
              <option value="">— pilih site —</option>
              {daftarSite.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shift" hint="Kosongkan bila pos tidak terikat shift tertentu">
            <Select value={pos.shiftId || ''} onChange={(e) => setPos({ ...pos, shiftId: e.target.value })}>
              <option value="">— semua shift —</option>
              {(shifts || []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.startTime}–{s.endTime})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nama pos">
            <Input value={pos.positionName || ''} onChange={(e) => setPos({ ...pos, positionName: e.target.value })} placeholder="Anggota Pos Utama" />
          </Field>
          <Field label="Jumlah orang">
            <Input type="number" value={pos.headcount} onChange={(e) => setPos({ ...pos, headcount: e.target.value })} />
          </Field>
          <Field label="Tarif jasa per orang / bulan">
            <Input type="number" value={pos.ratePerPerson || ''} onChange={(e) => setPos({ ...pos, ratePerPerson: e.target.value })} />
          </Field>
          <Field label="Golongan upah" hint="Dipakai untuk membandingkan tarif dengan beban gaji">
            <Select value={pos.gradeId || ''} onChange={(e) => setPos({ ...pos, gradeId: e.target.value })}>
              <option value="">— tidak dikaitkan —</option>
              {(grades || []).map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={dendaOpen}
        onClose={() => setDendaOpen(false)}
        title="Aturan Denda SLA"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDendaOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={simpanDenda}>
              <Save size={14} /> Simpan
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Jenis pelanggaran" hint="Jumlah kejadian dihitung otomatis dari data operasional">
            <Select value={denda.kind} onChange={(e) => setDenda({ ...denda, kind: e.target.value })}>
              {Object.entries(JENIS_DENDA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Uraian pada tagihan">
            <Input value={denda.description || ''} onChange={(e) => setDenda({ ...denda, description: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nilai">
              <Input type="number" value={denda.amount || ''} onChange={(e) => setDenda({ ...denda, amount: e.target.value })} />
            </Field>
            <Field label="Satuan">
              <Select value={denda.unit} onChange={(e) => setDenda({ ...denda, unit: e.target.value })}>
                {Object.entries(SATUAN_DENDA).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Toleransi" hint="Kejadian yang dimaafkan">
              <Input type="number" value={denda.threshold} onChange={(e) => setDenda({ ...denda, threshold: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
