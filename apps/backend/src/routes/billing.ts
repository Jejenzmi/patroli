import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND, ADMIN_ONLY } from '../middleware/auth';
import { dayjs, TZ } from '../lib/time';
import { audit, notifyUsers } from '../lib/notify';
import { rp, terbilangRupiah } from '../lib/uang';
import { parsePaging } from '../lib/scope';
import { rekonsiliasi, hitungTotal, nomorTagihanBaru, type BarisTagihan } from '../lib/tagihan';

const router = Router();
router.use(auth);

/**
 * Kontrak, manning table, dan penagihan.
 *
 * ADMIN mengelola; KLIEN hanya boleh membaca kontrak dan tagihan miliknya
 * sendiri — termasuk rincian pos kosong, supaya angka potongan tidak perlu
 * diperdebatkan lewat surat.
 */

const KELOLA = ADMIN_ONLY;
const periodeSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Periode harus YYYY-MM');

/** Klien hanya melihat miliknya sendiri. */
function batasKlien(req: any) {
  return req.user.role === 'CLIENT' ? { clientId: req.user.clientId ?? '-' } : {};
}

/* ═══════════════ KONTRAK ═══════════════ */

const kontrakSchema = z.object({
  clientId: z.string(),
  number: z.string().min(3),
  title: z.string().optional().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  billingDay: z.number().int().min(1).max(28).default(1),
  dueDays: z.number().int().min(0).max(120).default(14),
  managementFeePct: z.number().min(0).max(100).default(0),
  penaltyCapPct: z.number().min(0).max(100).default(10),
  ppnPct: z.number().min(0).max(100).default(11),
  pph23Pct: z.number().min(0).max(100).default(2),
  pph23Dipotong: z.boolean().default(true),
  status: z.enum(['DRAF', 'AKTIF', 'SELESAI', 'BATAL']).default('AKTIF'),
  note: z.string().optional().nullable(),
});

router.get('/contracts', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const rows = await prisma.contract.findMany({
    where: { ...batasKlien(req), ...(req.query.status ? { status: req.query.status as any } : {}) },
    include: {
      client: { select: { id: true, name: true, code: true } },
      posts: { select: { id: true, headcount: true, ratePerPerson: true, siteId: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: { endDate: 'asc' },
  });
  // Supervisor perlu tahu susunan pos untuk menyusun roster, tetapi tarif dan
  // nilai kontrak adalah urusan komersial — angkanya tidak ikut dikirim.
  const komersial = KELOLA.includes(req.user!.role) || req.user!.role === 'CLIENT';

  res.json(
    rows.map((c) => ({
      ...c,
      posts: komersial ? c.posts : c.posts.map(({ ratePerPerson, ...p }) => p),
      ...(komersial
        ? { nilaiBulanan: rp(c.posts.reduce((a, p) => a + p.headcount * p.ratePerPerson, 0)) }
        : {}),
      totalPos: c.posts.reduce((a, p) => a + p.headcount, 0),
      sisaHari: dayjs(c.endDate).diff(dayjs(), 'day'),
    }))
  );
});

router.get('/contracts/:id', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const c = await prisma.contract.findFirst({
    where: { id: req.params.id, ...batasKlien(req) },
    include: {
      client: true,
      posts: {
        include: { site: { select: { id: true, name: true } }, shift: { select: { id: true, name: true } }, grade: { select: { code: true, name: true, baseSalary: true, positionAllowance: true } } },
        orderBy: { createdAt: 'asc' },
      },
      penalties: { orderBy: { createdAt: 'asc' } },
      invoices: { orderBy: { period: 'desc' }, take: 24 },
    },
  });
  if (!c) return res.status(404).json({ message: 'Kontrak tidak ditemukan' });

  const komersial = KELOLA.includes(req.user!.role) || req.user!.role === 'CLIENT';
  res.json({
    ...c,
    posts: komersial ? c.posts : c.posts.map(({ ratePerPerson, grade, ...p }) => p),
    penalties: komersial ? c.penalties : [],
    invoices: komersial ? c.invoices : [],
    ...(komersial
      ? { nilaiBulanan: rp(c.posts.reduce((a, p) => a + p.headcount * p.ratePerPerson, 0)) }
      : {}),
    totalPos: c.posts.reduce((a, p) => a + p.headcount, 0),
  });
});

router.post('/contracts', allow(...KELOLA), async (req, res) => {
  const p = kontrakSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  const c = await prisma.contract.create({
    data: { ...p.data, startDate: new Date(p.data.startDate), endDate: new Date(p.data.endDate) },
  });
  await audit(req.user!.sub, 'CREATE', 'Contract', c.id, { number: c.number }, req.ip);
  res.status(201).json(c);
});

router.put('/contracts/:id', allow(...KELOLA), async (req, res) => {
  const p = kontrakSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  const { startDate, endDate, ...sisa } = p.data;
  const c = await prisma.contract.update({
    where: { id: req.params.id },
    data: {
      ...sisa,
      ...(startDate ? { startDate: new Date(startDate) } : {}),
      ...(endDate ? { endDate: new Date(endDate) } : {}),
    },
  });
  await audit(req.user!.sub, 'UPDATE', 'Contract', c.id, sisa, req.ip);
  res.json(c);
});

router.delete('/contracts/:id', allow(...KELOLA), async (req, res) => {
  const tagihan = await prisma.invoice.count({ where: { contractId: req.params.id } });
  if (tagihan)
    return res.status(409).json({ message: 'Kontrak yang sudah punya tagihan tidak dapat dihapus. Ubah statusnya menjadi Selesai.' });
  await prisma.contract.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'Contract', req.params.id, null, req.ip);
  res.json({ ok: true });
});

