import { prisma } from './prisma';
import { notifyCommand } from './notify';
import { haversineMeters } from '@patroli/shared';

/**
 * Penjagaan keaslian data lapangan.
 *
 * Ada dua lapis. Lapis pertama adalah laporan dari aplikasi: Android menandai
 * koordinat yang berasal dari penyedia tiruan, dan aplikasi meneruskan tanda
 * itu apa adanya. Lapis kedua berjalan di server dan tidak bergantung pada
 * kejujuran aplikasi sama sekali — perpindahan yang mustahil menurut jarak dan
 * waktu tetap tertangkap walau tanda dari aplikasi sengaja dihilangkan oleh
 * pemasangan aplikasi yang sudah diubah.
 *
 * Setiap pelanggaran menolak tindakannya, tetapi percobaannya selalu disimpan.
 */

/** Batas kecepatan wajar antar-catatan (km/jam). */
export const BATAS_KECEPATAN_KPH = Number(process.env.INTEGRITAS_KECEPATAN_KPH || 130);

/** Jarak minimal sebelum kecepatan dihitung, agar GPS yang meloncat sedikit
 *  tidak dianggap pelanggaran. */
const JARAK_MIN_M = 250;

export const LABEL_INTEGRITAS: Record<string, string> = {
  LOKASI_PALSU: 'Lokasi palsu (fake GPS)',
  KECEPATAN_TIDAK_WAJAR: 'Perpindahan mustahil',
  EMULATOR: 'Berjalan di emulator',
  PERANGKAT_ASING: 'Perangkat tidak terdaftar',
  PERANGKAT_ROOT: 'Perangkat di-root',
};

export interface CatatanIntegritas {
  userId?: string | null;
  siteId?: string | null;
  type: keyof typeof LABEL_INTEGRITAS;
  action: string;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  speedKph?: number | null;
  deviceId?: string | null;
  detail?: string | null;
  meta?: any;
  ip?: string | null;
}

/** Menyimpan pelanggaran dan memberi tahu pengawas. */
export async function catatPelanggaran(c: CatatanIntegritas) {
  // Hanya kolom yang memang ada yang diteruskan. Bila bidang lain ikut
  // terbawa, Prisma beralih ke bentuk berelasi dan menolak userId/siteId
  // yang justru dibutuhkan di sini.
  const ev = await prisma.integrityEvent.create({
    data: {
      userId: c.userId ?? null,
      siteId: c.siteId ?? null,
      type: c.type as any,
      action: c.action,
      lat: c.lat ?? null,
      lng: c.lng ?? null,
      accuracyM: c.accuracyM ?? null,
      speedKph: c.speedKph ?? null,
      deviceId: c.deviceId ?? null,
      detail: c.detail ?? null,
      meta: c.meta ?? undefined,
      ip: c.ip ?? null,
    },
  });

  const pelaku = c.userId
    ? await prisma.user.findUnique({ where: { id: c.userId }, select: { name: true, employeeId: true } })
    : null;

  await notifyCommand(
    {
      type: 'INTEGRITY',
      title: `⚠️ ${LABEL_INTEGRITAS[c.type]}`,
      body: `${pelaku?.name ?? 'Pengguna tidak dikenal'} — ${c.detail ?? c.action}`,
      data: { integrityId: ev.id, type: c.type },
    },
    c.siteId ?? undefined
  );
  return ev;
}

/**
 * Memeriksa keaslian sebuah koordinat sebelum tindakan diterima.
 *
 * Mengembalikan alasan penolakan bila melanggar, atau null bila wajar.
 */
