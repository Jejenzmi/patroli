import { prisma } from './prisma';

/**
 * Verifikasi wajah untuk presensi (FR-ATT-005, BRULE-003).
 *
 * Vektor ciri dihitung oleh layanan terpisah; pencocokan memakai jarak
 * euclidean. Semakin kecil jaraknya, semakin mirip. Ambang batas 0,55
 * merupakan nilai yang lazim untuk model 128 dimensi ini.
 */

const FACE_URL = process.env.FACE_SERVICE_URL || '';
export const AMBANG_JARAK = Number(process.env.FACE_THRESHOLD || 0.55);

export const wajahDiaktifkan = () => !!FACE_URL;

/** Apakah pengguna ini sudah mendaftarkan wajahnya. */
export async function wajahAktif(userId: string) {
  if (!wajahDiaktifkan()) return false;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { faceTemplate: true, faceEnrolledAt: true },
  });
  // Keduanya harus terisi agar penanda di aplikasi dan aturan server tidak berbeda.
  return Array.isArray(u?.faceTemplate) && !!u?.faceEnrolledAt;
}

/** Mengambil vektor ciri dari sebuah gambar yang tersimpan di penyimpanan berkas. */
export async function ciriDariUrl(url: string): Promise<number[] | null> {
  if (!wajahDiaktifkan()) return null;
  const berkas = await ambilBerkas(url);
  if (!berkas) return null;

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(berkas)]), 'foto.jpg');
  const r = await fetch(`${FACE_URL}/descriptor`, { method: 'POST', body: form });
  if (!r.ok) return null;
  const j: any = await r.json();
  return Array.isArray(j.descriptor) ? j.descriptor : null;
}

/** Mengunduh berkas foto dari MinIO lewat jalur internal. */
async function ambilBerkas(url: string): Promise<Buffer | null> {
  try {
    const basis = process.env.STORAGE_INTERNAL_URL || 'http://minio:9000/patroli';
    const kunci = url.replace(/^.*\/storage\//, '');
    const r = await fetch(`${basis}/${kunci}`);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

export function jarakEuclidean(a: number[], b: number[]) {
  let jumlah = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) jumlah += (a[i] - b[i]) ** 2;
  return Math.sqrt(jumlah);
}

/** Mengubah jarak menjadi skor kemiripan 0–100 agar mudah dibaca pengguna. */
export function skorDariJarak(jarak: number) {
  return Math.round(Math.max(0, Math.min(1, 1 - jarak / 1.2)) * 1000) / 10;
}

export interface HasilCocok {
  ok: boolean;
  score: number | null;
  result: 'WAJAH_TIDAK_COCOK' | 'WAJAH_TIDAK_TERDETEKSI' | 'LAINNYA';
  message: string;
}

/** Mencocokkan foto presensi dengan template wajah yang terdaftar. */
export async function cocokkanWajah(userId: string, photoUrl: string | null): Promise<HasilCocok> {
  if (!photoUrl)
    return {
      ok: false,
      score: null,
      result: 'WAJAH_TIDAK_TERDETEKSI',
      message: 'Foto wajah wajib diambil saat presensi.',
    };

  const u = await prisma.user.findUnique({ where: { id: userId }, select: { faceTemplate: true } });
  const template = u?.faceTemplate as number[] | null;
  if (!Array.isArray(template))
    return { ok: true, score: null, result: 'LAINNYA', message: 'Wajah belum didaftarkan.' };

  const ciri = await ciriDariUrl(photoUrl);
  if (!ciri)
    return {
      ok: false,
      score: null,
      result: 'WAJAH_TIDAK_TERDETEKSI',
      message: 'Wajah tidak terdeteksi pada foto. Ambil ulang dengan pencahayaan yang cukup.',
    };

  const jarak = jarakEuclidean(template, ciri);
  const skor = skorDariJarak(jarak);
  if (jarak > AMBANG_JARAK)
    return {
      ok: false,
      score: skor,
      result: 'WAJAH_TIDAK_COCOK',
      message: `Wajah tidak cocok dengan data terdaftar (kemiripan ${skor}%). Presensi ditolak.`,
    };

  return { ok: true, score: skor, result: 'LAINNYA', message: 'Wajah cocok' };
}
