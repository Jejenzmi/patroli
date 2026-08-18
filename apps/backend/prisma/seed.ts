/**
 * Seed PATROLI — data contoh yang menyerupai operasional nyata:
 * 3 klien, 5 site, titik patroli, rute, shift, roster 21 hari,
 * presensi, sesi patroli beserta pemindaian, insiden, tamu, kendaraan.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(arr: T[]): T => arr[rnd(arr.length)];
const chance = (p: number) => Math.random() < p;
/** Geser koordinat beberapa puluh meter agar titik tidak menumpuk. */
const jitter = (v: number, m = 300) => v + (Math.random() - 0.5) * (m / 111_000);

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0 && process.env.FORCE_SEED !== 'true') {
    console.log('▸ Database sudah berisi data, seed dilewati.');
    return;
  }

  console.log('▸ Menyiapkan data contoh PATROLI…');
  const hash = (p: string) => bcrypt.hashSync(p, 10);

  /* ── Klien ── */
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        code: 'GRD-MPK',
        name: 'PT Mega Pratama Kawasan',
        contactName: 'Bpk. Hendra Wijaya',
        phone: '021-8791200',
        email: 'facility@megapratama.co.id',
        address: 'Kawasan Industri Jababeka, Cikarang',
        contractNo: 'SPK/2025/MPK/014',
        contractEnd: dayjs().add(8, 'month').toDate(),
      },
    }),
    prisma.client.create({
      data: {
        code: 'GRD-BSR',
        name: 'Bumi Sentosa Retail',
        contactName: 'Ibu Ratna Sari',
        phone: '022-4207788',
        email: 'ops@bumisentosa.id',
        address: 'Jl. Asia Afrika No. 88, Bandung',
        contractNo: 'SPK/2025/BSR/007',
        contractEnd: dayjs().add(14, 'month').toDate(),
      },
    }),
    prisma.client.create({
      data: {
        code: 'GRD-HSP',
        name: 'RS Harapan Sehat',
        contactName: 'dr. Anton Prakoso',
        phone: '0264-201900',
        email: 'umum@rsharapansehat.co.id',
        address: 'Jl. Veteran No. 12, Purwakarta',
        contractNo: 'SPK/2025/HSP/003',
        contractEnd: dayjs().add(5, 'month').toDate(),
      },
    }),
  ]);

  /* ── Site ── */
  const siteDefs = [
    { clientId: clients[0].id, code: 'SITE-JBK', name: 'Kawasan Industri Jababeka Blok C', address: 'Jl. Jababeka Raya Blok C, Cikarang', city: 'Bekasi', lat: -6.2795, lng: 107.1462, radiusM: 400, picName: 'Hendra Wijaya', picPhone: '0812-9001-2233' },
    { clientId: clients[0].id, code: 'SITE-GDG', name: 'Gudang Distribusi Cibitung', address: 'Jl. Raya Cibitung KM 24', city: 'Bekasi', lat: -6.2648, lng: 107.0872, radiusM: 300, picName: 'Slamet Riyadi', picPhone: '0813-1122-3344' },
    { clientId: clients[1].id, code: 'SITE-MAL', name: 'Sentosa Plaza Bandung', address: 'Jl. Asia Afrika No. 88', city: 'Bandung', lat: -6.9218, lng: 107.6071, radiusM: 250, picName: 'Ratna Sari', picPhone: '0811-2233-4455' },
    { clientId: clients[1].id, code: 'SITE-WHS', name: 'Sentosa Warehouse Gedebage', address: 'Jl. Soekarno Hatta KM 12', city: 'Bandung', lat: -6.9412, lng: 107.6928, radiusM: 300, picName: 'Yusuf Maulana', picPhone: '0857-8899-1200' },
    { clientId: clients[2].id, code: 'SITE-RSH', name: 'RS Harapan Sehat Purwakarta', address: 'Jl. Veteran No. 12', city: 'Purwakarta', lat: -6.5561, lng: 107.4438, radiusM: 200, picName: 'dr. Anton Prakoso', picPhone: '0818-4455-6677' },
  ];
  const sites = await Promise.all(siteDefs.map((data) => prisma.site.create({ data })));

  /* ── Personel ── */
  const admin = await prisma.user.create({
    data: {
      employeeId: 'ADM-001', username: 'admin', name: 'Administrator Pusat',
      email: 'admin@patroli.id', phone: '0811-0000-0001',
      passwordHash: hash('admin123'), role: 'SUPER_ADMIN', rank: 'Kepala Operasional',
      joinedAt: dayjs().subtract(3, 'year').toDate(),
    },
  });
  const chief = await prisma.user.create({
    data: {
      employeeId: 'ADM-002', username: 'komandan', name: 'Bambang Suryanto',
      email: 'komandan@patroli.id', phone: '0811-0000-0002',
      passwordHash: hash('komandan123'), role: 'ADMIN', rank: 'Chief Security',
      joinedAt: dayjs().subtract(2, 'year').toDate(),
    },
  });
  const supervisors = await Promise.all([
    prisma.user.create({
      data: {
        employeeId: 'SPV-001', username: 'danru1', name: 'Agus Setiawan',
        phone: '0812-3344-5566', passwordHash: hash('danru123'), role: 'SUPERVISOR',
        rank: 'Danru Wilayah Bekasi', homeSiteId: sites[0].id,
        joinedAt: dayjs().subtract(18, 'month').toDate(),
      },
    }),
    prisma.user.create({
      data: {
        employeeId: 'SPV-002', username: 'danru2', name: 'Rina Puspitasari',
        phone: '0812-7788-9900', passwordHash: hash('danru123'), role: 'SUPERVISOR',
        rank: 'Danru Wilayah Bandung', homeSiteId: sites[2].id,
        joinedAt: dayjs().subtract(14, 'month').toDate(),
      },
    }),
  ]);
  const clientUser = await prisma.user.create({
    data: {
      username: 'klien', name: 'Hendra Wijaya (PT MPK)', email: 'hendra@megapratama.co.id',
      passwordHash: hash('klien123'), role: 'CLIENT', clientId: clients[0].id,
      rank: 'Facility Manager', joinedAt: dayjs().subtract(1, 'year').toDate(),
    },
  });

  const guardNames = [
    'Dedi Kurniawan', 'Joko Prasetyo', 'Ahmad Fauzi', 'Rizky Ramadhan', 'Bayu Nugroho',
    'Sulaeman', 'Iwan Setiadi', 'Hendrik Saputra', 'Andi Firmansyah', 'Yudi Hartono',
    'Tri Wahyudi', 'Nurul Hidayat', 'Wawan Gunawan', 'Eko Susilo', 'Fajar Maulana', 'Asep Saepudin',
  ];
  const guards = [];
  for (let i = 0; i < guardNames.length; i++) {
    const site = sites[i % sites.length];
    guards.push(
      await prisma.user.create({
        data: {
          employeeId: `SEC-${String(i + 1).padStart(3, '0')}`,
          username: `guard${i + 1}`,
          name: guardNames[i],
          phone: `0813-${String(1000 + i)}-${String(2000 + i * 7)}`,
          passwordHash: hash('guard123'),
          role: 'GUARD',
          rank: i % 5 === 0 ? 'Danru Pos' : 'Anggota',
          homeSiteId: site.id,
          joinedAt: dayjs().subtract(rnd(30) + 2, 'month').toDate(),
        },
      })
    );
  }

  /* ── Zona, titik patroli, rute, shift ── */
  const zoneNames = [
    ['Gerbang Utama', '#F59E0B'], ['Area Produksi', '#22D3EE'],
    ['Perimeter', '#A78BFA'], ['Parkir & Loading', '#34D399'],
  ] as const;
  const cpTemplates = [
    'Pos Gerbang Depan', 'Pos Gerbang Belakang', 'Ruang Panel Listrik', 'Gudang Material',
    'Area Parkir Karyawan', 'Loading Dock', 'Tangga Darurat Utara', 'Tangga Darurat Selatan',
    'Ruang Genset', 'Menara Air', 'Kantin & Musala', 'Perimeter Sisi Barat',
  ];

  const routesBySite: Record<string, string[]> = {};
  for (const site of sites) {
    const zones = [];
    for (const [name, color] of zoneNames) {
      zones.push(
        await prisma.zone.create({
          data: { siteId: site.id, name, color, riskLevel: name === 'Perimeter' ? 'MEDIUM' : 'LOW' },
        })
      );
    }
    // Lantai beserta penempatan titik pada denah (FR-MST-002, FR-MST-003)
    const lantai = [];
    for (const [i, nama] of ['Basement', 'Lantai 1', 'Lantai 2'].entries()) {
      lantai.push(
        await prisma.floor.create({
          data: { siteId: site.id, name: nama, level: i, notes: `Denah skematik ${nama}` },
        })
      );
    }

    const checkpoints = [];
    for (let i = 0; i < cpTemplates.length; i++) {
      checkpoints.push(
        await prisma.checkpoint.create({
          data: {
            siteId: site.id,
            zoneId: zones[i % zones.length].id,
            code: `${site.code}-CP${String(i + 1).padStart(2, '0')}`,
            name: cpTemplates[i],
            description: `Titik pemeriksaan ${cpTemplates[i].toLowerCase()} pada ${site.name}`,
            lat: jitter(site.lat, site.radiusM * 1.4),
            lng: jitter(site.lng, site.radiusM * 1.4),
            radiusM: 40,
            nfcTag: `NFC-${site.code}-${i + 1}`,
            floorId: lantai[i % lantai.length].id,
            planX: 12 + ((i * 23) % 76),
            planY: 14 + ((i * 37) % 72),
          },
        })
      );
    }

    const r1 = await prisma.patrolRoute.create({
      data: {
        siteId: site.id, name: 'Rute Perimeter Malam', description: 'Putaran keliling perimeter, prioritas pintu & pagar',
        expectedDurationMin: 45, graceMin: 10, enforceOrder: true, requirePhoto: false,
        checkpoints: {
          create: checkpoints.slice(0, 8).map((cp, i) => ({
            checkpointId: cp.id, orderIndex: i + 1, targetMinute: Math.round(((i + 1) / 8) * 45),
          })),
        },
      },
    });
    const r2 = await prisma.patrolRoute.create({
      data: {
        siteId: site.id, name: 'Rute Internal Siang', description: 'Pemeriksaan area dalam, panel, dan fasilitas',
        expectedDurationMin: 30, graceMin: 8,
        checkpoints: {
          create: checkpoints.slice(4).map((cp, i) => ({
            checkpointId: cp.id, orderIndex: i + 1, targetMinute: Math.round(((i + 1) / 8) * 30),
          })),
        },
      },
    });
    routesBySite[site.id] = [r1.id, r2.id];

    // Regu jaga (FR-MST-005)
    await prisma.team.createMany({
      data: [
        { siteId: site.id, code: `${site.code}-RGU-A`, name: 'Regu A', notes: 'Regu shift pagi' },
        { siteId: site.id, code: `${site.code}-RGU-B`, name: 'Regu B', notes: 'Regu shift sore' },
        { siteId: site.id, code: `${site.code}-RGU-C`, name: 'Regu C', notes: 'Regu shift malam' },
      ],
    });

    await prisma.shift.createMany({
      data: [
        { siteId: site.id, name: 'Pagi', startTime: '07:00', endTime: '15:00', color: '#F59E0B', lateToleranceMin: 10 },
        { siteId: site.id, name: 'Sore', startTime: '15:00', endTime: '23:00', color: '#22D3EE', lateToleranceMin: 10 },
        { siteId: site.id, name: 'Malam', startTime: '23:00', endTime: '07:00', crossesMidnight: true, color: '#A78BFA', lateToleranceMin: 15 },
      ],
    });

    await prisma.equipment.createMany({
      data: [
        { siteId: site.id, code: `${site.code}-HT01`, name: 'Handy Talky Motorola', category: 'KOMUNIKASI', serialNumber: `HT${rnd(99999)}` },
        { siteId: site.id, code: `${site.code}-HT02`, name: 'Handy Talky Motorola', category: 'KOMUNIKASI', serialNumber: `HT${rnd(99999)}` },
        { siteId: site.id, code: `${site.code}-SN01`, name: 'Senter LED Taktis', category: 'PENERANGAN' },
        { siteId: site.id, code: `${site.code}-MD01`, name: 'Metal Detector Genggam', category: 'DETEKSI' },
        { siteId: site.id, code: `${site.code}-APR01`, name: 'APAR 6kg', category: 'DAMKAR' },
      ],
    });
  }

  /* ── Roster, presensi, patroli 21 hari ke belakang + 7 hari ke depan ── */
  const allShifts = await prisma.shift.findMany();
  const shiftsBySite: Record<string, typeof allShifts> = {};
  for (const s of allShifts) (shiftsBySite[s.siteId] ||= []).push(s);

  const dateOnly = (d: dayjs.Dayjs) => new Date(`${d.format('YYYY-MM-DD')}T00:00:00.000Z`);

  let patrolCount = 0;
  for (let dayOffset = -20; dayOffset <= 7; dayOffset++) {
    const day = dayjs().add(dayOffset, 'day');
    const isPast = dayOffset < 0;
    const isToday = dayOffset === 0;

    for (const site of sites) {
      const siteGuards = guards.filter((g) => g.homeSiteId === site.id);
      if (!siteGuards.length) continue;
      const shifts = shiftsBySite[site.id] || [];

      for (let si = 0; si < shifts.length; si++) {
        const shift = shifts[si];
        const guard = siteGuards[(Math.abs(dayOffset) + si) % siteGuards.length];
        const routeId = routesBySite[site.id][si % 2];

        const schedule = await prisma.schedule.create({
          data: {
            siteId: site.id, shiftId: shift.id, guardId: guard.id, routeId,
            date: dateOnly(day),
            status: isPast ? 'DONE' : isToday ? 'CONFIRMED' : 'PLANNED',
          },
        });

        if (!isPast && !isToday) continue;
        // Sesekali anggota tidak hadir agar laporan punya variasi.
        if (isPast && chance(0.05)) {
          await prisma.schedule.update({ where: { id: schedule.id }, data: { status: 'ABSENT' } });
          continue;
        }

        const late = chance(0.18);
        const lateMin = late ? 12 + rnd(35) : 0;
        const startHour = Number(shift.startTime.slice(0, 2));
        const checkIn = day.hour(startHour).minute(rnd(8) + lateMin).second(0);
        if (checkIn.isAfter(dayjs())) continue;

        const shiftEnd = shift.crossesMidnight
          ? day.add(1, 'day').hour(Number(shift.endTime.slice(0, 2))).minute(rnd(20))
          : day.hour(Number(shift.endTime.slice(0, 2))).minute(rnd(20));
        const closed = shiftEnd.isBefore(dayjs());

        await prisma.attendance.create({
          data: {
            scheduleId: schedule.id, guardId: guard.id, siteId: site.id,
            checkInAt: checkIn.toDate(),
            checkInLat: jitter(site.lat, 60), checkInLng: jitter(site.lng, 60),
            checkInDistanceM: rnd(80),
            status: late ? 'LATE' : 'ON_TIME',
            lateMinutes: lateMin,
            checkOutAt: closed ? shiftEnd.toDate() : null,
            checkOutLat: closed ? jitter(site.lat, 60) : null,
            checkOutLng: closed ? jitter(site.lng, 60) : null,
            workedMinutes: closed ? shiftEnd.diff(checkIn, 'minute') : 0,
          },
        });

        // Dua putaran patroli per shift.
        const route = await prisma.patrolRoute.findUnique({
          where: { id: routeId },
          include: { checkpoints: { include: { checkpoint: true }, orderBy: { orderIndex: 'asc' } } },
        });
        if (!route) continue;

        for (let round = 0; round < 2; round++) {
          const started = checkIn.add(40 + round * 180 + rnd(20), 'minute');
          if (started.isAfter(dayjs())) continue;
          const running = isToday && round === 1 && started.add(route.expectedDurationMin, 'minute').isAfter(dayjs());

          const total = route.checkpoints.length;
          // Sebagian besar patroli tuntas; sisanya menyisakan titik terlewat.
          const scanned = running
            ? 1 + rnd(Math.max(1, total - 2))
            : chance(0.72) ? total : total - (1 + rnd(3));

          const session = await prisma.patrolSession.create({
            data: {
              siteId: site.id, routeId: route.id, guardId: guard.id, scheduleId: schedule.id,
              startedAt: started.toDate(),
              endedAt: running ? null : started.add(route.expectedDurationMin + rnd(15) - 5, 'minute').toDate(),
              status: running ? 'IN_PROGRESS' : scanned === 0 ? 'ABANDONED' : 'COMPLETED',
              totalCheckpoints: total,
              scannedCount: scanned,
              missedCount: total - scanned,
              complianceRate: Math.round((scanned / total) * 1000) / 10,
              durationMin: running ? 0 : route.expectedDurationMin + rnd(15) - 5,
              distanceM: 900 + rnd(1400),
            },
          });
          patrolCount++;

          for (let i = 0; i < scanned; i++) {
            const rc = route.checkpoints[i];
            const at = started.add(Math.round(((i + 1) / total) * route.expectedDurationMin) + rnd(6) - 2, 'minute');
            const issue = chance(0.06);
            await prisma.patrolScan.create({
              data: {
                sessionId: session.id, checkpointId: rc.checkpointId,
                scannedAt: at.toDate(),
                method: chance(0.75) ? 'QR' : chance(0.5) ? 'NFC' : 'GPS',
                lat: jitter(rc.checkpoint.lat, 25), lng: jitter(rc.checkpoint.lng, 25),
                distanceM: rnd(30),
                condition: issue ? (chance(0.45) ? 'BERMASALAH' : 'PERLU_PERHATIAN') : 'AMAN',
                note: issue ? pick(['Lampu mati', 'Pagar penyok', 'Pintu tidak terkunci', 'Genangan air', 'CCTV buram']) : null,
                isLate: chance(0.12),
                orderIndex: rc.orderIndex,
              },
            });
          }

          // Jejak GPS untuk peta riwayat.
          if (round === 0 || running) {
            const pings = [];
            for (let i = 0; i < 25; i++) {
              pings.push({
                guardId: guard.id, sessionId: session.id,
                lat: jitter(site.lat, site.radiusM * 1.6),
                lng: jitter(site.lng, site.radiusM * 1.6),
                accuracyM: 5 + rnd(15), speedKph: rnd(6), batteryPct: 100 - rnd(60),
                recordedAt: started.add(i * 2, 'minute').toDate(),
              });
            }
            await prisma.locationPing.createMany({ data: pings });
          }
        }
      }
    }
  }

  /* ── Insiden ── */
  const incidentSeeds = [
    { category: 'ORANG_MENCURIGAKAN', severity: 'MEDIUM', title: 'Orang tidak dikenal di area parkir', description: 'Ditemukan seseorang tanpa identitas berkeliling area parkir karyawan pada pukul 02.15. Yang bersangkutan diamankan dan diserahkan ke pos.' },
    { category: 'PENCURIAN', severity: 'HIGH', title: 'Kehilangan besi scrap di area loading', description: 'Timbangan sisa scrap berkurang 120 kg dibanding catatan sore. CCTV area loading sedang diperiksa.' },
    { category: 'KERUSAKAN_FASILITAS', severity: 'LOW', title: 'Lampu perimeter sisi barat mati', description: 'Tiga titik lampu perimeter tidak menyala sejak pukul 19.00. Sudah dilaporkan ke teknisi.' },
    { category: 'KEBAKARAN', severity: 'CRITICAL', title: 'Percikan api pada panel listrik gudang', description: 'Terjadi percikan pada panel utama gudang. APAR digunakan, aliran listrik dipadamkan, tidak ada korban.' },
    { category: 'KECELAKAAN', severity: 'MEDIUM', title: 'Forklift menabrak rak penyimpanan', description: 'Operator forklift menabrak rak baris B. Tidak ada korban, dua palet material rusak.' },
    { category: 'PELANGGARAN_TAMU', severity: 'LOW', title: 'Tamu masuk tanpa kartu identitas', description: 'Tamu vendor masuk melalui gerbang belakang tanpa menukar kartu identitas. Sudah diberi teguran.' },
    { category: 'MEDIS', severity: 'HIGH', title: 'Karyawan pingsan di area produksi', description: 'Karyawan bagian packing pingsan diduga kelelahan. Dibawa ke klinik perusahaan.' },
    { category: 'PERUSAKAN', severity: 'MEDIUM', title: 'Kaca pos jaga retak dilempar batu', description: 'Kaca sisi timur pos jaga retak akibat lemparan dari luar pagar. Pelaku belum teridentifikasi.' },
  ];
  let seq = 0;
  const SLA: Record<string, number> = { LOW: 72, MEDIUM: 24, HIGH: 8, CRITICAL: 1 };
  for (let i = 0; i < 22; i++) {
    const t = incidentSeeds[i % incidentSeeds.length];
    const site = pick(sites);
    const reporter = pick(guards.filter((g) => g.homeSiteId === site.id).concat(guards[0]));
    const occurred = dayjs().subtract(rnd(20), 'day').hour(rnd(24)).minute(rnd(60));
    const status = pick(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED', 'ESCALATED'] as const);
    const resolved = status === 'RESOLVED' || status === 'CLOSED';
    seq++;
    await prisma.incident.create({
      data: {
        code: `INC-${occurred.format('YYYYMM')}-${String(seq).padStart(4, '0')}`,
        siteId: site.id,
        reporterId: reporter.id,
        assigneeId: chance(0.7) ? pick(supervisors).id : null,
        category: t.category,
        severity: t.severity as any,
        status,
        title: t.title,
        description: t.description,
        lat: jitter(site.lat, 200), lng: jitter(site.lng, 200),
        locationHint: pick(['Dekat gerbang utama', 'Sisi utara pagar', 'Area loading dock', 'Lantai 2 gedung produksi']),
        occurredAt: occurred.toDate(),
        slaDueAt: occurred.add(SLA[t.severity], 'hour').toDate(),
        resolvedAt: resolved ? occurred.add(rnd(30) + 1, 'hour').toDate() : null,
        closedAt: status === 'CLOSED' ? occurred.add(rnd(48) + 2, 'hour').toDate() : null,
        lossValue: t.category === 'PENCURIAN' ? 3_500_000 + rnd(9) * 500_000 : null,
        updates: {
          create: [
            { userId: reporter.id, action: 'DILAPORKAN', note: 'Laporan insiden dibuat dari aplikasi lapangan', createdAt: occurred.toDate() },
            ...(resolved
              ? [{ userId: pick(supervisors).id, action: 'STATUS → RESOLVED', note: 'Penanganan selesai, situasi terkendali', createdAt: occurred.add(2, 'hour').toDate() }]
              : []),
          ],
        },
      },
    });
  }

  /* ── Sinyal darurat ── */
  await prisma.panicAlert.create({
    data: {
      guardId: pick(guards).id, siteId: sites[0].id,
      lat: jitter(sites[0].lat, 150), lng: jitter(sites[0].lng, 150),
      message: 'Ada keributan di gerbang belakang, butuh bantuan',
      status: 'RESOLVED',
      acknowledgedById: supervisors[0].id,
      acknowledgedAt: dayjs().subtract(3, 'day').add(2, 'minute').toDate(),
      resolvedAt: dayjs().subtract(3, 'day').add(25, 'minute').toDate(),
      responseNote: 'Tim bergerak, situasi diamankan dalam 20 menit',
      createdAt: dayjs().subtract(3, 'day').toDate(),
    },
  });

  /* ── Tamu & kendaraan ── */
  const purposes = ['Meeting dengan HRD', 'Pengiriman barang', 'Servis mesin', 'Audit vendor', 'Kunjungan keluarga karyawan', 'Survei kontraktor'];
  const companies = ['PT Sinar Jaya', 'CV Mitra Teknik', 'PT Logistik Nusantara', 'PT Karya Abadi', 'Perorangan'];
  for (let i = 0; i < 60; i++) {
    const site = pick(sites);
    const inAt = dayjs().subtract(rnd(10), 'day').hour(8 + rnd(9)).minute(rnd(60));
    const out = chance(0.8);
    await prisma.visitor.create({
      data: {
        siteId: site.id, handledById: pick(guards).id,
        badgeNo: `V-${String(100 + i)}`,
        name: pick(['Budi Santoso', 'Siti Aminah', 'Rudi Hartono', 'Maya Lestari', 'Dimas Aryo', 'Nia Kurnia', 'Toni Wijaya']),
        idType: pick(['KTP', 'SIM', 'KARTU PEGAWAI']),
        idNumber: `32${rnd(99999999)}`,
        company: pick(companies),
        phone: `0812${rnd(9999999)}`,
        purpose: pick(purposes),
        hostName: pick(['HRD', 'Bagian Teknik', 'Gudang', 'Manajemen']),
        vehiclePlate: chance(0.6) ? `B ${1000 + rnd(8999)} ${pick(['ABC', 'XYZ', 'KLM', 'PQR'])}` : null,
        checkInAt: inAt.toDate(),
        checkOutAt: out ? inAt.add(30 + rnd(180), 'minute').toDate() : null,
        status: out ? 'CHECKED_OUT' : 'INSIDE',
      },
    });
  }
  for (let i = 0; i < 45; i++) {
    const site = pick(sites);
    const inAt = dayjs().subtract(rnd(8), 'day').hour(6 + rnd(14)).minute(rnd(60));
    const out = chance(0.85);
    await prisma.vehicleLog.create({
      data: {
        siteId: site.id, recordedById: pick(guards).id,
        plate: `${pick(['B', 'D', 'T', 'F'])} ${1000 + rnd(8999)} ${pick(['UY', 'KA', 'ZR', 'NM'])}`,
        vehicleType: pick(['MOBIL', 'TRUK', 'MOTOR', 'BOX']),
        driverName: pick(['Sopyan', 'Marno', 'Herman', 'Wahyu', 'Iyan']),
        company: pick(companies),
        purpose: pick(['Muat barang', 'Bongkar material', 'Antar dokumen', 'Servis']),
        cargo: chance(0.5) ? pick(['Bahan baku plastik', 'Sparepart mesin', 'Kardus kemasan', 'Kosong']) : null,
        inAt: inAt.toDate(),
        outAt: out ? inAt.add(20 + rnd(150), 'minute').toDate() : null,
      },
    });
  }

  /* ── Serah terima & pengumuman ── */
  for (let i = 0; i < 8; i++) {
    const site = pick(sites);
    const g = guards.filter((x) => x.homeSiteId === site.id);
    if (g.length < 2) continue;
    await prisma.handover.create({
      data: {
        siteId: site.id, fromGuardId: g[0].id, toGuardId: g[1].id,
        shiftDate: dateOnly(dayjs().subtract(i, 'day')),
        situation: pick([
          'Situasi aman terkendali. Seluruh titik patroli terpantau normal.',
          'Ada perbaikan pagar sisi barat oleh kontraktor, pekerja masih di lokasi sampai pukul 22.00.',
          'Lampu perimeter titik 3 dan 4 mati, sudah dilaporkan ke teknisi.',
        ]),
        pendingWork: chance(0.5) ? 'Menunggu teknisi memperbaiki lampu perimeter' : null,
        equipmentOk: chance(0.85),
        equipmentNote: chance(0.3) ? 'HT nomor 2 baterai lemah' : null,
        acknowledgedAt: chance(0.7) ? dayjs().subtract(i, 'day').add(10, 'minute').toDate() : null,
      },
    });
  }

  await prisma.announcement.createMany({
    data: [
      { title: 'Apel Gabungan Bulanan', body: 'Seluruh anggota wajib mengikuti apel gabungan hari Sabtu pukul 07.00 di halaman kantor pusat. Seragam lengkap PDL.', audience: 'ALL', priority: 'MEDIUM', createdById: chief.id },
      { title: 'Peningkatan Kewaspadaan Malam Hari', body: 'Menyusul laporan pencurian di kawasan sekitar, frekuensi patroli malam ditambah menjadi 3 putaran per shift.', audience: 'GUARD', priority: 'HIGH', createdById: admin.id },
      { title: 'Pembaruan Prosedur Buku Tamu', body: 'Mulai pekan depan seluruh tamu wajib difoto dan menukar kartu identitas dengan kartu tamu.', audience: 'ALL', priority: 'LOW', createdById: chief.id },
    ],
  });

  await prisma.setting.createMany({
    data: [
      { key: 'org.name', value: 'PATROLI Command Center' },
      { key: 'org.company', value: 'PT Garda Nusantara Sekuriti' },
      { key: 'patrol.min_rounds_per_shift', value: 2 },
      { key: 'tracking.ping_interval_sec', value: 60 },
    ],
  });

  /* ── Anggota dimasukkan ke regu ── */
  const semuaRegu = await prisma.team.findMany();
  for (const g of guards) {
    const reguSite = semuaRegu.filter((r) => r.siteId === g.homeSiteId);
    if (reguSite.length)
      await prisma.user.update({
        where: { id: g.id },
        data: { teamId: pick(reguSite).id },
      });
  }

  /* ── Tugas insidental (FR-TASK-001) ── */
  const contohTugas = [
    ['Pemeriksaan APAR lantai 1', 'Periksa tekanan, segel, dan masa berlaku seluruh APAR.', 'TINGGI'],
    ['Pengawalan setoran ke bank', 'Dampingi kasir saat penyetoran, catat jam berangkat dan tiba.', 'MENDESAK'],
    ['Pendampingan tamu audit', 'Dampingi tim audit selama berada di area produksi.', 'NORMAL'],
    ['Periksa pagar sisi timur', 'Cek kerusakan pagar setelah laporan warga.', 'NORMAL'],
    ['Uji sirene kebakaran', 'Uji fungsi sirene bersama teknisi, catat hasilnya.', 'RENDAH'],
  ];
  for (let i = 0; i < 14; i++) {
    const t = contohTugas[i % contohTugas.length];
    const g = pick(guards);
    const status = pick(['BARU', 'DIKERJAKAN', 'SELESAI', 'SELESAI'] as const);
    const dibuat = dayjs().subtract(rnd(10), 'day');
    await prisma.task.create({
      data: {
        siteId: g.homeSiteId!,
        assigneeId: g.id,
        createdById: pick(supervisors).id,
        title: t[0],
        description: t[1],
        priority: t[2] as any,
        status,
        dueAt: dibuat.add(1 + rnd(3), 'day').toDate(),
        startedAt: status !== 'BARU' ? dibuat.add(2, 'hour').toDate() : null,
        finishedAt: status === 'SELESAI' ? dibuat.add(5, 'hour').toDate() : null,
        result: status === 'SELESAI' ? 'Selesai dikerjakan, tidak ada temuan berarti.' : null,
        createdAt: dibuat.toDate(),
      },
    });
  }

  /* ── Instruksi (FR-TASK-003) ── */
  for (const [judul, isi, mendesak] of [
    ['Perketat pemeriksaan kendaraan keluar', 'Seluruh kendaraan keluar wajib diperiksa muatannya dan dicatat.', false],
    ['Apel malam dimajukan', 'Apel malam dimajukan menjadi pukul 22.30 mulai hari ini.', true],
    ['Pemeliharaan lampu perimeter', 'Teknisi akan bekerja di sisi barat, dampingi selama pekerjaan.', false],
  ] as const) {
    await prisma.instruction.create({
      data: {
        senderId: pick(supervisors).id,
        siteId: pick(sites).id,
        title: judul,
        body: isi,
        urgent: mendesak,
        createdAt: dayjs().subtract(rnd(6), 'day').toDate(),
      },
    });
  }

  /* ── Penilaian manual Danru & Klien (FR-KPI-002) ── */
  const periodeIni = dayjs().format('YYYY-MM');
  const periodeLalu = dayjs().subtract(1, 'month').format('YYYY-MM');
  for (const periode of [periodeLalu, periodeIni]) {
    for (const g of guards) {
      const nilai = () => 3 + rnd(3);
      await prisma.assessment.create({
        data: {
          guardId: g.id,
          assessorId: pick(supervisors).id,
          assessorRole: 'DANRU',
          period: periode,
          disiplin: nilai(),
          penampilan: nilai(),
          responsif: nilai(),
          kualitasLaporan: nilai(),
          komunikasi: nilai(),
          note: 'Penilaian rutin bulanan.',
        },
      });
      // Klien menilai anggota pada site miliknya
      if (g.homeSiteId === sites[0].id || g.homeSiteId === sites[1].id) {
        await prisma.assessment.create({
          data: {
            guardId: g.id,
            assessorId: clientUser.id,
            assessorRole: 'KLIEN',
            period: periode,
            disiplin: nilai(),
            penampilan: nilai(),
            responsif: nilai(),
            kualitasLaporan: nilai(),
            komunikasi: nilai(),
            note: 'Penilaian dari perwakilan klien.',
          },
        });
      }
    }
  }

  /* ── Pengajuan cuti, izin, dan lembur ── */
  for (let i = 0; i < 8; i++) {
    const g = pick(guards);
    const mulai = dayjs().add(rnd(20) - 5, 'day');
    const jenis = pick(['CUTI', 'IZIN', 'LEMBUR'] as const);
    const status = pick(['DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DISETUJUI'] as const);
    await prisma.leaveRequest.create({
      data: {
        userId: g.id,
        type: jenis,
        startDate: mulai.toDate(),
        endDate: mulai.add(jenis === 'LEMBUR' ? 0 : rnd(3), 'day').toDate(),
        hours: jenis === 'LEMBUR' ? 2 + rnd(4) : null,
        reason: pick([
          'Keperluan keluarga',
          'Menghadiri acara pernikahan saudara',
          'Kondisi kesehatan',
          'Penambahan jam jaga menggantikan rekan',
        ]),
        status,
        approverId: status === 'DIAJUKAN' ? null : pick(supervisors).id,
        decidedAt: status === 'DIAJUKAN' ? null : mulai.subtract(1, 'day').toDate(),
        decisionNote: status === 'DITOLAK' ? 'Kekuatan regu tidak mencukupi pada tanggal tersebut.' : null,
      },
    });
  }

  /* ── Percobaan presensi yang ditolak (FR-ATT-006) ── */
  for (let i = 0; i < 12; i++) {
    const g = pick(guards);
    const jarak = 150 + rnd(900);
    const luar = chance(0.6);
    await prisma.attendanceAttempt.create({
      data: {
        guardId: g.id,
        siteId: g.homeSiteId!,
        result: luar ? 'DILUAR_RADIUS' : 'WAJAH_TIDAK_COCOK',
        reason: luar
          ? `Anda berada ${jarak} m dari pos (batas 400 m). Presensi harus dilakukan di area site.`
          : 'Wajah tidak cocok dengan data terdaftar. Presensi ditolak.',
        lat: jitter(sites[0].lat, 2000),
        lng: jitter(sites[0].lng, 2000),
        distanceM: luar ? jarak : rnd(80),
        faceScore: luar ? null : 30 + rnd(25),
        createdAt: dayjs().subtract(rnd(14), 'day').hour(6 + rnd(12)).toDate(),
      },
    });
  }

  await prisma.setting.create({
    data: {
      key: 'kpi.bobot',
      value: { kehadiran: 25, patroli: 30, ronde: 15, pelaporan: 10, penilaian: 20 },
    },
  });

  console.log(`▸ Selesai. ${guards.length + supervisors.length + 3} pengguna, ${sites.length} site, ${patrolCount} sesi patroli.`);
  console.log('  admin/admin123 · komandan/komandan123 · danru1/danru123 · guard1/guard123 · klien/klien123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
