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

# Modul keuangan: tabel TER, golongan upah, UMK, hari libur, kontrak awal.
# Idempoten — hanya mengisi yang masih kosong.
echo "▸ Menyiapkan data keuangan…"
npx tsx apps/backend/prisma/seed-keuangan.ts || echo "  (seed keuangan dilewati)"

echo "▸ Menjalankan API…"
exec node apps/backend/dist/server.js
