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
  await ambil('/tugas', 'tugas');
  await ambil('/kpi', 'kpi', { tunggu: 4200 });
  await ambil('/lantai', 'lantai', { tunggu: 3600 });
  await ambil('/cuti', 'cuti');
  await ambil('/laporan', 'laporan');
  await ambil('/serah-terima', 'serah-terima');
  await ambil('/pengumuman', 'pengumuman');
  await ambil('/jejak-audit', 'audit');
  await ambil('/profil', 'profil');

  // Darurat & Sirene: tiga tab
  for (const [nama, teksTab] of [['divisi', null], ['perutean', 'Perutean'], ['sirene', 'Sirene Tiang']]) {
    await web.goto(`${WEB}/sirene`, { waitUntil: 'networkidle2' });
    await sleep(2600);
    if (teksTab) {
      await web.evaluate((x) => {
        [...document.querySelectorAll('button')].find((b) => b.innerText.includes(x))?.click();
      }, teksTab);
      await sleep(1600);
    }
    await web.screenshot({ path: `${OUT}/web-sirene-${nama}.png` });
    console.log(`  · web-sirene-${nama}`);
  }

  // Integritas & Perangkat: dua tab
  for (const [nama, teksTab] of [['integritas', null], ['integritas-perangkat', 'Perangkat Terikat']]) {
    await web.goto(`${WEB}/integritas`, { waitUntil: 'networkidle2' });
    await sleep(2600);
    if (teksTab) {
      await web.evaluate((x) => {
        [...document.querySelectorAll('button')].find((b) => b.innerText.includes(x))?.click();
      }, teksTab);
      await sleep(1600);
    }
    await web.screenshot({ path: `${OUT}/web-${nama}.png` });
    console.log(`  · web-${nama}`);
  }

  // Denah lantai pada Peta Situasi
  await web.goto(`${WEB}/peta`, { waitUntil: 'networkidle2' });
  await sleep(3600);
  await web.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => /denah lantai/i.test(b.innerText))?.click();
  });
  await sleep(3000);
  await web.screenshot({ path: `${OUT}/web-denah-lantai.png` });
  console.log('  · web-denah-lantai');

  // Tab percobaan presensi yang ditolak
  await web.goto(`${WEB}/presensi`, { waitUntil: 'networkidle2' });
  await sleep(2600);
  await web.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => /percobaan ditolak/i.test(b.innerText))?.click();
  });
  await sleep(1800);
  await web.screenshot({ path: `${OUT}/web-presensi-ditolak.png` });
  console.log('  · web-presensi-ditolak');

  // Formulir pendaftaran wajah pada halaman personel
  await web.goto(`${WEB}/personel`, { waitUntil: 'networkidle2' });
  await sleep(2600);
  await web.evaluate(() => {
    const baris = document.querySelector('tbody tr');
    [...(baris?.querySelectorAll('button') || [])]
      .find((b) => /daftarkan wajah/i.test(b.title || ''))?.click();
  });
  await sleep(1400);
  await web.screenshot({ path: `${OUT}/web-daftar-wajah.png` });
  console.log('  · web-daftar-wajah');
  await web.keyboard.press('Escape');
  await sleep(600);

  // Formulir penilaian kinerja
  await web.goto(`${WEB}/kpi`, { waitUntil: 'networkidle2' });
  await sleep(4000);
  await web.evaluate(() => {
    for (const r of document.querySelectorAll('tbody tr')) {
      const b = [...r.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'nilai');
      if (b) { b.click(); return; }
    }
  });
  await sleep(1400);
  await web.screenshot({ path: `${OUT}/web-form-nilai.png` });
  console.log('  · web-form-nilai');
  await web.keyboard.press('Escape');
  await sleep(600);

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

  // Akun peragaan dipakai dari peramban yang selalu baru, sehingga penanda
  // perangkatnya berbeda setiap kali. Ikatan sebelumnya dilepaskan lebih dulu
  // agar aturan 'satu akun satu ponsel' tidak menahan pengambilan gambar.
  try {
    const daftar = await (await fetch(`${WEB}/api/users/devices/list`, {
      headers: { Authorization: `Bearer ${admin}` },
    })).json();
    for (const d of daftar) {
      if (d.user?.username === 'guard1' || d.user?.employeeId === 'SEC-001') {
        await fetch(`${WEB}/api/users/devices/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${admin}` },
        });
      }
    }
  } catch (e) {
    console.log('  ! gagal melepaskan ikatan perangkat:', e.message);
  }

  const hp = await browser.newPage();
  await hp.setViewport({ width: 412, height: 892, deviceScaleFactor: 2, isMobile: true });

  // Flutter web menggambar di dalam shadow DOM dan memecah teks per kata,
  // jadi elemen dicari lewat flt-span lalu ditekan di titik tengahnya.
  const cari = (kata) => hp.evaluate((k) => {
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

  const ketuk = async (kata, jeda = 1800) => {
    const k = await cari(kata);
    if (!k) { console.log(`  ! tidak menemukan "${kata}"`); return false; }
    await hp.mouse.click(k.x, k.y);
    await sleep(jeda);
    return true;
  };

  const gulir = async (dy) => {
    await hp.mouse.move(206, 500);
    await hp.mouse.wheel({ deltaY: dy });
    await sleep(900);
  };

  const potret = async (nama) => {
    await hp.screenshot({ path: `${OUT}/hp-${nama}.png` });
    console.log(`  · hp-${nama}`);
  };

  const kembali = async () => { await gulir(-1800); await hp.mouse.click(40, 35); await sleep(1800); };
  const keBeranda = async () => { await hp.mouse.click(41, 850); await sleep(2000); await gulir(-1800); };

  await hp.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3200);
  await potret('splash');
  await sleep(3200);
  await potret('onboarding');
  await ketuk('LANJUT');
  await potret('onboarding2');
  await ketuk('Lewati');
  await potret('masuk');

  const kolomUser = await cari('PENGGUNA');
  if (kolomUser) {
    await hp.mouse.click(kolomUser.x, kolomUser.y + 36);
    await sleep(400);
    await hp.keyboard.type('guard1', { delay: 35 });
  }
  const kolomSandi = await cari('SANDI');
  if (kolomSandi) {
    await hp.mouse.click(kolomSandi.x, kolomSandi.y + 36);
    await sleep(400);
    await hp.keyboard.type('guard123', { delay: 35 });
  }
  await ketuk('MASUK', 9000);
  await potret('beranda');

  // Dialog konfirmasi presensi — kata 'MASUK' hanya ada pada tombolnya,
  // sedangkan 'PRESENSI' juga dipakai judul kartu.
  if (await ketuk('MASUK', 2400)) {
    await potret('dialog-presensi');
    await ketuk('Batal', 1800);
  }

  // Kisi pintasan lengkap, termasuk modul BRD di baris ketiga
  await gulir(420);
  await potret('pintasan');
  await potret('beranda-bawah');

  // Buku tamu lewat pintasan beranda
  if (await ketuk('Buku', 3200)) {
    await potret('buku-tamu');
    if (await ketuk('TAMU', 2400)) await potret('form-tamu');
    await hp.keyboard.press('Escape');
    await sleep(1000);
    await kembali();
  }

  // Tugas & instruksi
  if (await ketuk('Tugas', 3600)) {
    await potret('tugas');
    if (await ketuk('Instruksi', 2400)) await potret('instruksi');
    await kembali();
  }

  // Nilai kinerja pribadi
  await keBeranda(); await gulir(420);
  if (await ketuk('Nilai', 5000)) {
    await potret('kpi');
    await gulir(500);
    await potret('kpi-rincian');
    await kembali();
  }

  // Semua layanan → cuti, izin, lembur
  await keBeranda(); await gulir(420);
  if (await ketuk('Semua', 3000)) {
    await potret('layanan');
    await gulir(600);
    if (await ketuk('Cuti', 3600)) {
      await potret('cuti');
      if (await ketuk('AJUKAN', 2400)) await potret('cuti-form');
      await hp.keyboard.press('Escape');
      await sleep(1200);
      await kembali();
    }
    await kembali();
  }

  // Mode tanpa sinyal: bilah keadaan dan daftar antrean.
  // Jaringan diputus sungguhan lewat CDP, lalu satu layar yang memanggil
  // server dibuka agar aplikasi menyadarinya.
  const cdp = await hp.target().createCDPSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  await keBeranda();
  await gulir(700);
  // Membuka satu layar yang memanggil server agar aplikasi menyadari
  // jaringannya mati. Dicoba dua pintasan supaya tidak bergantung pada
  // posisi gulir yang persis.
  if ((await ketuk('Instruksi', 6000)) || (await ketuk('Kendaraan', 6000))) {
    await hp.mouse.click(40, 62);
    await sleep(2500);
  }
  await keBeranda();
  await potret('luring');
  // Membuka rincian antrean lewat bilah di paling atas layar.
  await hp.mouse.click(206, 30);
  await sleep(1800);
  await potret('luring-antrean');
  await hp.keyboard.press('Escape');
  await sleep(1200);
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  await sleep(4000);

  // Kartu tombol darurat tekan-tahan
  await keBeranda();
  for (let i = 0; i < 6; i++) { await gulir(400); }
  await potret('darurat');

  // Tab patroli, insiden, dan profil
  await keBeranda();
  await hp.mouse.click(101, 850); await sleep(3200); await potret('patroli');
  await hp.mouse.click(310, 850); await sleep(3000); await potret('insiden');
  await hp.mouse.click(378, 850); await sleep(3200); await potret('profil');

  console.log('selesai');
  await browser.close();
})();