export async function periksaLokasi(opsi: {
  userId: string;
  siteId?: string | null;
  action: string;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  mocked?: boolean;
  isPhysical?: boolean;
  deviceId?: string | null;
  ip?: string | null;
}): Promise<{ ditolak: boolean; type?: string; pesan?: string; speedKph?: number }> {
  const { userId, lat, lng } = opsi;

  // Akun peragaan untuk peninjau Google Play dikecualikan. Peninjau bekerja
  // dari emulator dengan penyedia lokasi tiruan, sehingga tanpa kelonggaran
  // ini seluruh fungsi lapangan tertutup baginya dan aplikasi tampak rusak.
  // Kelonggaran hanya berlaku bagi akun yang ditandai `isDemo`, dan akun itu
  // hanya dapat dibuat lewat seed peragaan.
  const pengguna = await prisma.user.findUnique({
    where: { id: userId },
    select: { isDemo: true },
  });
  if (pengguna?.isDemo) return { ditolak: false };

  // ── Lapis pertama: tanda dari sistem operasi ──
  if (opsi.mocked) {
    await catatPelanggaran({
      ...opsi,
      type: 'LOKASI_PALSU',
      detail: 'Koordinat berasal dari penyedia lokasi tiruan pada perangkat',
    });
    return {
      ditolak: true,
      type: 'LOKASI_PALSU',
      pesan:
        'Lokasi palsu terdeteksi. Matikan aplikasi pengubah lokasi (fake GPS) pada ponsel Anda, lalu ulangi. Percobaan ini sudah tercatat dan dilaporkan ke pengawas.',
    };
  }

  if (opsi.isPhysical === false) {
    await catatPelanggaran({
      ...opsi,
      type: 'EMULATOR',
      detail: 'Aplikasi dijalankan pada emulator, bukan ponsel sungguhan',
    });
    return {
      ditolak: true,
      type: 'EMULATOR',
      pesan: 'Aplikasi harus dijalankan pada ponsel sungguhan. Percobaan ini sudah tercatat.',
    };
  }

  if (lat == null || lng == null) return { ditolak: false };

  // ── Lapis kedua: kewajaran perpindahan, dihitung di server ──
  const sebelum = await prisma.locationPing.findFirst({
    where: { guardId: userId },
    orderBy: { recordedAt: 'desc' },
    select: { lat: true, lng: true, recordedAt: true },
  });
  if (!sebelum) return { ditolak: false };

  const detik = (Date.now() - sebelum.recordedAt.getTime()) / 1000;
  if (detik <= 0 || detik > 3600) return { ditolak: false };

  const jarak = haversineMeters(sebelum.lat, sebelum.lng, lat, lng);
  if (jarak < JARAK_MIN_M) return { ditolak: false };

  const kph = (jarak / detik) * 3.6;
  if (kph <= BATAS_KECEPATAN_KPH) return { ditolak: false };

  await catatPelanggaran({
    ...opsi,
    type: 'KECEPATAN_TIDAK_WAJAR',
    speedKph: Math.round(kph),
    detail: `Berpindah ${Math.round(jarak)} m dalam ${Math.round(detik)} detik (${Math.round(kph)} km/jam)`,
    meta: { jarakM: Math.round(jarak), detik: Math.round(detik), batasKph: BATAS_KECEPATAN_KPH },
  });
  return {
    ditolak: true,
    type: 'KECEPATAN_TIDAK_WAJAR',
    speedKph: Math.round(kph),
    pesan: `Perpindahan tidak wajar terdeteksi (${Math.round(kph)} km/jam). Bila Anda memang berpindah lokasi, tunggu beberapa saat lalu ulangi. Percobaan ini sudah tercatat.`,
  };
}

/**
 * Menyimpan jejak posisi agar pemeriksaan kewajaran punya pembanding.
 *
 * Dipanggil setelah sebuah tindakan diterima; posisi yang ditolak sengaja
 * tidak disimpan supaya tidak mencemari pembanding berikutnya.
 */
export async function simpanJejak(userId: string, lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return;
  try {
    await prisma.locationPing.create({ data: { guardId: userId, lat, lng } });
  } catch {
    // Jejak bersifat pelengkap; kegagalannya tidak boleh membatalkan tindakan.
  }
}
