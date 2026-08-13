import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND, ADMIN_ONLY } from '../middleware/auth';
import { siteWhere, isCommand, allowedSiteIds, bolehSite, withSiteScope } from '../lib/scope';
import { audit } from '../lib/notify';
import { invalidate } from '../lib/redis';

const router = Router();
router.use(auth);

/* ─────────────────────────── KLIEN ─────────────────────────── */

router.get('/clients', async (req, res) => {
  const where: any = req.user!.role === 'CLIENT' ? { id: req.user!.clientId ?? '-' } : {};
  if (req.query.q) where.name = { contains: String(req.query.q), mode: 'insensitive' };
  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { sites: true } } },
  });
  res.json(clients);
});

const clientSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  contractNo: z.string().optional().nullable(),
  contractEnd: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.post('/clients', allow(...ADMIN_ONLY), async (req, res) => {
  const p = clientSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data klien tidak lengkap', issues: p.error.issues });
  const data: any = { ...p.data, contractEnd: p.data.contractEnd ? new Date(p.data.contractEnd) : null };
  const client = await prisma.client.create({ data });
  await audit(req.user!.sub, 'CREATE', 'Client', client.id, data, req.ip);
  res.status(201).json(client);
});

router.put('/clients/:id', allow(...ADMIN_ONLY), async (req, res) => {
  const p = clientSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const data: any = { ...p.data };
  if (data.contractEnd) data.contractEnd = new Date(data.contractEnd);
  const client = await prisma.client.update({ where: { id: req.params.id }, data });
  await audit(req.user!.sub, 'UPDATE', 'Client', client.id, data, req.ip);
  res.json(client);
});

router.delete('/clients/:id', allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.client.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'Client', req.params.id, null, req.ip);
  res.json({ message: 'Klien dihapus' });
});

/* ─────────────────────────── SITE / LOKASI ─────────────────────────── */

router.get('/sites', async (req, res) => {
  const where: any = { ...siteWhere(req) };
  const bolehIds = await allowedSiteIds(req);
  if (bolehIds !== null) where.id = { in: bolehIds.length ? bolehIds : ['-tidak-boleh-'] };
  if (req.query.clientId) where.clientId = String(req.query.clientId);
  if (req.query.q) where.name = { contains: String(req.query.q), mode: 'insensitive' };
  const sites = await prisma.site.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      client: { select: { id: true, name: true, code: true } },
      _count: { select: { checkpoints: true, routes: true, zones: true } },
    },
  });
  res.json(sites);
});

router.get('/sites/:id', async (req, res) => {
  if (!(await bolehSite(req, req.params.id)))
    return res.status(403).json({ message: 'Site ini di luar cakupan akses Anda' });
  const site = await prisma.site.findUnique({
    where: { id: req.params.id },
    include: {
      client: true,
      zones: { orderBy: { name: 'asc' } },
      checkpoints: { orderBy: { name: 'asc' }, include: { zone: true } },
      routes: {
        include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } },
      },
      shifts: { orderBy: { startTime: 'asc' } },
    },
  });
  if (!site) return res.status(404).json({ message: 'Site tidak ditemukan' });
  res.json(site);
});

const siteSchema = z.object({
  clientId: z.string(),
  code: z.string().min(2),
  name: z.string().min(2),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  lat: z.number(),
  lng: z.number(),
  radiusM: z.number().int().positive().optional(),
  photoUrl: z.string().optional().nullable(),
  picName: z.string().optional().nullable(),
  picPhone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.post('/sites', allow(...ADMIN_ONLY), async (req, res) => {
  const p = siteSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data site tidak lengkap', issues: p.error.issues });
  const site = await prisma.site.create({ data: p.data as any });
  await audit(req.user!.sub, 'CREATE', 'Site', site.id, p.data, req.ip);
  await invalidate('patroli:dash');
  res.status(201).json(site);
});

router.put('/sites/:id', allow(...ADMIN_ONLY), async (req, res) => {
  const p = siteSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const site = await prisma.site.update({ where: { id: req.params.id }, data: p.data as any });
  await audit(req.user!.sub, 'UPDATE', 'Site', site.id, p.data, req.ip);
  res.json(site);
});

router.delete('/sites/:id', allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.site.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'Site', req.params.id, null, req.ip);
  res.json({ message: 'Site dihapus' });
});

