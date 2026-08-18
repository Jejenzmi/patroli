import { prisma } from './prisma';

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

function batas(hari: number) {
  return new Date(Date.now() - hari * 24 * 3600 * 1000);
}

export async function bersihkanDataKedaluwarsa() {
  const hasil = {
    jejakLokasi: 0,
    percobaanPresensi: 0,
    notifikasi: 0,
  };

  try {
    hasil.jejakLokasi = (
      await prisma.locationPing.deleteMany({
        where: { recordedAt: { lt: batas(HARI_JEJAK_LOKASI) } },
      })
    ).count;

    hasil.percobaanPresensi = (
      await prisma.attendanceAttempt.deleteMany({
        where: { createdAt: { lt: batas(HARI_PERCOBAAN_PRESENSI) } },
      })
    ).count;

    hasil.notifikasi = (
      await prisma.notification.deleteMany({
        where: { createdAt: { lt: batas(HARI_NOTIFIKASI) }, readAt: { not: null } },
      })
    ).count;

    const total = hasil.jejakLokasi + hasil.percobaanPresensi + hasil.notifikasi;
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
};
