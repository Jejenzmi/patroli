/**
 * Menambahkan data contoh untuk modul baru (lantai, regu, tugas, instruksi,
 * penilaian, cuti/lembur, percobaan presensi) ke basis data yang sudah terisi.
 * Aman dijalankan berulang: melewati bagian yang sudah ada.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();
const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: T[]): T => a[rnd(a.length)];
const chance = (p: number) => Math.random() < p;
const jitter = (v: number, m = 300) => v + (Math.random() - 0.5) * (m / 111_000);

async function main() {
  const sites = await prisma.site.findMany({ orderBy: { code: 'asc' } });
  const guards = await prisma.user.findMany({ where: { role: 'GUARD' } });
  const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR' } });
  const klien = await prisma.user.findFirst({ where: { role: 'CLIENT' } });
  if (!sites.length || !guards.length) throw new Error('Data dasar belum ada');

  /* ── Lantai + penempatan titik pada denah ── */
  if ((await prisma.floor.count()) === 0) {
    for (const site of sites) {
      const lantai = [];
      for (const [i, nama] of ['Basement', 'Lantai 1', 'Lantai 2'].entries()) {
        lantai.push(
          await prisma.floor.create({
            data: { siteId: site.id, name: nama, level: i, notes: `Denah skematik ${nama}` },
          })
        );
      }
      const titik = await prisma.checkpoint.findMany({ where: { siteId: site.id }, orderBy: { code: 'asc' } });
      for (const [i, cp] of titik.entries()) {
        await prisma.checkpoint.update({
          where: { id: cp.id },
          data: {
            floorId: lantai[i % lantai.length].id,
            planX: 12 + ((i * 23) % 76),
            planY: 14 + ((i * 37) % 72),
          },
        });
      }
    }
    console.log('▸ Lantai dan penempatan titik dibuat');
  }

  /* ── Regu ── */
  if ((await prisma.team.count()) === 0) {
    for (const site of sites) {
      await prisma.team.createMany({
        data: [
          { siteId: site.id, code: `${site.code}-RGU-A`, name: 'Regu A', notes: 'Regu shift pagi' },
          { siteId: site.id, code: `${site.code}-RGU-B`, name: 'Regu B', notes: 'Regu shift sore' },
          { siteId: site.id, code: `${site.code}-RGU-C`, name: 'Regu C', notes: 'Regu shift malam' },
        ],
      });
    }
    const semua = await prisma.team.findMany();
    for (const g of guards) {
      const reguSite = semua.filter((r) => r.siteId === g.homeSiteId);
      if (reguSite.length)
        await prisma.user.update({ where: { id: g.id }, data: { teamId: pick(reguSite).id } });
    }
    console.log('▸ Regu dibuat dan anggota ditempatkan');
  }

  /* ── Tugas insidental ── */
  if ((await prisma.task.count()) === 0) {
    const contoh: [string, string, any][] = [
      ['Pemeriksaan APAR lantai 1', 'Periksa tekanan, segel, dan masa berlaku seluruh APAR.', 'TINGGI'],
      ['Pengawalan setoran ke bank', 'Dampingi kasir saat penyetoran, catat jam berangkat dan tiba.', 'MENDESAK'],
      ['Pendampingan tamu audit', 'Dampingi tim audit selama berada di area produksi.', 'NORMAL'],
      ['Periksa pagar sisi timur', 'Cek kerusakan pagar setelah laporan warga.', 'NORMAL'],
      ['Uji sirene kebakaran', 'Uji fungsi sirene bersama teknisi, catat hasilnya.', 'RENDAH'],
    ];
    for (let i = 0; i < 16; i++) {
      const t = contoh[i % contoh.length];
      // Tiga tugas pertama selalu untuk akun peragaan agar layar tugas tidak kosong.
      const g = i < 3 ? guards.find((x) => x.username === 'guard1') ?? pick(guards) : pick(guards);
      const status = pick(['BARU', 'DIKERJAKAN', 'SELESAI', 'SELESAI'] as const);
      const dibuat = dayjs().subtract(rnd(10), 'day');
      await prisma.task.create({
        data: {
          siteId: g.homeSiteId!,
          assigneeId: g.id,
          createdById: pick(supervisors).id,
          title: t[0],
          description: t[1],
          priority: t[2],
          status,
          dueAt: dibuat.add(1 + rnd(3), 'day').toDate(),
          startedAt: status !== 'BARU' ? dibuat.add(2, 'hour').toDate() : null,
          finishedAt: status === 'SELESAI' ? dibuat.add(5, 'hour').toDate() : null,
          result: status === 'SELESAI' ? 'Selesai dikerjakan, tidak ada temuan berarti.' : null,
          createdAt: dibuat.toDate(),
        },
      });
    }
    console.log('▸ Tugas insidental dibuat');
  }

  /* ── Instruksi ── */
  if ((await prisma.instruction.count()) === 0) {
    const daftar: [string, string, boolean][] = [
      ['Perketat pemeriksaan kendaraan keluar', 'Seluruh kendaraan keluar wajib diperiksa muatannya dan dicatat pada buku kendaraan.', false],
      ['Apel malam dimajukan', 'Apel malam dimajukan menjadi pukul 22.30 mulai hari ini sampai pemberitahuan berikutnya.', true],
      ['Pemeliharaan lampu perimeter', 'Teknisi bekerja di sisi barat pukul 09.00–15.00, dampingi selama pekerjaan berlangsung.', false],
    ];
    for (const [judul, isi, mendesak] of daftar) {
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
    console.log('▸ Instruksi dibuat');
  }

  /* ── Penilaian manual Danru & Klien ── */
  if ((await prisma.assessment.count()) === 0) {
    const periode = [dayjs().subtract(2, 'month'), dayjs().subtract(1, 'month'), dayjs()].map((d) =>
      d.format('YYYY-MM')
    );
    const nilai = () => 3 + rnd(3);
    for (const p of periode) {
      for (const g of guards) {
        await prisma.assessment.create({
          data: {
            guardId: g.id,
            assessorId: pick(supervisors).id,
            assessorRole: 'DANRU',
            period: p,
            disiplin: nilai(),
            penampilan: nilai(),
            responsif: nilai(),
            kualitasLaporan: nilai(),
            komunikasi: nilai(),
            note: 'Penilaian rutin bulanan oleh Danru.',
          },
        });
        if (klien && [sites[0].id, sites[1].id].includes(g.homeSiteId || '')) {
          await prisma.assessment.create({
            data: {
              guardId: g.id,
              assessorId: klien.id,
              assessorRole: 'KLIEN',
              period: p,
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
    console.log('▸ Penilaian manual dibuat');
  }

  /* ── Pengajuan cuti, izin, lembur ── */
  if ((await prisma.leaveRequest.count()) === 0) {
    for (let i = 0; i < 10; i++) {
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
            'Menggantikan rekan pada shift malam',
          ]),
          status,
          approverId: status === 'DIAJUKAN' ? null : pick(supervisors).id,
          decidedAt: status === 'DIAJUKAN' ? null : mulai.subtract(1, 'day').toDate(),
          decisionNote:
            status === 'DITOLAK' ? 'Kekuatan regu tidak mencukupi pada tanggal tersebut.' : null,
        },
      });
    }
    console.log('▸ Pengajuan cuti/lembur dibuat');
  }

  /* ── Percobaan presensi yang ditolak ── */
  if ((await prisma.attendanceAttempt.count()) === 0) {
    for (let i = 0; i < 14; i++) {
      const g = pick(guards);
      const site = sites.find((s) => s.id === g.homeSiteId) ?? sites[0];
      const jarak = 150 + rnd(900);
      const luar = chance(0.6);
      await prisma.attendanceAttempt.create({
        data: {
          guardId: g.id,
          siteId: site.id,
          result: luar ? 'DILUAR_RADIUS' : 'WAJAH_TIDAK_COCOK',
          reason: luar
            ? `Anda berada ${jarak} m dari pos (batas ${site.radiusM} m). Presensi harus dilakukan di area site.`
            : 'Wajah tidak cocok dengan data terdaftar. Presensi ditolak.',
          lat: jitter(site.lat, 2000),
          lng: jitter(site.lng, 2000),
          distanceM: luar ? jarak : rnd(80),
          faceScore: luar ? null : 30 + rnd(25),
          createdAt: dayjs().subtract(rnd(14), 'day').hour(6 + rnd(12)).toDate(),
        },
      });
    }
    console.log('▸ Percobaan presensi ditolak dibuat');
  }

  /* ── Bobot KPI bawaan ── */
  await prisma.setting.upsert({
    where: { key: 'kpi.bobot' },
    create: {
      key: 'kpi.bobot',
      value: { kehadiran: 25, patroli: 30, ronde: 15, pelaporan: 10, penilaian: 20 },
    },
    update: {},
  });

  /* ── Sebagian pemindaian lama diberi kondisi tiga tingkat ── */
  const scans = await prisma.patrolScan.findMany({
    where: { condition: 'BERMASALAH' },
    select: { id: true },
    take: 200,
  });
  for (const s of scans) {
    if (chance(0.5))
      await prisma.patrolScan.update({ where: { id: s.id }, data: { condition: 'PERLU_PERHATIAN' } });
  }

  console.log('▸ Data contoh modul BRD siap.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
