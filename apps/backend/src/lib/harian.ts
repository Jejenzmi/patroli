import { prisma } from './prisma';
import { startOfDay, endOfDay, dayjs, TZ } from './time';

/**
 * Laporan harian per personel.
 *
 * Satu baris menjawab pertanyaan yang paling sering diajukan klien dan
 * manajemen: hari itu siapa yang jaga, jam berapa masuk dan pulang, berapa
 * putaran patroli yang dijalankan, titik mana yang bermasalah, dan apa saja
 * yang dicatat di pos jaga.
 */

export interface BarisHarian {
  guardId: string;
  name: string;
  employeeId: string | null;
  avatarUrl: string | null;
  siteName: string | null;
  shiftName: string | null;
  masuk: Date | null;
  keluar: Date | null;
  statusPresensi: string | null;
  telatMenit: number;
  jamKerja: number;
  sesiPatroli: number;
  titikTerpindai: number;
  titikSeharusnya: number;
  titikTerlewat: number;
  kepatuhan: number;
  laporanTitik: number;
  laporanTertunda: number;
  temuan: { checkpoint: string; condition: string; note: string | null; waktu: Date }[];
  insiden: number;
  tugasSelesai: number;
  tamu: number;
  kendaraan: number;
  darurat: number;
}

export interface HasilHarian {
  tanggal: string;
  rows: BarisHarian[];
  total: {
    personel: number;
    hadir: number;
    tidakHadir: number;
    sesiPatroli: number;
    titikTerpindai: number;
    temuan: number;
    insiden: number;
    laporanTertunda: number;
  };
}

/**
 * Menyusun laporan satu hari.
 * `siteIds` null berarti tanpa batas; `guardId` mempersempit ke satu orang.
 */