/** Kontrak yang mendekati berakhir — pengingat perpanjangan. */
router.get('/contracts-jatuh-tempo', allow(...KELOLA), async (req, res) => {
  const hari = Math.min(365, Number(req.query.hari) || 90);
  const rows = await prisma.contract.findMany({
    where: { status: 'AKTIF', endDate: { lte: dayjs().add(hari, 'day').toDate() } },
    include: { client: { select: { name: true } }, posts: { select: { headcount: true, ratePerPerson: true } } },
    orderBy: { endDate: 'asc' },
  });
  res.json(
    rows.map((c) => ({
      id: c.id,
      number: c.number,
      client: c.client.name,
      endDate: c.endDate,
      sisaHari: dayjs(c.endDate).diff(dayjs(), 'day'),
      nilaiBulanan: rp(c.posts.reduce((a, p) => a + p.headcount * p.ratePerPerson, 0)),
    }))
  );
});

/* ═══════════════ MANNING TABLE (POS KONTRAK) ═══════════════ */

const posSchema = z.object({
  siteId: z.string(),
  shiftId: z.string().optional().nullable(),
  positionName: z.string().min(2),
  headcount: z.number().int().min(1).max(500),
  ratePerPerson: z.number().min(0),
  gradeId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

router.post('/contracts/:id/posts', allow(...KELOLA), async (req, res) => {
  const p = posSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  const pos = await prisma.contractPost.create({ data: { ...p.data, contractId: req.params.id } });
  await audit(req.user!.sub, 'CREATE', 'ContractPost', pos.id, { contractId: req.params.id }, req.ip);
  res.status(201).json(pos);
});

router.put('/posts/:id', allow(...KELOLA), async (req, res) => {
  const p = posSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  const pos = await prisma.contractPost.update({ where: { id: req.params.id }, data: p.data });
  await audit(req.user!.sub, 'UPDATE', 'ContractPost', pos.id, p.data, req.ip);
  res.json(pos);
});

router.delete('/posts/:id', allow(...KELOLA), async (req, res) => {
  await prisma.contractPost.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'ContractPost', req.params.id, null, req.ip);
  res.json({ ok: true });
});

/* ═══════════════ ATURAN DENDA SLA ═══════════════ */

const dendaSchema = z.object({
  kind: z.enum(['POS_KOSONG', 'MANGKIR', 'RONDE', 'INSIDEN', 'LAINNYA']),
  description: z.string().min(3),
  amount: z.number().min(0),
  unit: z.enum(['PER_KEJADIAN', 'PER_HARI_ORANG', 'PERSEN_TAGIHAN']).default('PER_KEJADIAN'),
  threshold: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

router.post('/contracts/:id/penalties', allow(...KELOLA), async (req, res) => {
  const p = dendaSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  const d = await prisma.penaltyRule.create({ data: { ...p.data, contractId: req.params.id } });
  res.status(201).json(d);
});

router.put('/penalties/:id', allow(...KELOLA), async (req, res) => {
  const p = dendaSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  res.json(await prisma.penaltyRule.update({ where: { id: req.params.id }, data: p.data }));
});

router.delete('/penalties/:id', allow(...KELOLA), async (req, res) => {
  await prisma.penaltyRule.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ═══════════════ TAGIHAN ═══════════════ */

/** Menghitung ulang total tagihan dari baris-barisnya. */
async function segarkanTotal(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, contract: true, payments: true },
  });
  if (!inv) return null;

  const lines: BarisTagihan[] = inv.lines.map((l) => ({
    kind: l.kind as any,
    siteId: l.siteId,
    description: l.description,
    qty: l.qty,
    unit: l.unit,
    unitPrice: l.unitPrice,
    amount: l.amount,
  }));
  const h = hitungTotal(lines, inv.contract, inv.period, dayjs(`${inv.period}-01`).daysInMonth());
  const paidTotal = rp(inv.payments.reduce((a, p) => a + p.amount, 0));
  const targetBayar = inv.contract.pph23Dipotong ? h.netReceivable : h.total;

  let status = inv.status;
  if (status !== 'BATAL' && status !== 'DRAFT') {
    if (paidTotal <= 0) status = 'TERKIRIM';
    else if (paidTotal + 1 < targetBayar) status = 'SEBAGIAN';
    else status = 'LUNAS';
  }

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: h.subtotal,
      deductionTotal: h.deductionTotal,
      penaltyTotal: h.penaltyTotal,
      additionTotal: h.additionTotal,
      managementFee: h.managementFee,
      dpp: h.dpp,
      ppn: h.ppn,
      pph23: h.pph23,
      total: h.total,
      netReceivable: h.netReceivable,
      paidTotal,
      status,
    },
  });
}

