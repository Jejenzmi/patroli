/**
 * Pembantu satuan uang.
 *
 * Seluruh nilai rupiah dalam sistem disimpan sebagai bilangan bulat rupiah.
 * Pembulatan dilakukan di satu tempat agar tidak ada selisih sen yang menumpuk
 * antara slip gaji, tagihan, dan laba-rugi.
 */

/** Membulatkan ke rupiah penuh. */
export const rp = (n: number): number => Math.round(Number.isFinite(n) ? n : 0);

/** Membulatkan ke bawah ke kelipatan tertentu (PKP dibulatkan ke ribuan penuh). */
export const bulatBawah = (n: number, kelipatan = 1000): number =>
  Math.floor((Number.isFinite(n) ? n : 0) / kelipatan) * kelipatan;

/** Persentase dari sebuah nilai, langsung dibulatkan. */
export const persen = (nilai: number, pct: number): number => rp((nilai * pct) / 100);

export const format = (n: number): string =>
  'Rp ' + Math.round(n).toLocaleString('id-ID', { maximumFractionDigits: 0 });

const SATUAN = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas',
];

/** Nilai dalam huruf — tagihan resmi lazim mencantumkannya. */
export function terbilang(n: number): string {
  const x = Math.floor(Math.abs(n));
  if (x < 12) return SATUAN[x] || 'nol';
  if (x < 20) return `${terbilang(x - 10)} belas`;
  if (x < 100) return `${terbilang(Math.floor(x / 10))} puluh ${terbilang(x % 10)}`.trim();
  if (x < 200) return `seratus ${terbilang(x - 100)}`.trim();
  if (x < 1000) return `${terbilang(Math.floor(x / 100))} ratus ${terbilang(x % 100)}`.trim();
  if (x < 2000) return `seribu ${terbilang(x - 1000)}`.trim();
  if (x < 1_000_000) return `${terbilang(Math.floor(x / 1000))} ribu ${terbilang(x % 1000)}`.trim();
  if (x < 1_000_000_000)
    return `${terbilang(Math.floor(x / 1_000_000))} juta ${terbilang(x % 1_000_000)}`.trim();
  if (x < 1_000_000_000_000)
    return `${terbilang(Math.floor(x / 1_000_000_000))} miliar ${terbilang(x % 1_000_000_000)}`.trim();
  return `${terbilang(Math.floor(x / 1_000_000_000_000))} triliun ${terbilang(
    x % 1_000_000_000_000
  )}`.trim();
}

/** "seratus dua puluh ribu rupiah" dengan huruf awal kapital. */
export function terbilangRupiah(n: number): string {
  const kata = `${terbilang(n)} rupiah`.replace(/\s+/g, ' ').trim();
  return kata.charAt(0).toUpperCase() + kata.slice(1);
}

export interface BarisUang {
  kode: string;
  label: string;
  jumlah: number;
  catatan?: string;
}

/** Menjumlahkan baris pendapatan/potongan slip gaji. */
export const jumlahBaris = (baris: BarisUang[]): number =>
  rp(baris.reduce((a, b) => a + (b.jumlah || 0), 0));
