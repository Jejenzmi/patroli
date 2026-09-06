#!/bin/sh
set -e
echo "▸ Menyiapkan skema basis data…"
npx prisma db push --schema apps/backend/prisma/schema.prisma --skip-generate --accept-data-loss

# Seed berhenti sendiri bila tabel pengguna sudah terisi.
echo "▸ Memeriksa data awal…"
npx tsx apps/backend/prisma/seed.ts || echo "  (seed dilewati)"

# Modul keuangan: tabel TER, golongan upah, UMK, hari libur, kontrak awal.
# Idempoten — hanya mengisi yang masih kosong.
echo "▸ Menyiapkan data keuangan…"
npx tsx apps/backend/prisma/seed-keuangan.ts || echo "  (seed keuangan dilewati)"

echo "▸ Menjalankan API…"
exec node apps/backend/dist/server.js