/** Pratinjau rekonsiliasi tanpa menyimpan apa pun. */
router.post('/invoices/pratinjau', allow(...KELOLA), async (req, res) => {
  const p = z.object({ contractId: z.string(), period: periodeSchema }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  res.json(await rekonsiliasi(p.data.contractId, p.data.period));
});

router.post('/invoices', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({ contractId: z.string(), period: periodeSchema, issueDate: z.string().optional(), note: z.string().optional().nullable() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });

  const ada = await prisma.invoice.findFirst({
    where: { contractId: p.data.contractId, period: p.data.period, status: { not: 'BATAL' } },
  });
  if (ada)
    return res.status(409).json({
      message: `Tagihan periode ${p.data.period} untuk kontrak ini sudah ada (${ada.number}). Batalkan dulu bila hendak menerbitkan ulang.`,
    });

  const kontrak = await prisma.contract.findUnique({ where: { id: p.data.contractId } });
  if (!kontrak) return res.status(404).json({ message: 'Kontrak tidak ditemukan' });

  const h = await rekonsiliasi(p.data.contractId, p.data.period);
  const issueDate = p.data.issueDate
    ? new Date(p.data.issueDate)
    : dayjs.tz(`${p.data.period}-${String(kontrak.billingDay).padStart(2, '0')} 09:00`, TZ).toDate();

  const inv = await prisma.invoice.create({
    data: {
      contractId: kontrak.id,
      clientId: kontrak.clientId,
      number: await nomorTagihanBaru(p.data.period),
      period: p.data.period,
      issueDate,
      dueDate: dayjs(issueDate).add(kontrak.dueDays, 'day').toDate(),
      note: p.data.note,
      lines: {
        create: h.lines.map((l) => ({
          kind: l.kind,
          siteId: l.siteId,
          description: l.description,
          qty: l.qty,
          unit: l.unit,
          unitPrice: l.unitPrice,
          amount: l.amount,
          meta: l.meta ?? undefined,
        })),
      },
    },
  });
  await segarkanTotal(inv.id);
  await audit(req.user!.sub, 'CREATE', 'Invoice', inv.id, { number: inv.number, period: inv.period }, req.ip);
  res.status(201).json(await prisma.invoice.findUnique({ where: { id: inv.id }, include: { lines: true } }));
});