export async function laporanHarian(
  tanggal: string,
  siteIds: string[] | null,
  guardId?: string
): Promise<HasilHarian> {
  const awal = startOfDay(new Date(tanggal));
  const akhir = endOfDay(new Date(tanggal));
  const kunci = dayjs(awal).tz(TZ).startOf('day').toDate();

  const batasSite = siteIds ? { in: siteIds.length ? siteIds : ['-'] } : undefined;

  // Yang masuk laporan: siapa pun yang dijadwalkan hari itu, ditambah yang
  // hadir tanpa jadwal — keduanya sama-sama harus terlihat.
  const [jadwal, presensi] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        date: kunci,
        status: { not: 'SWAPPED' },
        ...(guardId ? { guardId } : {}),
        ...(batasSite ? { siteId: batasSite } : {}),
      },
      include: {
        guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
        site: { select: { id: true, name: true } },
        shift: { select: { name: true, startTime: true, endTime: true } },
      },
    }),
    prisma.attendance.findMany({
      where: {
        checkInAt: { gte: awal, lte: akhir },
        ...(guardId ? { guardId } : {}),
        ...(batasSite ? { siteId: batasSite } : {}),
      },
      include: {
        guard: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
        site: { select: { id: true, name: true } },
        schedule: { select: { shift: { select: { name: true } } } },
      },
    }),
  ]);

  const peta = new Map<string, BarisHarian>();
  const tambah = (
    g: { id: string; name: string; employeeId: string | null; avatarUrl: string | null },
    siteName: string | null,
    shiftName: string | null
  ) => {
    if (!peta.has(g.id))
      peta.set(g.id, {
        guardId: g.id,
        name: g.name,
        employeeId: g.employeeId,
        avatarUrl: g.avatarUrl,
        siteName,
        shiftName,
        masuk: null,
        keluar: null,
        statusPresensi: null,
        telatMenit: 0,
        jamKerja: 0,
        sesiPatroli: 0,
        titikTerpindai: 0,
        titikSeharusnya: 0,
        titikTerlewat: 0,
        kepatuhan: 0,
        laporanTitik: 0,
        laporanTertunda: 0,
        temuan: [],
        insiden: 0,
        tugasSelesai: 0,
        tamu: 0,
        kendaraan: 0,
        darurat: 0,
      });
    return peta.get(g.id)!;
  };

  jadwal.forEach((j) => tambah(j.guard, j.site.name, j.shift?.name ?? null));
  presensi.forEach((a) => {
    const b = tambah(a.guard, a.site.name, a.schedule?.shift?.name ?? null);
    b.masuk = a.checkInAt;
    b.keluar = a.checkOutAt;
    b.statusPresensi = a.status;
    b.telatMenit = a.lateMinutes;
    b.jamKerja = Math.round((a.workedMinutes / 60) * 10) / 10;
    if (!b.siteName) b.siteName = a.site.name;
  });

  const ids = [...peta.keys()];
  if (!ids.length)
    return {
      tanggal,
      rows: [],
      total: {
        personel: 0,
        hadir: 0,
        tidakHadir: 0,
        sesiPatroli: 0,
        titikTerpindai: 0,
        temuan: 0,
        insiden: 0,
        laporanTertunda: 0,
      },
    };

  const [sesi, scans, insiden, tugas, tamu, kendaraan, darurat] = await Promise.all([
    prisma.patrolSession.findMany({
      where: { guardId: { in: ids }, startedAt: { gte: awal, lte: akhir } },
      select: { id: true, guardId: true, totalCheckpoints: true, scannedCount: true, missedCount: true, complianceRate: true },
    }),
    prisma.patrolScan.findMany({
      where: { session: { guardId: { in: ids }, startedAt: { gte: awal, lte: akhir } } },
      select: {
        scannedAt: true,
        condition: true,
        note: true,
        reportedAt: true,
        checkpoint: { select: { name: true } },
        session: { select: { guardId: true } },
      },
      orderBy: { scannedAt: 'asc' },
    }),
    prisma.incident.groupBy({
      by: ['reporterId'],
      where: { reporterId: { in: ids }, occurredAt: { gte: awal, lte: akhir } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { assigneeId: { in: ids }, status: 'SELESAI', finishedAt: { gte: awal, lte: akhir } },
      _count: { _all: true },
    }),
    prisma.visitor.groupBy({
      by: ['handledById'],
      where: { handledById: { in: ids }, checkInAt: { gte: awal, lte: akhir } },
      _count: { _all: true },
    }),
    prisma.vehicleLog.groupBy({
      by: ['recordedById'],
      where: { recordedById: { in: ids }, inAt: { gte: awal, lte: akhir } },
      _count: { _all: true },
    }),
    prisma.panicAlert.groupBy({
      by: ['guardId'],
      where: { guardId: { in: ids }, createdAt: { gte: awal, lte: akhir } },
      _count: { _all: true },
    }),
  ]);

  sesi.forEach((s) => {
    const b = peta.get(s.guardId);
    if (!b) return;
    b.sesiPatroli += 1;
    b.titikSeharusnya += s.totalCheckpoints;
    b.titikTerpindai += s.scannedCount;
    b.titikTerlewat += s.missedCount;
  });
  peta.forEach((b) => {
    b.kepatuhan = b.titikSeharusnya
      ? Math.round((b.titikTerpindai / b.titikSeharusnya) * 1000) / 10
      : 0;
  });

  scans.forEach((s) => {
    const b = peta.get(s.session.guardId);
    if (!b) return;
    if (s.reportedAt) b.laporanTitik += 1;
    else b.laporanTertunda += 1;
    if (s.condition !== 'AMAN')
      b.temuan.push({
        checkpoint: s.checkpoint.name,
        condition: s.condition,
        note: s.note,
        waktu: s.scannedAt,
      });
  });

  const pasang = (rows: any[], kolom: string, target: keyof BarisHarian) =>
    rows.forEach((r) => {
      const b = peta.get(r[kolom]);
      if (b) (b[target] as number) = r._count._all;
    });
  pasang(insiden, 'reporterId', 'insiden');
  pasang(tugas, 'assigneeId', 'tugasSelesai');
  pasang(tamu, 'handledById', 'tamu');
  pasang(kendaraan, 'recordedById', 'kendaraan');
  pasang(darurat, 'guardId', 'darurat');

  const rows = [...peta.values()].sort((a, b) =>
    (a.siteName || '').localeCompare(b.siteName || '') || a.name.localeCompare(b.name)
  );

  return {
    tanggal,
    rows,
    total: {
      personel: rows.length,
      hadir: rows.filter((r) => r.masuk).length,
      tidakHadir: rows.filter((r) => !r.masuk).length,
      sesiPatroli: rows.reduce((a, r) => a + r.sesiPatroli, 0),
      titikTerpindai: rows.reduce((a, r) => a + r.titikTerpindai, 0),
      temuan: rows.reduce((a, r) => a + r.temuan.length, 0),
      insiden: rows.reduce((a, r) => a + r.insiden, 0),
      laporanTertunda: rows.reduce((a, r) => a + r.laporanTertunda, 0),
    },
  };
}
