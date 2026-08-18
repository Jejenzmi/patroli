import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND, ADMIN_ONLY } from '../middleware/auth';
import { parsePaging, allowedSiteIds, isCommand } from '../lib/scope';
import { ciriDariUrl, wajahDiaktifkan } from '../lib/face';
import { audit } from '../lib/notify';

const router = Router();
router.use(auth);

router.get('/', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const { skip, take, page, pageSize } = parsePaging(req);
  const where: any = {};
  if (req.query.role) where.role = String(req.query.role);
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.siteId) where.homeSiteId = String(req.query.siteId);
  // Klien hanya melihat personel yang ditempatkan di site miliknya.
  const bolehIds = await allowedSiteIds(req);
  if (bolehIds !== null) where.homeSiteId = { in: bolehIds.length ? bolehIds : ['-tidak-boleh-'] };
  if (req.query.q)
    where.OR = [
      { name: { contains: String(req.query.q), mode: 'insensitive' } },
      { username: { contains: String(req.query.q), mode: 'insensitive' } },
      { employeeId: { contains: String(req.query.q), mode: 'insensitive' } },
    ];
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        employeeId: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        rank: true,
        avatarUrl: true,
        joinedAt: true,
        lastLoginAt: true,
        faceEnrolledAt: true,
        team: { select: { id: true, name: true } },
        homeSite: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  res.json({ data: rows, total, page, pageSize });
});

const userSchema = z.object({
  employeeId: z.string().optional().nullable(),
  username: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'GUARD', 'CLIENT']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'RESIGNED']).optional(),
  rank: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  homeSiteId: z.string().optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  joinedAt: z.string().optional().nullable(),
});

router.post('/', allow(...ADMIN_ONLY), async (req, res) => {
  const p = userSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data personel tidak lengkap', issues: p.error.issues });
  const { password, joinedAt, email, ...rest } = p.data;
  const exists = await prisma.user.findUnique({ where: { username: rest.username.toLowerCase() } });
  if (exists) return res.status(409).json({ message: 'Nama pengguna sudah dipakai' });
  const user = await prisma.user.create({
    data: {
      ...(rest as any),
      username: rest.username.toLowerCase(),
      email: email || null,
      joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
      passwordHash: await bcrypt.hash(password || 'patroli123', 10),
    },
  });
  await audit(req.user!.sub, 'CREATE', 'User', user.id, { role: user.role }, req.ip);
  const { passwordHash, ...safe } = user as any;
  res.status(201).json(safe);
});

router.put('/:id', allow(...ADMIN_ONLY), async (req, res) => {
  const p = userSchema.partial().safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });
  const { password, joinedAt, email, ...rest } = p.data;
  const data: any = { ...rest };
  if (email !== undefined) data.email = email || null;
  if (joinedAt) data.joinedAt = new Date(joinedAt);
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (data.username) data.username = String(data.username).toLowerCase();
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  await audit(req.user!.sub, 'UPDATE', 'User', user.id, null, req.ip);
  const { passwordHash, ...safe } = user as any;
  res.json(safe);
});

router.delete('/:id', allow(...ADMIN_ONLY), async (req, res) => {
  if (req.params.id === req.user!.sub)
    return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri' });
  await prisma.user.update({ where: { id: req.params.id }, data: { status: 'RESIGNED' } });
  await audit(req.user!.sub, 'DEACTIVATE', 'User', req.params.id, null, req.ip);
  res.json({ message: 'Personel dinonaktifkan' });
});

/** Mendaftarkan wajah personel dari foto (FR-ATT-005). */
router.post('/:id/face', async (req, res) => {
  const target = req.params.id;
  // Personel dapat mendaftarkan wajahnya sendiri; selebihnya hanya administrator.
  if (target !== req.user!.sub && !['SUPER_ADMIN', 'ADMIN'].includes(req.user!.role))
    return res.status(403).json({ message: 'Hak akses tidak mencukupi' });
  if (!wajahDiaktifkan())
    return res.status(503).json({ message: 'Layanan pengenalan wajah belum aktif' });

  const photoUrl = String(req.body?.photoUrl || '');
  if (!photoUrl) return res.status(400).json({ message: 'Foto wajah wajib diunggah lebih dulu' });

  const ciri = await ciriDariUrl(photoUrl);
  if (!ciri)
    return res.status(422).json({
      message: 'Wajah tidak terdeteksi. Gunakan foto menghadap kamera dengan pencahayaan cukup.',
    });

  await prisma.user.update({
    where: { id: target },
    data: { faceTemplate: ciri, faceEnrolledAt: new Date(), avatarUrl: photoUrl },
  });
  await audit(req.user!.sub, 'ENROLL_FACE', 'User', target, null, req.ip);
  res.json({ message: 'Wajah berhasil didaftarkan', dimensi: ciri.length });
});

/** Menghapus template wajah personel. */
router.delete('/:id/face', allow(...ADMIN_ONLY), async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    // Prisma mengabaikan undefined, jadi penghapusan harus memakai DbNull.
    data: { faceTemplate: Prisma.DbNull, faceEnrolledAt: null },
  });
  await audit(req.user!.sub, 'RESET_FACE', 'User', req.params.id, null, req.ip);
  res.json({ message: 'Template wajah dihapus' });
});