router.get('/invoices', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const { skip, take, page, pageSize } = parsePaging(req);
  const where: any = {
    ...batasKlien(req),
    ...(req.query.status ? { status: req.query.status as any } : {}),
    ...(req.query.period ? { period: String(req.query.period) } : {}),
    ...(req.query.contractId ? { contractId: String(req.query.contractId) } : {}),
    // Klien tidak perlu melihat tagihan yang masih draf.
    ...(req.user!.role === 'CLIENT' ? { status: { not: 'DRAFT' as const } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take,
      include: { client: { select: { name: true } }, contract: { select: { number: true } } },
      orderBy: [{ period: 'desc' }, { number: 'desc' }],
    }),
    prisma.invoice.count({ where }),
  ]);
  res.json({ data, total, page, pageSize });
});

router.get('/invoices/:id', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const inv = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      ...batasKlien(req),
      ...(req.user!.role === 'CLIENT' ? { status: { not: 'DRAFT' as const } } : {}),
    },
    include: {
      client: true,
      contract: true,
      lines: { include: { site: { select: { name: true } } } },
      payments: { orderBy: { date: 'asc' } },
    },
  });
  if (!inv) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });

  // Nilai dalam huruf dan identitas penerbit disertakan agar cetakan tagihan
  // dapat disusun seluruhnya dari satu permintaan.
  const target = inv.contract?.pph23Dipotong ? inv.netReceivable : inv.total;
  res.json({
    ...inv,
    terbilang: terbilangRupiah(target),
    penerbit: await ambilPenerbit(),
  });
});

/** Baris tambahan manual: permintaan tenaga tambahan, acara, penyesuaian. */
router.post('/invoices/:id/lines', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({
      kind: z.enum(['TAMBAHAN', 'POTONGAN', 'DENDA']),
      siteId: z.string().optional().nullable(),
      description: z.string().min(3),
      qty: z.number().min(0).default(1),
      unit: z.string().optional().nullable(),
      unitPrice: z.number(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });

  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });
  if (inv.status === 'LUNAS' || inv.status === 'BATAL')
    return res.status(409).json({ message: 'Tagihan yang sudah lunas atau dibatalkan tidak dapat diubah' });

  const besar = rp(p.data.qty * p.data.unitPrice);
  await prisma.invoiceLine.create({
    data: {
      invoiceId: inv.id,
      kind: p.data.kind,
      siteId: p.data.siteId || null,
      description: p.data.description,
      qty: p.data.qty,
      unit: p.data.unit,
      unitPrice: p.data.unitPrice,
      // Potongan dan denda selalu tercatat sebagai nilai negatif.
      amount: p.data.kind === 'TAMBAHAN' ? besar : -Math.abs(besar),
    },
  });
  res.status(201).json(await segarkanTotal(inv.id));
});

