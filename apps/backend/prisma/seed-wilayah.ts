import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { PrismaClient } from '@prisma/client';

/**
 * Memasang daftar wilayah administratif Indonesia.
 *
 * Sumber: Kepmendagri 300.2.2-2138 Tahun 2025 — 38 provinsi, 514
 * kabupaten/kota, 7.285 kecamatan, 83.762 desa/kelurahan. Disimpan sebagai
 * berkas terkompresi di dalam repo supaya pemasangan tidak bergantung pada
 * layanan luar.
 *
 *   npx tsx prisma/seed-wilayah.ts
 *
 * Idempoten: bila jumlah barisnya sudah sama, seluruh proses dilewati.
 */

const prisma = new PrismaClient();
const BERKAS = path.join(__dirname, 'data', 'wilayah.csv.gz');

/** Tingkat ditentukan dari jumlah titik pada kodenya. */
const tingkat = (kode: string) => kode.split('.').length;
const indukDari = (kode: string) => {
  const bagian = kode.split('.');
  return bagian.length > 1 ? bagian.slice(0, -1).join('.') : null;
};

async function main() {
  if (!fs.existsSync(BERKAS)) {
    console.log('  · berkas wilayah tidak ditemukan, dilewati');
    return;
  }

  const isi = zlib.gunzipSync(fs.readFileSync(BERKAS)).toString('utf8');
  const baris = isi.split('\n').filter(Boolean);

  const ada = await prisma.region.count();
  if (ada >= baris.length) {
    console.log(`  · wilayah: sudah ada ${ada} baris, dilewati`);
    return;
  }

  const data = baris.map((b) => {
    const pisah = b.indexOf(',');
    const code = b.slice(0, pisah);
    return { code, name: b.slice(pisah + 1), level: tingkat(code), parentCode: indukDari(code) };
  });

  // Induk harus lebih dulu ada sebelum anaknya; urutkan menurut tingkat.
  data.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));

  if (ada > 0) await prisma.region.deleteMany({});

  const POTONG = 5000;
  let masuk = 0;
  for (let i = 0; i < data.length; i += POTONG) {
    const r = await prisma.region.createMany({ data: data.slice(i, i + POTONG), skipDuplicates: true });
    masuk += r.count;
  }

  const per = data.reduce<Record<number, number>>((a, d) => ((a[d.level] = (a[d.level] || 0) + 1), a), {});
  console.log(
    `  · wilayah: ${masuk} baris dipasang — ${per[1]} provinsi, ${per[2]} kabupaten/kota, ` +
      `${per[3]} kecamatan, ${per[4]} desa/kelurahan`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
