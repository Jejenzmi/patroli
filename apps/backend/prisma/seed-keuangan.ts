import { PrismaClient } from '@prisma/client';
import { TER } from './data/ter';

/**
 * Seeder modul keuangan (Prioritas 1).
 *
 * Idempoten: dijalankan berulang kali tidak menggandakan data dan tidak
 * menimpa angka yang sudah disunting operator — hanya mengisi yang kosong.
 *
 *   npx tsx prisma/seed-keuangan.ts
 */

const prisma = new PrismaClient();

const rp = (n: number) => Math.round(n);

async function seedTer() {
  for (const [kategori, lapisan] of Object.entries(TER)) {
    const ada = await prisma.terBracket.count({ where: { category: kategori } });
    if (ada) {
      console.log(`  · TER ${kategori}: sudah ada ${ada} lapisan, dilewati`);
      continue;
    }
    await prisma.terBracket.createMany({
      data: lapisan.map(([min, max, tarif]) => ({
        category: kategori,
        minGross: min,
        maxGross: max,
        ratePct: tarif,
      })),
    });
    console.log(`  · TER ${kategori}: ${lapisan.length} lapisan dipasang`);
  }
}

async function seedPengaturan() {
  const bawaan: [string, any][] = [
    [
      'payroll.bpjs',
      {
        jkm: 0.3,
        jhtPerusahaan: 3.7,
        jpPerusahaan: 2,
        kesPerusahaan: 4,
        jhtPekerja: 2,
        jpPekerja: 1,
        kesPekerja: 1,
        batasUpahJp: 10_547_400,
        batasUpahKes: 12_000_000,
      },
    ],
    ['payroll.upah', { hariKerjaStandar: 25, hariKerjaSeminggu: 6, pembagiLembur: 173 }],
  ];
  for (const [key, value] of bawaan) {
    const ada = await prisma.setting.findUnique({ where: { key } });
    if (ada) continue;
    await prisma.setting.create({ data: { key, value } });
    console.log(`  · pengaturan ${key} dipasang`);
  }
}

/** UMK contoh — wajib disesuaikan dengan SK Gubernur tahun berjalan. */
const UMK: { region: string; amount: number }[] = [
  { region: 'Kabupaten Karawang', amount: 5_599_593 },
  { region: 'Kabupaten Bekasi', amount: 5_558_515 },
  { region: 'Kabupaten Purwakarta', amount: 4_792_252 },
  { region: 'Kota Bandung', amount: 4_482_914 },
];

async function seedUmk(tahun: number) {
  for (const u of UMK) {
    await prisma.minimumWage.upsert({
      where: { region_year: { region: u.region, year: tahun } },
      create: { ...u, year: tahun, note: 'Nilai awal — sesuaikan dengan SK Gubernur' },
      update: {},
    });
  }
  console.log(`  · UMK ${tahun}: ${UMK.length} wilayah`);
}

async function seedGolongan() {
  const umk = 5_599_593; // acuan Kabupaten Karawang
  const golongan = [
    {
      code: 'SEC-1',
      name: 'Anggota Security',
      region: 'Kabupaten Karawang',
      baseSalary: umk,
      positionAllowance: 0,
      mealPerDay: 25_000,
      transportPerDay: 20_000,
      attendanceBonus: 150_000,
      latePenaltyPerMin: 1_000,
    },
    {
      code: 'SEC-2',
      name: 'Danru / Komandan Regu',
      region: 'Kabupaten Karawang',
      baseSalary: umk,
      positionAllowance: 750_000,
      mealPerDay: 25_000,
      transportPerDay: 25_000,
      attendanceBonus: 200_000,
      latePenaltyPerMin: 1_000,
    },
    {
      code: 'SEC-3',
      name: 'Chief Security',
      region: 'Kabupaten Karawang',
      baseSalary: umk,
      positionAllowance: 1_750_000,
      mealPerDay: 30_000,
      transportPerDay: 30_000,
      attendanceBonus: 250_000,
      latePenaltyPerMin: 0,
    },
  ];

  for (const g of golongan) {
    await prisma.payGrade.upsert({ where: { code: g.code }, create: g, update: {} });
  }
  console.log(`  · golongan upah: ${golongan.length}`);

  const [anggota, danru] = await Promise.all([
    prisma.payGrade.findUnique({ where: { code: 'SEC-1' } }),
    prisma.payGrade.findUnique({ where: { code: 'SEC-2' } }),
  ]);

  // Personel yang belum bergolongan dipasangkan menurut perannya.
  const belum = await prisma.user.findMany({
    where: { role: { in: ['GUARD', 'SUPERVISOR'] }, gradeId: null },
    select: { id: true, role: true, name: true, joinedAt: true },
  });
  let i = 0;
  for (const u of belum) {
    i += 1;
    await prisma.user.update({
      where: { id: u.id },
      data: {
        gradeId: u.role === 'SUPERVISOR' ? danru!.id : anggota!.id,
        ptkp: i % 3 === 0 ? 'K1' : i % 3 === 1 ? 'TK0' : 'K0',
        bankName: 'BCA',
        bankAccount: `88${String(1000000 + i).padStart(8, '0')}`,
        bankAccountName: u.name,
        joinedAt: u.joinedAt ?? new Date(Date.now() - (180 + i * 30) * 86_400_000),
      },
    });
  }
  console.log(`  · ${belum.length} personel dipasangi golongan & data bank`);
}

