#!/bin/sh
set -e
echo "▸ Menyiapkan skema basis data…"
npx prisma db push --schema apps/backend/prisma/schema.prisma --skip-generate --accept-data-loss

# Seed berhenti sendiri bila tabel pengguna sudah terisi.
echo "▸ Memeriksa data awal…"
npx tsx apps/backend/prisma/seed.ts || echo "  (seed dilewati)"

echo "▸ Menjalankan API…"
exec node apps/backend/dist/server.js
