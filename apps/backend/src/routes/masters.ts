import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { jalankanAlarm } from '../lib/alarm';
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
  provinceCode: z.string().optional().nullable(),
  provinceName: z.string().optional().nullable(),
  regencyCode: z.string().optional().nullable(),
  regencyName: z.string().optional().nullable(),
  districtCode: z.string().optional().nullable(),
  districtName: z.string().optional().nullable(),
  villageCode: z.string().optional().nullable(),
  villageName: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
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

/* ─────────────────────────── WILAYAH ─────────────────────────── */

/**
 * Daftar wilayah berjenjang untuk pengisian alamat.
 * Tanpa `parent` yang dikembalikan adalah seluruh provinsi.
 */
router.get('/wilayah', async (req, res) => {
  const parent = req.query.parent ? String(req.query.parent) : null;
  const cari = req.query.q ? String(req.query.q).trim() : '';

  // Pencarian bebas dipakai kotak isian yang mengetik langsung; tanpa kata
  // kunci, yang dikirim adalah anak dari kode induk.
  const where = cari
    ? { name: { contains: cari, mode: 'insensitive' as const }, ...(parent ? { parentCode: parent } : {}) }
    : { parentCode: parent };

  const rows = await prisma.region.findMany({
    where,
    select: { code: true, name: true, level: true },
    orderBy: { name: 'asc' },
    take: 1000,
  });
  res.json(rows);
});

/** Menelusuri satu kode menjadi rangkaian wilayah dari provinsi ke bawah. */
router.get('/wilayah/:code', async (req, res) => {
  const kode = String(req.params.code);
  const bagian = kode.split('.');
  const kodeInduk = bagian.map((_, i) => bagian.slice(0, i + 1).join('.'));
  const rows = await prisma.region.findMany({
    where: { code: { in: kodeInduk } },
    select: { code: true, name: true, level: true },
    orderBy: { level: 'asc' },
  });
  res.json(rows);
});

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
  provinceCode: z.string().optional().nullable(),
  provinceName: z.string().optional().nullable(),
  regencyCode: z.string().optional().nullable(),
  regencyName: z.string().optional().nullable(),
  districtCode: z.string().optional().nullable(),
  districtName: z.string().optional().nullable(),
  villageCode: z.string().optional().nullable(),
  villageName: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
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

/**
 * Daftar zona. Sebelumnya zona hanya ikut terbawa pada rincian site, sehingga
 * tidak ada cara menampilkannya sebagai daftar tersendiri di antarmuka.
 */
router.get('/zones', async (req, res) => {
  const where = await withSiteScope(req, req.query.siteId ? { siteId: String(req.query.siteId) } : {});
  const rows = await prisma.zone.findMany({
    where,
    include: {
      site: { select: { id: true, name: true, code: true } },
      _count: { select: { checkpoints: true } },
    },
    orderBy: [{ site: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json(rows);
});

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
  res.json({ payload: `DHARMAPATI:CP:${cp.code}`, checkpoint: cp });
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
  requireReport: z.boolean().optional(),
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

/* ─────────────────────────── LANTAI & DENAH ─────────────────────────── */

router.get('/floors', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  where = await withSiteScope(req, where);
  const rows = await prisma.floor.findMany({
    where,
    orderBy: [{ siteId: 'asc' }, { level: 'asc' }],
    include: {
      site: { select: { id: true, name: true } },
      checkpoints: {
        select: { id: true, name: true, code: true, planX: true, planY: true, isActive: true },
      },
    },
  });
  res.json(rows);
});

const floorSchema = z.object({
  siteId: z.string(),
  name: z.string().min(1),
  level: z.number().int().optional(),
  planUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/floors', allow(...COMMAND), async (req, res) => {
  const p = floorSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data lantai tidak lengkap' });
  const f = await prisma.floor.create({ data: p.data as any });
  await audit(req.user!.sub, 'CREATE', 'Floor', f.id, p.data, req.ip);
  res.status(201).json(f);
});

router.put('/floors/:id', allow(...COMMAND), async (req, res) => {
  const p = floorSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const f = await prisma.floor.update({ where: { id: req.params.id }, data: p.data as any });
  res.json(f);
});

router.delete('/floors/:id', allow(...COMMAND), async (req, res) => {
  await prisma.floor.delete({ where: { id: req.params.id } });
  res.json({ message: 'Lantai dihapus' });
});

/** Menempatkan titik patroli pada denah lantai (FR-MST-003). */
router.put('/floors/:id/place', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    checkpointId: z.string(),
    planX: z.number().min(0).max(100),
    planY: z.number().min(0).max(100),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Posisi harus dalam persen 0–100' });
  const cp = await prisma.checkpoint.update({
    where: { id: p.data.checkpointId },
    data: { floorId: req.params.id, planX: p.data.planX, planY: p.data.planY },
  });
  res.json(cp);
});

/* ─────────────────────────── REGU ─────────────────────────── */

router.get('/teams', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  where = await withSiteScope(req, where);
  const rows = await prisma.team.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      site: { select: { id: true, name: true } },
      members: { select: { id: true, name: true, employeeId: true, avatarUrl: true, role: true } },
    },
  });
  res.json(rows);
});

