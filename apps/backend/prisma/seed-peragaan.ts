import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

/**
 * Data peragaan untuk peninjau Google Play.
 *
 * Google mewajibkan pelampiran akun bagi aplikasi yang isinya terkunci di
 * balik halaman masuk. Peninjaunya bekerja dari emulator di negara lain, jadi
 * akun biasa akan langsung terhalang pengikatan perangkat, penolakan lokasi
 * tiruan, dan geofence presensi — aplikasi akan tampak rusak lalu ditolak.
 *
 * Seeder ini menyiapkan satu klien, satu site, rute patroli, roster, dan
 * riwayat secukupnya supaya setiap layar berisi. Akunnya ditandai `isDemo`
 * sehingga ketiga penghadang itu dilonggarkan khusus untuknya.
 *
 *   npx tsx prisma/seed-peragaan.ts
 *
 * Idempoten: dijalankan berulang kali hanya menyegarkan roster agar selalu
 * mencakup hari berjalan.
 */

const prisma = new PrismaClient();

const AKUN = { username: 'demo.playstore', sandi: 'DemoPlay2026' };
const KODE_KLIEN = 'DEMO';
const KODE_SITE = 'DEMO-01';

/** Tengah malam UTC — kunci tanggal roster, sama seperti dateKey() di server. */
const hariKe = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
};

