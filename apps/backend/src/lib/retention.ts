import { prisma } from './prisma';
import { BUCKET, minio } from './storage';

/**
 * Masa simpan data (BRULE-010, FR-GPS-005, NFR Data Retention).
 *
 * Jejak lokasi dan bukti foto adalah data pribadi, sehingga tidak disimpan
 * selamanya. Nilai bawaan dapat diubah lewat variabel lingkungan agar sesuai
 * kebijakan yang disepakati dengan klien.
 */

const HARI_JEJAK_LOKASI = Number(process.env.RETENSI_JEJAK_LOKASI_HARI || 30);
const HARI_PERCOBAAN_PRESENSI = Number(process.env.RETENSI_PERCOBAAN_HARI || 180);
const HARI_NOTIFIKASI = Number(process.env.RETENSI_NOTIFIKASI_HARI || 90);
const HARI_FOTO_PRESENSI = Number(process.env.RETENSI_FOTO_PRESENSI_HARI || 180);

function batas(hari: number) {
  return new Date(Date.now() - hari * 24 * 3600 * 1000);
}

/**
 * Menghapus berkas di penyimpanan objek. Baris basis data saja tidak cukup:
 * foto wajah dan bukti tetap tersimpan bila objeknya dibiarkan.
 */
async function hapusBerkas(urls: (string | null | undefined)[]) {
  const kunci = urls
    .filter((u): u is string => !!u && u.includes('/storage/'))
    .map((u) => u.replace(/^.*\/storage\//, ''));
  let terhapus = 0;
  for (const k of kunci) {
    try {
      await minio.removeObject(BUCKET, k);
      terhapus++;
    } catch {
      // Objek mungkin sudah tidak ada; pembersihan tidak boleh menggagalkan sisanya.
    }
  }
  return terhapus;
}

export async function bersihkanDataKedaluwarsa() {
  const hasil = {
    jejakLokasi: 0,
    percobaanPresensi: 0,
    notifikasi: 0,
    berkas: 0,
  };

  try {
    hasil.jejakLokasi = (
      await prisma.locationPing.deleteMany({
        where: { recordedAt: { lt: batas(HARI_JEJAK_LOKASI) } },
      })
    ).count;

    // Fotonya dihapus lebih dulu, baru barisnya — supaya tidak ada objek yatim.
    const percobaanUsang = await prisma.attendanceAttempt.findMany({
      where: { createdAt: { lt: batas(HARI_PERCOBAAN_PRESENSI) } },
      select: { photoUrl: true },
    });
    hasil.berkas += await hapusBerkas(percobaanUsang.map((a) => a.photoUrl));
    hasil.percobaanPresensi = (
      await prisma.attendanceAttempt.deleteMany({
        where: { createdAt: { lt: batas(HARI_PERCOBAAN_PRESENSI) } },
      })
    ).count;

    // Foto presensi yang sudah lewat masa simpan: barisnya tetap disimpan
    // sebagai bukti kehadiran, tetapi fotonya tidak lagi diperlukan.
    const presensiUsang = await prisma.attendance.findMany({
      where: {
        checkInAt: { lt: batas(HARI_FOTO_PRESENSI) },
        OR: [{ checkInPhoto: { not: null } }, { checkOutPhoto: { not: null } }],
      },
      select: { id: true, checkInPhoto: true, checkOutPhoto: true },
      take: 500,
    });
    if (presensiUsang.length) {
      hasil.berkas += await hapusBerkas(
        presensiUsang.flatMap((a) => [a.checkInPhoto, a.checkOutPhoto])
      );
      await prisma.attendance.updateMany({
        where: { id: { in: presensiUsang.map((a) => a.id) } },
        data: { checkInPhoto: null, checkOutPhoto: null },
      });
    }

    hasil.notifikasi = (
      await prisma.notification.deleteMany({
        where: { createdAt: { lt: batas(HARI_NOTIFIKASI) }, readAt: { not: null } },
      })
    ).count;

    const total = hasil.jejakLokasi + hasil.percobaanPresensi + hasil.notifikasi + hasil.berkas;
    if (total) console.log('▸ Masa simpan: menghapus', JSON.stringify(hasil));
  } catch (e: any) {
    console.warn('[retensi] gagal:', e.message);
  }
  return hasil;
}

/** Menjalankan pembersihan saat mulai lalu setiap 24 jam. */
export function mulaiPenjadwalRetensi() {
  const jalan = () => void bersihkanDataKedaluwarsa();
  setTimeout(jalan, 60_000);
  setInterval(jalan, 24 * 3600 * 1000);
  console.log(
    `▸ Masa simpan aktif — jejak lokasi ${HARI_JEJAK_LOKASI} hari, percobaan presensi ${HARI_PERCOBAAN_PRESENSI} hari`
  );
}

export const kebijakanRetensi = {
  jejakLokasiHari: HARI_JEJAK_LOKASI,
  percobaanPresensiHari: HARI_PERCOBAAN_PRESENSI,
  notifikasiHari: HARI_NOTIFIKASI,
  fotoPresensiHari: HARI_FOTO_PRESENSI,
};
