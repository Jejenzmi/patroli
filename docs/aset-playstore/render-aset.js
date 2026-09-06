const puppeteer = require('puppeteer');
const path = require('path');

/** Merender berkas HTML menjadi PNG berukuran tepat. */
async function render(berkas, keluaran, lebar, tinggi) {
  const b = await puppeteer.launch({ args: ['--no-sandbox', '--force-device-scale-factor=1'] });
  const p = await b.newPage();
  await p.setViewport({ width: lebar, height: tinggi, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(berkas), { waitUntil: 'networkidle0' });
  await new Promise((s) => setTimeout(s, 400));
  await p.screenshot({ path: keluaran, omitBackground: false });
  await b.close();
  console.log('✓', keluaran, lebar + '×' + tinggi);
}

(async () => {
  await render('ikon.html', '/out/ikon-512.png', 512, 512);
  await render('feature.html', '/out/feature-1024x500.png', 1024, 500);
})();
