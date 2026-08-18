import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND } from '../middleware/auth';
import { dateKey, shiftStartAt, dayjs, TZ, startOfDay, endOfDay } from '../lib/time';
import { haversineMeters, WS_EVENTS } from '@patroli/shared';
import { emitOps } from '../lib/ws';
import { audit, notifyUsers } from '../lib/notify';
import { withSiteScope, bolehSite } from '../lib/scope';
import { cocokkanWajah, wajahAktif } from '../lib/face';

const router = Router();
router.use(auth);

/* ─────────────────────────── ROSTER / JADWAL JAGA ─────────────────────────── */

router.get('/', async (req, res) => {
  const from = req.query.from ? dateKey(String(req.query.from)) : dateKey();
  const to = req.query.to
    ? dateKey(String(req.query.to))
    : dateKey(dayjs().add(6, 'day').toISOString());
  let where: any = { date: { gte: from, lte: to } };
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.guardId) where.guardId = String(req.query.guardId);
  if (req.user!.role === 'GUARD') where.guardId = req.user!.sub;
  if (req.user!.role === 'CLIENT') where = await withSiteScope(req, where);

  const rows = await prisma.schedule.findMany({
    where,
    orderBy: [{ date: 'asc' }, { shiftId: 'asc' }],
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true, phone: true } },
      shift: true,
      site: { select: { id: true, name: true, code: true } },
      route: { select: { id: true, name: true } },
      attendance: true,
    },
  });
  res.json(rows);
});

const scheduleSchema = z.object({
  siteId: z.string(),
  shiftId: z.string(),
  guardId: z.string(),
  routeId: z.string().optional().nullable(),
  date: z.string(),
  notes: z.string().optional().nullable(),
});

router.post('/', allow(...COMMAND), async (req, res) => {
  const p = scheduleSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data jadwal tidak lengkap' });
  const data = { ...p.data, date: dateKey(p.data.date) };
  const dup = await prisma.schedule.findFirst({
    where: { guardId: data.guardId, date: data.date, shiftId: data.shiftId },
  });
  if (dup) return res.status(409).json({ message: 'Anggota sudah dijadwalkan pada shift ini' });
  const s = await prisma.schedule.create({ data: data as any });
  await notifyUsers([data.guardId], {
    type: 'SCHEDULE',
    title: 'Jadwal jaga baru',
    body: `Anda dijadwalkan pada ${dayjs(data.date).format('DD MMM YYYY')}`,
    data: { scheduleId: s.id },
  });
  await audit(req.user!.sub, 'CREATE', 'Schedule', s.id, data, req.ip);
  res.status(201).json(s);
});

/** Buat roster massal: satu guard untuk rentang tanggal. */
router.post('/bulk', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    siteId: z.string(),
    shiftId: z.string(),
    guardIds: z.array(z.string()).min(1),
    routeId: z.string().optional().nullable(),
    from: z.string(),
    to: z.string(),
    /** 0=Minggu … 6=Sabtu; kosong berarti semua hari */
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    /** Instruksi khusus yang berlaku untuk seluruh penugasan pada rentang ini. */
    notes: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Parameter roster massal tidak valid' });
  const { siteId, shiftId, guardIds, routeId, from, to, weekdays, notes } = p.data;

  const rows: any[] = [];
  let cursor = dayjs(from).tz(TZ).startOf('day');
  const end = dayjs(to).tz(TZ).startOf('day');
  let guard = 0;
  while (cursor.isBefore(end) || cursor.isSame(end)) {
    if (!weekdays?.length || weekdays.includes(cursor.day())) {
      for (const guardId of guardIds) {
        rows.push({
          siteId,
          shiftId,
          guardId,
          routeId: routeId || null,
          notes: notes || null,
          date: dateKey(cursor.toISOString()),
        });
      }
    }
    cursor = cursor.add(1, 'day');
    if (++guard > 400) break;
  }
  const result = await prisma.schedule.createMany({ data: rows, skipDuplicates: true });
  await audit(req.user!.sub, 'BULK_CREATE', 'Schedule', null, { count: result.count }, req.ip);
  res.json({ created: result.count, requested: rows.length });
});

