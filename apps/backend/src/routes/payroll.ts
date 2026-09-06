import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, ADMIN_ONLY } from '../middleware/auth';
import { dayjs, TZ } from '../lib/time';
import { audit, notifyUsers } from '../lib/notify';
import { rp } from '../lib/uang';
import { hitungPenggajian, konfigBpjs, konfigUpah, BPJS_BAWAAN, UPAH_BAWAAN } from '../lib/payroll';
import { lupakanCacheTer, PTKP, kategoriTer } from '../lib/pajak';
import { parsePaging } from '../lib/scope';

const router = Router();
router.use(auth);

/**
 * Penggajian.
 *
 * Seluruh pengelolaan hanya untuk ADMIN; anggota hanya dapat membaca slipnya
 * sendiri (/saya). Peran CLIENT tidak pernah menyentuh berkas ini — biaya
 * personel bukan urusan pemberi kerja site.
 */

const KELOLA = ADMIN_ONLY;
const periodeSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Periode harus YYYY-MM');

/* ═══════════════ GOLONGAN UPAH ═══════════════ */

const gradeSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  region: z.string().optional().nullable(),
  baseSalary: z.number().min(0),
  positionAllowance: z.number().min(0).default(0),
  mealPerDay: z.number().min(0).default(0),
  transportPerDay: z.number().min(0).default(0),
  attendanceBonus: z.number().min(0).default(0),
  absentDeduction: z.number().min(0).default(0),
  latePenaltyPerMin: z.number().min(0).default(0),
  bpjsTkEnrolled: z.boolean().default(true),
  bpjsKesEnrolled: z.boolean().default(true),
  jkkRatePct: z.number().min(0).max(10).default(0.54),
  overtimeEligible: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

router.get('/grades', allow(...KELOLA), async (_req, res) => {
  const rows = await prisma.payGrade.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { users: true } } },
  });
  res.json(rows);
});

router.post('/grades', allow(...KELOLA), async (req, res) => {
  const p = gradeSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  const g = await prisma.payGrade.create({ data: p.data });
  await audit(req.user!.sub, 'CREATE', 'PayGrade', g.id, { code: g.code }, req.ip);
  res.status(201).json(g);
});

router.put('/grades/:id', allow(...KELOLA), async (req, res) => {
  const p = gradeSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  const g = await prisma.payGrade.update({ where: { id: req.params.id }, data: p.data });
  await audit(req.user!.sub, 'UPDATE', 'PayGrade', g.id, p.data, req.ip);
  res.json(g);
});

router.delete('/grades/:id', allow(...KELOLA), async (req, res) => {
  const dipakai = await prisma.user.count({ where: { gradeId: req.params.id } });
  if (dipakai)
    return res
      .status(409)
      .json({ message: `Golongan ini masih dipakai ${dipakai} personel. Pindahkan dulu personelnya.` });
  await prisma.payGrade.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'PayGrade', req.params.id, null, req.ip);
  res.json({ ok: true });
});

/* ═══════════════ UPAH MINIMUM & HARI LIBUR ═══════════════ */

router.get('/umk', allow(...KELOLA), async (req, res) => {
  const year = Number(req.query.year) || dayjs().year();
  res.json(await prisma.minimumWage.findMany({ where: { year }, orderBy: { region: 'asc' } }));
});

