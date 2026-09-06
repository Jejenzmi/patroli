import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND, ADMIN_ONLY } from '../middleware/auth';
import { dayjs } from '../lib/time';
import { audit } from '../lib/notify';
import { rp } from '../lib/uang';

const router = Router();
router.use(auth);

/**
 * Laba-rugi per site.
 *
 * Pendapatan diambil dari tagihan yang sudah terbit (di luar PPN, karena PPN
 * bukan pendapatan perusahaan), biaya dari beban penggajian periode yang sama
 * ditambah biaya langsung site — seragam, APD, perlengkapan.
 */

const KELOLA = ADMIN_ONLY;

interface BarisPnl {
  siteId: string;
  siteName: string;
  clientName: string;
  pendapatan: number;
  biayaGaji: number;
  biayaLain: number;
  totalBiaya: number;
  margin: number;
  marginPct: number;
  orang: number;
}

/** Menghitung laba-rugi seluruh site pada satu periode. */
async function hitungPnl(period: string): Promise<{ rows: BarisPnl[]; tanpaSite: number }> {
  const [sites, invoices, payslips, expenses] = await Promise.all([
    prisma.site.findMany({
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { period, status: { notIn: ['BATAL', 'DRAFT'] } },
      include: { lines: true },
    }),
    prisma.payslip.findMany({
      where: { run: { period, status: { in: ['TERKUNCI', 'DIBAYAR'] } } },
      select: { siteId: true, biayaPerusahaan: true },
    }),
    prisma.siteExpense.findMany({ where: { period }, select: { siteId: true, amount: true } }),
  ]);

  const pendapatan = new Map<string, number>();
  let tanpaSite = 0;

  for (const inv of invoices) {
    // Baris bersite langsung dibebankan; baris tanpa site (denda, fee) dibagi
    // menurut porsi nilai pos tiap site pada tagihan yang sama.
    const perSite = new Map<string, number>();
    let umum = inv.managementFee;
    for (const l of inv.lines) {
      if (l.siteId) perSite.set(l.siteId, (perSite.get(l.siteId) || 0) + l.amount);
      else umum += l.amount;
    }
    const dasar = [...perSite.entries()].filter(([, v]) => v > 0);
    const jumlahDasar = dasar.reduce((a, [, v]) => a + v, 0);
    perSite.forEach((v, k) => pendapatan.set(k, (pendapatan.get(k) || 0) + v));
    if (umum !== 0) {
      if (jumlahDasar > 0)
        dasar.forEach(([k, v]) => pendapatan.set(k, (pendapatan.get(k) || 0) + (umum * v) / jumlahDasar));
      else tanpaSite += umum;
    }
  }

  const gaji = new Map<string, number>();
  const orang = new Map<string, number>();
  payslips.forEach((s) => {
    if (!s.siteId) return;
    gaji.set(s.siteId, (gaji.get(s.siteId) || 0) + s.biayaPerusahaan);
    orang.set(s.siteId, (orang.get(s.siteId) || 0) + 1);
  });

  const lain = new Map<string, number>();
  expenses.forEach((e) => lain.set(e.siteId, (lain.get(e.siteId) || 0) + e.amount));

  const rows: BarisPnl[] = sites
    .map((s) => {
      const pend = rp(pendapatan.get(s.id) || 0);
      const bg = rp(gaji.get(s.id) || 0);
      const bl = rp(lain.get(s.id) || 0);
      const total = rp(bg + bl);
      return {
        siteId: s.id,
        siteName: s.name,
        clientName: s.client.name,
        pendapatan: pend,
        biayaGaji: bg,
        biayaLain: bl,
        totalBiaya: total,
        margin: rp(pend - total),
        // Persentase hanya bermakna bila ada pendapatan; tagihan negatif
        // (potongan melampaui nilai pos) tidak boleh tampil sebagai margin positif.
        marginPct: pend > 0 ? Math.round(((pend - total) / pend) * 1000) / 10 : 0,
        orang: orang.get(s.id) || 0,
      };
    })
    .filter((r) => r.pendapatan || r.totalBiaya)
    .sort((a, b) => a.margin - b.margin);

  return { rows, tanpaSite: rp(tanpaSite) };
}

router.get('/pnl', allow(...KELOLA), async (req, res) => {
  const period = String(req.query.period || dayjs().format('YYYY-MM'));
  const { rows, tanpaSite } = await hitungPnl(period);
  const total = rows.reduce(
    (a, r) => ({
      pendapatan: a.pendapatan + r.pendapatan,
      biayaGaji: a.biayaGaji + r.biayaGaji,
      biayaLain: a.biayaLain + r.biayaLain,
      margin: a.margin + r.margin,
      orang: a.orang + r.orang,
    }),
    { pendapatan: 0, biayaGaji: 0, biayaLain: 0, margin: 0, orang: 0 }
  );
  res.json({
    period,
    rows,
    tanpaSite,
    total: {
      ...total,
      totalBiaya: rp(total.biayaGaji + total.biayaLain),
      marginPct: total.pendapatan > 0 ? Math.round((total.margin / total.pendapatan) * 1000) / 10 : 0,
    },
    rugi: rows.filter((r) => r.margin < 0).length,
  });
});