const teamSchema = z.object({
  siteId: z.string(),
  code: z.string().min(2),
  name: z.string().min(2),
  leaderId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  memberIds: z.array(z.string()).optional(),
});

router.post('/teams', allow(...COMMAND), async (req, res) => {
  const p = teamSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data regu tidak lengkap', issues: p.error.issues });
  const { memberIds = [], ...data } = p.data;
  const t = await prisma.team.create({ data: data as any });
  if (memberIds.length)
    await prisma.user.updateMany({ where: { id: { in: memberIds } }, data: { teamId: t.id } });
  await audit(req.user!.sub, 'CREATE', 'Team', t.id, data, req.ip);
  res.status(201).json(t);
});

router.put('/teams/:id', allow(...COMMAND), async (req, res) => {
  const p = teamSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const { memberIds, ...data } = p.data;
  const t = await prisma.team.update({ where: { id: req.params.id }, data: data as any });
  if (memberIds) {
    // Anggota yang tidak lagi terdaftar dilepas dari regu ini.
    await prisma.user.updateMany({ where: { teamId: t.id }, data: { teamId: null } });
    if (memberIds.length)
      await prisma.user.updateMany({ where: { id: { in: memberIds } }, data: { teamId: t.id } });
  }
  res.json(t);
});

router.delete('/teams/:id', allow(...COMMAND), async (req, res) => {
  await prisma.user.updateMany({ where: { teamId: req.params.id }, data: { teamId: null } });
  await prisma.team.delete({ where: { id: req.params.id } });
  res.json({ message: 'Regu dihapus' });
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

/* ═══════════════ DIVISI PENANGGAP & PERUTEAN DARURAT ═══════════════ */

const JENIS_DARURAT = ["UMUM", "KEBAKARAN", "KECELAKAAN", "MEDIS", "KRIMINAL", "BENCANA"] as const;

router.get("/divisions", async (req, res) => {
  const where: any = {};
  if (req.query.siteId) where.OR = [{ siteId: String(req.query.siteId) }, { siteId: null }];
  const rows = await prisma.emergencyDivision.findMany({
    where,
    orderBy: [{ siteId: "asc" }, { name: "asc" }],
    include: {
      site: { select: { id: true, name: true } },
      members: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      routes: { select: { id: true, type: true, siteId: true } },
    },
  });
  res.json(rows);
});

const divisionSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  memberIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

router.post("/divisions", allow(...ADMIN_ONLY), async (req, res) => {
  const p = divisionSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: "Kode dan nama divisi wajib diisi" });
  const { memberIds, ...data } = p.data;
  const d = await prisma.emergencyDivision.create({ data: { ...data, siteId: data.siteId || null } });
  if (memberIds?.length)
    await prisma.user.updateMany({ where: { id: { in: memberIds } }, data: { divisionId: d.id } });
  await audit(req.user!.sub, "CREATE", "EmergencyDivision", d.id, data, req.ip);
  res.status(201).json(d);
});

router.put("/divisions/:id", allow(...ADMIN_ONLY), async (req, res) => {
  const p = divisionSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: "Data divisi tidak valid" });
  const { memberIds, ...data } = p.data;
  const d = await prisma.emergencyDivision.update({
    where: { id: req.params.id },
    data: { ...data, ...(data.siteId !== undefined ? { siteId: data.siteId || null } : {}) },
  });
  if (memberIds) {
    await prisma.user.updateMany({ where: { divisionId: d.id }, data: { divisionId: null } });
    if (memberIds.length)
      await prisma.user.updateMany({ where: { id: { in: memberIds } }, data: { divisionId: d.id } });
  }
  await audit(req.user!.sub, "UPDATE", "EmergencyDivision", d.id, data, req.ip);
  res.json(d);
});

