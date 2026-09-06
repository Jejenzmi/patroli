/** Memastikan penampil denah lantai pada Peta Situasi benar-benar tergambar. */
const puppeteer = require("puppeteer");
const BASE = "https://dashboard.dharmapati.co.id";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const token = (await (await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  })).json()).token;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.evaluateOnNewDocument((t) => localStorage.setItem("patroli_token", t), token);

  let pass = 0, fail = 0;
  const cek = (n, ok, x = "") => { ok ? (pass++, console.log(`✓ ${n}`)) : (fail++, console.log(`✗ ${n} ${x}`)); };

  await page.goto(`${BASE}/peta`, { waitUntil: "networkidle2" });
  await sleep(3500);

  const adaJejak = await page.evaluate(() => document.querySelectorAll("path.leaflet-interactive").length);
  cek("peta menggambar lingkaran radius / jejak", adaJejak > 0, `${adaJejak} path`);
  const adaTitik = await page.evaluate(() => document.querySelectorAll(".leaflet-marker-icon").length);
  cek("penanda titik QR & anggota tergambar", adaTitik > 0, `${adaTitik} penanda`);

  const ditekan = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /denah lantai/i.test(x.innerText));
    if (!b) return false;
    b.click();
    return true;
  });
  cek("tombol Denah lantai tersedia", ditekan);
  await sleep(3000);
  await page.screenshot({ path: "/out/denah-lantai.png" });

  // Legenda berada di bawah gambar denah, jadi digulir dulu.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(700);

  const isi = await page.evaluate(() => {
    const img = [...document.querySelectorAll("img")].filter((i) => i.naturalWidth > 200);
    return {
      teks: document.body.innerText,
      gambarDenah: img.length,
      penandaTitik: document.querySelectorAll("div.h-3.w-3.rounded-full").length,
    };
  });
  cek("pemilih lantai tampil", /lantai/i.test(isi.teks), isi.teks.slice(0, 80));
  cek("gambar denah termuat", isi.gambarDenah > 0, `${isi.gambarDenah} gambar`);
  cek("titik QR tergambar di atas denah", isi.penandaTitik > 0, `${isi.penandaTitik} titik`);
  cek("legenda denah tampil", /Titik QR/i.test(isi.teks), isi.teks.slice(0, 120));
  cek("tidak ada galat halaman", errors.length === 0, errors.join(" | "));

  await browser.close();
  console.log(`\n═══ LULUS: ${pass}  GAGAL: ${fail} ═══`);
  process.exit(fail ? 1 : 0);
})();
