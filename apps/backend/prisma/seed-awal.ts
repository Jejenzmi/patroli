import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Data awal instans produksi — bukan data contoh.
 *
 * Hanya membuat satu akun administrator dan pengaturan dasar bila basis data
 * masih kosong. Data operasional (klien, site, personel, roster) dimasukkan
 * sendiri oleh perusahaan lewat antarmuka.
 *
 *   npx tsx prisma/seed-awal.ts
 *
 * Data contoh untuk peragaan ada di `seed.ts` dan hanya berjalan bila
 * dijalankan sendiri atau lingkungan menyalakan SEED_DEMO=true.
 */

const prisma = new PrismaClient();

async function main() {
  const admin = process.env.ADMIN_USERNAME || 'admin';
  const sandi = process.env.ADMIN_PASSWORD || 'admin123';

  const ada = await prisma.user.findUnique({ where: { username: admin } });
  if (!ada) {
    await prisma.user.create({
      data: {
        employeeId: 'ADM-001',
        username: admin,
        name: process.env.ADMIN_NAME || 'Administrator',
        email: process.env.ADMIN_EMAIL || null,
        passwordHash: bcrypt.hashSync(sandi, 10),
        role: 'SUPER_ADMIN',
        rank: 'Administrator Sistem',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    console.log(`  · akun administrator "${admin}" dibuat`);
    if (sandi === 'admin123')
      console.log('  ! sandi masih bawaan — segera ganti lewat menu Profil');
  }

  const pengaturan: [string, any][] = [
    ['org.name', process.env.ORG_NAME || 'DHARMAPATI Command Center'],
    ['org.company', process.env.ORG_COMPANY || 'PT Dharmapati Putra Nusantara'],
    ['tracking.ping_interval_sec', 60],
    ['patrol.min_rounds_per_shift', 2],
  ];
  for (const [key, value] of pengaturan) {
    const s = await prisma.setting.findUnique({ where: { key } });
    if (!s) {
      await prisma.setting.create({ data: { key, value } });
      console.log(`  · pengaturan ${key} dipasang`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
