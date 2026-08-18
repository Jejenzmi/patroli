/** Menguji dialog konfirmasi web: muncul, membatalkan, dan menyimpan. */
const puppeteer = require('puppeteer');
const BASE = 'https://patroli.gokar.id';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const token = (await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })).json()).token;

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.evaluateOnNewDocument((t) => localStorage.setItem('patroli_token', t), token);

  let pass = 0, fail = 0;
  const check = (name, ok, extra = '') => {
    if (ok) { pass++; console.log(`✓ ${name}`); }
    else { fail++; console.log(`✗ ${name} ${extra}`); }
  };

  // Klik tombol di dalam dialog konfirmasi saja (overlay menutupi sisanya).
  const clickDialog = async (which) => {
    const done = await page.evaluate((w) => {
      const dlg = [...document.querySelectorAll('div')].find((x) => x.className?.includes?.('z-[3000]'));
      if (!dlg) return false;
      const btns = [...dlg.querySelectorAll('button')].filter((b) => b.innerText.trim());
      const el = w === 'ya' ? btns[btns.length - 1] : btns.find((b) => /batal/i.test(b.innerText));
      if (!el) return false;
      el.click();
      return true;
    }, which);
    await sleep(900);
    return done;
  };

  const clickByText = async (text) => {
    const done = await page.evaluate((t) => {
      const el = [...document.querySelectorAll('button,a')].find((b) =>
        b.innerText.trim().toLowerCase().includes(t.toLowerCase()));
      if (!el) return false;
      el.click();
      return true;
    }, text);
    await sleep(700);
    return done;
  };

  const dialogText = () =>
    page.evaluate(() => {
      const d = document.querySelector('.fixed.z-\\[3000\\]') ||
        [...document.querySelectorAll('div')].find((x) => x.className?.includes?.('z-[3000]'));
      return d ? d.innerText : '';
    });

  /* 1. Dialog simpan pada CRUD klien */
  await page.goto(`${BASE}/klien`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await clickByText('Tambah Klien');
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('.panel input');
    const set = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], 'E2E-DLG');
    set(inputs[1], 'PT Uji Dialog Otomatis');
  });
  await sleep(300);
  await clickByText('Simpan');
  const t1 = await dialogText();
  check('dialog konfirmasi simpan muncul', /simpan klien|simpan perubahan/i.test(t1), t1.slice(0, 80));

  /* 2. Tombol batal menutup dialog tanpa menyimpan */
  await clickDialog('batal');
  const t2 = await dialogText();
  check('tombol batal menutup dialog', !t2 || !/simpan klien/i.test(t2));
  const adaSetelahBatal = await (await fetch(`${BASE}/api/master/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  check('data tidak tersimpan saat dibatalkan',
    !adaSetelahBatal.some((c) => c.code === 'E2E-DLG'));

  /* 3. Konfirmasi benar-benar menyimpan */
  await clickByText('Simpan');
  await sleep(600);
  await clickDialog('ya');
  await sleep(1400);
  const setelahSimpan = await (await fetch(`${BASE}/api/master/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const dibuat = setelahSimpan.find((c) => c.code === 'E2E-DLG');
  check('konfirmasi menyimpan data', !!dibuat);

  /* 4. Dialog hapus bernada bahaya */
  if (dibuat) {
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(1500);
    const dihapus = await page.evaluate((kode) => {
      const kartu = [...document.querySelectorAll('section')].find((s) => s.innerText.includes(kode));
      if (!kartu) return false;
      const tombol = kartu.querySelectorAll('button');
      tombol[tombol.length - 1].click();
      return true;
    }, 'E2E-DLG');
    await sleep(800);
    const t4 = await dialogText();
    check('dialog hapus muncul', dihapus && /hapus/i.test(t4), t4.slice(0, 80));
    await clickDialog('ya');
    await sleep(1500);
    const sisa = await (await fetch(`${BASE}/api/master/clients`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    check('data terhapus setelah konfirmasi', !sisa.some((c) => c.code === 'E2E-DLG'));
  }

  /* 5. Dialog keluar */
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.title === 'Keluar');
    btn?.click();
  });
  await sleep(800);
  const t5 = await dialogText();
  check('dialog konfirmasi keluar muncul', /keluar dari pusat komando/i.test(t5), t5.slice(0, 80));
  await page.screenshot({ path: '/out/dialog-keluar.png' });
  await clickDialog('batal');
  const masihMasuk = await page.evaluate(() => !!localStorage.getItem('patroli_token'));
  check('batal keluar mempertahankan sesi', masihMasuk);

  /* 6. Dialog respons sinyal darurat */
  await page.goto(`${BASE}/darurat`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  const adaTombol = await clickByText('Tutup');
  if (adaTombol) {
    const t6 = await dialogText();
    check('dialog respons darurat muncul', /tutup sinyal darurat/i.test(t6), t6.slice(0, 80));
    await clickDialog('batal');
  } else {
    console.log('· tidak ada sinyal darurat aktif untuk diuji (dilewati)');
  }


  /* 7. Dialog pada halaman modul BRD */

  // 7a. Penerbitan tugas baru
  await page.goto(`${BASE}/tugas`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  const adaTugas = await clickByText('Tugas Baru');
  const terisi = await page.evaluate(() => {
    // Modal aplikasi memakai lapisan z-[1000]; isian di luar itu (mis. pencarian) diabaikan.
    const modal = [...document.querySelectorAll('div')].find((x) => x.className?.includes?.('z-[1000]'));
    if (!modal) return 'modal tidak terbuka';
    const setNilai = (el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement
        : el.tagName === 'SELECT' ? window.HTMLSelectElement : window.HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    };
    for (const s of modal.querySelectorAll('select')) {
      const opsi = [...s.options].find((o) => o.value);
      if (opsi) setNilai(s, opsi.value);
    }
    const teks = modal.querySelector('input[type="text"], input:not([type])');
    if (!teks) return 'kolom judul tidak ada';
    setNilai(teks, 'Tugas uji dialog otomatis');
    return 'ok';
  });
  if (adaTugas && terisi === 'ok') {
    await sleep(400);
    await clickByText('Kirim Tugas');
    const t7 = await dialogText();
    check('dialog konfirmasi tugas baru muncul', /tugas/i.test(t7), t7.slice(0, 80));
    await clickDialog('batal');
    const setelah = await (await fetch(`${BASE}/api/tasks?limit=300`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    check('tugas tidak dibuat saat dibatalkan',
      !setelah.some((x) => x.title === 'Tugas uji dialog otomatis'));
  } else {
    check('dialog konfirmasi tugas baru muncul', false, terisi);
  }

  // 7b. Keputusan pengajuan cuti
  await fetch(`${BASE}/api/tasks/leaves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'IZIN', startDate: '2026-11-02T00:00:00.000Z', endDate: '2026-11-02T00:00:00.000Z',
      reason: 'Pengajuan uji dialog otomatis',
    }),
  });
  await page.goto(`${BASE}/cuti`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  const adaPutusan = await page.evaluate(() => {
    const baris = [...document.querySelectorAll('tr')].find((r) =>
      r.innerText.includes('Pengajuan uji dialog otomatis'));
    if (!baris) return false;
    const tombol = [...baris.querySelectorAll('button')].find((b) => /setujui/i.test(b.innerText));
    if (!tombol) return false;
    tombol.click();
    return true;
  });
  await sleep(800);
  if (adaPutusan) {
    const t8 = await dialogText();
    check('dialog keputusan cuti muncul', /setuj/i.test(t8), t8.slice(0, 80));
    await clickDialog('batal');
    const daftar = await (await fetch(`${BASE}/api/tasks/leaves/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const uji = daftar.find((x) => x.reason === 'Pengajuan uji dialog otomatis');
    check('pengajuan tetap menunggu saat dibatalkan', uji?.status === 'DIAJUKAN', uji?.status);
  } else {
    check('dialog keputusan cuti muncul', false, 'baris pengajuan tidak ditemukan');
  }

  // 7c. Penilaian kinerja oleh pengawas
  await page.goto(`${BASE}/kpi`, { waitUntil: 'networkidle2' });
  await sleep(2200);
  const adaNilai = await page.evaluate(() => {
    const baris = [...document.querySelectorAll('tbody tr')];
    for (const r of baris) {
      const b = [...r.querySelectorAll('button')].find((x) => x.innerText.trim().toLowerCase() === 'nilai');
      if (b) { b.click(); return true; }
    }
    return false;
  });
  await sleep(800);
  if (adaNilai) {
    await sleep(600);
    await clickByText('Simpan Penilaian');
    const t9 = await dialogText();
    check('dialog konfirmasi penilaian muncul', /nilai|penilaian/i.test(t9), t9.slice(0, 80));
    await clickDialog('batal');
  } else {
    check('dialog konfirmasi penilaian muncul', false, 'tombol Nilai tidak ditemukan');
  }

  check('tidak ada galat halaman', errors.length === 0, errors.join(' | '));

  await browser.close();
  console.log(`\n═══ LULUS: ${pass}  GAGAL: ${fail} ═══`);
  process.exit(fail ? 1 : 0);
})();
