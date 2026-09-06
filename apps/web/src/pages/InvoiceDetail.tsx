import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Plus, Trash2, Wallet, Ban, Receipt, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { Panel, PageHead, Loading, Empty, Modal, Field, Input, Select, Table } from '../components/ui';
import { ask } from '../components/confirm';
import { d, dt, num, rupiah } from '../lib/format';

const STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: 'Draf', tone: 'text-muted border-line bg-white/5' },
  TERKIRIM: { label: 'Terkirim', tone: 'text-cyan border-cyan/40 bg-cyan/10' },
  SEBAGIAN: { label: 'Dibayar Sebagian', tone: 'text-amber border-amber/40 bg-amber/10' },
  LUNAS: { label: 'Lunas', tone: 'text-emerald border-emerald/40 bg-emerald/10' },
  BATAL: { label: 'Batal', tone: 'text-danger border-danger/40 bg-danger/10' },
};

const KIND: Record<string, string> = {
  POS: 'Pos terpasang',
  TAMBAHAN: 'Tambahan',
  POTONGAN: 'Potongan',
  DENDA: 'Denda SLA',
};

export default function InvoiceDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { me } = useAuth();
  const admin = ['SUPER_ADMIN', 'ADMIN'].includes(me?.role || '');

  const [barisOpen, setBarisOpen] = useState(false);
  const [baris, setBaris] = useState<any>({ kind: 'TAMBAHAN', qty: 1 });
  const [bayarOpen, setBayarOpen] = useState(false);
  const [bayar, setBayar] = useState<any>({ method: 'TRANSFER', date: new Date().toISOString().slice(0, 10) });

  const { data: inv, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/billing/invoices/${id}`),
  });

  const segarkan = () => {
    qc.invalidateQueries({ queryKey: ['invoice', id] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['piutang'] });
  };

  const kirim = async () => {
    if (
      !(await ask.action(
        'Kirim tagihan ke klien?',
        'Tagihan berpindah dari draf menjadi terkirim, tampil di portal klien, dan wakil klien menerima notifikasi. Baris tagihan masih dapat disesuaikan sampai lunas.',
        'Ya, kirim'
      ))
    )
      return;
    try {
      await api.post(`/billing/invoices/${id}/kirim`);
      toast.ok('Tagihan terkirim');
      segarkan();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const batalkan = async () => {
    if (!(await ask.action('Batalkan tagihan ini?', 'Tagihan ditandai batal dan tidak lagi dihitung sebagai piutang.', 'Ya, batalkan'))) return;
    try {
      await api.post(`/billing/invoices/${id}/batal`);
      toast.ok('Tagihan dibatalkan');
      segarkan();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const simpanBaris = async () => {
    if (!baris.description || !baris.unitPrice) return toast.err('Uraian dan harga wajib diisi');
    try {
      await api.post(`/billing/invoices/${id}/lines`, {
        kind: baris.kind,
        siteId: baris.siteId || null,
        description: baris.description,
        qty: Number(baris.qty) || 1,
        unit: baris.unit,
        unitPrice: Number(baris.unitPrice),
      });
      toast.ok('Baris ditambahkan');
      setBarisOpen(false);
      setBaris({ kind: 'TAMBAHAN', qty: 1 });
      segarkan();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  const simpanBayar = async () => {
    if (!bayar.amount) return toast.err('Jumlah pembayaran wajib diisi');
    if (!(await ask.create('pembayaran', rupiah(Number(bayar.amount))))) return;
    try {
      await api.post(`/billing/invoices/${id}/pembayaran`, { ...bayar, amount: Number(bayar.amount) });
      toast.ok('Pembayaran dicatat');
      setBayarOpen(false);
      setBayar({ method: 'TRANSFER', date: new Date().toISOString().slice(0, 10) });
      segarkan();
    } catch (e: any) {
      toast.err('Gagal', e.message);
    }
  };

  if (isLoading) return <Loading label="Memuat tagihan…" />;
  if (!inv) return <Empty text="Tagihan tidak ditemukan" />;

  const target = inv.contract?.pph23Dipotong ? inv.netReceivable : inv.total;
  const sisa = target - inv.paidTotal;

  return (
    <>
      <PageHead
        className="tanpa-cetak"
        crumb="Keuangan · Tagihan"
        title={inv.number}
        desc={`${inv.client?.name} · periode ${inv.period} · terbit ${d(inv.issueDate)} · jatuh tempo ${d(inv.dueDate)}`}
      >
        <Link to="/tagihan" className="btn-ghost btn-sm">
          <ArrowLeft size={14} /> Kembali
        </Link>
        <button className="btn-ghost btn-sm" onClick={() => window.print()}>
          <Printer size={14} /> Cetak
        </button>
        {admin && inv.status === 'DRAFT' && (
          <button className="btn-primary btn-sm" onClick={kirim}>
            <Send size={14} /> Kirim ke Klien
          </button>
        )}
        {admin && ['TERKIRIM', 'SEBAGIAN'].includes(inv.status) && (
          <button className="btn-primary btn-sm" onClick={() => setBayarOpen(true)}>
            <Wallet size={14} /> Catat Pembayaran
          </button>
        )}
        {admin && ['DRAFT', 'TERKIRIM'].includes(inv.status) && !inv.payments?.length && (
          <button className="btn-ghost btn-sm" onClick={batalkan}>
            <Ban size={14} /> Batalkan
          </button>
        )}
      </PageHead>

      <LembarTagihan inv={inv} />

      <div className="tanpa-cetak mb-4 flex flex-wrap items-center gap-2">
        <span className={`chip ${STATUS[inv.status]?.tone}`}>{STATUS[inv.status]?.label}</span>
        {inv.sentAt && <span className="text-[11.5px] text-muted">Dikirim {dt(inv.sentAt)}</span>}
        {inv.taxInvoiceNo && <span className="num text-[11.5px] text-muted">Faktur pajak {inv.taxInvoiceNo}</span>}
      </div>

      <div className="tanpa-cetak grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Rincian Tagihan"
          icon={Receipt}
          bodyClass="p-0"
          action={
            admin &&
            inv.status !== 'LUNAS' &&
            inv.status !== 'BATAL' && (
              <button className="btn-ghost btn-sm" onClick={() => setBarisOpen(true)}>
                <Plus size={13} /> Baris
              </button>
            )
          }
        >
          <Table head={['Uraian', 'Jenis', 'Qty', 'Harga Satuan', 'Jumlah', '']}>
            {inv.lines.map((l: any) => (
              <tr key={l.id} className="transition hover:bg-white/[.025]">
                <td className="text-[12.5px]">
                  {l.description}
                  {l.meta?.hariOrangKosong ? (
                    <p className="text-[10.5px] text-danger">
                      {l.meta.hariOrangTerisi}/{l.meta.kontrakHariOrang} hari-orang terisi
                    </p>
                  ) : l.meta?.kejadian ? (
                    <p className="text-[10.5px] text-danger">
                      {l.meta.kejadian} kejadian di luar toleransi {l.meta.toleransi}
                    </p>
                  ) : l.site?.name ? (
                    <p className="text-[10.5px] text-muted">{l.site.name}</p>
                  ) : null}
                </td>
                <td className="text-[11.5px] text-muted">{KIND[l.kind]}</td>
                <td className="num text-[12px]">
                  {num(l.qty)} {l.unit}
                </td>
                <td className="num text-[12px]">{rupiah(l.unitPrice)}</td>
                <td className={`num font-semibold ${l.amount < 0 ? 'text-danger' : ''}`}>{rupiah(l.amount)}</td>
                <td className="text-right">
                  {admin && l.kind !== 'POS' && inv.status !== 'LUNAS' && inv.status !== 'BATAL' && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={async () => {
                        if (!(await ask.remove('baris tagihan', l.description))) return;
                        await api.del(`/billing/invoices/${id}/lines/${l.id}`);
                        segarkan();
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Panel>

        <div className="space-y-4">
          <Panel title="Ringkasan Nilai" icon={Wallet}>
            <div className="space-y-1.5 text-[12.5px]">
              {[
                ['Nilai pos terpasang', inv.subtotal],
                ['Potongan pos kosong', inv.deductionTotal],
                ['Denda SLA', inv.penaltyTotal],
                ['Tambahan', inv.additionTotal],
                ['Management fee', inv.managementFee],
                ['DPP', inv.dpp],
                [`PPN ${inv.contract?.ppnPct}%`, inv.ppn],
              ].map(([l, v]: any) => (
                <div key={l} className="flex justify-between border-b border-line/50 py-1 last:border-0">
                  <span className="text-muted">{l}</span>
                  <span className={`num font-semibold ${v < 0 ? 'text-danger' : ''}`}>{rupiah(v)}</span>
                </div>
              ))}
              <div className="flex justify-between rounded-xl border border-amber/30 bg-amber/[.07] px-3 py-2">
                <span className="font-bold text-amber">Total tagihan</span>
                <span className="num font-extrabold text-amber">{rupiah(inv.total)}</span>
              </div>
              {inv.contract?.pph23Dipotong && (
                <div className="flex justify-between py-1">
                  <span className="text-muted">PPh 23 {inv.contract?.pph23Pct}% dipotong klien</span>
                  <span className="num font-semibold text-danger">{rupiah(-inv.pph23)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-muted">Yang harus diterima</span>
                <span className="num font-semibold">{rupiah(target)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Sudah dibayar</span>
                <span className="num font-semibold text-emerald">{rupiah(inv.paidTotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">Sisa</span>
                <span className={`num font-bold ${sisa > 0 ? 'text-danger' : 'text-emerald'}`}>{rupiah(sisa)}</span>
              </div>
            </div>
          </Panel>

          <Panel title="Pembayaran Diterima" icon={Wallet} bodyClass="p-0">
            {!inv.payments?.length ? (
              <Empty text="Belum ada pembayaran" />
            ) : (
              <div className="divide-y divide-line/60">
                {inv.payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="num text-[13px] font-semibold text-emerald">{rupiah(p.amount)}</p>
                      <p className="text-[11px] text-muted">
                        {d(p.date)} · {p.method} {p.ref ? `· ${p.ref}` : ''}
                      </p>
                    </div>
                    {admin && (
                      <button
                        className="btn-ghost btn-sm"
                        onClick={async () => {
                          if (!(await ask.remove('catatan pembayaran', rupiah(p.amount)))) return;
                          await api.del(`/billing/pembayaran/${p.id}`);
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
        </div>
      </div>

      <Modal
        open={barisOpen}
        onClose={() => setBarisOpen(false)}
        title="Baris Tagihan Tambahan"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setBarisOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={simpanBaris}>
              Simpan
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Jenis baris">
            <Select value={baris.kind} onChange={(e) => setBaris({ ...baris, kind: e.target.value })}>
              <option value="TAMBAHAN">Tambahan (menambah tagihan)</option>
              <option value="POTONGAN">Potongan (mengurangi tagihan)</option>
              <option value="DENDA">Denda SLA manual</option>
            </Select>
          </Field>
          <Field label="Uraian">
            <Input
              value={baris.description || ''}
              onChange={(e) => setBaris({ ...baris, description: e.target.value })}
              placeholder="Tenaga tambahan acara HUT perusahaan"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Jumlah">
              <Input type="number" value={baris.qty} onChange={(e) => setBaris({ ...baris, qty: e.target.value })} />
            </Field>
            <Field label="Satuan">
              <Input value={baris.unit || ''} onChange={(e) => setBaris({ ...baris, unit: e.target.value })} placeholder="hari-orang" />
            </Field>
            <Field label="Harga satuan">
              <Input type="number" value={baris.unitPrice || ''} onChange={(e) => setBaris({ ...baris, unitPrice: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={bayarOpen}
        onClose={() => setBayarOpen(false)}
        title="Catat Pembayaran"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setBayarOpen(false)}>
              Batal
            </button>
            <button className="btn-primary" onClick={simpanBayar}>
              Simpan
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal terima">
              <Input type="date" value={bayar.date} onChange={(e) => setBayar({ ...bayar, date: e.target.value })} />
            </Field>
            <Field label="Jumlah" hint={`Sisa tagihan ${rupiah(sisa)}`}>
              <Input type="number" value={bayar.amount || ''} onChange={(e) => setBayar({ ...bayar, amount: e.target.value })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cara bayar">
              <Select value={bayar.method} onChange={(e) => setBayar({ ...bayar, method: e.target.value })}>
                <option value="TRANSFER">Transfer bank</option>
                <option value="GIRO">Giro</option>
                <option value="TUNAI">Tunai</option>
              </Select>
            </Field>
            <Field label="Nomor bukti">
              <Input value={bayar.ref || ''} onChange={(e) => setBayar({ ...bayar, ref: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}

/**
 * Lembar tagihan yang tercetak di atas kertas.
 *
 * Hanya tampil saat mencetak: di layar, rinciannya sudah disajikan panel
 * biasa. Isinya sengaja lengkap sebagai dokumen komersial — kop penerbit,
 * NPWP, nilai dalam huruf, keterangan rekening, dan ruang tanda tangan —
 * karena tagihan yang dikirim ke pengguna jasa akan diarsipkan bagian
 * keuangan mereka, bukan sekadar dibaca di layar.
 */
function LembarTagihan({ inv }: { inv: any }) {
  const p = inv.penerbit || {};
  const potongPph = !!inv.contract?.pph23Dipotong;
  const tagihan = potongPph ? inv.netReceivable : inv.total;

  const baris = (label: string, nilai: number, tebal = false) => (
    <tr>
      <td colSpan={4} style={{ textAlign: 'right', fontWeight: tebal ? 700 : 400 }}>
        {label}
      </td>
      <td className="angka" style={{ fontWeight: tebal ? 700 : 400 }}>
        {rupiah(nilai)}
      </td>
    </tr>
  );

  return (
    <div className="hanya-cetak lembar-cetak">
      {/* Kop penerbit */}
      <div style={{ borderBottom: '2px solid #111', paddingBottom: 10, marginBottom: 18 }}>
        <div style={{ fontSize: '15pt', fontWeight: 800, letterSpacing: '.02em' }}>{p.nama}</div>
        {p.alamat && <div style={{ fontSize: '9.5pt', marginTop: 3 }}>{p.alamat}</div>}
        <div style={{ fontSize: '9.5pt' }}>
          {[p.telepon && `Telp. ${p.telepon}`, p.email, p.npwp && `NPWP ${p.npwp}`]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '13pt', fontWeight: 800, letterSpacing: '.14em' }}>FAKTUR TAGIHAN</div>
        <div className="num" style={{ fontSize: '10pt' }}>
          Nomor {inv.number}
        </div>
      </div>

      <table style={{ border: 'none', marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ border: 'none', width: '50%', verticalAlign: 'top', padding: 0 }}>
              <div style={{ fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '.1em' }}>Kepada</div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{inv.client?.name}</div>
              {inv.client?.address && <div style={{ fontSize: '9.5pt' }}>{inv.client.address}</div>}
              {inv.client?.contactName && (
                <div style={{ fontSize: '9.5pt' }}>u.p. {inv.client.contactName}</div>
              )}
            </td>
            <td style={{ border: 'none', verticalAlign: 'top', padding: 0, fontSize: '9.5pt' }}>
              <div>Periode layanan : {inv.period}</div>
              <div>Tanggal terbit : {d(inv.issueDate)}</div>
              <div>Jatuh tempo : {d(inv.dueDate)}</div>
              {inv.contract?.number && <div>Kontrak : {inv.contract.number}</div>}
              {inv.taxInvoiceNo && <div>Faktur pajak : {inv.taxInvoiceNo}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>No</th>
            <th>Uraian</th>
            <th style={{ width: '10%' }}>Qty</th>
            <th style={{ width: '18%' }}>Harga Satuan</th>
            <th style={{ width: '20%' }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l: any, i: number) => (
            <tr key={l.id}>
              <td className="angka">{i + 1}</td>
              <td>
                {l.description}
                {l.site?.name && <div style={{ fontSize: '9pt' }}>{l.site.name}</div>}
              </td>
              <td className="angka">
                {num(l.qty)} {l.unit || ''}
              </td>
              <td className="angka">{rupiah(l.unitPrice)}</td>
              <td className="angka">{rupiah(l.amount)}</td>
            </tr>
          ))}

          {baris('Jumlah pos terpasang', inv.subtotal)}
          {inv.deductionTotal !== 0 && baris('Potongan pos kosong', inv.deductionTotal)}
          {inv.penaltyTotal !== 0 && baris('Denda SLA', inv.penaltyTotal)}
          {inv.additionTotal !== 0 && baris('Tambahan', inv.additionTotal)}
          {inv.managementFee !== 0 && baris('Management fee', inv.managementFee)}
          {baris('Dasar pengenaan pajak', inv.dpp, true)}
          {inv.ppn !== 0 && baris(`PPN ${num(inv.contract?.ppnPct ?? 11)}%`, inv.ppn)}
          {baris('Total tagihan', inv.total, true)}
          {potongPph && baris(`PPh 23 ${num(inv.contract?.pph23Pct ?? 2)}% (dipotong pemberi kerja)`, -inv.pph23)}
          {potongPph && baris('Jumlah yang ditransfer', inv.netReceivable, true)}
        </tbody>
      </table>

      <div className="utuh" style={{ marginTop: 14, fontSize: '10pt' }}>
        <b>Terbilang:</b> <i>{inv.terbilang}</i>
      </div>

      {(p.bank || p.rekening) && (
        <div className="utuh" style={{ marginTop: 14, fontSize: '10pt' }}>
          <b>Pembayaran ditujukan ke:</b>
          <div>
            {[p.bank, p.rekening, p.atasNama && `a.n. ${p.atasNama}`].filter(Boolean).join('  ·  ')}
          </div>
        </div>
      )}

      {p.catatanKaki && (
        <div style={{ marginTop: 10, fontSize: '9.5pt', fontStyle: 'italic' }}>{p.catatanKaki}</div>
      )}

      <div className="utuh" style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'center', minWidth: 230 }}>
          <div style={{ fontSize: '10pt' }}>
            {p.kota ? `${p.kota}, ` : ''}
            {d(inv.issueDate)}
          </div>
          <div style={{ fontSize: '10pt' }}>{p.nama}</div>
          <div style={{ height: 68 }} />
          <div style={{ fontWeight: 700, borderTop: '1px solid #111', paddingTop: 4 }}>
            {p.penandaTangan || ' '}
          </div>
          {p.jabatan && <div style={{ fontSize: '9.5pt' }}>{p.jabatan}</div>}
        </div>
      </div>
    </div>
  );
}
