import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND, ADMIN_ONLY } from '../middleware/auth';
import { dayjs, dateKey } from '../lib/time';
import { audit, notifyUsers } from '../lib/notify';
import { allowedSiteIds } from '../lib/scope';
import {
  LABEL_DOKUMEN,
  DOKUMEN_WAJIB,
  statusBerkas,
  periksaKompetensi,
  periksaMasaBerlaku,
  blokirBerkasMati,
} from '../lib/kepatuhan';

const router = Router();
router.use(auth);

/**
 * Kepatuhan personel: berkas & masa berlaku, syarat kompetensi site,
 * kedisiplinan, dan perjanjian kerja.
 *
 * Anggota boleh melihat berkasnya sendiri (agar tahu apa yang harus
 * diperpanjang) tetapi tidak boleh mengubahnya.
 */

const DOC_TYPES = [
  'KTA_POLRI', 'GADA_PRATAMA', 'GADA_MADYA', 'GADA_UTAMA', 'SKCK', 'MCU',
  'KTP', 'SIM_A', 'SIM_C', 'DAMKAR', 'P3K', 'IJAZAH', 'SERTIFIKAT_LAIN',
] as const;

/* ═══════════════ BERKAS PERSONEL ═══════════════ */

const docSchema = z.object({
  guardId: z.string(),
  type: z.enum(DOC_TYPES),
  number: z.string().optional().nullable(),
  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

/** Berkas milik sendiri — dipakai aplikasi lapangan. */
router.get('/documents/saya', async (req, res) => {
  const rows = await prisma.personnelDocument.findMany({
    where: { guardId: req.user!.sub },
    orderBy: [{ expiresAt: 'asc' }],
  });
  res.json(rows.map((r) => ({ ...r, label: LABEL_DOKUMEN[r.type] || r.type })));
});

router.get('/documents', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const boleh = await allowedSiteIds(req);
  const where: any = {
    ...(req.query.guardId ? { guardId: String(req.query.guardId) } : {}),
    ...(req.query.type ? { type: String(req.query.type) as any } : {}),
    ...(boleh ? { guard: { homeSiteId: { in: boleh.length ? boleh : ['-'] } } } : {}),
  };
  const rows = await prisma.personnelDocument.findMany({
    where,
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true, homeSite: { select: { name: true } } } },
    },
    orderBy: [{ expiresAt: 'asc' }],
    take: 500,
  });
  const sekarang = new Date();
  res.json(
    rows.map((r) => ({
      ...r,
      label: LABEL_DOKUMEN[r.type] || r.type,
      sisaHari: r.expiresAt ? dayjs(r.expiresAt).endOf('day').diff(dayjs().startOf('day'), 'day') : null,
      mati: !!r.expiresAt && r.expiresAt < sekarang,
    }))
  );
});

/** Papan berkas yang segera berakhir — pintu masuk halaman Kepatuhan. */
router.get('/documents/kedaluwarsa', allow(...COMMAND), async (req, res) => {
  const hari = Math.min(365, Number(req.query.hari) || 90);
  const rows = await prisma.personnelDocument.findMany({
    where: { expiresAt: { not: null, lte: dayjs().add(hari, 'day').toDate() }, guard: { status: 'ACTIVE' } },
    include: { guard: { select: { id: true, name: true, employeeId: true, homeSite: { select: { name: true } } } } },
    orderBy: { expiresAt: 'asc' },
  });
  const data = rows.map((r) => ({
    id: r.id,
    guardId: r.guardId,
    guard: r.guard.name,
    employeeId: r.guard.employeeId,
    site: r.guard.homeSite?.name || null,
    type: r.type,
    label: LABEL_DOKUMEN[r.type] || r.type,
    number: r.number,
    expiresAt: r.expiresAt,
    sisaHari: dayjs(r.expiresAt).endOf('day').diff(dayjs().startOf('day'), 'day'),
    wajib: (DOKUMEN_WAJIB as readonly string[]).includes(r.type),
  }));
  res.json({
    mati: data.filter((d) => d.sisaHari < 0),
    h30: data.filter((d) => d.sisaHari >= 0 && d.sisaHari <= 30),
    h60: data.filter((d) => d.sisaHari > 30 && d.sisaHari <= 60),
    h90: data.filter((d) => d.sisaHari > 60),
  });
});

