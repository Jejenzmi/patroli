#!/bin/sh
set -e
echo "▸ Menyiapkan skema basis data…"
npx prisma db push --schema apps/backend/prisma/schema.prisma --skip-generate --accept-data-loss

# Data awal produksi: satu akun administrator dan pengaturan dasar. Idempoten.
echo "▸ Memeriksa data awal…"
npx tsx apps/backend/prisma/seed-awal.ts || echo "  (seed awal dilewati)"

# Data contoh untuk peragaan hanya dipasang bila diminta lewat lingkungan.
if [ "$SEED_DEMO" = "true" ]; then
  echo "▸ Memasang data contoh peragaan…"
  npx tsx apps/backend/prisma/seed.ts || echo "  (seed contoh dilewati)"
fi

# Daftar wilayah administratif (Kepmendagri 2025) untuk pengisian alamat.
echo "▸ Menyiapkan daftar wilayah…"
npx tsx apps/backend/prisma/seed-wilayah.ts || echo "  (seed wilayah dilewati)"

# Modul keuangan: tabel TER, golongan upah, UMK, hari libur, kontrak awal.
# Idempoten — hanya mengisi yang masih kosong.
echo "▸ Menyiapkan data keuangan…"
npx tsx apps/backend/prisma/seed-keuangan.ts || echo "  (seed keuangan dilewati)"

# Akun dan data peragaan untuk peninjau Google Play. Dijalankan tiap layanan
# hidup supaya rosternya selalu mencakup hari berjalan — peninjauan bisa datang
# berminggu-minggu setelah unggahan, dan layar jadwal yang kosong membuat
# aplikasi tampak tidak berfungsi.
if [ "$SEED_PERAGAAN" != "false" ]; then
  echo "▸ Menyegarkan data peragaan…"
  npx tsx apps/backend/prisma/seed-peragaan.ts || echo "  (seed peragaan dilewati)"
fi

echo "▸ Menjalankan API…"
exec node apps/backend/dist/server.js
