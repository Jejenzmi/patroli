import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND } from '../middleware/auth';
import { allowedSiteIds } from '../lib/scope';
import { startOfDay, endOfDay, dayjs, TZ } from '../lib/time';
import { cached, getPresence } from '../lib/redis';

const router = Router();
router.use(auth);
// Seluruh analitik hanya untuk pengawas dan klien; anggota memakai aplikasi lapangan.
router.use(allow(...COMMAND, 'CLIENT'));

function range(req: any) {
  const from = req.query.from ? startOfDay(new Date(String(req.query.from))) : startOfDay(dayjs().subtract(29, 'day').toDate());
  const to = req.query.to ? endOfDay(new Date(String(req.query.to))) : endOfDay(new Date());
  return { from, to };
}

function clientScope(req: any) {
  return req.user.role === 'CLIENT' ? { site: { clientId: req.user.clientId } } : {};
}

/* ─────────────────────────── DASBOR PUSAT KOMANDO ─────────────────────────── */

router.get('/dashboard', async (req, res) => {
  const scope = clientScope(req);
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const key = `patroli:dash:${req.user!.role}:${req.user!.clientId || 'all'}:${dayjs().tz(TZ).format('YYYYMMDDHHmm').slice(0, 11)}`;

  const data = await cached(key, 45, async () => {
    const [
      sitesCount,
      guardsOnDuty,
      activePatrols,
      todaySessions,
      openIncidents,
      criticalIncidents,
      activePanics,
      visitorsInside,
      lateToday,
      overdueSla,
    ] = await Promise.all([
      prisma.site.count({ where: { isActive: true, ...(req.user!.role === 'CLIENT' ? { clientId: req.user!.clientId! } : {}) } }),
      prisma.attendance.count({ where: { checkOutAt: null, checkInAt: { gte: todayStart }, ...scope } }),
      prisma.patrolSession.count({ where: { status: 'IN_PROGRESS', ...scope } }),
      prisma.patrolSession.findMany({
        where: { startedAt: { gte: todayStart, lte: todayEnd }, ...scope },
        select: { status: true, complianceRate: true, missedCount: true, totalCheckpoints: true, scannedCount: true },
      }),
      prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_REVIEW', 'ESCALATED'] }, ...scope } }),
      prisma.incident.count({ where: { severity: 'CRITICAL', status: { notIn: ['CLOSED', 'RESOLVED'] }, ...scope } }),
      prisma.panicAlert.count({ where: { status: 'ACTIVE', ...scope } }),
      prisma.visitor.count({ where: { status: 'INSIDE', ...scope } }),
      prisma.attendance.count({ where: { status: 'LATE', checkInAt: { gte: todayStart }, ...scope } }),
      prisma.incident.count({
        where: { status: { in: ['OPEN', 'IN_REVIEW', 'ESCALATED'] }, slaDueAt: { lt: new Date() }, ...scope },
      }),
    ]);

    const done = todaySessions.filter((s) => s.status === 'COMPLETED');
    const totalCp = todaySessions.reduce((a, s) => a + s.totalCheckpoints, 0);
    const scannedCp = todaySessions.reduce((a, s) => a + s.scannedCount, 0);

    return {
      sitesCount,
      guardsOnDuty,
      activePatrols,
      patrolsToday: todaySessions.length,
      patrolsCompleted: done.length,
      complianceToday: totalCp ? Math.round((scannedCp / totalCp) * 1000) / 10 : 0,
      missedCheckpointsToday: todaySessions.reduce((a, s) => a + s.missedCount, 0),
      openIncidents,
      criticalIncidents,
      activePanics,
      visitorsInside,
      lateToday,
      overdueSla,
    };
  });

  res.json(data);
});

