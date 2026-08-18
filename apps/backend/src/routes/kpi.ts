import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND, ADMIN_ONLY } from '../middleware/auth';
import { allowedSiteIds, isCommand } from '../lib/scope';
import { dayjs, TZ } from '../lib/time';
import { audit } from '../lib/notify';

const router = Router();
router.use(auth);

/**
 * Mesin KPI (FR-KPI-001..005).
 *
 * Nilai akhir 0–100 dari lima komponen berbobot. Bobot bawaan mengikuti
 * proposal teknis dan dapat diubah manajemen lewat pengaturan.
 */

export interface BobotKpi {
  kehadiran: number;
  patroli: number;
  ronde: number;
  pelaporan: number;
  penilaian: number;
}

const BOBOT_BAWAAN: BobotKpi = {
  kehadiran: 25,
  patroli: 30,
  ronde: 15,
  pelaporan: 10,
  penilaian: 20,
};

/** Jumlah laporan insiden per bulan yang dianggap wajar sebagai nilai penuh. */
const BATAS_WAJAR_LAPORAN = 4;

async function ambilBobot(): Promise<BobotKpi> {
  const s = await prisma.setting.findUnique({ where: { key: 'kpi.bobot' } });
  if (!s) return BOBOT_BAWAAN;
  const v = s.value as any;
  return { ...BOBOT_BAWAAN, ...v };
}

export function predikat(nilai: number): string {
  if (nilai >= 90) return 'A';
  if (nilai >= 80) return 'B';
  if (nilai >= 70) return 'C';
  if (nilai >= 60) return 'D';
  return 'E';
}

