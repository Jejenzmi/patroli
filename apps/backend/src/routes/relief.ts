import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND, ADMIN_ONLY } from '../middleware/auth';
import { dayjs, dateKey, shiftStartAt } from '../lib/time';
import { audit, notifyUsers, notifyCommand } from '../lib/notify';
import { allowedSiteIds } from '../lib/scope';
import {
  calonPengganti,
  periksaKelelahan,
  konfigKelelahan,
  KELELAHAN_BAWAAN,
  posKosong,
} from '../lib/roster';
import { alasanTidakBolehBertugas } from '../lib/kepatuhan';

const router = Router();
router.use(auth);

/**
 * Pengisian pos kosong.
 *
 * Alur: pos kosong terlihat di papan → komandan membuka tawaran → sistem
 * memeringkat calon dan memberi tahu mereka → yang pertama menyanggupi
 * langsung masuk roster. Semua langkah tercatat, termasuk alasan pemeringkatan.
 */

/* ═══════════════ PAPAN POS KOSONG ═══════════════ */

router.get('/pos-kosong', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const tanggal = dateKey(req.query.tanggal ? String(req.query.tanggal) : undefined);
  let siteId = req.query.siteId ? String(req.query.siteId) : undefined;

  // Klien hanya boleh melihat sitenya sendiri.
  const boleh = await allowedSiteIds(req);
  if (boleh !== null) {
    if (siteId && !boleh.includes(siteId)) return res.status(403).json({ message: 'Site di luar cakupan akses Anda' });
    if (!siteId && boleh.length === 1) siteId = boleh[0];
  }

  const hasil = await posKosong(tanggal, siteId);
  if (boleh !== null) hasil.baris = hasil.baris.filter((b) => boleh.includes(b.siteId));
  res.json(hasil);
});

/* ═══════════════ TAWARAN PENGGANTI ═══════════════ */