router.post('/umk', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({ region: z.string().min(3), year: z.number().int().min(2020).max(2100), amount: z.number().min(0), note: z.string().optional().nullable() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Wilayah, tahun, dan nilai UMK wajib diisi' });
  const row = await prisma.minimumWage.upsert({
    where: { region_year: { region: p.data.region, year: p.data.year } },
    create: p.data,
    update: { amount: p.data.amount, note: p.data.note },
  });
  await audit(req.user!.sub, 'UPSERT', 'MinimumWage', row.id, p.data, req.ip);
  res.status(201).json(row);
});

router.delete('/umk/:id', allow(...KELOLA), async (req, res) => {
  await prisma.minimumWage.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.get('/holidays', allow(...KELOLA), async (req, res) => {
  const year = Number(req.query.year) || dayjs().year();
  res.json(
    await prisma.holiday.findMany({
      where: { date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
      orderBy: { date: 'asc' },
    })
  );
});

router.post('/holidays', allow(...KELOLA), async (req, res) => {
  const p = z.object({ date: z.string(), name: z.string().min(2), isNational: z.boolean().default(true) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Tanggal dan nama hari libur wajib diisi' });
  const date = new Date(`${dayjs(p.data.date).format('YYYY-MM-DD')}T00:00:00.000Z`);
  const row = await prisma.holiday.upsert({
    where: { date },
    create: { date, name: p.data.name, isNational: p.data.isNational },
    update: { name: p.data.name, isNational: p.data.isNational },
  });
  res.status(201).json(row);
});

router.delete('/holidays/:id', allow(...KELOLA), async (req, res) => {
  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ═══════════════ PENGATURAN IURAN & PAJAK ═══════════════ */

router.get('/config', allow(...KELOLA), async (_req, res) => {
  const [bpjs, upah, ter] = await Promise.all([
    konfigBpjs(),
    konfigUpah(),
    prisma.terBracket.groupBy({ by: ['category'], _count: { _all: true } }),
  ]);
  res.json({
    bpjs,
    upah,
    bawaan: { bpjs: BPJS_BAWAAN, upah: UPAH_BAWAAN },
    ptkp: PTKP,
    ter: Object.fromEntries(ter.map((t) => [t.category, t._count._all])),
  });
});

router.put('/config/bpjs', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({
      jkm: z.number().min(0).max(10),
      jhtPerusahaan: z.number().min(0).max(20),
      jpPerusahaan: z.number().min(0).max(20),
      kesPerusahaan: z.number().min(0).max(20),
      jhtPekerja: z.number().min(0).max(20),
      jpPekerja: z.number().min(0).max(20),
      kesPekerja: z.number().min(0).max(20),
      batasUpahJp: z.number().min(0),
      batasUpahKes: z.number().min(0),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Tarif iuran harus angka yang wajar' });
  await prisma.setting.upsert({
    where: { key: 'payroll.bpjs' },
    create: { key: 'payroll.bpjs', value: p.data },
    update: { value: p.data },
  });
  await audit(req.user!.sub, 'UPDATE', 'Setting', 'payroll.bpjs', p.data, req.ip);
  res.json(p.data);
});

router.put('/config/upah', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({
      hariKerjaStandar: z.number().int().min(20).max(31),
      hariKerjaSeminggu: z.number().int().min(5).max(6),
      pembagiLembur: z.number().min(100).max(200),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Nilai pengaturan upah di luar rentang wajar' });
  await prisma.setting.upsert({
    where: { key: 'payroll.upah' },
    create: { key: 'payroll.upah', value: p.data },
    update: { value: p.data },
  });
  await audit(req.user!.sub, 'UPDATE', 'Setting', 'payroll.upah', p.data, req.ip);
  res.json(p.data);
});

/** Tabel TER satu kategori. */
router.get('/config/ter/:kategori', allow(...KELOLA), async (req, res) => {
  const kategori = String(req.params.kategori).toUpperCase();
  if (!['A', 'B', 'C'].includes(kategori)) return res.status(400).json({ message: 'Kategori TER hanya A, B, atau C' });
  res.json(await prisma.terBracket.findMany({ where: { category: kategori }, orderBy: { minGross: 'asc' } }));
});

/** Mengganti seluruh lapisan satu kategori sekaligus. */
router.put('/config/ter/:kategori', allow(...KELOLA), async (req, res) => {
  const kategori = String(req.params.kategori).toUpperCase();
  if (!['A', 'B', 'C'].includes(kategori)) return res.status(400).json({ message: 'Kategori TER hanya A, B, atau C' });
  const p = z
    .array(z.object({ minGross: z.number().min(0), maxGross: z.number().min(0).nullable(), ratePct: z.number().min(0).max(100) }))
    .min(1)
    .safeParse(req.body?.rows);
  if (!p.success) return res.status(400).json({ message: 'Lapisan tarif tidak sah' });

  await prisma.$transaction([
    prisma.terBracket.deleteMany({ where: { category: kategori } }),
    prisma.terBracket.createMany({ data: p.data.map((r) => ({ ...r, category: kategori })) }),
  ]);
  lupakanCacheTer();
  await audit(req.user!.sub, 'UPDATE', 'TerBracket', kategori, { lapisan: p.data.length }, req.ip);
  res.json({ ok: true, lapisan: p.data.length });
});

/* ═══════════════ PERIODE PENGGAJIAN ═══════════════ */

async function tulisDraf(runId: string, period: string, type: 'BULANAN' | 'THR') {
  const { slips, workingDays } = await hitungPenggajian(period, type);

  await prisma.$transaction([
    prisma.payslip.deleteMany({ where: { runId } }),
    ...(slips.length
      ? [
          prisma.payslip.createMany({
            data: slips.map((s) => ({
              runId,
              guardId: s.guardId,
              siteId: s.siteId,
              gradeId: s.gradeId,
              hariJadwal: s.hariJadwal,
              hariHadir: s.hariHadir,
              hariMangkir: s.hariMangkir,
              menitTelat: s.menitTelat,
              jamLembur: s.jamLembur,
              masaKerjaBulan: s.masaKerjaBulan,
              upahDasar: s.upahDasar,
              earnings: s.earnings as any,
              deductions: s.deductions as any,
              bruto: s.bruto,
              totalPotongan: s.totalPotongan,
              netto: s.netto,
              pph21: s.pph21,
              pph21Basis: s.pph21Basis,
              bpjsPekerja: s.bpjsPekerja,
              bpjsPerusahaan: s.bpjsPerusahaan,
              biayaPerusahaan: s.biayaPerusahaan,
              bankName: s.bankName,
              bankAccount: s.bankAccount,
              bankAccountName: s.bankAccountName,
            })),
          }),
        ]
      : []),
    prisma.payrollRun.update({
      where: { id: runId },
      data: {
        workingDays,
        calculatedAt: new Date(),
        totalGross: rp(slips.reduce((a, s) => a + s.bruto, 0)),
        totalDeduction: rp(slips.reduce((a, s) => a + s.totalPotongan, 0)),
        totalNet: rp(slips.reduce((a, s) => a + s.netto, 0)),
        totalEmployerCost: rp(slips.reduce((a, s) => a + s.biayaPerusahaan, 0)),
      },
    }),
  ]);

  return slips;
}

router.get('/runs', allow(...KELOLA), async (req, res) => {
  const { skip, take, page, pageSize } = parsePaging(req);
  const [data, total] = await Promise.all([
    prisma.payrollRun.findMany({
      skip,
      take,
      orderBy: [{ period: 'desc' }, { type: 'asc' }],
      include: { _count: { select: { payslips: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.payrollRun.count(),
  ]);
  res.json({ data, total, page, pageSize });
});

router.post('/runs', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({ period: periodeSchema, type: z.enum(['BULANAN', 'THR']).default('BULANAN'), note: z.string().optional().nullable() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });

  const ada = await prisma.payrollRun.findUnique({
    where: { period_type: { period: p.data.period, type: p.data.type } },
  });
  if (ada)
    return res.status(409).json({ message: `Periode ${p.data.period} (${p.data.type}) sudah pernah dibuat` });

  const run = await prisma.payrollRun.create({
    data: { period: p.data.period, type: p.data.type, note: p.data.note, createdById: req.user!.sub },
  });
  const slips = await tulisDraf(run.id, run.period, run.type as any);
  await audit(req.user!.sub, 'CREATE', 'PayrollRun', run.id, { period: run.period, slip: slips.length }, req.ip);
  res.status(201).json(await prisma.payrollRun.findUnique({ where: { id: run.id } }));
});

router.post('/runs/:id/hitung', allow(...KELOLA), async (req, res) => {
  const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id } });
  if (!run) return res.status(404).json({ message: 'Periode penggajian tidak ditemukan' });
  if (run.status !== 'DRAFT')
    return res.status(409).json({ message: 'Periode yang sudah dikunci tidak dapat dihitung ulang' });
  const slips = await tulisDraf(run.id, run.period, run.type as any);
  await audit(req.user!.sub, 'RECALC', 'PayrollRun', run.id, { slip: slips.length }, req.ip);
  res.json(await prisma.payrollRun.findUnique({ where: { id: run.id } }));
});

router.get('/runs/:id', allow(...KELOLA), async (req, res) => {
  const run = await prisma.payrollRun.findUnique({
    where: { id: req.params.id },
    include: { createdBy: { select: { name: true } } },
  });
  if (!run) return res.status(404).json({ message: 'Periode penggajian tidak ditemukan' });

  const slips = await prisma.payslip.findMany({
    where: { runId: run.id },
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      site: { select: { id: true, name: true } },
      grade: { select: { code: true, name: true } },
    },
    orderBy: { guard: { name: 'asc' } },
  });

  // Rekap beban per site — pintu masuk laba-rugi.
  const perSite = new Map<string, { siteId: string | null; name: string; orang: number; biaya: number }>();
  slips.forEach((s) => {
    const key = s.siteId || '-';
    const cur = perSite.get(key) || { siteId: s.siteId, name: s.site?.name || 'Tanpa penempatan', orang: 0, biaya: 0 };
    cur.orang += 1;
    cur.biaya += s.biayaPerusahaan;
    perSite.set(key, cur);
  });

  res.json({ run, slips, perSite: [...perSite.values()].sort((a, b) => b.biaya - a.biaya) });
});

router.post('/runs/:id/kunci', allow(...KELOLA), async (req, res) => {
  const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id }, include: { payslips: true } });
  if (!run) return res.status(404).json({ message: 'Periode penggajian tidak ditemukan' });
  if (run.status !== 'DRAFT') return res.status(409).json({ message: 'Periode ini sudah dikunci' });
  if (!run.payslips.length) return res.status(400).json({ message: 'Belum ada slip untuk dikunci' });

  // Potongan kasbon baru dicatat saat penguncian, sekali saja per periode.
  const kasbon = await prisma.employeeLoan.findMany({
    where: { guardId: { in: run.payslips.map((s) => s.guardId) }, status: 'AKTIF' },
    include: { payments: { select: { period: true } } },
  });

  await prisma.$transaction(async (tx) => {
    for (const slip of run.payslips) {
      const baris = (slip.deductions as any[])?.filter((d) => d.kode === 'KASBON') || [];
      if (!baris.length) continue;
      const pinjaman = kasbon.filter(
        (k) => k.guardId === slip.guardId && !k.payments.some((p) => p.period === run.period)
      );
      for (let i = 0; i < baris.length && i < pinjaman.length; i++) {
        const k = pinjaman[i];
        const jumlah = rp(baris[i].jumlah);
        await tx.loanPayment.create({
          data: { loanId: k.id, payslipId: slip.id, period: run.period, amount: jumlah },
        });
        const dibayar = rp(k.paidAmount + jumlah);
        await tx.employeeLoan.update({
          where: { id: k.id },
          data: { paidAmount: dibayar, status: dibayar >= k.amount ? 'LUNAS' : 'AKTIF' },
        });
      }
    }
    await tx.payrollRun.update({
      where: { id: run.id },
      data: { status: 'TERKUNCI', lockedAt: new Date() },
    });
  });

  await audit(req.user!.sub, 'LOCK', 'PayrollRun', run.id, { period: run.period }, req.ip);
  res.json({ ok: true });
});

router.post('/runs/:id/bayar', allow(...KELOLA), async (req, res) => {
  const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id }, include: { payslips: true } });
  if (!run) return res.status(404).json({ message: 'Periode penggajian tidak ditemukan' });
  if (run.status === 'DRAFT') return res.status(409).json({ message: 'Kunci dulu periodenya sebelum ditandai dibayar' });
  if (run.status === 'DIBAYAR') return res.status(409).json({ message: 'Periode ini sudah ditandai dibayar' });

  await prisma.payrollRun.update({ where: { id: run.id }, data: { status: 'DIBAYAR', paidAt: new Date() } });

  const bulan = dayjs(`${run.period}-01`).format('MMMM YYYY');
  await notifyUsers(
    run.payslips.map((s) => s.guardId),
    {
      type: 'PAYROLL',
      title: `Slip gaji ${bulan} tersedia`,
      body: `Gaji ${run.type === 'THR' ? 'THR' : 'bulan'} ${bulan} sudah dibayarkan. Buka menu Slip Gaji untuk rinciannya.`,
      data: { runId: run.id, period: run.period },
    }
  );
  await audit(req.user!.sub, 'PAY', 'PayrollRun', run.id, { period: run.period }, req.ip);
  res.json({ ok: true });
});

router.delete('/runs/:id', allow(...KELOLA), async (req, res) => {
  const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id } });
  if (!run) return res.status(404).json({ message: 'Periode penggajian tidak ditemukan' });
  if (run.status !== 'DRAFT')
    return res.status(409).json({ message: 'Hanya periode berstatus draf yang boleh dihapus' });
  await prisma.payrollRun.delete({ where: { id: run.id } });
  await audit(req.user!.sub, 'DELETE', 'PayrollRun', run.id, { period: run.period }, req.ip);
  res.json({ ok: true });
});

/** Berkas transfer massal untuk diunggah ke bank. */
router.get('/runs/:id/bank', allow(...KELOLA), async (req, res) => {
  const run = await prisma.payrollRun.findUnique({ where: { id: req.params.id } });
  if (!run) return res.status(404).json({ message: 'Periode penggajian tidak ditemukan' });
  const bank = String(req.query.bank || '').toUpperCase();

  const slips = await prisma.payslip.findMany({
    where: { runId: run.id, netto: { gt: 0 }, ...(bank && bank !== 'SEMUA' ? { bankName: bank } : {}) },
    include: { guard: { select: { name: true, employeeId: true } } },
    orderBy: { guard: { name: 'asc' } },
  });

  const berita = `GAJI ${run.period}`;
  const baris = [
    ['No', 'NIK', 'Nama Penerima', 'Bank', 'Nomor Rekening', 'Nama Rekening', 'Jumlah', 'Berita'],
    ...slips.map((s, i) => [
      i + 1,
      s.guard.employeeId || '',
      s.guard.name,
      s.bankName || '',
      s.bankAccount || '',
      s.bankAccountName || s.guard.name,
      Math.round(s.netto),
      berita,
    ]),
  ];
  const csv = baris
    .map((r) => r.map((c) => (typeof c === 'string' && /[,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');

  await audit(req.user!.sub, 'EXPORT', 'PayrollRun', run.id, { bank, baris: slips.length }, req.ip);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="transfer-${run.period}-${bank || 'semua'}.csv"`);
  res.send('﻿' + csv);
});

/* ═══════════════ SLIP ═══════════════ */

/** Slip milik sendiri — dipakai aplikasi lapangan. */
router.get('/saya', async (req, res) => {
  const rows = await prisma.payslip.findMany({
    where: { guardId: req.user!.sub, run: { status: { in: ['TERKUNCI', 'DIBAYAR'] } } },
    include: { run: { select: { period: true, type: true, status: true, paidAt: true } } },
    orderBy: { run: { period: 'desc' } },
    take: 24,
  });
  res.json(rows);
});

router.get('/slips/:id', async (req, res) => {
  const slip = await prisma.payslip.findUnique({
    where: { id: req.params.id },
    include: {
      run: true,
      guard: { select: { id: true, name: true, employeeId: true, ptkp: true, npwp: true } },
      site: { select: { name: true } },
      grade: { select: { code: true, name: true } },
    },
  });
  if (!slip) return res.status(404).json({ message: 'Slip tidak ditemukan' });

  const milikSendiri = slip.guardId === req.user!.sub;
  const bolehKelola = KELOLA.includes(req.user!.role);
  if (!milikSendiri && !bolehKelola)
    return res.status(403).json({ message: 'Slip gaji hanya dapat dilihat pemiliknya' });
  // Anggota tidak boleh melihat slipnya sendiri selama masih draf.
  if (milikSendiri && !bolehKelola && slip.run.status === 'DRAFT')
    return res.status(403).json({ message: 'Slip periode ini belum terbit' });

  if (!bolehKelola) await audit(req.user!.sub, 'READ_PAYSLIP', 'Payslip', slip.id, null, req.ip);
  res.json({ ...slip, kategoriTer: kategoriTer(slip.guard.ptkp) });
});

/* ═══════════════ KASBON ═══════════════ */

router.get('/loans', allow(...KELOLA), async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const rows = await prisma.employeeLoan.findMany({
    where: status ? { status: status as any } : {},
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      payments: { orderBy: { period: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(rows);
});

router.get('/loans/saya', async (req, res) => {
  res.json(
    await prisma.employeeLoan.findMany({
      where: { guardId: req.user!.sub },
      include: { payments: { orderBy: { period: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
  );
});

router.post('/loans', allow(...KELOLA), async (req, res) => {
  const p = z
    .object({
      guardId: z.string(),
      amount: z.number().min(1),
      installmentCount: z.number().int().min(1).max(36),
      startPeriod: periodeSchema,
      reason: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });

  const installmentAmount = rp(p.data.amount / p.data.installmentCount);
  const loan = await prisma.employeeLoan.create({
    data: { ...p.data, installmentAmount, approvedById: req.user!.sub },
  });
  await notifyUsers([p.data.guardId], {
    type: 'KASBON',
    title: 'Kasbon disetujui',
    body: `Kasbon Rp ${p.data.amount.toLocaleString('id-ID')} disetujui, dipotong ${p.data.installmentCount}× mulai ${p.data.startPeriod}.`,
    data: { loanId: loan.id },
  });
  await audit(req.user!.sub, 'CREATE', 'EmployeeLoan', loan.id, { guardId: p.data.guardId }, req.ip);
  res.status(201).json(loan);
});

router.put('/loans/:id', allow(...KELOLA), async (req, res) => {
  const p = z.object({ status: z.enum(['AKTIF', 'LUNAS', 'DIBATALKAN']) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Status kasbon tidak sah' });
  const loan = await prisma.employeeLoan.update({ where: { id: req.params.id }, data: { status: p.data.status } });
  await audit(req.user!.sub, 'UPDATE', 'EmployeeLoan', loan.id, p.data, req.ip);
  res.json(loan);
});

export default router;