router.put('/:id', allow(...COMMAND), async (req, res) => {
  const data: any = { ...req.body };
  if (data.date) data.date = dateKey(data.date);
  const s = await prisma.schedule.update({ where: { id: req.params.id }, data });
  res.json(s);
});

router.delete('/:id', allow(...COMMAND), async (req, res) => {
  await prisma.schedule.delete({ where: { id: req.params.id } });
  res.json({ message: 'Jadwal dihapus' });
});

/** Jadwal aktif milik anggota hari ini (dipakai aplikasi mobile). */
router.get('/my/today', async (req, res) => {
  const today = dateKey();
  const rows = await prisma.schedule.findMany({
    where: { guardId: req.user!.sub, date: { gte: today, lte: dateKey(dayjs().add(1, 'day').toISOString()) } },
    include: {
      shift: true,
      site: true,
      attendance: true,
      route: { include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } } },
    },
    orderBy: { date: 'asc' },
  });
  res.json(rows);
});

/* ─────────────────────────── PRESENSI ─────────────────────────── */

const checkInSchema = z.object({
  scheduleId: z.string().optional().nullable(),
  siteId: z.string(),
  lat: z.number(),
  lng: z.number(),
  photoUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/attendance/check-in', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const p = checkInSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Lokasi dan site wajib dikirim' });
  const { scheduleId, siteId, lat, lng, photoUrl, notes } = p.data;
  const guardId = req.user!.sub;

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return res.status(404).json({ message: 'Site tidak ditemukan' });
  if (!(await bolehSite(req, siteId)))
    return res.status(403).json({ message: 'Anda tidak ditempatkan pada site ini' });

  const distance = Math.round(haversineMeters(lat, lng, site.lat, site.lng));

  // FR-ATT-006 / BRULE-004: setiap penolakan disimpan sebagai bukti.
  const catatGagal = (result: any, reason: string, faceScore?: number | null) =>
    prisma.attendanceAttempt.create({
      data: {
        guardId,
        siteId,
        result,
        reason,
        lat,
        lng,
        distanceM: distance,
        faceScore: faceScore ?? null,
        photoUrl: photoUrl || null,
      },
    });

  if (distance > site.radiusM) {
    const pesan = `Anda berada ${distance} m dari pos (batas ${site.radiusM} m). Presensi harus dilakukan di area site.`;
    await catatGagal('DILUAR_RADIUS', pesan);
    return res.status(422).json({ message: pesan, distanceM: distance });
  }

  // FR-ATT-005 / BRULE-003: wajah dicocokkan dengan template terdaftar.
  let faceScore: number | null = null;
  if (await wajahAktif(guardId)) {
    const hasil = await cocokkanWajah(guardId, photoUrl || null);
    faceScore = hasil.score;
    if (!hasil.ok) {
      await catatGagal(hasil.result, hasil.message, hasil.score);
      return res.status(422).json({ message: hasil.message, faceScore: hasil.score });
    }
  }

  const existing = await prisma.attendance.findFirst({
    where: { guardId, checkOutAt: null, checkInAt: { gte: startOfDay(new Date()) } },
  });
  if (existing) {
    const pesan = 'Anda masih dalam status masuk. Lakukan presensi pulang dulu.';
    await catatGagal('SUDAH_MASUK', pesan, faceScore);
    return res.status(409).json({ message: pesan });
  }

  let status: 'ON_TIME' | 'LATE' = 'ON_TIME';
  let lateMinutes = 0;
  if (scheduleId) {
    const sch = await prisma.schedule.findUnique({ where: { id: scheduleId }, include: { shift: true } });
    if (sch) {
      const expected = shiftStartAt(sch.date, sch.shift.startTime);
      const diff = Math.round((Date.now() - expected.getTime()) / 60000);
      if (diff > sch.shift.lateToleranceMin) {
        status = 'LATE';
        lateMinutes = diff;
      }
      await prisma.schedule.update({ where: { id: scheduleId }, data: { status: 'CONFIRMED' } });
    }
  }

  const att = await prisma.attendance.create({
    data: {
      scheduleId: scheduleId || null,
      guardId,
      siteId,
      checkInAt: new Date(),
      checkInLat: lat,
      checkInLng: lng,
      checkInPhoto: photoUrl || null,
      checkInDistanceM: distance,
      faceScore,
      status,
      lateMinutes,
      notes: notes || null,
    },
    include: { guard: { select: { id: true, name: true, avatarUrl: true } }, site: { select: { name: true } } },
  });

  emitOps(WS_EVENTS.ATTENDANCE, { type: 'CHECK_IN', attendance: att }, siteId);
  await audit(guardId, 'CHECK_IN', 'Attendance', att.id, { distance, status }, req.ip);
  res.status(201).json({ ...att, distanceM: distance });
});

