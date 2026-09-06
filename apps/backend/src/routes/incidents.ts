import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND } from '../middleware/auth';
import { SLA_HOURS, WS_EVENTS, type IncidentSeverity } from '@patroli/shared';
import { emitOps } from '../lib/ws';
import { audit, notifyCommand, notifyUsers, klienDariSite } from '../lib/notify';
import { beritahuDivisi, LABEL_DARURAT } from '../lib/darurat';
import { jalankanAlarm, sireneUntukKejadian } from '../lib/alarm';
import { parsePaging, bolehSite, isCommand } from '../lib/scope';
import { getPresence } from '../lib/redis';

const router = Router();
router.use(auth);

function incidentCode(seq: number) {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `INC-${ym}-${String(seq).padStart(4, '0')}`;
}

/* ─────────────────────────── INSIDEN ─────────────────────────── */

router.get('/', async (req, res) => {
  const { skip, take, page, pageSize } = parsePaging(req);
  const where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.severity) where.severity = String(req.query.severity);
  if (req.query.category) where.category = String(req.query.category);
  if (req.user!.role === 'GUARD') where.reporterId = req.user!.sub;
  if (req.user!.role === 'CLIENT') where.site = { clientId: req.user!.clientId };
  if (req.query.q)
    where.OR = [
      { title: { contains: String(req.query.q), mode: 'insensitive' } },
      { code: { contains: String(req.query.q), mode: 'insensitive' } },
    ];

  const [rows, total] = await Promise.all([
    prisma.incident.findMany({
      where,
      skip,
      take,
      orderBy: { occurredAt: 'desc' },
      include: {
        site: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true } },
        media: { take: 1 },
        _count: { select: { media: true, updates: true } },
      },
    }),
    prisma.incident.count({ where }),
  ]);
  res.json({ data: rows, total, page, pageSize });
});

