/**
 * Mengambil tangkapan layar aplikasi DHARMAPATI untuk halaman Google Play.
 *
 * Dijalankan terhadap aplikasi versi web yang disajikan di jaringan lokal,
 * memakai akun peragaan yang sama dengan yang dilampirkan ke peninjau Play —
 * jadi yang terlihat di halaman toko benar-benar tampilan aplikasi, bukan
 * gambar rekaan.
 *
 * Flutter web menggambar di dalam shadow DOM `flt-glass-pane` dan memecah teks
 * menjadi satu `flt-span` per kata, sehingga tombol dicari lewat kata tunggal
 * lalu ditekan di titik tengah kotaknya.
 */

const puppeteer = require('puppeteer');

const APP = process.env.APP || 'http://127.0.0.1:8125';
const API = process.env.API || 'https://dashboard.dharmapati.co.id';
const OUT = '/out';
const AKUN = { username: 'demo.playstore', password: 'DemoPlay2026' };

const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
  });

  const hp = await browser.newPage();
  await hp.setViewport({ width: 412, height: 892, deviceScaleFactor: 2, isMobile: true });
  hp.on('console', (m) => {
    const t = m.text();
    if (t.includes('Error') || t.includes('error')) console.log('    [app]', t.slice(0, 120));
  });

  const cari = (kata) =>
    hp.evaluate((k) => {
      const host = document.querySelector('flt-glass-pane');
      if (!host || !host.shadowRoot) return null;
      for (const el of host.shadowRoot.querySelectorAll('flt-span')) {
        if ((el.textContent || '').trim() !== k) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) continue;
        if (r.y < 0 || r.y > window.innerHeight) continue;
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    }, kata);

  const ketuk = async (kata, tunggu = 2000) => {
    const k = await cari(kata);
    if (!k) {
      console.log(`  ! "${kata}" tidak ditemukan`);
      return false;
    }
    await hp.mouse.click(k.x, k.y);
    await jeda(tunggu);
    return true;
  };

  const isi = async (label, nilai) => {
    const k = await cari(label);
    if (!k) return false;
    await hp.mouse.click(k.x, k.y + 36);
    await jeda(300);
    await hp.keyboard.type(nilai, { delay: 28 });
    return true;
  };

  const gulir = async (dy) => {
    await hp.mouse.move(206, 500);
    await hp.mouse.wheel({ deltaY: dy });
    await jeda(800);
  };

  const potret = async (nama) => {
    await hp.screenshot({ path: `${OUT}/layar-${nama}.png` });
    console.log('  ✓', nama);
  };

  const keBeranda = async () => {
    await hp.mouse.click(41, 850);
    await jeda(2000);
    await gulir(-2500);
  };

  console.log('▸ Membuka aplikasi…');
  await hp.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await jeda(4000);

  for (let i = 0; i < 5; i++) if (!(await ketuk('LANJUT', 900))) break;
  await ketuk('MULAI', 1500);
  await jeda(1500);

  console.log('▸ Masuk sebagai akun peragaan…');
  await isi('PENGGUNA', AKUN.username);
  await isi('SANDI', AKUN.password);
  await jeda(400);
  await ketuk('MASUK', 5000);

  // 1. Beranda — keadaan siap presensi masuk.
  await gulir(-2500);
  await potret('1-beranda');

  // 2. Tombol darurat ada di bagian bawah beranda.
  await gulir(3100);
  await potret('2-darurat');
  await gulir(-2500);

  // 3. Ronde patroli lewat tab bawah.
  await hp.mouse.click(140, 850);
  await jeda(2600);
  await potret('3-patroli');

  // 4. Kembali ke beranda, lalu buka daftar layanan lengkap.
  await hp.mouse.click(41, 850);
  await jeda(2200);
  await gulir(-2500);
  if (await ketuk('Semua', 2400)) await potret('4-layanan');

  // 5. Jadwal & presensi dari daftar layanan.
  if (await ketuk('Jadwal', 2600)) {
    await potret('5-jadwal');
    await hp.mouse.click(40, 35);
    await jeda(1800);
  }

  // 6. Buku tamu — administrasi pos jaga.
  if (await ketuk('Buku', 2600)) await potret('6-buku-tamu');

  await browser.close();
  console.log('▸ Selesai.');
})();