router.post('/attendance/check-out', allow(...COMMAND, 'GUARD'), async (req, res) => {
  const schema = z.object({
    lat: z.number(),
    lng: z.number(),
    photoUrl: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Lokasi wajib dikirim' });

  const open = await prisma.attendance.findFirst({
    where: { guardId: req.user!.sub, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
    include: { schedule: { include: { shift: true } } },
  });
  if (!open) return res.status(404).json({ message: 'Tidak ada presensi masuk yang aktif' });

  const now = new Date();
  const worked = open.checkInAt ? Math.round((now.getTime() - open.checkInAt.getTime()) / 60000) : 0;

  let status = open.status;
  if (open.schedule) {
    const endAt = shiftStartAt(open.schedule.date, open.schedule.shift.endTime);
    const adjusted = open.schedule.shift.crossesMidnight
      ? new Date(endAt.getTime() + 24 * 3600 * 1000)
      : endAt;
    if (now.getTime() < adjusted.getTime() - 15 * 60000) status = 'EARLY_LEAVE';
    await prisma.schedule.update({ where: { id: open.schedule.id }, data: { status: 'DONE' } });
  }

  const att = await prisma.attendance.update({
    where: { id: open.id },
    data: {
      checkOutAt: now,
      checkOutLat: p.data.lat,
      checkOutLng: p.data.lng,
      checkOutPhoto: p.data.photoUrl || null,
      workedMinutes: worked,
      status,
      notes: p.data.notes ? `${open.notes ? open.notes + ' | ' : ''}${p.data.notes}` : open.notes,
    },
    include: { guard: { select: { id: true, name: true } } },
  });

  emitOps(WS_EVENTS.ATTENDANCE, { type: 'CHECK_OUT', attendance: att }, open.siteId);
  await audit(req.user!.sub, 'CHECK_OUT', 'Attendance', att.id, { worked }, req.ip);
  res.json(att);
});

router.get('/attendance', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.guardId) where.guardId = String(req.query.guardId);
  if (req.user!.role === 'GUARD') where.guardId = req.user!.sub;
  if (req.user!.role === 'CLIENT') where = await withSiteScope(req, where);
  if (req.query.from || req.query.to) {
    where.checkInAt = {};
    if (req.query.from) where.checkInAt.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.checkInAt.lte = endOfDay(new Date(String(req.query.to)));
  }
  const rows = await prisma.attendance.findMany({
    where,
    orderBy: { checkInAt: 'desc' },
    take: Math.min(500, Number(req.query.limit) || 100),
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      site: { select: { id: true, name: true } },
      schedule: { include: { shift: true } },
    },
  });
  res.json(rows);
});

/** Percobaan presensi yang ditolak — bukti monitoring (FR-ATT-006). */
router.get('/attendance/attempts', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  // NFR Audit Trail: percobaan presensi memuat foto wajah dan koordinat.
  await audit(req.user!.sub, 'READ_ATTENDANCE_ATTEMPTS', 'AttendanceAttempt', null, req.query, req.ip);
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.guardId) where.guardId = String(req.query.guardId);
  where = await withSiteScope(req, where);
  const rows = await prisma.attendanceAttempt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(300, Number(req.query.limit) || 100),
    include: {
      guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      site: { select: { id: true, name: true } },
    },
  });
  res.json(rows);
});

/** Status presensi anggota saat ini (mobile: tombol masuk/pulang). */
router.get('/attendance/current', async (req, res) => {
  const open = await prisma.attendance.findFirst({
    where: { guardId: req.user!.sub, checkOutAt: null },
    orderBy: { checkInAt: 'desc' },
    include: { site: { select: { id: true, name: true, lat: true, lng: true, radiusM: true } } },
  });
  res.json(open);
});

export default router;