/* ─────────────────────────── ZONA ─────────────────────────── */

router.post('/zones', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    siteId: z.string(),
    name: z.string().min(1),
    color: z.string().optional(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data zona tidak valid' });
  const zone = await prisma.zone.create({ data: p.data as any });
  res.status(201).json(zone);
});

router.put('/zones/:id', allow(...COMMAND), async (req, res) => {
  const zone = await prisma.zone.update({ where: { id: req.params.id }, data: req.body });
  res.json(zone);
});

router.delete('/zones/:id', allow(...COMMAND), async (req, res) => {
  await prisma.zone.delete({ where: { id: req.params.id } });
  res.json({ message: 'Zona dihapus' });
});

/* ─────────────────────────── CHECKPOINT ─────────────────────────── */

router.get('/checkpoints', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  where = await withSiteScope(req, where);
  const list = await prisma.checkpoint.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { zone: true, site: { select: { id: true, name: true } } },
  });
  res.json(list);
});

const cpSchema = z.object({
  siteId: z.string(),
  zoneId: z.string().optional().nullable(),
  code: z.string().min(3),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  lat: z.number(),
  lng: z.number(),
  radiusM: z.number().int().positive().optional(),
  nfcTag: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.post('/checkpoints', allow(...COMMAND), async (req, res) => {
  const p = cpSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data titik patroli tidak lengkap', issues: p.error.issues });
  const cp = await prisma.checkpoint.create({ data: p.data as any });
  await audit(req.user!.sub, 'CREATE', 'Checkpoint', cp.id, p.data, req.ip);
  res.status(201).json(cp);
});

router.put('/checkpoints/:id', allow(...COMMAND), async (req, res) => {
  const p = cpSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const cp = await prisma.checkpoint.update({ where: { id: req.params.id }, data: p.data as any });
  res.json(cp);
});

router.delete('/checkpoints/:id', allow(...COMMAND), async (req, res) => {
  await prisma.checkpoint.delete({ where: { id: req.params.id } });
  res.json({ message: 'Titik patroli dihapus' });
});

/** Data untuk cetak kartu QR titik patroli. */
router.get('/checkpoints/:id/qr', allow(...COMMAND), async (req, res) => {
  const cp = await prisma.checkpoint.findUnique({
    where: { id: req.params.id },
    include: { site: { select: { name: true, code: true } }, zone: true },
  });
  if (!cp) return res.status(404).json({ message: 'Titik patroli tidak ditemukan' });
  res.json({ payload: `PATROLI:CP:${cp.code}`, checkpoint: cp });
});

/* ─────────────────────────── RUTE PATROLI ─────────────────────────── */

router.get('/routes', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  where = await withSiteScope(req, where);
  const list = await prisma.patrolRoute.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      site: { select: { id: true, name: true } },
      checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } },
      _count: { select: { sessions: true } },
    },
  });
  res.json(list);
});