/** Tren kepatuhan patroli 14 hari terakhir. */
router.get('/trend/compliance', async (req, res) => {
  const scope = clientScope(req);
  const days = Math.min(60, Number(req.query.days) || 14);
  const from = startOfDay(dayjs().subtract(days - 1, 'day').toDate());
  const sessions = await prisma.patrolSession.findMany({
    where: { startedAt: { gte: from }, ...scope },
    select: { startedAt: true, totalCheckpoints: true, scannedCount: true, status: true },
  });
  const buckets = new Map<string, { total: number; scanned: number; sessions: number; completed: number }>();
  for (let i = 0; i < days; i++) {
    const d = dayjs().subtract(days - 1 - i, 'day').tz(TZ).format('YYYY-MM-DD');
    buckets.set(d, { total: 0, scanned: 0, sessions: 0, completed: 0 });
  }
  for (const s of sessions) {
    const d = dayjs(s.startedAt).tz(TZ).format('YYYY-MM-DD');
    const b = buckets.get(d);
    if (!b) continue;
    b.total += s.totalCheckpoints;
    b.scanned += s.scannedCount;
    b.sessions += 1;
    if (s.status === 'COMPLETED') b.completed += 1;
  }
  res.json(
    [...buckets.entries()].map(([date, b]) => ({
      date,
      compliance: b.total ? Math.round((b.scanned / b.total) * 1000) / 10 : 0,
      sessions: b.sessions,
      completed: b.completed,
    }))
  );
});

/** Sebaran insiden per kategori & tingkat keparahan. */
router.get('/incidents/summary', async (req, res) => {
  const { from, to } = range(req);
  const scope = clientScope(req);
  const rows = await prisma.incident.findMany({
    where: { occurredAt: { gte: from, lte: to }, ...scope },
    select: { category: true, severity: true, status: true, siteId: true, site: { select: { name: true } }, occurredAt: true, resolvedAt: true, slaDueAt: true },
  });
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const bySite: Record<string, { name: string; count: number }> = {};
  let slaMet = 0;
  let slaTotal = 0;
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    const s = (bySite[r.siteId] ||= { name: r.site.name, count: 0 });
    s.count++;
    if (r.resolvedAt && r.slaDueAt) {
      slaTotal++;
      if (r.resolvedAt <= r.slaDueAt) slaMet++;
    }
  }
  res.json({
    total: rows.length,
    byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
    bySeverity: Object.entries(bySeverity).map(([name, value]) => ({ name, value })),
    byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
    bySite: Object.values(bySite).sort((a, b) => b.count - a.count).slice(0, 10),
    slaCompliance: slaTotal ? Math.round((slaMet / slaTotal) * 1000) / 10 : 100,
  });
});

/** Papan peringkat kinerja anggota. */
router.get('/guards/ranking', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const { from, to } = range(req);
  const scope = clientScope(req);
  const sessions = await prisma.patrolSession.findMany({
    where: { startedAt: { gte: from, lte: to }, ...scope },
    select: {
      guardId: true,
      complianceRate: true,
      status: true,
      totalCheckpoints: true,
      scannedCount: true,
      guard: { select: { name: true, employeeId: true, avatarUrl: true } },
    },
  });
  const map = new Map<string, any>();
  for (const s of sessions) {
    const e = map.get(s.guardId) || {
      guardId: s.guardId,
      name: s.guard.name,
      employeeId: s.guard.employeeId,
      avatarUrl: s.guard.avatarUrl,
      sessions: 0,
      completed: 0,
      totalCp: 0,
      scannedCp: 0,
    };
    e.sessions++;
    if (s.status === 'COMPLETED') e.completed++;
    e.totalCp += s.totalCheckpoints;
    e.scannedCp += s.scannedCount;
    map.set(s.guardId, e);
  }
  const attendance = await prisma.attendance.groupBy({
    by: ['guardId', 'status'],
    where: { checkInAt: { gte: from, lte: to }, ...scope },
    _count: { _all: true },
  });
  const lateMap = new Map<string, number>();
  const attMap = new Map<string, number>();
  for (const a of attendance) {
    attMap.set(a.guardId, (attMap.get(a.guardId) || 0) + a._count._all);
    if (a.status === 'LATE') lateMap.set(a.guardId, (lateMap.get(a.guardId) || 0) + a._count._all);
  }
  const rows = [...map.values()].map((e) => {
    const compliance = e.totalCp ? (e.scannedCp / e.totalCp) * 100 : 0;
    const att = attMap.get(e.guardId) || 0;
    const late = lateMap.get(e.guardId) || 0;
    const punctuality = att ? ((att - late) / att) * 100 : 100;
    return {
      ...e,
      compliance: Math.round(compliance * 10) / 10,
      punctuality: Math.round(punctuality * 10) / 10,
      lateCount: late,
      // Skor gabungan: 70% kepatuhan titik, 30% ketepatan waktu hadir.
      score: Math.round((compliance * 0.7 + punctuality * 0.3) * 10) / 10,
    };
  });
  rows.sort((a, b) => b.score - a.score);
  res.json(rows);
});