async function main() {
  // Koordinat kantor Dharmapati sebagai titik pusat peragaan.
  const LAT = -6.3061;
  const LNG = 107.3128;

  const klien = await prisma.client.upsert({
    where: { code: KODE_KLIEN },
    update: {},
    create: {
      code: KODE_KLIEN,
      name: 'PT Contoh Peragaan',
      contactName: 'Bagian Umum',
      phone: '021-0000000',
      address: 'Kawasan Industri Contoh Blok A-1',
      provinceCode: '32',
      provinceName: 'Jawa Barat',
      regencyCode: '32.15',
      regencyName: 'Kabupaten Karawang',
    },
  });

  const site = await prisma.site.upsert({
    where: { code: KODE_SITE },
    update: {},
    create: {
      clientId: klien.id,
      code: KODE_SITE,
      name: 'Pos Utama Peragaan',
      address: 'Gerbang Utama, Kawasan Industri Contoh',
      provinceCode: '32',
      provinceName: 'Jawa Barat',
      regencyCode: '32.15',
      regencyName: 'Kabupaten Karawang',
      lat: LAT,
      lng: LNG,
      radiusM: 300,
      picName: 'Bagian Umum',
      picPhone: '021-0000000',
    },
  });

  const shift = await prisma.shift.upsert({
    where: { id: (await prisma.shift.findFirst({ where: { siteId: site.id, name: 'Pagi' } }))?.id ?? 'baru' },
    update: {},
    create: { siteId: site.id, name: 'Pagi', startTime: '07:00', endTime: '15:00', lateToleranceMin: 15 },
  });

  // ── Titik patroli mengelilingi pos ──
  const titikBaru = [
    { kode: 'DEMO-CP1', nama: 'Gerbang Utama', dLat: 0.0002, dLng: 0.0002 },
    { kode: 'DEMO-CP2', nama: 'Area Parkir', dLat: -0.0003, dLng: 0.0004 },
    { kode: 'DEMO-CP3', nama: 'Gudang Belakang', dLat: -0.0005, dLng: -0.0002 },
    { kode: 'DEMO-CP4', nama: 'Ruang Panel Listrik', dLat: 0.0004, dLng: -0.0004 },
  ];
  const titik = [];
  for (const t of titikBaru) {
    titik.push(
      await prisma.checkpoint.upsert({
        where: { code: t.kode },
        update: {},
        create: {
          siteId: site.id,
          code: t.kode,
          name: t.nama,
          description: 'Titik peragaan untuk peninjauan aplikasi',
          lat: LAT + t.dLat,
          lng: LNG + t.dLng,
          radiusM: 50,
        },
      })
    );
  }

  let rute = await prisma.patrolRoute.findFirst({ where: { siteId: site.id, name: 'Ronde Peragaan' } });
  if (!rute) {
    rute = await prisma.patrolRoute.create({
      data: {
        siteId: site.id,
        name: 'Ronde Peragaan',
        description: 'Empat titik keliling pos, urutan bebas agar mudah dicoba',
        expectedDurationMin: 30,
        graceMin: 15,
        enforceOrder: false,
        requirePhoto: false,
        requireReport: true,
      },
    });
    await prisma.routeCheckpoint.createMany({
      data: titik.map((t, i) => ({
        routeId: rute!.id,
        checkpointId: t.id,
        orderIndex: i + 1,
        targetMinute: (i + 1) * 7,
      })),
    });
  }

  // ── Akun peragaan ──
  const hash = await bcrypt.hash(AKUN.sandi, 10);
  const demo = await prisma.user.upsert({
    where: { username: AKUN.username },
    update: {
      passwordHash: hash,
      status: 'ACTIVE',
      isDemo: true,
      homeSiteId: site.id,
      name: 'Anggota Peragaan',
    },
    create: {
      username: AKUN.username,
      // Nama ini tampil pada tangkapan layar halaman Play, jadi dijaga tetap
      // wajar dan jujur — bukan nama orang karangan.
      name: 'Anggota Peragaan',
      employeeId: 'DEMO-001',
      passwordHash: hash,
      role: 'GUARD',
      rank: 'Anggota',
      phone: '0800000000',
      homeSiteId: site.id,
      isDemo: true,
      joinedAt: new Date(new Date().getFullYear(), 0, 2),
    },
  });

  // Perangkat yang pernah terikat dilepas: peninjau boleh berganti emulator.
  await prisma.userDevice.deleteMany({ where: { userId: demo.id } });

  // ── Roster: selalu mencakup hari berjalan ──
  // Dijalankan ulang tiap kali layanan hidup supaya peninjauan yang datang
  // berminggu-minggu kemudian tetap menemukan jadwal hari ini.
  let jadwalBaru = 0;
  for (let i = -3; i <= 30; i++) {
    const tanggal = hariKe(i);
    const ada = await prisma.schedule.findUnique({
      where: { guardId_date_shiftId: { guardId: demo.id, date: tanggal, shiftId: shift.id } },
    });
    if (!ada) {
      await prisma.schedule.create({
        data: {
          siteId: site.id,
          shiftId: shift.id,
          guardId: demo.id,
          routeId: rute.id,
          date: tanggal,
          status: 'PLANNED',
          notes: i === 0 ? 'Jadwal hari ini — silakan lakukan presensi masuk lalu mulai ronde.' : null,
        },
      });
      jadwalBaru++;
    }
  }

  // ── Isi layar lain supaya tidak kosong saat ditinjau ──
  const adaPengumuman = await prisma.announcement.findFirst({ where: { title: { startsWith: 'Selamat datang' } } });
  if (!adaPengumuman) {
    const admin = await prisma.user.findFirst({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
    if (admin)
      await prisma.announcement.create({
        data: {
          title: 'Selamat datang di aplikasi DHARMAPATI',
          body:
            'Aplikasi ini dipakai anggota satuan pengamanan untuk presensi berfoto, ronde patroli ' +
            'berbasis titik QR/NFC, pelaporan insiden, buku tamu, dan tombol darurat. ' +
            'Akun peragaan sudah dijadwalkan bertugas hari ini di Pos Utama Peragaan.',
          audience: 'ALL',
          siteId: site.id,
          priority: 'MEDIUM',
          createdById: admin.id,
        },
      });
  }

  const adaTugas = await prisma.task.findFirst({ where: { assigneeId: demo.id } });
  if (!adaTugas) {
    const admin = await prisma.user.findFirst({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } });
    if (admin)
      await prisma.task.create({
        data: {
          siteId: site.id,
          title: 'Periksa lampu penerangan area parkir',
          description: 'Catat lampu yang mati dan laporkan lewat menu Tugas.',
          priority: 'NORMAL',
          status: 'BARU',
          assigneeId: demo.id,
          createdById: admin.id,
          dueAt: hariKe(2),
        },
      });
  }

  console.log(
    `  · peragaan: akun ${AKUN.username} siap di ${site.name}` +
      (jadwalBaru ? `, ${jadwalBaru} hari roster ditambahkan` : ', roster sudah lengkap')
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
