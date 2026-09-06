import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, ADMIN_ONLY } from '../middleware/auth';
import { audit } from '../lib/notify';

const router = Router();

/**
 * Kendali versi aplikasi lapangan.
 *
 * Google Play memang memberi tahu adanya pembaruan, tetapi hanya di dalam
 * aplikasi Play dan hanya bila pengguna membukanya. Anggota di lapangan jarang
 * melakukannya, sehingga versi lama bisa bertahan berbulan-bulan — padahal
 * sebagian pembaruan menyangkut cara presensi dan patroli dicatat.
 *
 * Selain itu sebagian ponsel dinas dipasang langsung dari berkas APK, di luar
 * Play. Karena itu penentu versinya diletakkan di sini, bukan diserahkan
 * sepenuhnya kepada Play: satu sumber yang mengurus kedua jalur pemasangan.
 *
 * Endpoint pembacaan sengaja terbuka tanpa token — aplikasi harus dapat
 * mengetahui dirinya kedaluwarsa bahkan sebelum penggunanya masuk.
 */

export interface KonfigVersi {
  /** Versi terbaru yang tersedia, mis. "1.6.1" */
  versi: string;
  /** Nomor build terbaru — ini yang dibandingkan, bukan teks versinya */
  build: number;
  /** Build terendah yang masih boleh dipakai; di bawah ini pembaruan dipaksa */
  buildMinimum: number;
  catatan: string;
  tautanPlay: string;
  tautanApk: string;
}

export const VERSI_BAWAAN: KonfigVersi = {
  versi: '1.6.0',
  build: 7,
  buildMinimum: 1,
  catatan: '',
  tautanPlay: 'https://play.google.com/store/apps/details?id=id.co.dharmapati.patroli',
  tautanApk: 'https://dashboard.dharmapati.co.id/DHARMAPATI.apk',
};

async function ambilVersi(): Promise<KonfigVersi> {
  const s = await prisma.setting.findUnique({ where: { key: 'app.versi' } });
  return { ...VERSI_BAWAAN, ...((s?.value as any) || {}) };
}

/**
 * Dipanggil aplikasi saat mulai dan setiap kali kembali ke beranda.
 * `build` yang dikirim aplikasi menentukan jawabannya.
 */
router.get('/versi', async (req, res) => {
  const konfig = await ambilVersi();
  const build = Number(req.query.build) || 0;

  res.json({
    ...konfig,
    // Jawaban dihitung di server agar aturannya dapat diubah tanpa menunggu
    // aplikasi diperbarui lebih dulu — persoalan ayam dan telur yang klasik.
    adaPembaruan: build > 0 && build < konfig.build,
    wajib: build > 0 && build < konfig.buildMinimum,
  });
});

/** Pengaturan versi — hanya administrator. */
router.get('/versi/config', auth, allow(...ADMIN_ONLY), async (_req, res) => {
  res.json({ ...(await ambilVersi()), bawaan: VERSI_BAWAAN });
});

router.put('/versi/config', auth, allow(...ADMIN_ONLY), async (req, res) => {
  const p = z
    .object({
      versi: z.string().regex(/^\d+\.\d+\.\d+$/, 'Versi harus berbentuk 1.2.3'),
      build: z.number().int().min(1),
      buildMinimum: z.number().int().min(1),
      catatan: z.string().max(500).optional().default(''),
      tautanPlay: z.string().url(),
      tautanApk: z.string().url(),
    })
    .safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.issues[0].message });
  if (p.data.buildMinimum > p.data.build)
    return res
      .status(400)
      .json({ message: 'Build minimum tidak boleh lebih tinggi daripada build terbaru' });

  await prisma.setting.upsert({
    where: { key: 'app.versi' },
    create: { key: 'app.versi', value: p.data },
    update: { value: p.data },
  });
  await audit(req.user!.sub, 'UPDATE', 'Setting', 'app.versi', p.data, req.ip);
  res.json(p.data);
});

export default router;
