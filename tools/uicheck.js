/**
 * Memeriksa setiap halaman pusat komando dengan browser sungguhan:
 * mencatat galat konsol/permintaan gagal dan memastikan konten benar-benar tampil.
 */
const puppeteer = require('puppeteer');

const BASE = 'https://patroli.gokar.id';
const ROUTES = [
  ['/', 'Pusat Komando'],
  ['/peta', 'Peta Situasi'],
  ['/patroli', 'Sesi Patroli'],
  ['/insiden', 'Manajemen Insiden'],
  ['/darurat', 'Sinyal Darurat'],
  ['/jadwal', 'Jadwal Jaga'],
  ['/presensi', 'Presensi Anggota'],
  ['/personel', 'Data Personel'],
  ['/serah-terima', 'Serah Terima Shift'],
  ['/tamu', 'Buku Tamu'],
  ['/kendaraan', 'Lalu Lintas Kendaraan'],
  ['/inventaris', 'Inventaris Peralatan'],
  ['/klien', 'Klien'],
  ['/site', 'Site & Lokasi'],
  ['/titik', 'Titik, Rute & Shift'],
  ['/pengumuman', 'Pengumuman'],
  ['/tugas', 'Tugas & Instruksi'],
  ['/kpi', 'Penilaian Kinerja'],
  ['/lantai', 'Lantai, Denah & Regu'],
  ['/cuti', 'Cuti, Izin & Lembur'],
  ['/sirene', 'Darurat & Sirene'],
  ['/laporan', 'Laporan & Ekspor'],
  ['/jejak-audit', 'Jejak Audit'],
  ['/profil', 'Profil Saya'],
];

(async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const { token } = await res.json();
  if (!token) throw new Error('gagal login');

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 900 },
  });

  let fail = 0;
  let pass = 0;

  const PERAN = process.env.PERAN || "SUPER_ADMIN";
  const KHUSUS_KOMANDO = ["/titik", "/klien", "/jejak-audit", "/darurat", "/lantai", "/sirene"];
  const daftar = PERAN === "CLIENT" ? ROUTES.filter((r) => !KHUSUS_KOMANDO.includes(r[0])) : ROUTES;

  for (const [route, expect] of daftar) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
    page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url().slice(0, 120)));

    await page.evaluateOnNewDocument((t) => localStorage.setItem('patroli_token', t), token);
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));

    const text = await page.evaluate(() => document.body.innerText);
    const found = text.toLowerCase().includes(expect.toLowerCase());
    // Galat pemuatan ubin peta OSM tidak dihitung sebagai kegagalan aplikasi.
    const real = errors.filter((e) => !/tile\.openstreetmap|favicon|fonts\.g/.test(e));

    if (found && real.length === 0) {
      pass++;
      console.log(`✓ ${route.padEnd(16)} ${expect}`);
    } else {
      fail++;
      console.log(`✗ ${route.padEnd(16)} ${expect}`);
      if (!found) console.log(`    judul tidak ditemukan; cuplikan: ${text.slice(0, 160).replace(/\n/g, ' | ')}`);
      real.slice(0, 4).forEach((e) => console.log(`    ${e}`));
    }
    await page.close();
  }

  // Uji satu halaman rincian yang datanya dinamis.
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.evaluateOnNewDocument((t) => localStorage.setItem('patroli_token', t), token);
  const list = await (await fetch(`${BASE}/api/patrols?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  if (list[0]) {
    await page.goto(`${BASE}/patroli/${list[0].id}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));
    const txt = await page.evaluate(() => document.body.innerText);
    if (txt.toLowerCase().includes('kepatuhan') && errs.length === 0) {
      pass++;
      console.log('✓ /patroli/:id     Rincian sesi patroli');
    } else {
      fail++;
      console.log('✗ /patroli/:id', errs.slice(0, 3));
    }
  }

  const inc = await (await fetch(`${BASE}/api/incidents?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  if (inc.data?.[0]) {
    const p2 = await browser.newPage();
    const e2 = [];
    p2.on('pageerror', (e) => e2.push(String(e).slice(0, 200)));
    await p2.evaluateOnNewDocument((t) => localStorage.setItem('patroli_token', t), token);
    await p2.goto(`${BASE}/insiden/${inc.data[0].id}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2500));
    const txt = await p2.evaluate(() => document.body.innerText);
    if (txt.toLowerCase().includes('uraian kejadian') && e2.length === 0) {
      pass++;
      console.log('✓ /insiden/:id     Rincian insiden');
    } else {
      fail++;
      console.log('✗ /insiden/:id', e2.slice(0, 3));
    }
  }

  // Halaman masuk (tanpa token)
  const ctx = await browser.createBrowserContext();
  const p3 = await ctx.newPage();
  const e3 = [];
  p3.on('pageerror', (e) => e3.push(String(e).slice(0, 200)));
  await p3.goto(`${BASE}/masuk`, { waitUntil: 'networkidle2', timeout: 45000 });
  const t3 = await p3.evaluate(() => document.body.innerText);
  if (t3.toLowerCase().includes('masuk ke pusat komando') && e3.length === 0) {
    pass++;
    console.log('✓ /masuk           Halaman masuk');
  } else {
    fail++;
    console.log('✗ /masuk', e3.slice(0, 3), t3.slice(0, 120).replace(/\n/g, ' | '));
  }
  await p3.screenshot({ path: '/out/login.png' });

  // Tangkapan layar dasbor untuk pemeriksaan visual
  const p4 = await browser.newPage();
  await p4.evaluateOnNewDocument((t) => localStorage.setItem('patroli_token', t), token);
  await p4.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 4000));
  await p4.screenshot({ path: '/out/dashboard.png', fullPage: true });
  await p4.goto(`${BASE}/peta`, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 4000));
  await p4.screenshot({ path: '/out/peta.png' });

  await browser.close();
  console.log(`\n═══ LULUS: ${pass}  GAGAL: ${fail} ═══`);
  process.exit(fail > 0 ? 1 : 0);
})();
