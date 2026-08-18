/** Memotret ulang dua layar mode tanpa sinyal untuk panduan. */
const puppeteer = require("puppeteer");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = "https://patroli.gokar.id/api";

(async () => {
  const adm = (await (await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123", platform: "web" }),
  })).json()).token;
  const daftar = await (await fetch(`${API}/users/devices/list`, { headers: { Authorization: `Bearer ${adm}` } })).json();
  for (const d of daftar) {
    if (d.user?.username === "guard1") {
      await fetch(`${API}/users/devices/${d.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${adm}` } });
    }
  }

  const b = await puppeteer.launch({
    args: ["--no-sandbox","--disable-dev-shm-usage","--disable-web-security","--user-data-dir=/tmp/plshot"],
    defaultViewport: { width: 412, height: 892, deviceScaleFactor: 2, isMobile: true },
  });
  const p = await b.newPage();
  const cdp = await p.target().createCDPSession();
  await cdp.send("Network.enable");

  const cari = (k) => p.evaluate((k) => {
    const h = document.querySelector("flt-glass-pane");
    if (!h?.shadowRoot) return null;
    for (const el of h.shadowRoot.querySelectorAll("flt-span")) {
      if ((el.textContent||"").trim() !== k) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 3 || r.y < 0 || r.y > window.innerHeight) continue;
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    }
    return null;
  }, k);
  const ketuk = async (k, j=1800) => { const t = await cari(k); if (!t) { console.log("  ! tidak menemukan "+k); return false; } await p.mouse.click(t.x,t.y); await sleep(j); return true; };
  const gulir = async (dy) => { await p.mouse.move(206,500); await p.mouse.wheel({deltaY:dy}); await sleep(900); };
  const teks = () => p.evaluate(() => document.querySelector("flt-glass-pane")?.shadowRoot?.textContent || "");

  await p.goto("http://127.0.0.1:8125", { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(6500);
  await ketuk("Lewati");
  let k = await cari("PENGGUNA"); if (k) { await p.mouse.click(k.x,k.y+36); await sleep(300); await p.keyboard.type("guard1",{delay:25}); }
  k = await cari("SANDI"); if (k) { await p.mouse.click(k.x,k.y+36); await sleep(300); await p.keyboard.type("guard123",{delay:25}); }
  await ketuk("MASUK", 9000);

  await cdp.send("Network.emulateNetworkConditions",{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await gulir(700);
  if (!await ketuk("Instruksi", 6000)) { await gulir(-400); await ketuk("Instruksi", 6000); }
  await p.mouse.click(40, 62); await sleep(2500);
  await p.mouse.click(41, 850); await sleep(2000);
  await gulir(-1800);
  await p.screenshot({ path: "/img/hp-luring.png" });
  console.log("  · hp-luring · bilah:", /Tanpa jaringan/.test(await teks()));
  await p.mouse.click(206, 30); await sleep(1800);
  await p.screenshot({ path: "/img/hp-luring-antrean.png" });
  console.log("  · hp-luring-antrean");
  await b.close();
})();
