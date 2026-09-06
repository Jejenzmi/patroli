/**
 * Membuktikan aplikasi tetap bekerja tanpa jaringan.
 *
 * Jaringan diputus sungguhan lewat CDP (Network.emulateNetworkConditions),
 * lalu tindakan lapangan dilakukan seperti biasa. Yang diperiksa: pekerjaan
 * tetap tercatat di layar, antrean terisi, dan begitu jaringan pulih seluruh
 * catatan terkirim sendiri tanpa disuruh.
 */
const puppeteer = require("puppeteer");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = "https://dashboard.dharmapati.co.id/api";

(async () => {
  const masuk = await (await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "guard1", password: "guard123", platform: "mobile" }),
  })).json();
  const tok = masuk.token;
  const siteId = masuk.user.homeSite.id;

  // Titik awal bersih: tutup presensi & patroli yang mungkin masih terbuka.
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${tok}` };
  const aktif = await (await fetch(`${API}/patrols/my/active`, { headers: H })).json();
  if (aktif?.id) await fetch(`${API}/patrols/${aktif.id}/finish`, { method: "POST", headers: H, body: "{}" });
  const att = await (await fetch(`${API}/schedules/attendance/current`, { headers: H })).json();
  if (att?.id) await fetch(`${API}/schedules/attendance/check-out`, { method: "POST", headers: H, body: JSON.stringify({ lat: -6.2, lng: 107.15 }) });

  const browser = await puppeteer.launch({
    args: ["--no-sandbox","--disable-dev-shm-usage","--disable-web-security","--user-data-dir=/tmp/pluring"],
    defaultViewport: { width: 412, height: 892, deviceScaleFactor: 2, isMobile: true },
  });
  const p = await browser.newPage();
  const cdp = await p.target().createCDPSession();
  await cdp.send("Network.enable");
  const putus = (offline) => cdp.send("Network.emulateNetworkConditions", {
    offline, latency: 0, downloadThroughput: offline ? 0 : -1, uploadThroughput: offline ? 0 : -1,
  });

  const cari = (kata) => p.evaluate((k) => {
    const h = document.querySelector("flt-glass-pane");
    if (!h?.shadowRoot) return null;
    for (const el of h.shadowRoot.querySelectorAll("flt-span")) {
      if ((el.textContent || "").trim() !== k) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 3 || r.y < 0 || r.y > window.innerHeight) continue;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, kata);
  const ketuk = async (k, jeda = 1800) => {
    const t = await cari(k);
    if (!t) { console.log(`  ! tidak menemukan "${k}"`); return false; }
    await p.mouse.click(t.x, t.y); await sleep(jeda); return true;
  };
  const teks = () => p.evaluate(() => document.querySelector("flt-glass-pane")?.shadowRoot?.textContent || "");
  const gulir = async (dy) => { await p.mouse.move(206, 500); await p.mouse.wheel({ deltaY: dy }); await sleep(800); };

  let pass = 0, fail = 0;
  const cek = (n, ok, x = "") => { ok ? (pass++, console.log(`✓ ${n}`)) : (fail++, console.log(`✗ ${n} ${x}`)); };

  // ── Masuk selagi daring ──
  await p.goto("http://127.0.0.1:8125", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(6500);
  await ketuk("Lewati");
  let k = await cari("PENGGUNA");
  if (k) { await p.mouse.click(k.x, k.y + 36); await sleep(300); await p.keyboard.type("guard1", { delay: 25 }); }
  k = await cari("SANDI");
  if (k) { await p.mouse.click(k.x, k.y + 36); await sleep(300); await p.keyboard.type("guard123", { delay: 25 }); }
  await ketuk("MASUK", 9000);
  cek("berhasil masuk", /Presensi|Beranda|Selamat/i.test(await teks()));

  // ── Putus jaringan ──
  await putus(true);
  // Keadaan luring dikenali dari permintaan yang benar-benar gagal — bukan
  // dari indikator sistem — jadi dipancing dengan membuka satu layar yang
  // memang memanggil server.
  await sleep(1200);
  await gulir(420);
  if (await ketuk("Tugas", 6000)) {
    await p.mouse.click(40, 35);   // kembali
    await sleep(2500);
  }
  await p.screenshot({ path: "/img/hp-luring-1.png" });
  const t1 = await teks();
  cek("bilah tanpa jaringan muncul", /Tanpa jaringan/i.test(t1), t1.slice(0, 120));

  // ── Presensi masuk saat luring ──
  await gulir(-1800);                   // kembali ke puncak beranda
  await ketuk("MASUK", 2500);           // tombol PRESENSI MASUK
  await ketuk("presensi", 2500);        // "Ya, presensi" pada dialog
  await sleep(6000);
  const t2 = await teks();
  cek("presensi luring diterima aplikasi", /tersimpan|menunggu|Tanpa jaringan/i.test(t2), t2.slice(0, 160));
  await p.screenshot({ path: "/img/hp-luring-2.png" });

  const antre1 = /(\d+)\s*catatan menunggu/i.exec(await teks());
  cek("catatan masuk antrean", antre1 && Number(antre1[1]) >= 1, antre1 && antre1[0]);

  // ── Sinyal darurat saat luring ──
  await gulir(-1800);
  await gulir(2400);
  await ketuk("Kebakaran", 1200);
  const tombol = await cari("TEKAN");
  if (tombol) {
    await p.mouse.move(tombol.x, tombol.y);
    await p.mouse.down(); await sleep(3000); await p.mouse.up();
    await sleep(7000);
  }
  const antre2 = /(\d+)\s*catatan menunggu/i.exec(await teks());
  cek("sinyal darurat ikut mengantre", antre2 && Number(antre2[1]) >= 2, antre2 && antre2[0]);
  await p.screenshot({ path: "/img/hp-luring-3.png" });

  // ── Jaringan pulih: antrean harus terkirim sendiri ──
  await putus(false);
  console.log("  · jaringan disambungkan kembali, menunggu pengiriman otomatis…");
  let kosong = false;
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    const t = await teks();
    if (!/catatan menunggu|Mengirim/i.test(t)) { kosong = true; break; }
  }
  cek("antrean terkirim sendiri tanpa disuruh", kosong, (await teks()).slice(0, 160));
  await p.screenshot({ path: "/img/hp-luring-4.png" });

  // ── Bukti di server ──
  const cur = await (await fetch(`${API}/schedules/attendance/current`, { headers: H })).json();
  cek("presensi luring sampai di server", !!cur?.id, JSON.stringify(cur).slice(0, 80));
  cek("waktu luring ikut tercatat", !!cur?.offlineAt, cur?.offlineAt);

  const panik = await (await fetch(`${API}/incidents/panic/list?limit=5`, {
    headers: { Authorization: `Bearer ${tok}` },
  })).json().catch(() => []);
  console.log(`  · sinyal darurat terakhir: ${Array.isArray(panik) ? panik.length : "?"}`);

  await browser.close();
  console.log(`\n═══ LULUS: ${pass}  GAGAL: ${fail} ═══`);
  process.exit(fail ? 1 : 0);
})();