/** Rekap per site untuk laporan bulanan ke klien. */
router.get('/sites/summary', async (req, res) => {
  const { from, to } = range(req);
  const scope = clientScope(req);
  const sites = await prisma.site.findMany({
    where: { isActive: true, ...(req.user!.role === 'CLIENT' ? { clientId: req.user!.clientId! } : {}) },
    select: { id: true, name: true, code: true, client: { select: { name: true } } },
  });
  const [sessions, incidents, attendance, visitors] = await Promise.all([
    prisma.patrolSession.groupBy({
      by: ['siteId'],
      where: { startedAt: { gte: from, lte: to }, ...scope },
      _count: { _all: true },
      _sum: { totalCheckpoints: true, scannedCount: true, missedCount: true },
    }),
    prisma.incident.groupBy({
      by: ['siteId'],
      where: { occurredAt: { gte: from, lte: to }, ...scope },
      _count: { _all: true },
    }),
    prisma.attendance.groupBy({
      by: ['siteId'],
      where: { checkInAt: { gte: from, lte: to }, ...scope },
      _count: { _all: true },
    }),
    prisma.visitor.groupBy({
      by: ['siteId'],
      where: { checkInAt: { gte: from, lte: to }, ...scope },
      _count: { _all: true },
    }),
  ]);
  const idx = <T extends { siteId: string }>(arr: T[]) => new Map(arr.map((r) => [r.siteId, r]));
  const sMap = idx(sessions as any);
  const iMap = idx(incidents as any);
  const aMap = idx(attendance as any);
  const vMap = idx(visitors as any);

  res.json(
    sites.map((s) => {
      const ses: any = sMap.get(s.id);
      const total = ses?._sum?.totalCheckpoints || 0;
      const scanned = ses?._sum?.scannedCount || 0;
      return {
        siteId: s.id,
        name: s.name,
        code: s.code,
        client: s.client.name,
        patrols: ses?._count?._all || 0,
        compliance: total ? Math.round((scanned / total) * 1000) / 10 : 0,
        missed: ses?._sum?.missedCount || 0,
        incidents: (iMap.get(s.id) as any)?._count?._all || 0,
        attendance: (aMap.get(s.id) as any)?._count?._all || 0,
        visitors: (vMap.get(s.id) as any)?._count?._all || 0,
      };
    })
  );
});