router.get('/:id', async (req, res) => {
  const inc = await prisma.incident.findUnique({
    where: { id: req.params.id },
    include: {
      site: true,
      reporter: { select: { id: true, name: true, employeeId: true, avatarUrl: true, phone: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      media: true,
      updates: {
        include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!inc) return res.status(404).json({ message: 'Insiden tidak ditemukan' });
  if (req.user!.role === 'GUARD' && inc.reporterId !== req.user!.sub && inc.assigneeId !== req.user!.sub)
    return res.status(403).json({ message: 'Laporan ini bukan milik Anda' });
  if (!isCommand(req) && !(await bolehSite(req, inc.siteId)))
    return res.status(403).json({ message: 'Insiden ini di luar cakupan akses Anda' });
  res.json(inc);
});

const incidentSchema = z.object({
  /// Waktu yang dilaporkan perangkat bila catatan ini sempat mengantre
  /// tanpa jaringan; waktu resmi tetap milik server (BRULE-008).
  offlineAt: z.string().optional().nullable(),
  siteId: z.string(),
  category: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  title: z.string().min(3),
  description: z.string().min(3),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  locationHint: z.string().optional().nullable(),
  occurredAt: z.string().optional(),
  lossValue: z.number().optional().nullable(),
  mediaUrls: z.array(z.string()).optional(),
});

router.post('/', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const p = incidentSchema.safeParse(req.body);
  if (!p.success)
    return res.status(400).json({ message: 'Laporan insiden belum lengkap', issues: p.error.issues });
  const { mediaUrls = [], occurredAt, lossValue, ...data } = p.data;

  const seq = (await prisma.incident.count()) + 1;
  const severity = data.severity as IncidentSeverity;
  const occurred = occurredAt ? new Date(occurredAt) : new Date();
  const slaDueAt = new Date(occurred.getTime() + SLA_HOURS[severity] * 3600 * 1000);

  const inc = await prisma.incident.create({
    data: {
      ...(data as any),
      code: incidentCode(seq),
      reporterId: req.user!.sub,
      offlineAt: data.offlineAt ? new Date(data.offlineAt) : null,
      occurredAt: occurred,
      slaDueAt,
      lossValue: lossValue ?? null,
      media: { create: mediaUrls.map((url) => ({ url })) },
      updates: {
        create: { userId: req.user!.sub, action: 'DILAPORKAN', note: 'Laporan insiden dibuat' },
      },
    },
    include: {
      site: { select: { id: true, name: true } },
      reporter: { select: { id: true, name: true } },
      media: true,
    },
  });

  emitOps(WS_EVENTS.INCIDENT, inc, inc.siteId);
  await notifyCommand(
    {
      type: 'INCIDENT',
      title: `Insiden ${severity}: ${inc.title}`,
      body: `${inc.site.name} — dilaporkan oleh ${inc.reporter.name}`,
      data: { incidentId: inc.id, code: inc.code },
    },
    inc.siteId
  );
  await audit(req.user!.sub, 'CREATE', 'Incident', inc.id, { severity }, req.ip);
  res.status(201).json(inc);
});

router.put('/:id', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    status: z.enum(['OPEN', 'IN_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED']).optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    assigneeId: z.string().optional().nullable(),
    closingNote: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    lossValue: z.number().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const { note, ...data } = p.data;

  const current = await prisma.incident.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ message: 'Insiden tidak ditemukan' });

  const patch: any = { ...data };
  if (data.status === 'RESOLVED' && !current.resolvedAt) patch.resolvedAt = new Date();
  if (data.status === 'CLOSED') patch.closedAt = new Date();
  if (data.severity && data.severity !== current.severity) {
    patch.slaDueAt = new Date(
      current.occurredAt.getTime() + SLA_HOURS[data.severity as IncidentSeverity] * 3600 * 1000
    );
  }

  const inc = await prisma.incident.update({
    where: { id: req.params.id },
    data: {
      ...patch,
      updates: {
        create: {
          userId: req.user!.sub,
          action: data.status ? `STATUS → ${data.status}` : 'DIPERBARUI',
          note: note || null,
        },
      },
    },
    include: { assignee: { select: { id: true, name: true } }, site: { select: { id: true, name: true } } },
  });

  if (data.assigneeId && data.assigneeId !== current.assigneeId) {
    await notifyUsers([data.assigneeId], {
      type: 'INCIDENT_ASSIGNED',
      title: 'Insiden ditugaskan kepada Anda',
      body: `${inc.code} — ${inc.title}`,
      data: { incidentId: inc.id },
    });
  }
  await notifyUsers([current.reporterId], {
    type: 'INCIDENT_UPDATE',
    title: `Insiden ${inc.code} diperbarui`,
    body: data.status ? `Status kini ${data.status}` : 'Ada pembaruan pada laporan Anda',
    data: { incidentId: inc.id },
  });
  await audit(req.user!.sub, 'UPDATE', 'Incident', inc.id, patch, req.ip);
  res.json(inc);
});

router.post('/:id/updates', allow(...COMMAND, 'GUARD'), async (req, res) => {
  if (!isCommand(req)) {
    const inc = await prisma.incident.findUnique({
      where: { id: req.params.id },
      select: { reporterId: true, assigneeId: true },
    });
    if (!inc || (inc.reporterId !== req.user!.sub && inc.assigneeId !== req.user!.sub))
      return res.status(403).json({ message: 'Laporan ini bukan milik Anda' });
  }
  const schema = z.object({ note: z.string().min(1), action: z.string().optional() });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Catatan wajib diisi' });
  const upd = await prisma.incidentUpdate.create({
    data: {
      incidentId: req.params.id,
      userId: req.user!.sub,
      action: p.data.action || 'CATATAN',
      note: p.data.note,
    },
    include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
  });
  res.status(201).json(upd);
});

router.post('/:id/media', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const schema = z.object({ url: z.string(), caption: z.string().optional(), mimeType: z.string().optional() });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'URL berkas wajib diisi' });
  const m = await prisma.incidentMedia.create({ data: { incidentId: req.params.id, ...p.data } });
  res.status(201).json(m);
});