router.delete('/invoices/:id/lines/:lineId', allow(...KELOLA), async (req, res) => {
  await prisma.invoiceLine.delete({ where: { id: req.params.lineId } });
  res.json(await segarkanTotal(req.params.id));
});

router.put('/invoices/:id', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({ note: z.string().optional().nullable(), taxInvoiceNo: z.string().optional().nullable(), dueDate: z.string().optional() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tagihan tidak sah' });
  const inv = await prisma.invoice.update({
    where: { id: req.params.id },
    data: {
      note: p.data.note,
      taxInvoiceNo: p.data.taxInvoiceNo,
      ...(p.data.dueDate ? { dueDate: new Date(p.data.dueDate) } : {}),
    },
  });
  res.json(inv);
});

/* ═══════════════ IDENTITAS PENERBIT TAGIHAN ═══════════════ */

/**
 * Dipakai pada kop cetakan tagihan.
 *
 * Disimpan sebagai pengaturan, bukan ditanam di kode, karena alamat, nomor
 * rekening, dan penanda tangan berubah tanpa menunggu penerapan baru.
 */
export const PENERBIT_BAWAAN = {
  nama: 'PT. Dharmapati Putra Nusantara',
  alamat: 'Samesta Royal Campaka, Ruko Blok R1 No. 36, Campaka, Purwakarta, Jawa Barat 41181',
  telepon: '',
  email: 'info@dharmapati.co.id',
  npwp: '94.187.081.8-409.000',
  bank: '',
  rekening: '',
  atasNama: '',
  penandaTangan: '',
  jabatan: 'Direktur',
  kota: 'Purwakarta',
  catatanKaki: 'Pembayaran mohon ditransfer ke rekening di atas dan bukti transfernya dikirimkan kepada kami.',
};

async function ambilPenerbit() {
  const s = await prisma.setting.findUnique({ where: { key: 'billing.penerbit' } });
  return { ...PENERBIT_BAWAAN, ...((s?.value as any) || {}) };
}

router.get('/penerbit', allow(...COMMAND, 'CLIENT'), async (_req, res) => {
  res.json(await ambilPenerbit());
});

router.put('/penerbit', allow(...KELOLA), async (req, res) => {
  const schema = z.object({
    nama: z.string().min(3),
    alamat: z.string().optional().default(''),
    telepon: z.string().optional().default(''),
    email: z.string().optional().default(''),
    npwp: z.string().optional().default(''),
    bank: z.string().optional().default(''),
    rekening: z.string().optional().default(''),
    atasNama: z.string().optional().default(''),
    penandaTangan: z.string().optional().default(''),
    jabatan: z.string().optional().default(''),
    kota: z.string().optional().default(''),
    catatanKaki: z.string().max(400).optional().default(''),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  await prisma.setting.upsert({
    where: { key: 'billing.penerbit' },
    create: { key: 'billing.penerbit', value: p.data },
    update: { value: p.data },
  });
  await audit(req.user!.sub, 'UPDATE', 'Setting', 'billing.penerbit', p.data, req.ip);
  res.json(p.data);
});

router.post('/invoices/:id/kirim', allow(...KELOLA), async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!inv) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });
  if (inv.status !== 'DRAFT') return res.status(409).json({ message: 'Tagihan ini sudah pernah dikirim' });

  await prisma.invoice.update({
    where: { id: inv.id },
    data: { status: 'TERKIRIM', sentAt: new Date() },
  });

  const wakil = await prisma.user.findMany({
    where: { role: 'CLIENT', clientId: inv.clientId, status: 'ACTIVE' },
    select: { id: true },
  });
  await notifyUsers(
    wakil.map((w) => w.id),
    {
      type: 'INVOICE',
      title: `Tagihan ${inv.number} terbit`,
      body: `Tagihan periode ${inv.period} sebesar Rp ${Math.round(inv.total).toLocaleString('id-ID')} sudah terbit, jatuh tempo ${dayjs(inv.dueDate).format('DD MMM YYYY')}.`,
      data: { invoiceId: inv.id },
    }
  );
  await audit(req.user!.sub, 'SEND', 'Invoice', inv.id, { number: inv.number }, req.ip);
  res.json({ ok: true });
});

