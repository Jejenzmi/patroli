/**
 * Mencetak panduan.html menjadi PDF A4 dengan nomor halaman.
 * Dijalankan di dalam kontainer puppeteer.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--user-data-dir=/tmp/prender'],
  });
  const page = await browser.newPage();

  await page.goto('file:///app/panduan.html', { waitUntil: 'networkidle0', timeout: 120000 });
  // Beri jeda agar seluruh gambar benar-benar terpasang sebelum dicetak.
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))
    );
  });

  await page.pdf({
    path: '/out/Panduan-Penggunaan-DHARMAPATI.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-family:Inter,Arial,sans-serif;font-size:7.6pt;color:#8494AC;
                  padding:0 16mm;display:flex;justify-content:space-between;align-items:center;">
        <span>Panduan Penggunaan DHARMAPATI · Security Guard Management &amp; Patrol Tracking</span>
        <span>Hal. <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
  });

  const halaman = await page.evaluate(() => document.querySelectorAll('h1.part').length);
  console.log(`▸ PDF tercetak — ${halaman} bab`);
  await browser.close();
})();