/* ─────────────────────────── TOMBOL DARURAT ─────────────────────────── */

router.post('/panic/trigger', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const schema = z.object({
    siteId: z.string(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    message: z.string().optional().nullable(),
    // MAN_DOWN dikirim aplikasi sendiri saat anggota tidak bergerak dan tidak
    // menjawab pemeriksaan — bukan ditekan orang.
    type: z
      .enum(['UMUM', 'KEBAKARAN', 'KECELAKAAN', 'MEDIS', 'KRIMINAL', 'BENCANA', 'MAN_DOWN'])
      .default('UMUM'),
    /// Dikirim aplikasi bila sinyal sempat mengantre saat tanpa jaringan.
    /// Waktu resmi tetap milik server; kolom ini hanya menerangkan bahwa
    /// catatan menyusul (BRULE-008).
    offlineAt: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Site wajib dikirim' });
  const { offlineAt, ...isi } = p.data;

  // FR-PAN-002: lantai terakhir diambil dari titik QR yang paling akhir dipindai.
  const scanTerakhir = await prisma.patrolScan.findFirst({
    where: { session: { guardId: req.user!.sub } },
    orderBy: { scannedAt: 'desc' },
    select: { scannedAt: true, checkpoint: { select: { floorId: true, name: true } } },
  });

  const alert = await prisma.panicAlert.create({
    data: {
      guardId: req.user!.sub,
      floorId: scanTerakhir?.checkpoint.floorId ?? null,
      ...(isi as any),
      ...(offlineAt ? { offlineAt: new Date(offlineAt) } : {}),
    },
    include: {
      guard: { select: { id: true, name: true, phone: true, avatarUrl: true, employeeId: true } },
      site: { select: { id: true, name: true, lat: true, lng: true, picPhone: true } },
      floor: { select: { id: true, name: true, level: true } },
    },
  });

  const label = LABEL_DARURAT[alert.type] ?? 'Bantuan umum';
  const diLantai = alert.floor ? ` · ${alert.floor.name}` : '';
  const isiNotifikasi = {
    type: 'PANIC',
    title: `🚨 DARURAT — ${label.toUpperCase()}`,
    body: `${alert.guard.name} di ${alert.site.name}${diLantai}`,
    data: { panicId: alert.id, lat: alert.lat, lng: alert.lng, type: alert.type },
  };

  await notifyCommand(isiNotifikasi, alert.siteId);
  // FR-PAN-003: klien pemilik site menerima pemberitahuan pada saat yang sama.
  await notifyUsers(await klienDariSite(alert.siteId), isiNotifikasi);
  // Diteruskan ke divisi penanggap sesuai jenis kejadiannya.
  const divisi = await beritahuDivisi({ type: alert.type, siteId: alert.siteId, isi: isiNotifikasi });

  // Sirene tiang dibunyikan tanpa menunggu jawaban perangkat, agar
  // pemberitahuan ke pusat kendali tidak ikut tertahan bila alat mati.
  const perangkat = await sireneUntukKejadian(alert.siteId, alert.floorId);
  const alarm = perangkat.length
    ? await jalankanAlarm({
        perangkat,
        aksi: 'ON',
        alasan: label,
        panicId: alert.id,
        sumber: 'PANIC',
        olehId: req.user!.sub,
      })
    : [];

  const lengkap = await prisma.panicAlert.update({
    where: { id: alert.id },
    data: { notifiedDivisions: divisi as any },
    include: {
      guard: { select: { id: true, name: true, phone: true, avatarUrl: true, employeeId: true } },
      site: { select: { id: true, name: true, lat: true, lng: true, picPhone: true } },
      floor: { select: { id: true, name: true, level: true } },
    },
  });

  emitOps(WS_EVENTS.PANIC, { ...lengkap, alarm }, alert.siteId);
  await audit(req.user!.sub, 'PANIC', 'PanicAlert', alert.id, { type: alert.type }, req.ip);
  res.status(201).json({ ...lengkap, divisi, alarm });
});

/** Menyalakan atau mematikan sirene secara manual untuk satu kejadian. */
router.post('/panic/:id/alarm', allow(...COMMAND), async (req, res) => {
  const aksi = String(req.body?.action || 'OFF').toUpperCase() === 'ON' ? 'ON' : 'OFF';
  const alert = await prisma.panicAlert.findUnique({ where: { id: req.params.id } });
  if (!alert) return res.status(404).json({ message: 'Sinyal darurat tidak ditemukan' });

  const perangkat = await sireneUntukKejadian(alert.siteId, alert.floorId);
  if (!perangkat.length) return res.status(404).json({ message: 'Tidak ada sirene aktif di site ini' });

  const hasil = await jalankanAlarm({
    perangkat,
    aksi,
    alasan: aksi === 'ON' ? 'Dinyalakan manual dari pusat kendali' : 'Dimatikan dari pusat kendali',
    panicId: alert.id,
    sumber: 'MANUAL',
    olehId: req.user!.sub,
  });
  await audit(req.user!.sub, `ALARM_${aksi}`, 'PanicAlert', alert.id, null, req.ip);
  res.json({ action: aksi, hasil });
});

/** Riwayat perintah sirene pada satu kejadian. */
router.get('/panic/:id/alarm', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const rows = await prisma.alarmEvent.findMany({
    where: { panicId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: { device: { select: { id: true, code: true, name: true, location: true } } },
  });
  res.json(rows);
});

router.get('/panic/list', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.user!.role === 'CLIENT') where.site = { clientId: req.user!.clientId };
  const rows = await prisma.panicAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, Number(req.query.limit) || 50),
    include: {
      guard: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      site: { select: { id: true, name: true } },
      floor: { select: { id: true, name: true, level: true } },
      acknowledgedBy: { select: { id: true, name: true } },
      alarmEvents: {
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { device: { select: { code: true, name: true } } },
      },
    },
  });
  res.json(rows);
});

