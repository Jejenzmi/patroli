/**
 * Mengambil tangkapan layar untuk Panduan Penggunaan PATROLI:
 * halaman web (1440x900) dan layar aplikasi lapangan (412x892).
 */
const puppeteer = require('puppeteer');

const WEB = 'https://patroli.gokar.id';
const APP = 'http://127.0.0.1:8125';
const OUT = '/img';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tokenOf(username, password) {
  const r = await fetch(`${WEB}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return (await r.json()).token;
}

(async () => {
  const admin = await tokenOf('admin', 'admin123');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--user-data-dir=/tmp/pshots'],
  });

  /* ─────────── Halaman web ─────────── */
  const web = await browser.newPage();
  await web.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await web.evaluateOnNewDocument((t) => localStorage.setItem('patroli_token', t), admin);

  const ambil = async (path, nama, { penuh = false, tunggu = 2600 } = {}) => {
    await web.goto(`${WEB}${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(tunggu);
    await web.screenshot({ path: `${OUT}/web-${nama}.png`, fullPage: penuh });
    console.log(`  · web-${nama}`);
  };

  // Halaman masuk (tanpa sesi)
  const ctx = await browser.createBrowserContext();
  const masuk = await ctx.newPage();
  await masuk.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
  await masuk.goto(`${WEB}/masuk`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await masuk.screenshot({ path: `${OUT}/web-masuk.png` });
  console.log('  · web-masuk');
  await masuk.close();

  await ambil('/', 'dasbor');
  await ambil('/peta', 'peta', { tunggu: 4200 });
  await ambil('/patroli', 'patroli');
  await ambil('/insiden', 'insiden');
  await ambil('/darurat', 'darurat');
  await ambil('/jadwal', 'jadwal');
  await ambil('/presensi', 'presensi');
  await ambil('/personel', 'personel');
  await ambil('/tamu', 'tamu');
  await ambil('/kendaraan', 'kendaraan');
  await ambil('/inventaris', 'inventaris');
  await ambil('/site', 'site');
  await ambil('/titik', 'titik');
  await ambil('/laporan', 'laporan');
  await ambil('/serah-terima', 'serah-terima');
  await ambil('/pengumuman', 'pengumuman');
  await ambil('/jejak-audit', 'audit');
  await ambil('/profil', 'profil');

  // Rincian sesi patroli
  const sesi = await (await fetch(`${WEB}/api/patrols?limit=1&status=COMPLETED`, {
    headers: { Authorization: `Bearer ${admin}` },
  })).json();
  if (sesi[0]) await ambil(`/patroli/${sesi[0].id}`, 'patroli-detail', { tunggu: 3800 });

  // Rincian insiden
  const inc = await (await fetch(`${WEB}/api/incidents?pageSize=1`, {
    headers: { Authorization: `Bearer ${admin}` },
  })).json();
  if (inc.data?.[0]) await ambil(`/insiden/${inc.data[0].id}`, 'insiden-detail', { tunggu: 3200 });

  // Dialog konfirmasi simpan (pada formulir klien)
  await web.goto(`${WEB}/klien`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await web.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => /tambah klien/i.test(b.innerText))?.click();
  });
  await sleep(900);
  await web.screenshot({ path: `${OUT}/web-form-klien.png` });
  console.log('  · web-form-klien');

  // Dialog keluar
  await web.goto(`${WEB}/`, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await web.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.title === 'Keluar')?.click();
  });
  await sleep(1000);
  await web.screenshot({ path: `${OUT}/web-dialog-keluar.png` });
  console.log('  · web-dialog-keluar');
  await web.keyboard.press('Escape');

  // Kartu QR titik patroli
  await web.goto(`${WEB}/titik`, { waitUntil: 'networkidle2' });
  await sleep(2600);
  await web.evaluate(() => {
    const baris = document.querySelector('tbody tr');
    baris?.querySelectorAll('button')[0]?.click();
  });
  await sleep(1400);
  await web.screenshot({ path: `${OUT}/web-qr.png` });
  console.log('  · web-qr');
  await web.close();

  /* ─────────── Layar aplikasi lapangan ─────────── */
  const hp = await browser.newPage();
  await hp.setViewport({ width: 412, height: 892, deviceScaleFactor: 2, isMobile: true });
  const potret = async (nama) => {
    await hp.screenshot({ path: `${OUT}/hp-${nama}.png` });
    console.log(`  · hp-${nama}`);
  };

  await hp.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1500);
  await potret('splash');
  await sleep(2500);
  await potret('onboarding');
  await hp.mouse.click(206, 620); // Lanjut
  await sleep(1200);
  await potret('onboarding2');
  await hp.mouse.click(369, 28); // Lewati
  await sleep(1600);
  await potret('masuk');

  await hp.mouse.click(206, 303);
  await sleep(400);
  await hp.keyboard.type('guard1', { delay: 35 });
  await hp.mouse.click(206, 392);
  await sleep(400);
  await hp.keyboard.type('guard123', { delay: 35 });
  await hp.mouse.click(206, 460);
  await sleep(7000);
  await potret('beranda');

  // Dialog presensi
  await hp.mouse.click(206, 341);
  await sleep(1800);
  await potret('dialog-presensi');
  await hp.mouse.click(121, 603); // Batal
  await sleep(1600);

  const nav = 850;
  await hp.mouse.click(101, nav); await sleep(3000); await potret('patroli');
  await hp.mouse.click(243, nav); await sleep(3000); await potret('layanan');
  await hp.mouse.click(310, nav); await sleep(3000); await potret('insiden');
  await hp.mouse.click(378, nav); await sleep(3200); await potret('profil');

  // Buku tamu lewat pintasan beranda
  await hp.mouse.click(34, nav); await sleep(2500);
  await hp.mouse.click(70, 466); await sleep(3000); await potret('buku-tamu');
  await hp.mouse.click(206, 820); await sleep(2200); await potret('form-tamu');

  console.log('selesai');
  await browser.close();
})();
