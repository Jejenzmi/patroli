import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND } from '../middleware/auth';
import { haversineMeters, WS_EVENTS } from '@patroli/shared';
import { emitOps } from '../lib/ws';
import { audit, notifyCommand } from '../lib/notify';
import { setPresence } from '../lib/redis';
import { bolehSite, isCommand } from '../lib/scope';
import { startOfDay, endOfDay } from '../lib/time';

const router = Router();
router.use(auth);

/* ─────────────────────────── SESI PATROLI ─────────────────────────── */

router.post('/start', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const schema = z.object({
    routeId: z.string(),
    scheduleId: z.string().optional().nullable(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Rute patroli wajib dipilih' });

  const route = await prisma.patrolRoute.findUnique({
    where: { id: p.data.routeId },
    include: { checkpoints: true, site: true },
  });
  if (!route) return res.status(404).json({ message: 'Rute tidak ditemukan' });
  if (!route.isActive) return res.status(400).json({ message: 'Rute sedang dinonaktifkan' });
  if (!route.checkpoints.length)
    return res.status(400).json({ message: 'Rute belum memiliki titik patroli' });

  const running = await prisma.patrolSession.findFirst({
    where: { guardId: req.user!.sub, status: 'IN_PROGRESS' },
  });
  if (running)
    return res.status(409).json({ message: 'Masih ada patroli berjalan. Selesaikan dulu.', sessionId: running.id });

  const session = await prisma.patrolSession.create({
    data: {
      siteId: route.siteId,
      routeId: route.id,
      guardId: req.user!.sub,
      scheduleId: p.data.scheduleId || null,
      totalCheckpoints: route.checkpoints.length,
    },
    include: {
      route: { include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } } },
      site: { select: { id: true, name: true } },
      guard: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  emitOps(WS_EVENTS.PATROL_START, session, route.siteId);
  await audit(req.user!.sub, 'PATROL_START', 'PatrolSession', session.id, { routeId: route.id }, req.ip);
  res.status(201).json(session);
});

const scanSchema = z.object({
  /** Isi salah satu: kode QR/NFC hasil pindai, atau id titik patroli */
  code: z.string().optional(),
  checkpointId: z.string().optional(),
  method: z.enum(['QR', 'NFC', 'GPS', 'MANUAL']).default('QR'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  photoUrl: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  condition: z.enum(['NORMAL', 'ISSUE']).default('NORMAL'),
});

router.post('/:id/scan', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const p = scanSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data pindai tidak valid' });

  const session = await prisma.patrolSession.findUnique({
    where: { id: req.params.id },
    include: { route: { include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } } } },
  });
  if (!session) return res.status(404).json({ message: 'Sesi patroli tidak ditemukan' });
  if (session.guardId !== req.user!.sub && req.user!.role === 'GUARD')
    return res.status(403).json({ message: 'Bukan sesi patroli Anda' });
  if (session.status !== 'IN_PROGRESS')
    return res.status(400).json({ message: 'Sesi patroli sudah ditutup' });

  // Kode QR memakai format PATROLI:CP:<kode-titik>
  const rawCode = p.data.code?.replace(/^PATROLI:CP:/i, '').trim();
  const link = session.route.checkpoints.find(
    (rc) =>
      (p.data.checkpointId && rc.checkpointId === p.data.checkpointId) ||
      (rawCode &&
        (rc.checkpoint.code.toLowerCase() === rawCode.toLowerCase() ||
          rc.checkpoint.nfcTag?.toLowerCase() === rawCode.toLowerCase()))
  );
  if (!link)
    return res.status(404).json({ message: 'Titik ini tidak termasuk dalam rute patroli yang sedang berjalan' });

  const dup = await prisma.patrolScan.findFirst({
    where: { sessionId: session.id, checkpointId: link.checkpointId },
  });
  if (dup) return res.status(409).json({ message: 'Titik ini sudah dipindai pada putaran ini' });

  // Urutan wajib: titik sebelumnya harus sudah dipindai.
  if (session.route.enforceOrder) {
    const prior = session.route.checkpoints.filter((rc) => rc.orderIndex < link.orderIndex);
    const scanned = await prisma.patrolScan.count({ where: { sessionId: session.id } });
    if (scanned < prior.length)
      return res.status(422).json({
        message: `Rute ini wajib berurutan. Titik ke-${scanned + 1} harus dipindai lebih dulu.`,
      });
  }

  if (session.route.requirePhoto && !p.data.photoUrl)
    return res.status(422).json({ message: 'Rute ini mewajibkan foto bukti di setiap titik' });

  // Verifikasi jarak GPS terhadap koordinat titik patroli.
  let distanceM: number | null = null;
  if (p.data.lat != null && p.data.lng != null) {
    distanceM = Math.round(
      haversineMeters(p.data.lat, p.data.lng, link.checkpoint.lat, link.checkpoint.lng)
    );
    const tolerance = link.checkpoint.radiusM;
    if (p.data.method === 'GPS' && distanceM > tolerance)
      return res.status(422).json({
        message: `Terlalu jauh dari titik (${distanceM} m, batas ${tolerance} m).`,
        distanceM,
      });
  }

  const elapsedMin = Math.round((Date.now() - session.startedAt.getTime()) / 60000);
  const isLate = elapsedMin > link.targetMinute + session.route.graceMin;

  const scan = await prisma.patrolScan.create({
    data: {
      sessionId: session.id,
      checkpointId: link.checkpointId,
      method: p.data.method,
      lat: p.data.lat ?? null,
      lng: p.data.lng ?? null,
      distanceM,
      photoUrl: p.data.photoUrl || null,
      note: p.data.note || null,
      condition: p.data.condition,
      isLate,
      orderIndex: link.orderIndex,
    },
    include: { checkpoint: true },
  });

  const scannedCount = await prisma.patrolScan.count({ where: { sessionId: session.id } });
  const issueCount = await prisma.patrolScan.count({
    where: { sessionId: session.id, condition: 'ISSUE' },
  });
  await prisma.patrolSession.update({
    where: { id: session.id },
    data: {
      scannedCount,
      issueCount,
      complianceRate: Math.round((scannedCount / session.totalCheckpoints) * 1000) / 10,
    },
  });

  emitOps(WS_EVENTS.SCAN, { sessionId: session.id, scan, scannedCount, total: session.totalCheckpoints }, session.siteId);

  if (p.data.condition === 'ISSUE') {
    await notifyCommand(
      {
        type: 'CHECKPOINT_ISSUE',
        title: 'Temuan di titik patroli',
        body: `${link.checkpoint.name}: ${p.data.note || 'ada temuan'}`,
        data: { sessionId: session.id, checkpointId: link.checkpointId },
      },
      session.siteId
    );
  }

  res.status(201).json({ scan, scannedCount, total: session.totalCheckpoints });
});

router.post('/:id/finish', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const session = await prisma.patrolSession.findUnique({
    where: { id: req.params.id },
    include: { route: { include: { checkpoints: true } } },
  });
  if (!session) return res.status(404).json({ message: 'Sesi tidak ditemukan' });
  if (session.status !== 'IN_PROGRESS') return res.status(400).json({ message: 'Sesi sudah ditutup' });
  if (session.guardId !== req.user!.sub && req.user!.role === 'GUARD')
    return res.status(403).json({ message: 'Bukan sesi patroli Anda' });

  const scanned = await prisma.patrolScan.count({ where: { sessionId: session.id } });
  const missed = Math.max(0, session.totalCheckpoints - scanned);
  const durationMin = Math.round((Date.now() - session.startedAt.getTime()) / 60000);
  const compliance = session.totalCheckpoints
    ? Math.round((scanned / session.totalCheckpoints) * 1000) / 10
    : 0;

  // Patroli yang tak menyentuh satu titik pun dicatat sebagai terbengkalai.
  const status = scanned === 0 ? 'ABANDONED' : 'COMPLETED';

  const updated = await prisma.patrolSession.update({
    where: { id: session.id },
    data: {
      endedAt: new Date(),
      status,
      scannedCount: scanned,
      missedCount: missed,
      durationMin,
      complianceRate: compliance,
      notes: req.body?.notes || session.notes,
    },
    include: {
      guard: { select: { id: true, name: true } },
      route: { select: { name: true } },
      site: { select: { id: true, name: true } },
    },
  });

  emitOps(WS_EVENTS.PATROL_END, updated, session.siteId);
  if (missed > 0) {
    await notifyCommand(
      {
        type: 'PATROL_INCOMPLETE',
        title: 'Patroli tidak lengkap',
        body: `${updated.guard.name} melewatkan ${missed} titik pada rute ${updated.route.name} (kepatuhan ${compliance}%)`,
        data: { sessionId: session.id },
      },
      session.siteId
    );
  }
  await audit(req.user!.sub, 'PATROL_FINISH', 'PatrolSession', session.id, { compliance, missed }, req.ip);
  res.json(updated);
});

