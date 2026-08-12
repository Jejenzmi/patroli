/**
 * Memotret UI aplikasi lapangan (build web dari kode Flutter yang sama)
 * pada ukuran layar ponsel: splash → onboarding → masuk → beranda.
 */
const puppeteer = require('puppeteer');

const APP = 'http://127.0.0.1:8125';
const API = 'https://patroli.gokar.id';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Koordinat sentuh pada layar masuk (CSS px, viewport 412x892)
const LOGIN_USER_Y = Number(process.env.USER_Y || 430);
const LOGIN_PASS_Y = Number(process.env.PASS_Y || 530);
const LOGIN_BTN_Y = Number(process.env.BTN_Y || 620);

(async () => {
  const browser = await puppeteer.launch({
    // Preview dilayani dari origin lokal; pemeriksaan CORS dimatikan khusus uji.
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--user-data-dir=/tmp/pchrome'],
    defaultViewport: { width: 412, height: 892, deviceScaleFactor: 2, isMobile: true },
  });

  const errors = [];
  const shot = async (page, nama) => {
    await page.screenshot({ path: `/out/mobile-${nama}.png` });
    console.log(`  · tangkapan layar: ${nama}`);
  };

  // 1) Splash + onboarding (pemasangan baru)
  const p1 = await browser.newPage();
  p1.on('pageerror', (e) => errors.push('splash: ' + String(e).slice(0, 140)));
  await p1.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);
  await sleep(1200);
  await shot(p1, '1-splash');
  await sleep(2600);
  await shot(p1, '2-onboarding');

  // Geser ke halaman berikutnya
  await p1.mouse.move(330, 430);
  await p1.mouse.down();
  await p1.mouse.move(60, 430, { steps: 18 });
  await p1.mouse.up();
  await sleep(900);
  await shot(p1, '3-onboarding-2');

  // Lewati (kanan atas) → halaman masuk. Flutter web menggambar di kanvas,
  // jadi interaksi dilakukan lewat koordinat sentuh.
  await p1.mouse.click(369, 28);
  await sleep(1400);
  await shot(p1, '4-login');

  // 2) Masuk sungguhan lewat formulir, seperti anggota di lapangan.
  const p2 = p1;
  await p2.mouse.click(206, LOGIN_USER_Y);
  await sleep(500);
  await p2.keyboard.type('guard1', { delay: 40 });
  await sleep(300);
  await p2.mouse.click(206, LOGIN_PASS_Y);
  await sleep(500);
  await p2.keyboard.type('guard123', { delay: 40 });
  await sleep(300);
  await shot(p2, '4b-login-terisi');
  await p2.mouse.click(206, LOGIN_BTN_Y);
  await sleep(6000);
  await shot(p2, '5-beranda');

  const teks = await p2.evaluate(() => document.body.innerText);
  const masuk = /Selamat|Presensi|Beranda/i.test(teks);
  console.log(masuk ? '✓ beranda termuat' : '· sesi tidak terbawa, layar masuk yang tampil');

  if (masuk) {
    // Ketuk tab Layanan (posisi kira-kira di bilah bawah)
    const h = 892;
    await p2.mouse.click(250, h - 30);
    await sleep(1500);
    await shot(p2, '6-layanan');
    await p2.mouse.click(60, h - 30);
    await sleep(1200);
    // Buka dialog presensi untuk memeriksa tampilannya
    await p2.evaluate(() => window.scrollTo(0, 0));
    await sleep(400);
  }

  console.log(errors.length ? `✗ galat: ${errors.slice(0, 3).join(' | ')}` : '✓ tidak ada galat runtime');
  await browser.close();
})();