router.post('/panic/:id/ack', allow(...COMMAND), async (req, res) => {
  const alert = await prisma.panicAlert.update({
    where: { id: req.params.id },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedById: req.user!.sub,
      acknowledgedAt: new Date(),
      responseNote: req.body?.note || null,
    },
    include: { guard: { select: { id: true, name: true } } },
  });
  emitOps(WS_EVENTS.PANIC_ACK, alert, alert.siteId);
  await notifyUsers([alert.guardId], {
    type: 'PANIC_ACK',
    title: 'Sinyal darurat Anda diterima',
    body: `${req.user!.name} sedang menangani. Tetap di tempat aman.`,
    data: { panicId: alert.id },
  });
  res.json(alert);
});

router.post('/panic/:id/resolve', allow(...COMMAND), async (req, res) => {
  const alert = await prisma.panicAlert.update({
    where: { id: req.params.id },
    data: { status: 'RESOLVED', resolvedAt: new Date(), responseNote: req.body?.note || undefined },
  });

  // Menutup kejadian sekaligus mematikan sirene; membiarkannya berbunyi
  // setelah penanganan selesai justru menumpulkan kewaspadaan.
  const perangkat = await sireneUntukKejadian(alert.siteId, alert.floorId);
  const alarm = perangkat.length
    ? await jalankanAlarm({
        perangkat,
        aksi: 'OFF',
        alasan: 'Penanganan selesai',
        panicId: alert.id,
        sumber: 'PANIC',
        olehId: req.user!.sub,
      })
    : [];

  emitOps(WS_EVENTS.PANIC_ACK, alert, alert.siteId);
  res.json({ ...alert, alarm });
});

/** Posisi seluruh anggota yang sedang online (dari Redis). */
router.get('/tracking/live', allow(...COMMAND, 'CLIENT'), async (_req, res) => {
  res.json(await getPresence());
});

export default router;
