# Panduan Penggunaan — sumber dokumen

Menghasilkan `Panduan-Penggunaan-DHARMAPATI.pdf` (A4, bernomor halaman) dari sistem yang berjalan.

| Berkas | Isi |
|---|---|
| `shots.js` | Mengambil tangkapan layar web (1440×900) dan aplikasi lapangan (412×892) langsung dari sistem live |
| `optim.py` | Mengecilkan tangkapan layar menjadi JPEG (14 MB → 3,9 MB) agar PDF ringan |
| `build.js` | Menyusun `panduan.html` — isi panduan ditulis di dalam berkas ini |
| `render.js` | Mencetak HTML menjadi PDF beserta nomor halaman |
| `style.css` | Gaya cetak A4 |

## Membangun ulang

```bash
# 1. Siapkan preview aplikasi lapangan (untuk tangkapan layar mobile)
cd apps/mobile && flutter build web --release --web-renderer html \
  --dart-define=API_BASE=https://dashboard.dharmapati.co.id
docker run -d --name patroli-webpreview -p 127.0.0.1:8125:80 \
  -v $PWD/build/web:/usr/share/nginx/html:ro nginx:alpine

# 2. Ambil tangkapan layar, kecilkan, lalu cetak PDF
cd docs/panduan
docker run --rm -v $PWD:/app -v $PWD/img:/img -w /home/pptruser \
  -e NODE_PATH=/home/pptruser/node_modules --network host \
  ghcr.io/puppeteer/puppeteer:23.10.4 node /app/shots.js
python3 optim.py
docker run --rm -v $PWD:/app -v $PWD/out:/out -w /app \
  -e NODE_PATH=/home/pptruser/node_modules \
  ghcr.io/puppeteer/puppeteer:23.10.4 bash -lc "node build.js && node render.js"
```

Hasil disalin ke `/var/www/patroli/` agar tersaji di
`https://dashboard.dharmapati.co.id/Panduan-Penggunaan-DHARMAPATI.pdf`.