/** Titik yang paling sering terlewat — bahan evaluasi rute. */
router.get('/checkpoints/missed', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const { from, to } = range(req);
  const scope = clientScope(req);
  const sessions = await prisma.patrolSession.findMany({
    where: { startedAt: { gte: from, lte: to }, status: { in: ['COMPLETED', 'ABANDONED'] }, ...scope },
    select: {
      id: true,
      route: { select: { checkpoints: { select: { checkpointId: true, checkpoint: { select: { name: true, code: true } } } } } },
      scans: { select: { checkpointId: true } },
    },
  });
  const stat = new Map<string, { name: string; code: string; expected: number; missed: number }>();
  for (const s of sessions) {
    const scanned = new Set(s.scans.map((x) => x.checkpointId));
    for (const rc of s.route.checkpoints) {
      const e = stat.get(rc.checkpointId) || {
        name: rc.checkpoint.name,
        code: rc.checkpoint.code,
        expected: 0,
        missed: 0,
      };
      e.expected++;
      if (!scanned.has(rc.checkpointId)) e.missed++;
      stat.set(rc.checkpointId, e);
    }
  }
  const rows = [...stat.entries()]
    .map(([checkpointId, e]) => ({
      checkpointId,
      ...e,
      missRate: e.expected ? Math.round((e.missed / e.expected) * 1000) / 10 : 0,
    }))
    .filter((r) => r.missed > 0)
    .sort((a, b) => b.missRate - a.missRate)
    .slice(0, 20);
  res.json(rows);
});