/** Menghitung KPI seluruh anggota pada satu periode (YYYY-MM). */
async function hitungKpi(periode: string, siteIds: string[] | null) {
  const awal = dayjs.tz(`${periode}-01 00:00`, TZ).toDate();
  const akhir = dayjs(awal).add(1, 'month').toDate();
  const bobot = await ambilBobot();

  const anggota = await prisma.user.findMany({
    where: {
      role: { in: ['GUARD', 'SUPERVISOR'] },
      status: 'ACTIVE',
      ...(siteIds ? { homeSiteId: { in: siteIds.length ? siteIds : ['-'] } } : {}),
    },
    select: {
      id: true,
      name: true,
      employeeId: true,
      avatarUrl: true,
      homeSite: { select: { id: true, name: true } },
    },
  });
  if (!anggota.length) return { periode, bobot, data: [] };

  const ids = anggota.map((a) => a.id);

  const [presensi, percobaan, sesi, insiden, penilaian] = await Promise.all([
    prisma.attendance.findMany({
      where: { guardId: { in: ids }, checkInAt: { gte: awal, lt: akhir } },
      select: { guardId: true, status: true, faceScore: true, checkInDistanceM: true },
    }),
    prisma.attendanceAttempt.groupBy({
      by: ['guardId'],
      where: { guardId: { in: ids }, createdAt: { gte: awal, lt: akhir } },
      _count: { _all: true },
    }),
    prisma.patrolSession.findMany({
      where: { guardId: { in: ids }, startedAt: { gte: awal, lt: akhir } },
      select: { guardId: true, complianceRate: true, status: true, totalCheckpoints: true, scannedCount: true },
    }),
    prisma.incident.groupBy({
      by: ['reporterId'],
      where: { reporterId: { in: ids }, occurredAt: { gte: awal, lt: akhir } },
      _count: { _all: true },
    }),
    prisma.assessment.findMany({
      where: { guardId: { in: ids }, period: periode },
      select: {
        guardId: true,
        assessorRole: true,
        disiplin: true,
        penampilan: true,
        responsif: true,
        kualitasLaporan: true,
        komunikasi: true,
      },
    }),
  ]);

  const kelompok = <T extends { guardId: string }>(arr: T[]) => {
    const m = new Map<string, T[]>();
    arr.forEach((x) => m.set(x.guardId, [...(m.get(x.guardId) || []), x]));
    return m;
  };
  const mPresensi = kelompok(presensi);
  const mSesi = kelompok(sesi);
  const mNilai = kelompok(penilaian);
  const mPercobaan = new Map(percobaan.map((p) => [p.guardId, p._count._all]));
  const mInsiden = new Map(insiden.map((i) => [i.reporterId, i._count._all]));

  const data = anggota.map((a) => {
    const pr = mPresensi.get(a.id) || [];
    const ss = mSesi.get(a.id) || [];
    const nl = mNilai.get(a.id) || [];

    // 1. Kehadiran: tepat waktu, di dalam radius, dan lolos verifikasi wajah.
    const gagal = mPercobaan.get(a.id) || 0;
    const tepat = pr.filter((x) => x.status === 'ON_TIME').length;
    const totalPresensi = pr.length + gagal;
    const nKehadiran = totalPresensi ? (tepat / totalPresensi) * 100 : 0;

    // 2. Penyelesaian patroli: rata-rata kemajuan seluruh ronde.
    const nPatroli = ss.length ? ss.reduce((s, x) => s + x.complianceRate, 0) / ss.length : 0;

    // 3. Ronde tuntas 100%.
    const tuntas = ss.filter((x) => x.totalCheckpoints > 0 && x.scannedCount >= x.totalCheckpoints).length;
    const nRonde = ss.length ? (tuntas / ss.length) * 100 : 0;

    // 4. Aktivitas pelaporan, dinormalisasi terhadap batas wajar.
    const jmlLaporan = mInsiden.get(a.id) || 0;
    const nPelaporan = Math.min(100, (jmlLaporan / BATAS_WAJAR_LAPORAN) * 100);

    // 5. Penilaian manual Danru dan Klien (skala 1–5 → 0–100).
    const rata = (x: any) =>
      (x.disiplin + x.penampilan + x.responsif + x.kualitasLaporan + x.komunikasi) / 5;
    const nPenilaian = nl.length ? (nl.reduce((s, x) => s + rata(x), 0) / nl.length / 5) * 100 : 0;

    const nilai =
      (nKehadiran * bobot.kehadiran +
        nPatroli * bobot.patroli +
        nRonde * bobot.ronde +
        nPelaporan * bobot.pelaporan +
        nPenilaian * bobot.penilaian) /
      (bobot.kehadiran + bobot.patroli + bobot.ronde + bobot.pelaporan + bobot.penilaian);

    const bulat = (n: number) => Math.round(n * 10) / 10;

    return {
      guardId: a.id,
      name: a.name,
      employeeId: a.employeeId,
      avatarUrl: a.avatarUrl,
      site: a.homeSite,
      komponen: {
        kehadiran: bulat(nKehadiran),
        patroli: bulat(nPatroli),
        ronde: bulat(nRonde),
        pelaporan: bulat(nPelaporan),
        penilaian: bulat(nPenilaian),
      },
      rincian: {
        presensiTepat: tepat,
        presensiTotal: pr.length,
        presensiGagal: gagal,
        sesiPatroli: ss.length,
        rondeTuntas: tuntas,
        laporanInsiden: jmlLaporan,
        jumlahPenilai: nl.length,
      },
      nilai: bulat(nilai),
      predikat: predikat(nilai),
    };
  });

  data.sort((a, b) => b.nilai - a.nilai);
  return { periode, bobot, data };
}

/** Peringkat KPI satu periode. */
router.get('/', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const periode = String(req.query.period || dayjs().tz(TZ).format('YYYY-MM'));
  const hasil = await hitungKpi(periode, await allowedSiteIds(req));
  res.json(hasil);
});

