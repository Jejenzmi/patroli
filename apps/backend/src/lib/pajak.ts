import { prisma } from './prisma';
import { rp, bulatBawah } from './uang';

/**
 * PPh 21 pegawai tetap.
 *
 * Masa Januari–November memakai Tarif Efektif Rata-rata (TER) bulanan
 * (PMK 168/2023): pajak = tarif TER × penghasilan bruto sebulan.
 * Masa Desember memakai perhitungan setahun dengan tarif Pasal 17 UU HPP,
 * lalu dikurangi seluruh PPh 21 yang sudah dipotong Januari–November.
 *
 * Tabel TER disimpan pada tabel `TerBracket` — bukan di kode — supaya
 * pembaruan tarif tidak menuntut penerapan ulang.
 */

/** PTKP setahun menurut status (PMK 101/2016, masih berlaku). */
export const PTKP: Record<string, number> = {
  TK0: 54_000_000,
  TK1: 58_500_000,
  TK2: 63_000_000,
  TK3: 67_500_000,
  K0: 58_500_000,
  K1: 63_000_000,
  K2: 67_500_000,
  K3: 72_000_000,
};

/** Pengelompokan status PTKP ke kategori TER A/B/C. */
export function kategoriTer(ptkp: string | null | undefined): 'A' | 'B' | 'C' {
  switch (ptkp || 'TK0') {
    case 'TK0':
    case 'TK1':
    case 'K0':
      return 'A';
    case 'TK2':
    case 'TK3':
    case 'K1':
    case 'K2':
      return 'B';
    case 'K3':
      return 'C';
    default:
      return 'A';
  }
}

/** Lapisan tarif Pasal 17 UU HPP untuk perhitungan setahun. */
export const LAPISAN_PASAL_17: { batas: number; tarif: number }[] = [
  { batas: 60_000_000, tarif: 5 },
  { batas: 250_000_000, tarif: 15 },
  { batas: 500_000_000, tarif: 25 },
  { batas: 5_000_000_000, tarif: 30 },
  { batas: Infinity, tarif: 35 },
];

/** Biaya jabatan: 5% penghasilan bruto, paling banyak Rp 500.000 sebulan. */
export const BIAYA_JABATAN_PCT = 5;
export const BIAYA_JABATAN_MAKS_BULAN = 500_000;

let cacheTer: { pada: number; data: Record<string, { min: number; max: number | null; tarif: number }[]> } | null =
  null;

/** Tabel TER dari basis data, disinggahkan lima menit. */
export async function tabelTer() {
  if (cacheTer && Date.now() - cacheTer.pada < 5 * 60_000) return cacheTer.data;
  const rows = await prisma.terBracket.findMany({ orderBy: [{ category: 'asc' }, { minGross: 'asc' }] });
  const data: Record<string, { min: number; max: number | null; tarif: number }[]> = { A: [], B: [], C: [] };
  rows.forEach((r) => {
    (data[r.category] ||= []).push({ min: r.minGross, max: r.maxGross, tarif: r.ratePct });
  });
  cacheTer = { pada: Date.now(), data };
  return data;
}

export function lupakanCacheTer() {
  cacheTer = null;
}

/** Tarif TER (%) untuk satu kategori pada penghasilan bruto sebulan. */
export async function tarifTer(kategori: 'A' | 'B' | 'C', bruto: number): Promise<number> {
  const tabel = (await tabelTer())[kategori] || [];
  if (!tabel.length) return 0;
  const baris = tabel.find((b) => bruto >= b.min && (b.max === null || bruto <= b.max));
  return baris ? baris.tarif : tabel[tabel.length - 1].tarif;
}

/** PPh 21 masa Januari–November. */
export async function pph21Bulanan(bruto: number, ptkp: string | null | undefined) {
  const kategori = kategoriTer(ptkp);
  const tarif = await tarifTer(kategori, bruto);
  return { pajak: rp((bruto * tarif) / 100), kategori, tarif };
}

/** Pajak setahun menurut lapisan Pasal 17. */
export function pajakProgresif(pkp: number): number {
  let sisa = Math.max(0, pkp);
  let bawah = 0;
  let total = 0;
  for (const l of LAPISAN_PASAL_17) {
    const lebar = l.batas - bawah;
    const kena = Math.min(sisa, lebar);
    if (kena <= 0) break;
    total += (kena * l.tarif) / 100;
    sisa -= kena;
    bawah = l.batas;
  }
  return rp(total);
}

export interface HitungDesember {
  /** Penghasilan bruto setahun termasuk masa Desember */
  brutoSetahun: number;
  /** Iuran JHT + JP yang ditanggung pekerja setahun (pengurang) */
  iuranPekerjaSetahun: number;
  /** Jumlah bulan bekerja dalam tahun berjalan */
  bulanKerja: number;
  ptkp: string | null | undefined;
  /** PPh 21 yang sudah dipotong Januari–November */
  sudahDipotong: number;
}

/**
 * PPh 21 masa Desember (atau masa pajak terakhir).
 * Hasilnya bisa negatif — artinya lebih potong dan harus dikembalikan.
 */
export function pph21Desember(h: HitungDesember) {
  const biayaJabatan = Math.min(
    (h.brutoSetahun * BIAYA_JABATAN_PCT) / 100,
    BIAYA_JABATAN_MAKS_BULAN * Math.max(1, Math.min(12, h.bulanKerja))
  );
  const neto = h.brutoSetahun - biayaJabatan - h.iuranPekerjaSetahun;
  const ptkp = PTKP[h.ptkp || 'TK0'] ?? PTKP.TK0;
  const pkp = bulatBawah(Math.max(0, neto - ptkp), 1000);
  const pajakSetahun = pajakProgresif(pkp);
  return {
    biayaJabatan: rp(biayaJabatan),
    neto: rp(neto),
    ptkp,
    pkp,
    pajakSetahun,
    pajakMasaIni: rp(pajakSetahun - h.sudahDipotong),
  };
}