router.delete("/divisions/:id", allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.emergencyDivision.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, "DELETE", "EmergencyDivision", req.params.id, null, req.ip);
  res.json({ message: "Divisi dihapus" });
});

/** Pemetaan jenis darurat ke divisi. */
router.get("/panic-routes", async (req, res) => {
  const where: any = {};
  if (req.query.siteId) where.OR = [{ siteId: String(req.query.siteId) }, { siteId: null }];
  const rows = await prisma.panicRoute.findMany({
    where,
    orderBy: [{ type: "asc" }],
    include: {
      division: { select: { id: true, code: true, name: true, phone: true } },
      site: { select: { id: true, name: true } },
    },
  });
  res.json(rows);
});

router.post("/panic-routes", allow(...ADMIN_ONLY), async (req, res) => {
  const schema = z.object({
    type: z.enum(JENIS_DARURAT),
    divisionId: z.string(),
    siteId: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: "Jenis darurat dan divisi wajib dipilih" });
  const r = await prisma.panicRoute.create({
    data: { ...p.data, siteId: p.data.siteId || null },
  });
  await audit(req.user!.sub, "CREATE", "PanicRoute", r.id, p.data, req.ip);
  res.status(201).json(r);
});

router.delete("/panic-routes/:id", allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.panicRoute.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, "DELETE", "PanicRoute", req.params.id, null, req.ip);
  res.json({ message: "Perutean dihapus" });
});

/* ═══════════════ SIRENE TIANG ═══════════════ */

router.get("/alarms", async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  where = await withSiteScope(req, where);
  const rows = await prisma.alarmDevice.findMany({
    where,
    orderBy: [{ siteId: "asc" }, { code: "asc" }],
    include: {
      site: { select: { id: true, name: true } },
      floor: { select: { id: true, name: true, level: true } },
      events: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  res.json(rows);
});

const alarmSchema = z.object({
  siteId: z.string(),
  floorId: z.string().optional().nullable(),
  code: z.string().min(2),
  name: z.string().min(2),
  location: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  driver: z.enum(["HTTP_GET", "HTTP_JSON"]).optional(),
  endpointOn: z.string().min(4),
  endpointOff: z.string().optional().nullable(),
  authToken: z.string().optional().nullable(),
  durationS: z.number().int().min(0).max(3600).optional(),
  isActive: z.boolean().optional(),
});

router.post("/alarms", allow(...ADMIN_ONLY), async (req, res) => {
  const p = alarmSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: "Data sirene belum lengkap" });
  const d = await prisma.alarmDevice.create({ data: { ...p.data, floorId: p.data.floorId || null } as any });
  await audit(req.user!.sub, "CREATE", "AlarmDevice", d.id, p.data, req.ip);
  res.status(201).json(d);
});

router.put("/alarms/:id", allow(...ADMIN_ONLY), async (req, res) => {
  const p = alarmSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: "Data sirene tidak valid" });
  const d = await prisma.alarmDevice.update({
    where: { id: req.params.id },
    data: { ...p.data, ...(p.data.floorId !== undefined ? { floorId: p.data.floorId || null } : {}) } as any,
  });
  await audit(req.user!.sub, "UPDATE", "AlarmDevice", d.id, p.data, req.ip);
  res.json(d);
});

router.delete("/alarms/:id", allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.alarmDevice.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, "DELETE", "AlarmDevice", req.params.id, null, req.ip);
  res.json({ message: "Sirene dihapus" });
});

/** Uji bunyi satu sirene tanpa membuat sinyal darurat. */
router.post("/alarms/:id/test", allow(...COMMAND), async (req, res) => {
  const d = await prisma.alarmDevice.findUnique({ where: { id: req.params.id } });
  if (!d) return res.status(404).json({ message: "Sirene tidak ditemukan" });
  const aksi = String(req.body?.action || "ON").toUpperCase() === "OFF" ? "OFF" : "ON";
  const [hasil] = await jalankanAlarm({
    perangkat: [d],
    aksi,
    alasan: "Uji bunyi dari pusat kendali",
    sumber: "UJI",
    olehId: req.user!.sub,
  });
  await audit(req.user!.sub, `ALARM_TEST_${aksi}`, "AlarmDevice", d.id, null, req.ip);
  res.json(hasil);
});

/** Riwayat perintah sirene. */
router.get("/alarms/:id/events", async (req, res) => {
  const rows = await prisma.alarmEvent.findMany({
    where: { deviceId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(rows);
});

export default router;
