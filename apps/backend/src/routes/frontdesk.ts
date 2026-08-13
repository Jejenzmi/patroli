import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND } from '../middleware/auth';
import { startOfDay, endOfDay, dateKey } from '../lib/time';
import { withSiteScope, bolehSite, isCommand } from '../lib/scope';
import { audit, notifyUsers } from '../lib/notify';

const router = Router();
router.use(auth);

/* ─────────────────────────── BUKU TAMU ─────────────────────────── */

router.get('/visitors', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.status) where.status = String(req.query.status);
  where = await withSiteScope(req, where);
  if (req.query.from || req.query.to) {
    where.checkInAt = {};
    if (req.query.from) where.checkInAt.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.checkInAt.lte = endOfDay(new Date(String(req.query.to)));
  }
  if (req.query.q)
    where.OR = [
      { name: { contains: String(req.query.q), mode: 'insensitive' } },
      { company: { contains: String(req.query.q), mode: 'insensitive' } },
      { vehiclePlate: { contains: String(req.query.q), mode: 'insensitive' } },
    ];
  const rows = await prisma.visitor.findMany({
    where,
    orderBy: { checkInAt: 'desc' },
    take: Math.min(500, Number(req.query.limit) || 100),
    include: {
      site: { select: { id: true, name: true } },
      handledBy: { select: { id: true, name: true } },
    },
  });
  res.json(rows);
});

const visitorSchema = z.object({
  siteId: z.string(),
  name: z.string().min(2),
  idType: z.string().optional(),
  idNumber: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  purpose: z.string().min(2),
  hostName: z.string().optional().nullable(),
  vehiclePlate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  itemsBrought: z.string().optional().nullable(),
  badgeNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/visitors', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const p = visitorSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tamu belum lengkap', issues: p.error.issues });
  if (!(await bolehSite(req, p.data.siteId)))
    return res.status(403).json({ message: 'Site ini di luar penempatan Anda' });
  const v = await prisma.visitor.create({
    data: { ...(p.data as any), handledById: req.user!.sub },
    include: { site: { select: { name: true } } },
  });
  await audit(req.user!.sub, 'CREATE', 'Visitor', v.id, null, req.ip);
  res.status(201).json(v);
});

router.post('/visitors/:id/checkout', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const v = await prisma.visitor.update({
    where: { id: req.params.id },
    data: { checkOutAt: new Date(), status: 'CHECKED_OUT', notes: req.body?.notes || undefined },
  });
  res.json(v);
});

router.put('/visitors/:id', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const v = await prisma.visitor.update({ where: { id: req.params.id }, data: req.body });
  res.json(v);
});

/* ─────────────────────────── LALU LINTAS KENDARAAN ─────────────────────────── */

router.get('/vehicles', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  where = await withSiteScope(req, where);
  if (req.query.open === 'true') where.outAt = null;
  if (req.query.q) where.plate = { contains: String(req.query.q), mode: 'insensitive' };
  const rows = await prisma.vehicleLog.findMany({
    where,
    orderBy: { inAt: 'desc' },
    take: Math.min(500, Number(req.query.limit) || 100),
    include: { site: { select: { id: true, name: true } }, recordedBy: { select: { id: true, name: true } } },
  });
  res.json(rows);
});

router.post('/vehicles', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const schema = z.object({
    siteId: z.string(),
    plate: z.string().min(2),
    vehicleType: z.string().optional(),
    driverName: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    purpose: z.string().optional().nullable(),
    cargo: z.string().optional().nullable(),
    photoUrl: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Nomor polisi wajib diisi' });
  if (!(await bolehSite(req, p.data.siteId)))
    return res.status(403).json({ message: 'Site ini di luar penempatan Anda' });
  const v = await prisma.vehicleLog.create({
    data: { ...(p.data as any), plate: p.data.plate.toUpperCase(), recordedById: req.user!.sub },
  });
  res.status(201).json(v);
});

router.post('/vehicles/:id/out', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const v = await prisma.vehicleLog.update({
    where: { id: req.params.id },
    data: { outAt: new Date(), notes: req.body?.notes || undefined },
  });
  res.json(v);
});

/* ─────────────────────────── SERAH TERIMA SHIFT ─────────────────────────── */