/** Ringkasan kinerja satu anggota — dipakai halaman profil personel & aplikasi lapangan. */
router.get('/:id/performance', async (req, res) => {
  const guardId = req.params.id;
  // Anggota boleh melihat kinerjanya sendiri; selebihnya hanya pengawas dan klien.
  const isSelf = guardId === req.user!.sub;
  if (!isSelf && !['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'CLIENT'].includes(req.user!.role))
    return res.status(403).json({ message: 'Hak akses tidak mencukupi' });

  if (!isSelf && !isCommand(req)) {
    // Klien hanya boleh menilai personel yang ditempatkan di site miliknya.
    const bolehIds = (await allowedSiteIds(req)) ?? [];
    const target = await prisma.user.findUnique({
      where: { id: guardId },
      select: { homeSiteId: true },
    });
    if (!target?.homeSiteId || !bolehIds.includes(target.homeSiteId))
      return res.status(403).json({ message: 'Personel ini di luar cakupan akses Anda' });
  }
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [sessions, attendance, incidents, user] = await Promise.all([
    prisma.patrolSession.findMany({
      where: { guardId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { route: { select: { name: true } }, site: { select: { name: true } } },
    }),
    prisma.attendance.findMany({ where: { guardId, checkInAt: { gte: since } } }),
    prisma.incident.count({ where: { reporterId: guardId, createdAt: { gte: since } } }),
    prisma.user.findUnique({
      where: { id: guardId },
      select: {
        id: true, name: true, employeeId: true, rank: true, phone: true, avatarUrl: true,
        joinedAt: true, status: true, homeSite: { select: { id: true, name: true } },
      },
    }),
  ]);
  const completed = sessions.filter((s) => s.status === 'COMPLETED');
  const avgCompliance = completed.length
    ? completed.reduce((a, s) => a + s.complianceRate, 0) / completed.length
    : 0;
  const late = attendance.filter((a) => a.status === 'LATE').length;
  res.json({
    user,
    period: '30 hari terakhir',
    patrolTotal: sessions.length,
    patrolCompleted: completed.length,
    avgCompliance: Math.round(avgCompliance * 10) / 10,
    attendanceTotal: attendance.length,
    lateCount: late,
    punctuality: attendance.length ? Math.round(((attendance.length - late) / attendance.length) * 1000) / 10 : 100,
    incidentsReported: incidents,
    recentSessions: sessions.slice(0, 10),
  });
});

/* ═══════════════ PERANGKAT TERIKAT & PELANGGARAN INTEGRITAS ═══════════════ */

/** Daftar perangkat yang terikat pada akun. */
router.get('/devices/list', allow(...COMMAND), async (req, res) => {
  const where: any = {};
  if (req.query.userId) where.userId = String(req.query.userId);
  const rows = await prisma.userDevice.findMany({
    where,
    orderBy: { lastSeenAt: 'desc' },
    take: 300,
    include: {
      user: {
        select: { id: true, name: true, username: true, employeeId: true, role: true, avatarUrl: true,
                  homeSite: { select: { id: true, name: true } } },
      },
    },
  });
  res.json(rows);
});

/**
 * Melepaskan ikatan perangkat.
 *
 * Dipakai ketika petugas berganti ponsel atau ponselnya hilang. Masuk
 * berikutnya akan mengikat ponsel yang baru.
 */
router.delete('/devices/:id', allow(...ADMIN_ONLY), async (req, res) => {
  const d = await prisma.userDevice.findUnique({ where: { id: req.params.id } });
  if (!d) return res.status(404).json({ message: 'Perangkat tidak ditemukan' });
  await prisma.userDevice.delete({ where: { id: d.id } });
  await audit(req.user!.sub, 'RELEASE_DEVICE', 'UserDevice', d.id, { userId: d.userId }, req.ip);
  res.json({ message: 'Ikatan perangkat dilepaskan' });
});

/** Memblokir atau mengaktifkan kembali sebuah perangkat. */
router.put('/devices/:id', allow(...ADMIN_ONLY), async (req, res) => {
  const status = String(req.body?.status || '').toUpperCase() === 'DIBLOKIR' ? 'DIBLOKIR' : 'AKTIF';
  const d = await prisma.userDevice.update({
    where: { id: req.params.id },
    data: { status: status as any, note: req.body?.note ?? undefined, releasedById: req.user!.sub },
  });
  await audit(req.user!.sub, 'UPDATE_DEVICE', 'UserDevice', d.id, { status }, req.ip);
  res.json(d);
});

/** Riwayat pelanggaran integritas: lokasi palsu, perpindahan mustahil, dan lainnya. */
router.get('/integrity/events', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const where: any = {};
  if (req.query.type) where.type = String(req.query.type);
  if (req.query.userId) where.userId = String(req.query.userId);
  const boleh = await allowedSiteIds(req);
  if (boleh !== null) where.siteId = { in: boleh.length ? boleh : ['-tidak-boleh-'] };

  const rows = await prisma.integrityEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(300, Number(req.query.limit) || 100),
    include: {
      user: { select: { id: true, name: true, employeeId: true, avatarUrl: true, role: true } },
      site: { select: { id: true, name: true } },
    },
  });
  res.json(rows);
});

/** Ringkasan pelanggaran untuk kartu di halaman pemantauan. */
router.get('/integrity/summary', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const sejak = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const rows = await prisma.integrityEvent.groupBy({
    by: ['type'],
    where: { createdAt: { gte: sejak } },
    _count: { _all: true },
  });
  const pelaku = await prisma.integrityEvent.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: sejak }, userId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 5,
  });
  const nama = await prisma.user.findMany({
    where: { id: { in: pelaku.map((p) => p.userId!).filter(Boolean) } },
    select: { id: true, name: true, employeeId: true },
  });
  res.json({
    perJenis: rows.map((r) => ({ type: r.type, jumlah: r._count._all })),
    teratas: pelaku.map((p) => ({
      user: nama.find((n) => n.id === p.userId) ?? null,
      jumlah: p._count._all,
    })),
  });
});

export default router;