/** Hari libur nasional — daftar awal, wajib diperbarui tiap tahun. */
const LIBUR: [string, string][] = [
  ['01-01', 'Tahun Baru Masehi'],
  ['05-01', 'Hari Buruh Internasional'],
  ['06-01', 'Hari Lahir Pancasila'],
  ['08-17', 'Hari Kemerdekaan RI'],
  ['12-25', 'Hari Raya Natal'],
];

async function seedLibur(tahun: number) {
  for (const [md, nama] of LIBUR) {
    const date = new Date(`${tahun}-${md}T00:00:00.000Z`);
    await prisma.holiday.upsert({ where: { date }, create: { date, name: nama }, update: {} });
  }
  console.log(`  · hari libur ${tahun}: ${LIBUR.length} tanggal (tanggal keagamaan menyusul, ikut SKB)`);
}

async function seedKontrak() {
  const klien = await prisma.client.findMany({
    include: { sites: { include: { shifts: true } } },
  });

  const grades = await prisma.payGrade.findMany();
  const tarifJasa = (kode: string) => {
    const g = grades.find((x) => x.code === kode)!;
    // Tarif jasa = beban langsung + iuran + seragam + margin pengelolaan.
    const beban = g.baseSalary + g.positionAllowance;
    const iuran = beban * 0.1024; // JKK+JKM+JHT+JP+Kesehatan porsi perusahaan
    const tunjangan = (g.mealPerDay + g.transportPerDay) * 25;
    return rp((beban + iuran + tunjangan + 250_000) * 1.15);
  };

  let dibuat = 0;
  for (const c of klien) {
    if (!c.sites.length) continue;
    const number = `KTR/${c.code}/${new Date().getFullYear()}`;
    const ada = await prisma.contract.findUnique({ where: { number } });
    if (ada) continue;

    const kontrak = await prisma.contract.create({
      data: {
        clientId: c.id,
        number,
        title: `Jasa Pengamanan — ${c.name}`,
        startDate: new Date(`${new Date().getFullYear()}-01-01`),
        endDate: new Date(`${new Date().getFullYear()}-12-31`),
        billingDay: 5,
        dueDays: 14,
        ppnPct: 11,
        pph23Pct: 2,
        pph23Dipotong: true,
        status: 'AKTIF',
      },
    });

    for (const s of c.sites) {
      const shifts = s.shifts.length ? s.shifts : [null];
      for (const sh of shifts) {
        await prisma.contractPost.create({
          data: {
            contractId: kontrak.id,
            siteId: s.id,
            shiftId: sh?.id ?? null,
            positionName: sh ? `Anggota ${sh.name}` : 'Anggota Security',
            headcount: 2,
            ratePerPerson: tarifJasa('SEC-1'),
            gradeId: grades.find((g) => g.code === 'SEC-1')!.id,
          },
        });
      }
      await prisma.contractPost.create({
        data: {
          contractId: kontrak.id,
          siteId: s.id,
          positionName: 'Danru',
          headcount: 1,
          ratePerPerson: tarifJasa('SEC-2'),
          gradeId: grades.find((g) => g.code === 'SEC-2')!.id,
        },
      });
    }

    await prisma.penaltyRule.createMany({
      data: [
        {
          contractId: kontrak.id,
          kind: 'POS_KOSONG',
          description: 'Pos tidak terisi di luar potongan pro-rata',
          amount: 100_000,
          unit: 'PER_HARI_ORANG',
          threshold: 2,
        },
        {
          contractId: kontrak.id,
          kind: 'RONDE',
          description: 'Ronde tidak tuntas atau ditinggalkan',
          amount: 50_000,
          unit: 'PER_KEJADIAN',
          threshold: 5,
        },
        {
          contractId: kontrak.id,
          kind: 'INSIDEN',
          description: 'Penanganan insiden melampaui SLA',
          amount: 250_000,
          unit: 'PER_KEJADIAN',
          threshold: 0,
        },
      ],
    });
    dibuat += 1;
  }
  console.log(`  · kontrak dibuat: ${dibuat}`);
}

async function main() {
  const tahun = new Date().getFullYear();
  console.log('▸ Seeder keuangan PATROLI');
  await seedTer();
  await seedPengaturan();
  await seedUmk(tahun);
  await seedGolongan();
  await seedLibur(tahun);
  await seedKontrak();
  console.log('▸ selesai');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