router.get('/handovers', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.user!.role === 'GUARD')
    where.OR = [{ fromGuardId: req.user!.sub }, { toGuardId: req.user!.sub }];
  if (req.user!.role === 'CLIENT') where = await withSiteScope(req, where);
  const rows = await prisma.handover.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      site: { select: { id: true, name: true } },
      fromGuard: { select: { id: true, name: true, avatarUrl: true } },
      toGuard: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
  res.json(rows);
});

router.post('/handovers', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const schema = z.object({
    siteId: z.string(),
    toGuardId: z.string(),
    shiftDate: z.string().optional(),
    situation: z.string().min(3),
    pendingWork: z.string().optional().nullable(),
    equipmentOk: z.boolean().optional(),
    equipmentNote: z.string().optional().nullable(),
    signatureUrl: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data serah terima belum lengkap' });
  const h = await prisma.handover.create({
    data: {
      ...(p.data as any),
      fromGuardId: req.user!.sub,
      shiftDate: dateKey(p.data.shiftDate),
    },
    include: { fromGuard: { select: { name: true } } },
  });
  await notifyUsers([p.data.toGuardId], {
    type: 'HANDOVER',
    title: 'Serah terima shift',
    body: `${h.fromGuard.name} mengirim berita acara serah terima`,
    data: { handoverId: h.id },
  });
  res.status(201).json(h);
});

router.post('/handovers/:id/ack', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const h = await prisma.handover.findUnique({ where: { id: req.params.id } });
  if (!h) return res.status(404).json({ message: 'Serah terima tidak ditemukan' });
  if (h.toGuardId !== req.user!.sub)
    return res.status(403).json({ message: 'Hanya penerima shift yang dapat mengonfirmasi' });
  const updated = await prisma.handover.update({
    where: { id: req.params.id },
    data: { acknowledgedAt: new Date() },
  });
  res.json(updated);
});

/* ─────────────────────────── PENGUMUMAN & NOTIFIKASI ─────────────────────────── */

router.get('/announcements', async (req, res) => {
  // Pengguna hanya menerima pengumuman yang ditujukan kepadanya.
  const penerima = isCommand(req) ? undefined : { audience: { in: ['ALL', req.user!.role] } };
  const rows = await prisma.announcement.findMany({
    where: {
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
        ...(penerima ? [penerima] : []),
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
  });
  res.json(rows);
});

router.post('/announcements', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    title: z.string().min(3),
    body: z.string().min(3),
    audience: z.string().optional(),
    siteId: z.string().optional().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    expiresAt: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Judul dan isi pengumuman wajib diisi' });
  const a = await prisma.announcement.create({
    data: {
      ...(p.data as any),
      expiresAt: p.data.expiresAt ? new Date(p.data.expiresAt) : null,
      createdById: req.user!.sub,
    },
  });
  const targets = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      ...(p.data.audience && p.data.audience !== 'ALL' ? { role: p.data.audience as any } : {}),
    },
    select: { id: true },
  });
  await notifyUsers(
    targets.map((t) => t.id),
    { type: 'ANNOUNCEMENT', title: a.title, body: a.body.slice(0, 160), data: { announcementId: a.id } }
  );
  res.status(201).json(a);
});

router.delete('/announcements/:id', allow(...COMMAND), async (req, res) => {
  await prisma.announcement.delete({ where: { id: req.params.id } });
  res.json({ message: 'Pengumuman dihapus' });
});

router.get('/notifications', async (req, res) => {
  const rows = await prisma.notification.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  const unread = await prisma.notification.count({ where: { userId: req.user!.sub, readAt: null } });
  res.json({ data: rows, unread });
});

router.post('/notifications/read', async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, ...(ids.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

/* ─────────────────────────── JEJAK AUDIT ─────────────────────────── */

router.get('/audit', allow(...COMMAND), async (req, res) => {
  const rows = await prisma.auditLog.findMany({
    where: {
      ...(req.query.entity ? { entity: String(req.query.entity) } : {}),
      ...(req.query.userId ? { userId: String(req.query.userId) } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(500, Number(req.query.limit) || 100),
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  res.json(rows);
});

export default router;