/** KPI satu anggota beserta tren enam bulan terakhir (FR-KPI-004). */
router.get('/:guardId', async (req, res) => {
  const guardId = req.params.guardId;
  if (guardId !== req.user!.sub && !isCommand(req) && req.user!.role !== 'CLIENT')
    return res.status(403).json({ message: 'Hak akses tidak mencukupi' });

  if (req.user!.role === 'CLIENT') {
    const boleh = (await allowedSiteIds(req)) ?? [];
    const target = await prisma.user.findUnique({
      where: { id: guardId },
      select: { homeSiteId: true },
    });
    if (!target?.homeSiteId || !boleh.includes(target.homeSiteId))
      return res.status(403).json({ message: 'Personel ini di luar cakupan akses Anda' });
  }

  const periode = String(req.query.period || dayjs().tz(TZ).format('YYYY-MM'));
  const tren: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const p = dayjs(`${periode}-01`).subtract(i, 'month').format('YYYY-MM');
    const h = await hitungKpi(p, null);
    const baris = h.data.find((d) => d.guardId === guardId);
    tren.push({ periode: p, nilai: baris?.nilai ?? 0, predikat: baris?.predikat ?? 'E' });
  }

  const sekarang = await hitungKpi(periode, null);
  const saya = sekarang.data.find((d) => d.guardId === guardId) ?? null;
  const peringkat = sekarang.data.findIndex((d) => d.guardId === guardId) + 1;

  const penilaian = await prisma.assessment.findMany({
    where: { guardId, period: periode },
    include: { assessor: { select: { id: true, name: true, role: true } } },
  });

  res.json({ periode, bobot: sekarang.bobot, kpi: saya, peringkat, dari: sekarang.data.length, tren, penilaian });
});

/* ═══════════════ PENILAIAN MANUAL (Danru & Klien) ═══════════════ */

const nilaiSchema = z.object({
  guardId: z.string(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  disiplin: z.number().int().min(1).max(5),
  penampilan: z.number().int().min(1).max(5),
  responsif: z.number().int().min(1).max(5),
  kualitasLaporan: z.number().int().min(1).max(5),
  komunikasi: z.number().int().min(1).max(5),
  note: z.string().optional().nullable(),
});

router.post('/assessments', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const p = nilaiSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Penilaian harus bernilai 1–5 pada semua aspek' });

  // Klien hanya boleh menilai personel di site miliknya.
  if (req.user!.role === 'CLIENT') {
    const boleh = (await allowedSiteIds(req)) ?? [];
    const target = await prisma.user.findUnique({
      where: { id: p.data.guardId },
      select: { homeSiteId: true },
    });
    if (!target?.homeSiteId || !boleh.includes(target.homeSiteId))
      return res.status(403).json({ message: 'Personel ini di luar cakupan akses Anda' });
  }

  const assessorRole = req.user!.role === 'CLIENT' ? 'KLIEN' : 'DANRU';
  const a = await prisma.assessment.upsert({
    where: {
      guardId_assessorId_period: {
        guardId: p.data.guardId,
        assessorId: req.user!.sub,
        period: p.data.period,
      },
    },
    create: { ...(p.data as any), assessorId: req.user!.sub, assessorRole },
    update: { ...(p.data as any), assessorRole },
  });
  await audit(req.user!.sub, 'ASSESS', 'Assessment', a.id, { period: a.period }, req.ip);
  res.status(201).json(a);
});

router.get('/assessments/list', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const periode = String(req.query.period || dayjs().tz(TZ).format('YYYY-MM'));
  const boleh = await allowedSiteIds(req);
  const rows = await prisma.assessment.findMany({
    where: {
      period: periode,
      ...(boleh ? { guard: { homeSiteId: { in: boleh.length ? boleh : ['-'] } } } : {}),
    },
    include: {
      guard: { select: { id: true, name: true, employeeId: true } },
      assessor: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows);
});

/* ═══════════════ BOBOT KPI (FR-KPI-005) ═══════════════ */

router.get('/config/bobot', allow(...COMMAND), async (_req, res) => {
  res.json(await ambilBobot());
});

router.put('/config/bobot', allow(...ADMIN_ONLY), async (req, res) => {
  const schema = z.object({
    kehadiran: z.number().min(0).max(100),
    patroli: z.number().min(0).max(100),
    ronde: z.number().min(0).max(100),
    pelaporan: z.number().min(0).max(100),
    penilaian: z.number().min(0).max(100),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Bobot harus angka 0–100 pada semua komponen' });
  const total = Object.values(p.data).reduce((a, b) => a + b, 0);
  if (total !== 100) return res.status(400).json({ message: `Jumlah bobot harus 100, sekarang ${total}` });

  await prisma.setting.upsert({
    where: { key: 'kpi.bobot' },
    create: { key: 'kpi.bobot', value: p.data },
    update: { value: p.data },
  });
  await audit(req.user!.sub, 'UPDATE', 'Setting', 'kpi.bobot', p.data, req.ip);
  res.json(p.data);
});

export default router;