router.post('/invoices/:id/batal', allow(...KELOLA), async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { payments: true } });
  if (!inv) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });
  if (inv.payments.length)
    return res.status(409).json({ message: 'Tagihan yang sudah menerima pembayaran tidak dapat dibatalkan' });
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'BATAL' } });
  await audit(req.user!.sub, 'VOID', 'Invoice', inv.id, { number: inv.number }, req.ip);
  res.json({ ok: true });
});

router.delete('/invoices/:id', allow(...KELOLA), async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });
  if (inv.status !== 'DRAFT') return res.status(409).json({ message: 'Hanya tagihan draf yang boleh dihapus' });
  await prisma.invoice.delete({ where: { id: inv.id } });
  await audit(req.user!.sub, 'DELETE', 'Invoice', inv.id, { number: inv.number }, req.ip);
  res.json({ ok: true });
});

router.post('/invoices/:id/pembayaran', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({ date: z.string(), amount: z.number().min(1), method: z.string().default('TRANSFER'), ref: z.string().optional().nullable(), note: z.string().optional().nullable() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Tanggal dan jumlah pembayaran wajib diisi' });

  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ message: 'Tagihan tidak ditemukan' });
  if (inv.status === 'DRAFT') return res.status(409).json({ message: 'Kirim dulu tagihannya sebelum mencatat pembayaran' });
  if (inv.status === 'BATAL') return res.status(409).json({ message: 'Tagihan ini sudah dibatalkan' });

  await prisma.payment.create({
    data: { ...p.data, date: new Date(p.data.date), invoiceId: inv.id, createdById: req.user!.sub },
  });
  const baru = await segarkanTotal(inv.id);
  await audit(req.user!.sub, 'PAYMENT', 'Invoice', inv.id, { amount: p.data.amount }, req.ip);
  res.status(201).json(baru);
});

router.delete('/pembayaran/:id', allow(...KELOLA), async (req, res) => {
  const bayar = await prisma.payment.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'Payment', bayar.id, { amount: bayar.amount }, req.ip);
  res.json(await segarkanTotal(bayar.invoiceId));
});

/** Umur piutang — berapa lama tagihan menganggur. Hanya untuk keuangan. */
router.get('/piutang', allow(...KELOLA), async (_req, res) => {
  const rows = await prisma.invoice.findMany({
    where: { status: { in: ['TERKIRIM', 'SEBAGIAN'] } },
    include: { client: { select: { name: true } }, contract: { select: { number: true, pph23Dipotong: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const ember = { belumJatuhTempo: 0, h1_30: 0, h31_60: 0, h61_90: 0, lebih90: 0 };
  const data = rows.map((i) => {
    const target = i.contract.pph23Dipotong ? i.netReceivable : i.total;
    const sisa = rp(target - i.paidTotal);
    const umur = dayjs().diff(dayjs(i.dueDate), 'day');
    if (umur <= 0) ember.belumJatuhTempo += sisa;
    else if (umur <= 30) ember.h1_30 += sisa;
    else if (umur <= 60) ember.h31_60 += sisa;
    else if (umur <= 90) ember.h61_90 += sisa;
    else ember.lebih90 += sisa;
    return {
      id: i.id,
      number: i.number,
      client: i.client.name,
      contract: i.contract.number,
      period: i.period,
      dueDate: i.dueDate,
      total: i.total,
      target,
      paidTotal: i.paidTotal,
      sisa,
      umurHari: umur,
      status: i.status,
    };
  });

  res.json({ ember, total: rp(data.reduce((a, d) => a + d.sisa, 0)), data });
});

export default router;