const routeSchema = z.object({
  siteId: z.string(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  expectedDurationMin: z.number().int().positive().optional(),
  graceMin: z.number().int().nonnegative().optional(),
  enforceOrder: z.boolean().optional(),
  requirePhoto: z.boolean().optional(),
  isActive: z.boolean().optional(),
  checkpointIds: z.array(z.string()).optional(),
});

router.post('/routes', allow(...COMMAND), async (req, res) => {
  const p = routeSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data rute tidak lengkap', issues: p.error.issues });
  const { checkpointIds = [], ...data } = p.data;
  const dur = data.expectedDurationMin ?? 45;
  const route = await prisma.patrolRoute.create({
    data: {
      ...(data as any),
      checkpoints: {
        create: checkpointIds.map((checkpointId, i) => ({
          checkpointId,
          orderIndex: i + 1,
          // Target waktu tiba dibagi rata sepanjang durasi rute.
          targetMinute: Math.round(((i + 1) / Math.max(1, checkpointIds.length)) * dur),
        })),
      },
    },
    include: { checkpoints: { include: { checkpoint: true } } },
  });
  await audit(req.user!.sub, 'CREATE', 'PatrolRoute', route.id, data, req.ip);
  res.status(201).json(route);
});

router.put('/routes/:id', allow(...COMMAND), async (req, res) => {
  const p = routeSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const { checkpointIds, ...data } = p.data;
  if (checkpointIds) {
    const existing = await prisma.patrolRoute.findUnique({ where: { id: req.params.id } });
    const dur = data.expectedDurationMin ?? existing?.expectedDurationMin ?? 45;
    await prisma.routeCheckpoint.deleteMany({ where: { routeId: req.params.id } });
    await prisma.routeCheckpoint.createMany({
      data: checkpointIds.map((checkpointId, i) => ({
        routeId: req.params.id,
        checkpointId,
        orderIndex: i + 1,
        targetMinute: Math.round(((i + 1) / Math.max(1, checkpointIds.length)) * dur),
      })),
    });
  }
  const route = await prisma.patrolRoute.update({
    where: { id: req.params.id },
    data: data as any,
    include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } },
  });
  res.json(route);
});

router.delete('/routes/:id', allow(...COMMAND), async (req, res) => {
  await prisma.patrolRoute.delete({ where: { id: req.params.id } });
  res.json({ message: 'Rute dihapus' });
});

/* ─────────────────────────── SHIFT ─────────────────────────── */

router.get('/shifts', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  where = await withSiteScope(req, where);
  const list = await prisma.shift.findMany({
    where,
    orderBy: [{ siteId: 'asc' }, { startTime: 'asc' }],
    include: { site: { select: { id: true, name: true } } },
  });
  res.json(list);
});

router.post('/shifts', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    siteId: z.string(),
    name: z.string().min(1),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    lateToleranceMin: z.number().int().nonnegative().optional(),
    color: z.string().optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data shift tidak valid (format jam HH:mm)' });
  const crossesMidnight = p.data.endTime <= p.data.startTime;
  const shift = await prisma.shift.create({ data: { ...p.data, crossesMidnight } as any });
  res.status(201).json(shift);
});

router.put('/shifts/:id', allow(...COMMAND), async (req, res) => {
  const data: any = { ...req.body };
  if (data.startTime && data.endTime) data.crossesMidnight = data.endTime <= data.startTime;
  const shift = await prisma.shift.update({ where: { id: req.params.id }, data });
  res.json(shift);
});

router.delete('/shifts/:id', allow(...COMMAND), async (req, res) => {
  await prisma.shift.delete({ where: { id: req.params.id } });
  res.json({ message: 'Shift dihapus' });
});

/* ─────────────────────────── INVENTARIS ─────────────────────────── */

router.get('/equipment', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.status) where.status = String(req.query.status);
  where = await withSiteScope(req, where);
  const list = await prisma.equipment.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      site: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  res.json(list);
});

router.post('/equipment', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    siteId: z.string(),
    code: z.string().min(2),
    name: z.string().min(2),
    category: z.string().optional(),
    serialNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data inventaris tidak valid' });
  const eq = await prisma.equipment.create({ data: p.data as any });
  res.status(201).json(eq);
});

router.put('/equipment/:id', allow(...COMMAND), async (req, res) => {
  const data: any = { ...req.body };
  if (data.assignedToId) {
    data.status = 'ASSIGNED';
    data.assignedAt = new Date();
  } else if (data.assignedToId === null) {
    data.status = data.status || 'AVAILABLE';
    data.assignedAt = null;
  }
  const eq = await prisma.equipment.update({ where: { id: req.params.id }, data });
  res.json(eq);
});

router.delete('/equipment/:id', allow(...COMMAND), async (req, res) => {
  await prisma.equipment.delete({ where: { id: req.params.id } });
  res.json({ message: 'Inventaris dihapus' });
});

export default router;