router.get('/', async (req, res) => {
  const where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.guardId) where.guardId = String(req.query.guardId);
  if (req.query.status) where.status = String(req.query.status);
  if (req.user!.role === 'GUARD') where.guardId = req.user!.sub;
  if (req.user!.role === 'CLIENT') where.site = { clientId: req.user!.clientId };
  if (req.query.from || req.query.to) {
    where.startedAt = {};
    if (req.query.from) where.startedAt.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.startedAt.lte = endOfDay(new Date(String(req.query.to)));
  }
  const rows = await prisma.patrolSession.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: Math.min(500, Number(req.query.limit) || 60),
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      route: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
    },
  });
  res.json(rows);
});

/** Sesi patroli yang sedang berjalan — untuk papan pusat komando. */
router.get('/active', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const where: any = { status: 'IN_PROGRESS' };
  if (req.user!.role === 'CLIENT') where.site = { clientId: req.user!.clientId };
  const rows = await prisma.patrolSession.findMany({
    where,
    orderBy: { startedAt: 'asc' },
    include: {
      guard: { select: { id: true, name: true, avatarUrl: true, phone: true } },
      route: { include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } } },
      site: { select: { id: true, name: true, lat: true, lng: true } },
      scans: { select: { checkpointId: true, scannedAt: true, condition: true } },
    },
  });
  res.json(rows);
});