router.get('/', allow(...COMMAND), async (req, res) => {
  const rows = await prisma.reliefOffer.findMany({
    where: {
      ...(req.query.status ? { status: String(req.query.status) as any } : {}),
      ...(req.query.tanggal ? { date: dateKey(String(req.query.tanggal)) } : {}),
    },
    include: {
      site: { select: { id: true, name: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      takenBy: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      createdBy: { select: { name: true } },
      candidates: {
        include: { guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } } },
        orderBy: { score: 'desc' },
      },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });
  res.json(rows);
});

/** Tawaran yang masih terbuka untuk anggota yang sedang masuk. */
router.get('/saya', async (req, res) => {
  const rows = await prisma.reliefCandidate.findMany({
    where: { guardId: req.user!.sub, offer: { status: 'TERBUKA', date: { gte: dateKey() } } },
    include: {
      offer: {
        include: {
          site: { select: { id: true, name: true, address: true } },
          shift: { select: { name: true, startTime: true, endTime: true } },
        },
      },
    },
    orderBy: { offer: { date: 'asc' } },
  });
  res.json(
    rows.map((r) => ({
      candidateId: r.id,
      offerId: r.offerId,
      score: r.score,
      distanceM: r.distanceM,
      response: r.response,
      site: r.offer.site,
      shift: r.offer.shift,
      date: r.offer.date,
      reason: r.offer.reason,
      note: r.offer.note,
    }))
  );
});

/** Pratinjau calon tanpa membuka tawaran. */
router.get('/calon', allow(...COMMAND), async (req, res) => {
  const siteId = String(req.query.siteId || '');
  const shiftId = String(req.query.shiftId || '');
  if (!siteId || !shiftId) return res.status(400).json({ message: 'Site dan shift wajib dipilih' });
  const tanggal = dateKey(req.query.tanggal ? String(req.query.tanggal) : undefined);
  res.json(await calonPengganti(siteId, shiftId, tanggal, Number(req.query.batas) || 10));
});

router.post('/', allow(...COMMAND), async (req, res) => {
  const p = z
    .object({
      siteId: z.string(),
      shiftId: z.string(),
      tanggal: z.string(),
      reason: z.string().min(3),
      scheduleId: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
      /** Jumlah calon teratas yang langsung diberi tahu */
      beritahu: z.number().int().min(1).max(20).default(5),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Site, shift, tanggal, dan alasan wajib diisi' });

  const tanggal = dateKey(p.data.tanggal);
  const shift = await prisma.shift.findUnique({ where: { id: p.data.shiftId } });
  if (!shift) return res.status(404).json({ message: 'Shift tidak ditemukan' });

  const kembar = await prisma.reliefOffer.findFirst({
    where: { siteId: p.data.siteId, shiftId: p.data.shiftId, date: tanggal, status: 'TERBUKA' },
  });
  if (kembar)
    return res.status(409).json({ message: 'Sudah ada tawaran terbuka untuk shift dan tanggal yang sama' });

  const calon = await calonPengganti(p.data.siteId, p.data.shiftId, tanggal, 20);

  const offer = await prisma.reliefOffer.create({
    data: {
      siteId: p.data.siteId,
      shiftId: p.data.shiftId,
      date: tanggal,
      scheduleId: p.data.scheduleId || null,
      reason: p.data.reason,
      note: p.data.note,
      createdById: req.user!.sub,
      // Tawaran gugur begitu shift dimulai — mengisi pos setelah itu tidak ada gunanya.
      expiresAt: shiftStartAt(tanggal, shift.startTime),
      candidates: {
        create: calon.map((c) => ({
          guardId: c.guardId,
          score: c.score,
          distanceM: c.distanceM,
          reasons: c.reasons as any,
        })),
      },
    },
    include: { site: { select: { name: true } } },
  });

  const diberitahu = calon.slice(0, p.data.beritahu);
  if (diberitahu.length) {
    await notifyUsers(
      diberitahu.map((c) => c.guardId),
      {
        type: 'TAWARAN_SHIFT',
        title: 'Tawaran shift pengganti',
        body: `${offer.site.name} — ${shift.name} (${shift.startTime}–${shift.endTime}) pada ${dayjs(tanggal).format('DD MMM YYYY')}. Buka menu Tawaran Shift bila bersedia.`,
        data: { offerId: offer.id },
      }
    );
    await prisma.reliefCandidate.updateMany({
      where: { offerId: offer.id, guardId: { in: diberitahu.map((c) => c.guardId) } },
      data: { notifiedAt: new Date() },
    });
  }

  await audit(req.user!.sub, 'CREATE', 'ReliefOffer', offer.id, { calon: calon.length }, req.ip);
  res.status(201).json({ ...offer, calon });
});

/** Anggota menyanggupi; pos langsung terisi. */
router.post('/:id/ambil', async (req, res) => {
  const guardId = req.user!.sub;
  const offer = await prisma.reliefOffer.findUnique({
    where: { id: req.params.id },
    include: { site: { select: { name: true } }, shift: { select: { name: true, startTime: true } } },
  });
  if (!offer) return res.status(404).json({ message: 'Tawaran tidak ditemukan' });
  if (offer.status !== 'TERBUKA')
    return res.status(409).json({ message: 'Tawaran ini sudah tidak terbuka — mungkin sudah diambil orang lain' });
  if (offer.expiresAt && offer.expiresAt < new Date())
    return res.status(409).json({ message: 'Tawaran sudah lewat waktu mulai shift' });

  const calon = await prisma.reliefCandidate.findUnique({
    where: { offerId_guardId: { offerId: offer.id, guardId } },
  });
  if (!calon) return res.status(403).json({ message: 'Anda tidak termasuk calon pada tawaran ini' });

  const halangan = await alasanTidakBolehBertugas(guardId);
  if (halangan) return res.status(422).json({ message: halangan });

  const k = await konfigKelelahan();
  const pelanggaran = await periksaKelelahan(guardId, offer.shiftId, offer.date, k);
  if (pelanggaran.length && k.tegakkan)
    return res.status(422).json({ message: pelanggaran[0].pesan, code: 'BATAS_JAM_KERJA' });

  const sudah = await prisma.schedule.findFirst({
    where: { guardId, date: offer.date, shiftId: offer.shiftId },
  });
  if (sudah) return res.status(409).json({ message: 'Anda sudah dijadwalkan pada shift ini' });

  // Perebutan tawaran diselesaikan di satu transaksi: hanya perubahan status
  // dari TERBUKA yang berhasil, sisanya gagal dan diberi tahu.
  const hasil = await prisma.$transaction(async (tx) => {
    const kunci = await tx.reliefOffer.updateMany({
      where: { id: offer.id, status: 'TERBUKA' },
      data: { status: 'DIAMBIL', takenById: guardId, takenAt: new Date() },
    });
    if (!kunci.count) return null;

    const jadwal = await tx.schedule.create({
      data: {
        siteId: offer.siteId,
        shiftId: offer.shiftId,
        guardId,
        date: offer.date,
        status: 'CONFIRMED',
        notes: `Pengganti — ${offer.reason}`,
      },
    });
    await tx.reliefCandidate.update({
      where: { id: calon.id },
      data: { response: 'BERSEDIA', respondedAt: new Date() },
    });
    // Jadwal yang ditinggalkan ditandai agar tidak ikut terhitung sebagai mangkir.
    if (offer.scheduleId)
      await tx.schedule.update({ where: { id: offer.scheduleId }, data: { status: 'SWAPPED' } });
    return jadwal;
  });

  if (!hasil) return res.status(409).json({ message: 'Tawaran baru saja diambil orang lain' });

  const orang = await prisma.user.findUnique({ where: { id: guardId }, select: { name: true } });
  await notifyCommand(
    {
      type: 'TAWARAN_DIAMBIL',
      title: 'Pos kosong terisi',
      body: `${orang?.name} menyanggupi ${offer.shift.name} di ${offer.site.name} pada ${dayjs(offer.date).format('DD MMM YYYY')}.`,
      data: { offerId: offer.id, scheduleId: hasil.id },
    },
    offer.siteId
  );
  await audit(guardId, 'TAKE', 'ReliefOffer', offer.id, { scheduleId: hasil.id }, req.ip);
  res.json({ ok: true, scheduleId: hasil.id });
});

/** Anggota menyatakan tidak bisa — agar komandan tahu harus mencari lagi. */
router.post('/:id/tolak', async (req, res) => {
  const calon = await prisma.reliefCandidate.findUnique({
    where: { offerId_guardId: { offerId: req.params.id, guardId: req.user!.sub } },
  });
  if (!calon) return res.status(404).json({ message: 'Anda tidak termasuk calon pada tawaran ini' });
  await prisma.reliefCandidate.update({
    where: { id: calon.id },
    data: { response: 'TIDAK_BISA', respondedAt: new Date() },
  });
  res.json({ ok: true });
});

/** Komandan menugaskan langsung tanpa menunggu kesanggupan. */
router.post('/:id/tugaskan', allow(...COMMAND), async (req, res) => {
  const p = z.object({ guardId: z.string() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Personel wajib dipilih' });

  const offer = await prisma.reliefOffer.findUnique({ where: { id: req.params.id } });
  if (!offer) return res.status(404).json({ message: 'Tawaran tidak ditemukan' });
  if (offer.status !== 'TERBUKA') return res.status(409).json({ message: 'Tawaran ini sudah tidak terbuka' });

  const halangan = await alasanTidakBolehBertugas(p.data.guardId);
  if (halangan) return res.status(422).json({ message: halangan });

  const jadwal = await prisma.$transaction(async (tx) => {
    const s = await tx.schedule.create({
      data: {
        siteId: offer.siteId,
        shiftId: offer.shiftId,
        guardId: p.data.guardId,
        date: offer.date,
        status: 'CONFIRMED',
        notes: `Penugasan pengganti — ${offer.reason}`,
      },
    });
    await tx.reliefOffer.update({
      where: { id: offer.id },
      data: { status: 'DIAMBIL', takenById: p.data.guardId, takenAt: new Date() },
    });
    if (offer.scheduleId)
      await tx.schedule.update({ where: { id: offer.scheduleId }, data: { status: 'SWAPPED' } });
    return s;
  });

  await notifyUsers([p.data.guardId], {
    type: 'SCHEDULE',
    title: 'Anda ditugaskan sebagai pengganti',
    body: `Penugasan pada ${dayjs(offer.date).format('DD MMM YYYY')}. Periksa jadwal Anda.`,
    data: { scheduleId: jadwal.id },
  });
  await audit(req.user!.sub, 'ASSIGN', 'ReliefOffer', offer.id, p.data, req.ip);
  res.json({ ok: true, scheduleId: jadwal.id });
});

router.post('/:id/batal', allow(...COMMAND), async (req, res) => {
  const offer = await prisma.reliefOffer.update({
    where: { id: req.params.id },
    data: { status: 'DIBATALKAN' },
  });
  await audit(req.user!.sub, 'CANCEL', 'ReliefOffer', offer.id, null, req.ip);
  res.json({ ok: true });
});

/* ═══════════════ PAGAR JAM KERJA ═══════════════ */

router.get('/kelelahan/config', allow(...COMMAND), async (_req, res) => {
  res.json({ ...(await konfigKelelahan()), bawaan: KELELAHAN_BAWAAN });
});

router.put('/kelelahan/config', allow(...ADMIN_ONLY), async (req, res) => {
  const p = z
    .object({
      maksHariBerturut: z.number().int().min(1).max(31),
      maksJamPekan: z.number().int().min(20).max(120),
      minJedaJam: z.number().int().min(0).max(24),
      tegakkan: z.boolean(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Nilai pagar jam kerja di luar rentang wajar' });
  await prisma.setting.upsert({
    where: { key: 'roster.kelelahan' },
    create: { key: 'roster.kelelahan', value: p.data },
    update: { value: p.data },
  });
  await audit(req.user!.sub, 'UPDATE', 'Setting', 'roster.kelelahan', p.data, req.ip);
  res.json(p.data);
});

/** Memeriksa satu rencana penugasan sebelum disimpan. */
router.get('/kelelahan/periksa', allow(...COMMAND), async (req, res) => {
  const guardId = String(req.query.guardId || '');
  const shiftId = String(req.query.shiftId || '');
  if (!guardId || !shiftId) return res.status(400).json({ message: 'Personel dan shift wajib dipilih' });
  const tanggal = dateKey(req.query.tanggal ? String(req.query.tanggal) : undefined);
  const pelanggaran = await periksaKelelahan(guardId, shiftId, tanggal);
  res.json({ aman: pelanggaran.length === 0, pelanggaran, ...(await konfigKelelahan()) });
});

export default router;