/** Tren margin enam periode terakhir. */
router.get('/pnl/tren', allow(...KELOLA), async (req, res) => {
  const period = String(req.query.period || dayjs().format('YYYY-MM'));
  const siteId = req.query.siteId ? String(req.query.siteId) : null;
  const hasil: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const p = dayjs(`${period}-01`).subtract(i, 'month').format('YYYY-MM');
    const { rows } = await hitungPnl(p);
    const dipakai = siteId ? rows.filter((r) => r.siteId === siteId) : rows;
    hasil.push({
      periode: p,
      pendapatan: rp(dipakai.reduce((a, r) => a + r.pendapatan, 0)),
      biaya: rp(dipakai.reduce((a, r) => a + r.totalBiaya, 0)),
      margin: rp(dipakai.reduce((a, r) => a + r.margin, 0)),
    });
  }
  res.json(hasil);
});

/** Ringkasan keuangan untuk pusat komando. */
router.get('/ringkasan', allow(...KELOLA), async (req, res) => {
  const period = String(req.query.period || dayjs().format('YYYY-MM'));
  const [{ rows }, piutang, run, kontrakDekat, tagihanPeriode, kontrakAktif] = await Promise.all([
    hitungPnl(period),
    prisma.invoice.findMany({
      where: { status: { in: ['TERKIRIM', 'SEBAGIAN'] } },
      select: {
        total: true,
        netReceivable: true,
        paidTotal: true,
        dueDate: true,
        contract: { select: { pph23Dipotong: true } },
      },
    }),
    prisma.payrollRun.findUnique({ where: { period_type: { period, type: 'BULANAN' } } }),
    prisma.contract.count({ where: { status: 'AKTIF', endDate: { lte: dayjs().add(90, 'day').toDate() } } }),
    prisma.invoice.count({ where: { period } }),
    prisma.contract.count({ where: { status: 'AKTIF' } }),
  ]);

  const sisaPiutang = rp(
    piutang.reduce((a, i) => a + ((i.contract.pph23Dipotong ? i.netReceivable : i.total) - i.paidTotal), 0)
  );
  const lewatTempo = rp(
    piutang
      .filter((i) => dayjs(i.dueDate).isBefore(dayjs(), 'day'))
      .reduce((a, i) => a + ((i.contract.pph23Dipotong ? i.netReceivable : i.total) - i.paidTotal), 0)
  );

  const pendapatan = rp(rows.reduce((a, r) => a + r.pendapatan, 0));
  const biaya = rp(rows.reduce((a, r) => a + r.totalBiaya, 0));

  res.json({
    period,
    pendapatan,
    biaya,
    margin: rp(pendapatan - biaya),
    marginPct: pendapatan > 0 ? Math.round(((pendapatan - biaya) / pendapatan) * 1000) / 10 : 0,
    siteRugi: rows
      .filter((r) => r.margin < 0)
      .map((r) => ({ siteId: r.siteId, siteName: r.siteName, margin: r.margin })),
    piutang: sisaPiutang,
    piutangLewatTempo: lewatTempo,
    penggajian: run ? { id: run.id, status: run.status, totalNet: run.totalNet } : null,
    kontrakAktif,
    kontrakJatuhTempo: kontrakDekat,
    tagihanPeriode,
  });
});

/* ═══════════════ BIAYA LANGSUNG SITE ═══════════════ */

router.get('/expenses', allow(...COMMAND), async (req, res) => {
  const period = String(req.query.period || dayjs().format('YYYY-MM'));
  res.json(
    await prisma.siteExpense.findMany({
      where: { period, ...(req.query.siteId ? { siteId: String(req.query.siteId) } : {}) },
      include: { site: { select: { name: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  );
});

router.post('/expenses', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({
      siteId: z.string(),
      period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      category: z.string().default('LAINNYA'),
      description: z.string().min(3),
      amount: z.number().min(1),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Site, periode, uraian, dan nilai biaya wajib diisi' });
  const row = await prisma.siteExpense.create({ data: { ...p.data, createdById: req.user!.sub } });
  await audit(req.user!.sub, 'CREATE', 'SiteExpense', row.id, p.data, req.ip);
  res.status(201).json(row);
});

router.delete('/expenses/:id', allow(...KELOLA), async (req, res) => {
  await prisma.siteExpense.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'SiteExpense', req.params.id, null, req.ip);
  res.json({ ok: true });
});

export default router;