/** Sesi milik anggota yang sedang aktif (mobile). */
router.get('/my/active', async (req, res) => {
  const s = await prisma.patrolSession.findFirst({
    where: { guardId: req.user!.sub, status: 'IN_PROGRESS' },
    include: {
      route: { include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } } },
      site: true,
      scans: true,
    },
  });
  res.json(s);
});

router.get('/:id', async (req, res) => {
  const s = await prisma.patrolSession.findUnique({
    where: { id: req.params.id },
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true, phone: true } },
      site: true,
      route: { include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } } },
      scans: { include: { checkpoint: true }, orderBy: { scannedAt: 'asc' } },
      pings: { orderBy: { recordedAt: 'asc' }, take: 1000 },
    },
  });
  if (!s) return res.status(404).json({ message: 'Sesi tidak ditemukan' });
  if (req.user!.role === 'GUARD' && s.guardId !== req.user!.sub)
    return res.status(403).json({ message: 'Sesi patroli ini bukan milik Anda' });
  if (!isCommand(req) && !(await bolehSite(req, s.siteId)))
    return res.status(403).json({ message: 'Sesi patroli ini di luar cakupan akses Anda' });
  const scannedIds = new Set(s.scans.map((x) => x.checkpointId));
  const missed = s.route.checkpoints.filter((rc) => !scannedIds.has(rc.checkpointId)).map((rc) => rc.checkpoint);
  res.json({ ...s, missedCheckpoints: missed });
});

/* ─────────────────────────── PELACAKAN POSISI ─────────────────────────── */

router.post('/tracking/ping', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const schema = z.object({
    lat: z.number(),
    lng: z.number(),
    accuracyM: z.number().optional(),
    speedKph: z.number().optional(),
    batteryPct: z.number().int().optional(),
    sessionId: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Koordinat wajib dikirim' });

  const ping = await prisma.locationPing.create({
    data: {
      guardId: req.user!.sub,
      sessionId: p.data.sessionId || null,
      lat: p.data.lat,
      lng: p.data.lng,
      accuracyM: p.data.accuracyM ?? null,
      speedKph: p.data.speedKph ?? null,
      batteryPct: p.data.batteryPct ?? null,
    },
  });

  const guard = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { name: true, homeSiteId: true, avatarUrl: true },
  });

  const presence = {
    guardId: req.user!.sub,
    name: guard?.name || req.user!.name,
    siteId: guard?.homeSiteId ?? null,
    lat: p.data.lat,
    lng: p.data.lng,
    batteryPct: p.data.batteryPct ?? null,
    speedKph: p.data.speedKph ?? null,
    sessionId: p.data.sessionId ?? null,
    at: new Date().toISOString(),
  };
  await setPresence(presence);
  emitOps(WS_EVENTS.LOCATION, { ...presence, avatarUrl: guard?.avatarUrl }, guard?.homeSiteId);

  res.status(201).json({ ok: true, id: ping.id });
});

/** Jejak posisi satu anggota pada rentang waktu — untuk peta riwayat. */
router.get('/tracking/history/:guardId', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  if (!isCommand(req)) {
    const target = await prisma.user.findUnique({
      where: { id: req.params.guardId },
      select: { homeSiteId: true },
    });
    if (!(await bolehSite(req, target?.homeSiteId)))
      return res.status(403).json({ message: 'Personel ini di luar cakupan akses Anda' });
  }
  const from = req.query.from ? new Date(String(req.query.from)) : startOfDay(new Date());
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const rows = await prisma.locationPing.findMany({
    where: { guardId: req.params.guardId, recordedAt: { gte: from, lte: to } },
    orderBy: { recordedAt: 'asc' },
    take: 2000,
  });
  res.json(rows);
});

export default router;