/** Matriks kelengkapan berkas seluruh personel. */
router.get('/documents/matriks', allow(...COMMAND), async (req, res) => {
  const siteId = req.query.siteId ? String(req.query.siteId) : undefined;
  const orang = await prisma.user.findMany({
    where: { role: { in: ['GUARD', 'SUPERVISOR'] }, status: 'ACTIVE', ...(siteId ? { homeSiteId: siteId } : {}) },
    select: { id: true, name: true, employeeId: true, homeSite: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  const berkas = await prisma.personnelDocument.findMany({
    where: { guardId: { in: orang.map((o) => o.id) } },
    select: { guardId: true, type: true, expiresAt: true },
  });
  const sekarang = new Date();
  const peta = new Map<string, Record<string, { ada: boolean; mati: boolean; expiresAt: Date | null }>>();
  berkas.forEach((b) => {
    const baris = peta.get(b.guardId) || {};
    baris[b.type] = { ada: true, mati: !!b.expiresAt && b.expiresAt < sekarang, expiresAt: b.expiresAt };
    peta.set(b.guardId, baris);
  });
  res.json({
    jenis: DOC_TYPES.map((t) => ({ type: t, label: LABEL_DOKUMEN[t], wajib: (DOKUMEN_WAJIB as readonly string[]).includes(t) })),
    data: orang.map((o) => ({
      guardId: o.id,
      name: o.name,
      employeeId: o.employeeId,
      site: o.homeSite?.name || null,
      berkas: peta.get(o.id) || {},
    })),
  });
});

router.post('/documents', allow(...COMMAND), async (req, res) => {
  const p = docSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data berkas tidak lengkap' });
  const d = await prisma.personnelDocument.create({
    data: {
      ...p.data,
      issuedAt: p.data.issuedAt ? new Date(p.data.issuedAt) : null,
      expiresAt: p.data.expiresAt ? new Date(p.data.expiresAt) : null,
      verifiedById: req.user!.sub,
      verifiedAt: new Date(),
    },
  });
  await audit(req.user!.sub, 'CREATE', 'PersonnelDocument', d.id, { type: d.type, guardId: d.guardId }, req.ip);
  res.status(201).json(d);
});

router.put('/documents/:id', allow(...COMMAND), async (req, res) => {
  const p = docSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data berkas tidak sah' });
  const { issuedAt, expiresAt, ...sisa } = p.data;
  const d = await prisma.personnelDocument.update({
    where: { id: req.params.id },
    data: {
      ...sisa,
      ...(issuedAt !== undefined ? { issuedAt: issuedAt ? new Date(issuedAt) : null } : {}),
      // Masa berlaku baru berarti pengingat lama tidak relevan lagi.
      ...(expiresAt !== undefined
        ? { expiresAt: expiresAt ? new Date(expiresAt) : null, lastAlertDays: null }
        : {}),
      verifiedById: req.user!.sub,
      verifiedAt: new Date(),
    },
  });
  await audit(req.user!.sub, 'UPDATE', 'PersonnelDocument', d.id, sisa, req.ip);
  res.json(d);
});

router.delete('/documents/:id', allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.personnelDocument.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'PersonnelDocument', req.params.id, null, req.ip);
  res.json({ ok: true });
});

/** Kelayakan satu personel untuk ditugaskan. */
router.get('/kelayakan/:guardId', allow(...COMMAND), async (req, res) => {
  const st = await statusBerkas(req.params.guardId);
  const orang = await prisma.user.findUnique({
    where: { id: req.params.guardId },
    select: { name: true, blacklisted: true, blacklistReason: true, status: true },
  });
  res.json({ ...st, orang, blokirAktif: await blokirBerkasMati() });
});

/* ═══════════════ SYARAT KOMPETENSI ═══════════════ */

router.get('/requirements', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const where = req.query.siteId ? { siteId: String(req.query.siteId) } : {};
  const rows = await prisma.competencyRequirement.findMany({
    where,
    include: { site: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(rows.map((r) => ({ ...r, label: LABEL_DOKUMEN[r.docType] || r.docType })));
});

router.post('/requirements', allow(...COMMAND), async (req, res) => {
  const p = z
    .object({
      siteId: z.string(),
      docType: z.enum(DOC_TYPES),
      minCount: z.number().int().min(1).max(50).default(1),
      perShift: z.boolean().default(false),
      note: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Syarat kompetensi tidak lengkap' });
  const r = await prisma.competencyRequirement.upsert({
    where: { siteId_docType: { siteId: p.data.siteId, docType: p.data.docType } },
    create: p.data,
    update: { minCount: p.data.minCount, perShift: p.data.perShift, note: p.data.note },
  });
  await audit(req.user!.sub, 'UPSERT', 'CompetencyRequirement', r.id, p.data, req.ip);
  res.status(201).json(r);
});

router.delete('/requirements/:id', allow(...COMMAND), async (req, res) => {
  await prisma.competencyRequirement.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/** Pemenuhan syarat kompetensi pada satu tanggal. */
router.get('/requirements/periksa', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const siteId = String(req.query.siteId || '');
  if (!siteId) return res.status(400).json({ message: 'Site wajib dipilih' });
  const tanggal = dateKey(req.query.tanggal ? String(req.query.tanggal) : undefined);
  const hasil = await periksaKompetensi(siteId, tanggal);
  res.json({ siteId, tanggal, ...hasil });
});

/* ═══════════════ KEDISIPLINAN & DAFTAR HITAM ═══════════════ */

router.get('/disciplines', allow(...COMMAND), async (req, res) => {
  const rows = await prisma.discipline.findMany({
    where: req.query.guardId ? { guardId: String(req.query.guardId) } : {},
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true, blacklisted: true } },
      issuedBy: { select: { name: true } },
      incident: { select: { id: true, code: true, title: true } },
    },
    orderBy: { date: 'desc' },
    take: 200,
  });
  res.json(rows);
});

router.post('/disciplines', allow(...COMMAND), async (req, res) => {
  const p = z
    .object({
      guardId: z.string(),
      level: z.enum(['TEGURAN', 'SP1', 'SP2', 'SP3', 'PHK']),
      reason: z.string().min(5),
      incidentId: z.string().optional().nullable(),
      date: z.string().optional(),
      expiresAt: z.string().optional().nullable(),
      fileUrl: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Jenis sanksi dan alasan wajib diisi' });

  const d = await prisma.discipline.create({
    data: {
      ...p.data,
      date: p.data.date ? new Date(p.data.date) : new Date(),
      // SP tanpa masa berlaku dianggap gugur setelah enam bulan, sesuai kelaziman.
      expiresAt: p.data.expiresAt
        ? new Date(p.data.expiresAt)
        : p.data.level.startsWith('SP')
        ? dayjs(p.data.date || undefined).add(6, 'month').toDate()
        : null,
      issuedById: req.user!.sub,
    },
  });

  await notifyUsers([p.data.guardId], {
    type: 'DISIPLIN',
    title: `Anda menerima ${p.data.level}`,
    body: p.data.reason,
    data: { disciplineId: d.id },
  });
  await audit(req.user!.sub, 'CREATE', 'Discipline', d.id, { level: d.level, guardId: d.guardId }, req.ip);
  res.status(201).json(d);
});

router.delete('/disciplines/:id', allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.discipline.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'Discipline', req.params.id, null, req.ip);
  res.json({ ok: true });
});

router.put('/blacklist/:guardId', allow(...ADMIN_ONLY), async (req, res) => {
  const p = z
    .object({ blacklisted: z.boolean(), reason: z.string().optional().nullable() })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Status daftar hitam tidak sah' });
  const u = await prisma.user.update({
    where: { id: req.params.guardId },
    data: { blacklisted: p.data.blacklisted, blacklistReason: p.data.blacklisted ? p.data.reason : null },
  });
  await audit(
    req.user!.sub,
    p.data.blacklisted ? 'BLACKLIST' : 'UNBLACKLIST',
    'User',
    u.id,
    { reason: p.data.reason },
    req.ip
  );
  res.json({ ok: true, blacklisted: u.blacklisted });
});

router.get('/blacklist', allow(...COMMAND), async (_req, res) => {
  res.json(
    await prisma.user.findMany({
      where: { blacklisted: true },
      select: { id: true, name: true, employeeId: true, blacklistReason: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
  );
});

/* ═══════════════ PERJANJIAN KERJA ═══════════════ */

router.get('/employment', allow(...COMMAND), async (req, res) => {
  const rows = await prisma.employmentContract.findMany({
    where: {
      ...(req.query.guardId ? { guardId: String(req.query.guardId) } : {}),
      ...(req.query.status ? { status: String(req.query.status) as any } : {}),
    },
    include: { guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } } },
    orderBy: [{ endDate: 'asc' }],
    take: 300,
  });
  res.json(
    rows.map((r) => ({
      ...r,
      sisaHari: r.endDate ? dayjs(r.endDate).diff(dayjs(), 'day') : null,
    }))
  );
});

router.post('/employment', allow(...COMMAND), async (req, res) => {
  const p = z
    .object({
      guardId: z.string(),
      type: z.enum(['PROBATION', 'PKWT', 'PKWTT']).default('PKWT'),
      number: z.string().min(3),
      startDate: z.string(),
      endDate: z.string().optional().nullable(),
      fileUrl: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Nomor dan tanggal perjanjian wajib diisi' });
  if (p.data.type !== 'PKWTT' && !p.data.endDate)
    return res.status(400).json({ message: 'PKWT dan masa percobaan wajib punya tanggal berakhir' });

  const c = await prisma.employmentContract.create({
    data: {
      ...p.data,
      startDate: new Date(p.data.startDate),
      endDate: p.data.endDate ? new Date(p.data.endDate) : null,
    },
  });
  await audit(req.user!.sub, 'CREATE', 'EmploymentContract', c.id, { guardId: c.guardId }, req.ip);
  res.status(201).json(c);
});

router.put('/employment/:id', allow(...COMMAND), async (req, res) => {
  const p = z
    .object({
      status: z.enum(['BERJALAN', 'BERAKHIR', 'DIPERPANJANG', 'DIPUTUS']).optional(),
      endDate: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
      fileUrl: z.string().optional().nullable(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data perjanjian tidak sah' });
  const c = await prisma.employmentContract.update({
    where: { id: req.params.id },
    data: {
      ...p.data,
      ...(p.data.endDate !== undefined ? { endDate: p.data.endDate ? new Date(p.data.endDate) : null } : {}),
    },
  });
  res.json(c);
});

router.delete('/employment/:id', allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.employmentContract.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

/* ═══════════════ PENGATURAN & PEMERIKSAAN MANUAL ═══════════════ */

router.get('/config', allow(...COMMAND), async (_req, res) => {
  res.json({ blokirBerkasMati: await blokirBerkasMati(), dokumenWajib: DOKUMEN_WAJIB });
});

router.put('/config', allow(...ADMIN_ONLY), async (req, res) => {
  const p = z.object({ blokirBerkasMati: z.boolean() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Pengaturan tidak sah' });
  await prisma.setting.upsert({
    where: { key: 'kepatuhan.blokirBerkasMati' },
    create: { key: 'kepatuhan.blokirBerkasMati', value: { aktif: p.data.blokirBerkasMati } },
    update: { value: { aktif: p.data.blokirBerkasMati } },
  });
  await audit(req.user!.sub, 'UPDATE', 'Setting', 'kepatuhan.blokirBerkasMati', p.data, req.ip);
  res.json(p.data);
});

/** Menjalankan pemeriksaan masa berlaku sekarang juga. */
router.post('/periksa-sekarang', allow(...ADMIN_ONLY), async (req, res) => {
  const hasil = await periksaMasaBerlaku();
  await audit(req.user!.sub, 'CHECK', 'Compliance', null, hasil, req.ip);
  res.json(hasil);
});

export default router;