/** Aliran kejadian terbaru untuk panel kanan pusat komando. */
router.get('/feed', async (req, res) => {
  const scope = clientScope(req);
  const sitesBoleh = await allowedSiteIds(req);
  const batasSesi = sitesBoleh === null ? {} : { session: { siteId: { in: sitesBoleh } } };

  const [scans, incidents, attendance, panics] = await Promise.all([
    prisma.patrolScan.findMany({
      where: batasSesi,
      orderBy: { scannedAt: 'desc' },
      take: 12,
      include: {
        checkpoint: { select: { name: true } },
        session: { select: { siteId: true, guard: { select: { name: true, avatarUrl: true } } } },
      },
    }),
    prisma.incident.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { site: { select: { name: true } }, reporter: { select: { name: true, avatarUrl: true } } },
    }),
    prisma.attendance.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { guard: { select: { name: true, avatarUrl: true } }, site: { select: { name: true } } },
    }),
    prisma.panicAlert.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { guard: { select: { name: true, avatarUrl: true } }, site: { select: { name: true } } },
    }),
  ]);

  const feed = [
    ...scans.map((s) => ({
      type: 'SCAN' as const,
      at: s.scannedAt,
      title: `${s.session.guard.name} memindai ${s.checkpoint.name}`,
      meta:
        s.condition === 'BERMASALAH'
          ? 'Titik bermasalah'
          : s.condition === 'PERLU_PERHATIAN'
            ? 'Perlu perhatian'
            : s.isLate
              ? 'Terlambat'
              : 'Aman',
      severity:
        s.condition === 'BERMASALAH'
          ? 'HIGH'
          : s.condition === 'PERLU_PERHATIAN' || s.isLate
            ? 'MEDIUM'
            : 'LOW',
      avatarUrl: s.session.guard.avatarUrl,
    })),
    ...incidents.map((i) => ({
      type: 'INCIDENT' as const,
      at: i.createdAt,
      title: `${i.code} — ${i.title}`,
      meta: `${i.site.name} · ${i.reporter.name}`,
      severity: i.severity,
      avatarUrl: i.reporter.avatarUrl,
    })),
    ...attendance.map((a) => ({
      type: 'ATTENDANCE' as const,
      at: a.createdAt,
      title: `${a.guard.name} ${a.checkOutAt ? 'selesai jaga' : 'mulai jaga'}`,
      meta: `${a.site.name}${a.status === 'LATE' ? ` · telat ${a.lateMinutes} mnt` : ''}`,
      severity: a.status === 'LATE' ? 'MEDIUM' : 'LOW',
      avatarUrl: a.guard.avatarUrl,
    })),
    ...panics.map((p) => ({
      type: 'PANIC' as const,
      at: p.createdAt,
      title: `Sinyal darurat — ${p.guard.name}`,
      meta: `${p.site.name} · ${p.status}`,
      severity: 'CRITICAL',
      avatarUrl: p.guard.avatarUrl,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 25);

  res.json(feed);
});

/** Rekap tombol darurat pada satu periode (FR-REP-002). */
router.get('/panic/summary', async (req, res) => {
  const { from, to } = range(req);
  const scope = clientScope(req);
  const rows = await prisma.panicAlert.findMany({
    where: { createdAt: { gte: from, lte: to }, ...scope },
    orderBy: { createdAt: 'desc' },
    include: {
      guard: { select: { id: true, name: true, employeeId: true } },
      site: { select: { id: true, name: true } },
      acknowledgedBy: { select: { id: true, name: true } },
      floor: { select: { name: true } },
    },
  });

  const direspons = rows.filter((r) => r.acknowledgedAt);
  const rataRespons = direspons.length
    ? direspons.reduce(
        (a, r) => a + (r.acknowledgedAt!.getTime() - r.createdAt.getTime()) / 60000,
        0
      ) / direspons.length
    : 0;
  const selesai = rows.filter((r) => r.resolvedAt);
  const rataTuntas = selesai.length
    ? selesai.reduce((a, r) => a + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 60000, 0) /
      selesai.length
    : 0;

  res.json({
    total: rows.length,
    aktif: rows.filter((r) => r.status === 'ACTIVE').length,
    rataResponsMenit: Math.round(rataRespons * 10) / 10,
    rataTuntasMenit: Math.round(rataTuntas * 10) / 10,
    data: rows.slice(0, 100),
  });
});

/** Ekspor CSV: patroli, insiden, presensi. */
router.get('/export/:kind', allow(...COMMAND, 'CLIENT'), async (req, res) => {
  const { from, to } = range(req);
  const scope = clientScope(req);
  const kind = req.params.kind;
  let rows: string[][] = [];

  if (kind === 'patrols') {
    const data = await prisma.patrolSession.findMany({
      where: { startedAt: { gte: from, lte: to }, ...scope },
      orderBy: { startedAt: 'desc' },
      include: { guard: true, route: true, site: true },
    });
    rows = [
      ['Tanggal', 'Site', 'Rute', 'Anggota', 'Mulai', 'Selesai', 'Titik', 'Terpindai', 'Terlewat', 'Kepatuhan %', 'Status'],
      ...data.map((s) => [
        dayjs(s.startedAt).tz(TZ).format('YYYY-MM-DD'),
        s.site.name,
        s.route.name,
        s.guard.name,
        dayjs(s.startedAt).tz(TZ).format('HH:mm'),
        s.endedAt ? dayjs(s.endedAt).tz(TZ).format('HH:mm') : '-',
        String(s.totalCheckpoints),
        String(s.scannedCount),
        String(s.missedCount),
        String(s.complianceRate),
        s.status,
      ]),
    ];
  } else if (kind === 'incidents') {
    const data = await prisma.incident.findMany({
      where: { occurredAt: { gte: from, lte: to }, ...scope },
      orderBy: { occurredAt: 'desc' },
      include: { site: true, reporter: true, assignee: true },
    });
    rows = [
      ['Kode', 'Waktu', 'Site', 'Kategori', 'Keparahan', 'Judul', 'Pelapor', 'Penanggung Jawab', 'Status', 'Selesai'],
      ...data.map((i) => [
        i.code,
        dayjs(i.occurredAt).tz(TZ).format('YYYY-MM-DD HH:mm'),
        i.site.name,
        i.category,
        i.severity,
        i.title,
        i.reporter.name,
        i.assignee?.name || '-',
        i.status,
        i.resolvedAt ? dayjs(i.resolvedAt).tz(TZ).format('YYYY-MM-DD HH:mm') : '-',
      ]),
    ];
  } else if (kind === 'attendance') {
    const data = await prisma.attendance.findMany({
      where: { checkInAt: { gte: from, lte: to }, ...scope },
      orderBy: { checkInAt: 'desc' },
      include: { guard: true, site: true },
    });
    rows = [
      ['Tanggal', 'Anggota', 'NIP', 'Site', 'Masuk', 'Pulang', 'Status', 'Telat (mnt)', 'Durasi (mnt)'],
      ...data.map((a) => [
        dayjs(a.checkInAt!).tz(TZ).format('YYYY-MM-DD'),
        a.guard.name,
        a.guard.employeeId || '-',
        a.site.name,
        a.checkInAt ? dayjs(a.checkInAt).tz(TZ).format('HH:mm') : '-',
        a.checkOutAt ? dayjs(a.checkOutAt).tz(TZ).format('HH:mm') : '-',
        a.status,
        String(a.lateMinutes),
        String(a.workedMinutes),
      ]),
    ];
  } else if (kind === 'panic') {
    const data = await prisma.panicAlert.findMany({
      where: { createdAt: { gte: from, lte: to }, ...scope },
      orderBy: { createdAt: 'desc' },
      include: { guard: true, site: true, acknowledgedBy: true },
    });
    rows = [
      ['Waktu', 'Anggota', 'Site', 'Pesan', 'Status', 'Direspons oleh', 'Waktu respons (mnt)', 'Selesai (mnt)'],
      ...data.map((p) => [
        dayjs(p.createdAt).tz(TZ).format('YYYY-MM-DD HH:mm'),
        p.guard.name,
        p.site.name,
        p.message || '-',
        p.status,
        p.acknowledgedBy?.name || '-',
        p.acknowledgedAt
          ? String(Math.round((p.acknowledgedAt.getTime() - p.createdAt.getTime()) / 60000))
          : '-',
        p.resolvedAt
          ? String(Math.round((p.resolvedAt.getTime() - p.createdAt.getTime()) / 60000))
          : '-',
      ]),
    ];
  } else if (kind === 'attempts') {
    const data = await prisma.attendanceAttempt.findMany({
      where: { createdAt: { gte: from, lte: to }, ...scope },
      orderBy: { createdAt: 'desc' },
      include: { guard: true, site: true },
    });
    rows = [
      ['Waktu', 'Anggota', 'NIP', 'Site', 'Sebab penolakan', 'Keterangan', 'Jarak (m)', 'Skor wajah'],
      ...data.map((a) => [
        dayjs(a.createdAt).tz(TZ).format('YYYY-MM-DD HH:mm'),
        a.guard.name,
        a.guard.employeeId || '-',
        a.site.name,
        a.result,
        a.reason,
        a.distanceM != null ? String(a.distanceM) : '-',
        a.faceScore != null ? String(a.faceScore) : '-',
      ]),
    ];
  } else {
    return res.status(400).json({ message: 'Jenis ekspor tidak dikenal' });
  }

  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="patroli-${kind}-${dayjs().format('YYYYMMDD')}.csv"`);
  res.send('﻿' + csv);
});

/** Peta situasi: site, titik, dan posisi anggota online. */
router.get('/map', async (req, res) => {
  const sites = await prisma.site.findMany({
    where: { isActive: true, ...(req.user!.role === 'CLIENT' ? { clientId: req.user!.clientId! } : {}) },
    select: {
      id: true, name: true, code: true, lat: true, lng: true, radiusM: true,
      checkpoints: { where: { isActive: true }, select: { id: true, name: true, code: true, lat: true, lng: true, radiusM: true } },
    },
  });
  const idsSite = new Set(sites.map((s) => s.id));
  const [presenceSemua, panics] = await Promise.all([
    getPresence(),
    prisma.panicAlert.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
        ...(req.user!.role === 'CLIENT' ? { site: { clientId: req.user!.clientId! } } : {}),
      },
      include: { guard: { select: { name: true } }, site: { select: { name: true } } },
    }),
  ]);
  // Klien hanya melihat anggota yang bertugas di site miliknya.
  const presence =
    req.user!.role === 'CLIENT'
      ? presenceSemua.filter((p) => p.siteId && idsSite.has(p.siteId))
      : presenceSemua;

  // FR-GPS-001: jejak pergerakan terakhir tiap anggota yang sedang bertugas.
  const sejak = new Date(Date.now() - 90 * 60 * 1000);
  const idsAnggota = presence.map((p) => p.guardId).filter(Boolean) as string[];
  const pings = idsAnggota.length
    ? await prisma.locationPing.findMany({
        where: { guardId: { in: idsAnggota }, recordedAt: { gte: sejak } },
        orderBy: { recordedAt: 'asc' },
        select: { guardId: true, lat: true, lng: true, recordedAt: true },
        take: 3000,
      })
    : [];
  const perAnggota = new Map<string, [number, number][]>();
  for (const p of pings) {
    const arr = perAnggota.get(p.guardId) ?? [];
    arr.push([p.lat, p.lng]);
    perAnggota.set(p.guardId, arr);
  }
  const tracks = [...perAnggota.entries()]
    .filter(([, titik]) => titik.length > 1)
    .map(([guardId, titik]) => ({
      guardId,
      name: presence.find((p) => p.guardId === guardId)?.name ?? '',
      // Cukup 40 titik terakhir; lebih dari itu hanya membebani peta.
      points: titik.slice(-40),
    }));

  res.json({ sites, presence, panics, tracks });
});

/**
 * Denah lantai beserta posisi anggota (FR-GPS-003).
 *
 * Posisi anggota di dalam gedung tidak dapat diandalkan dari GPS, sehingga
 * yang dipakai adalah titik QR terakhir yang ia pindai — itulah keberadaan
 * terakhir yang benar-benar terbukti.
 */
router.get('/floors', async (req, res) => {
  const siteId = req.query.siteId ? String(req.query.siteId) : null;
  const where: any = siteId ? { siteId } : {};
  const boleh = await allowedSiteIds(req);
  if (boleh !== null) where.siteId = siteId && boleh.includes(siteId) ? siteId : { in: boleh };

  const floors = await prisma.floor.findMany({
    where,
    orderBy: [{ siteId: 'asc' }, { level: 'asc' }],
    include: {
      site: { select: { id: true, name: true } },
      checkpoints: {
        where: { isActive: true },
        select: { id: true, name: true, code: true, planX: true, planY: true },
      },
    },
  });

  // Pemindaian terakhir tiap anggota dalam 12 jam terakhir.
  const sejak = new Date(Date.now() - 12 * 3600 * 1000);
  const scans = await prisma.patrolScan.findMany({
    where: { scannedAt: { gte: sejak }, checkpoint: { floorId: { not: null } } },
    orderBy: { scannedAt: 'desc' },
    take: 800,
    select: {
      scannedAt: true,
      condition: true,
      checkpoint: { select: { id: true, name: true, floorId: true, planX: true, planY: true } },
      session: { select: { guard: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  });

  const terakhir = new Map<string, any>();
  for (const s of scans) {
    const g = s.session?.guard;
    if (!g || terakhir.has(g.id)) continue;
    terakhir.set(g.id, {
      guardId: g.id,
      name: g.name,
      avatarUrl: g.avatarUrl,
      floorId: s.checkpoint.floorId,
      checkpointId: s.checkpoint.id,
      checkpointName: s.checkpoint.name,
      planX: s.checkpoint.planX,
      planY: s.checkpoint.planY,
      condition: s.condition,
      at: s.scannedAt,
    });
  }
  const posisi = [...terakhir.values()];

  res.json(
    floors.map((f) => ({
      ...f,
      guards: posisi.filter((p) => p.floorId === f.id && p.planX != null && p.planY != null),
    }))
  );
});

export default router;
