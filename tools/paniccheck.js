/** Membuktikan tombol darurat hanya terkirim setelah ditahan penuh. */
const puppeteer = require("puppeteer");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({
    args: ["--no-sandbox","--disable-dev-shm-usage","--disable-web-security","--user-data-dir=/tmp/ppanic"],
    defaultViewport: { width: 412, height: 892, deviceScaleFactor: 2, isMobile: true },
  });
  const p = await b.newPage();
  const permintaan = [];
  p.on("request", (r) => { if (r.url().includes("/panic")) permintaan.push(r.url()); });

  const cari = (kata) => p.evaluate((k) => {
    const h = document.querySelector("flt-glass-pane");
    if (!h?.shadowRoot) return null;
    for (const el of h.shadowRoot.querySelectorAll("flt-span")) {
      if ((el.textContent || "").trim() !== k) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 3) continue;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, kata);

  const teks = () => p.evaluate(() => (document.querySelector("flt-glass-pane")?.shadowRoot?.textContent || ""));

  let pass = 0, fail = 0;
  const cek = (n, ok, x = "") => { ok ? (pass++, console.log(`✓ ${n}`)) : (fail++, console.log(`✗ ${n} ${x}`)); };

  await p.goto("http://127.0.0.1:8125", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(6500);
  let k = await cari("Lewati"); if (k) { await p.mouse.click(k.x, k.y); await sleep(1800); }
  k = await cari("PENGGUNA");
  if (k) { await p.mouse.click(k.x, k.y + 36); await sleep(400); await p.keyboard.type("guard1", { delay: 30 }); }
  k = await cari("SANDI");
  if (k) { await p.mouse.click(k.x, k.y + 36); await sleep(400); await p.keyboard.type("guard123", { delay: 30 }); }
  k = await cari("MASUK"); if (k) { await p.mouse.click(k.x, k.y); await sleep(9000); }

  // Gulir ke kartu darurat
  await p.mouse.move(206, 500);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel({ deltaY: 400 }); await sleep(350); }
  cek("kartu darurat menyebut tekan & tahan", /TEKAN & TAHAN/i.test(await teks()), (await teks()).slice(-160));
  await p.screenshot({ path: "/img/hp-darurat.png" });

  const tombol = await cari("TEKAN");
  if (!tombol) { console.log("✗ tombol tidak ditemukan"); await b.close(); process.exit(1); }

  // 1) Lepas sebelum penuh — tidak boleh mengirim apa pun
  await p.mouse.move(tombol.x, tombol.y);
  await p.mouse.down();
  await sleep(900);
  const saatMenahan = await teks();
  cek("hitungan mundur muncul saat ditahan", /TAHAN TERUS/i.test(saatMenahan), saatMenahan.slice(-120));
  await p.screenshot({ path: "/img/hp-darurat-menahan.png" });
  await p.mouse.up();
  await sleep(1500);
  cek("dilepas sebelum penuh tidak mengirim sinyal", permintaan.length === 0, JSON.stringify(permintaan));

  // 2) Tahan penuh — harus mengirim
  await p.mouse.down();
  await sleep(2800);
  // Setelah bilah penuh, aplikasi menunggu penguncian GPS (batas 5 detik)
  // sebelum mengirim, jadi pemeriksaan diberi tenggang yang cukup.
  const terkirimTampil = /SINYAL TERKIRIM/i.test(await teks());
  await p.mouse.up();
  for (let i = 0; i < 12 && permintaan.length === 0; i++) await sleep(1000);
  cek("ditahan penuh mengirim sinyal", permintaan.length >= 1, JSON.stringify(permintaan));
  cek("umpan balik terkirim tampil saat bilah penuh", terkirimTampil);

  await b.close();
  console.log(`\n═══ LULUS: ${pass}  GAGAL: ${fail} ═══`);
  process.exit(fail ? 1 : 0);
})();
