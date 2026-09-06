/**
 * Menyusun tangkapan layar mentah menjadi gambar halaman Google Play.
 *
 * Ukuran keluaran 1080×1920 — perbandingan 9:16 yang diterima seluruh format
 * ponsel di Play Console. Tangkapan aslinya diletakkan di atas latar bermerek
 * beserta satu kalimat keterangan, karena gambar polos tanpa penjelasan
 * membuat calon pengguna harus menebak sendiri apa yang sedang dilihatnya.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SUMBER = '/layar';
const OUT = '/out';

const LAYAR = [
  {
    berkas: 'layar-1-beranda.png',
    label: 'Presensi Jaga',
    judul: 'Presensi hanya diterima di dalam radius pos jaga',
  },
  {
    berkas: 'layar-3-patroli.png',
    label: 'Ronde Patroli',
    judul: 'Tiap titik diverifikasi lewat QR, NFC, atau koordinat GPS',
  },
  {
    berkas: 'layar-2-darurat.png',
    label: 'Keadaan Darurat',
    judul: 'Enam jenis kejadian, satu tombol tekan-tahan',
  },
  {
    berkas: 'layar-4-layanan.png',
    label: 'Satu Tempat',
    judul: 'Seluruh perangkat tugas anggota dalam satu daftar',
  },
  {
    berkas: 'layar-5-jadwal.png',
    label: 'Jadwal Jaga',
    judul: 'Roster, riwayat ronde, dan kehadiran Anda sendiri',
  },
];

const halaman = (l, dataUri) => `<!doctype html><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  html,body { width:1080px; height:1920px; overflow:hidden }
  body {
    background: radial-gradient(85% 60% at 50% 0%, #16295f 0%, #0a1440 45%, #050c28 100%);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color:#fff; position:relative;
  }
  .kisi {
    position:absolute; inset:0;
    background-image:
      linear-gradient(#ffffff0a 1px, transparent 1px),
      linear-gradient(90deg, #ffffff0a 1px, transparent 1px);
    background-size:60px 60px;
  }
  .isi { position:relative; height:100%; display:flex; flex-direction:column; align-items:center;
         padding:88px 90px 0 }
  .label {
    display:inline-flex; align-items:center; gap:12px;
    padding:10px 22px; border-radius:999px;
    border:1px solid #f5b30159; background:#f5b3011a;
    font-size:22px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; color:#fcd34d;
  }
  .label i { width:10px; height:10px; border-radius:50%; background:#f5b301;
             box-shadow:0 0 0 6px #f5b30126 }
  h2 { margin-top:26px; font-size:46px; line-height:1.2; font-weight:800; text-align:center;
       letter-spacing:-.015em; max-width:900px }
  .bingkai {
    margin-top:52px; width:720px; border-radius:34px; overflow:hidden;
    border:1px solid #ffffff26; box-shadow:0 34px 80px -18px #00000099;
  }
  .bingkai img { display:block; width:100%; height:auto }
</style>
<div class="kisi"></div>
<div class="isi">
  <div class="label"><i></i>${l.label}</div>
  <h2>${l.judul}</h2>
  <div class="bingkai"><img src="${dataUri}"></div>
</div>`;

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

  for (let i = 0; i < LAYAR.length; i++) {
    const l = LAYAR[i];
    const asal = path.join(SUMBER, l.berkas);
    if (!fs.existsSync(asal)) {
      console.log('  ! lewati, tidak ada:', l.berkas);
      continue;
    }
    const uri = 'data:image/png;base64,' + fs.readFileSync(asal).toString('base64');

    const p = await browser.newPage();
    await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await p.setContent(halaman(l, uri), { waitUntil: 'networkidle0' });
    await new Promise((s) => setTimeout(s, 300));

    const nama = `toko-${i + 1}-${l.berkas.replace(/^layar-\d-/, '').replace('.png', '')}.png`;
    await p.screenshot({ path: path.join(OUT, nama) });
    await p.close();
    console.log('  ✓', nama, '1080×1920');
  }

  await browser.close();
})();
