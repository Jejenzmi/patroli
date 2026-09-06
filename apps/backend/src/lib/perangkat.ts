import { prisma } from './prisma';
import { catatPelanggaran } from './integritas';

/**
 * Pengikatan akun pada satu perangkat.
 *
 * Tujuannya sederhana: akun tidak dapat dipinjamkan. Pengikatan terjadi pada
 * masuk pertama dari aplikasi lapangan, dan hanya administrator yang dapat
 * melepaskannya bila petugas berganti ponsel.
 *
 * Pemasangan ulang aplikasi menghasilkan penanda baru, dan itu bukan
 * pelanggaran. Karena itu ciri perangkat (merek, model, papan, versi sistem)
 * ikut disimpan: bila cirinya sama persis, ponselnya dianggap sama dan
 * penandanya diperbarui tanpa merepotkan siapa pun.
 */

export interface InfoPerangkat {
  deviceId?: string | null;
  fingerprint?: string | null;
  label?: string | null;
  platform?: string | null;
  osVersion?: string | null;
  appVersion?: string | null;
  isPhysical?: boolean | null;
}

export interface HasilPerangkat {
  ok: boolean;
  pesan?: string;
  device?: any;
}

export async function periksaPerangkat(
  userId: string,
  info: InfoPerangkat,
  ip?: string
): Promise<HasilPerangkat> {
  const deviceId = (info.deviceId || '').trim();
  // Aplikasi lama yang belum mengirim penanda tidak dihalangi; pengikatan
  // mulai berlaku begitu petugas memakai versi yang mengirimkannya.
  if (!deviceId) return { ok: true };

  // Akun peragaan dipakai bergantian dari beberapa perangkat oleh peninjau
  // Google Play, jadi tidak diikat ke satu ponsel.
  const pengguna = await prisma.user.findUnique({
    where: { id: userId },
    select: { isDemo: true },
  });
  if (pengguna?.isDemo) return { ok: true };

  const terdaftar = await prisma.userDevice.findMany({ where: { userId } });
  const cocok = terdaftar.find((d) => d.deviceId === deviceId);

  if (cocok) {
    if (cocok.status === 'DIBLOKIR') {
      await catatPelanggaran({
        userId,
        type: 'PERANGKAT_ASING',
        action: 'MASUK',
        deviceId,
        detail: `Perangkat ${cocok.label ?? deviceId} berstatus diblokir`,
        ip,
      });
      return {
        ok: false,
        pesan: 'Perangkat ini diblokir administrator. Hubungi pengawas Anda.',
      };
    }
    const device = await prisma.userDevice.update({
      where: { id: cocok.id },
      data: {
        lastSeenAt: new Date(),
        appVersion: info.appVersion ?? cocok.appVersion,
        osVersion: info.osVersion ?? cocok.osVersion,
        isPhysical: info.isPhysical ?? cocok.isPhysical,
      },
    });
    return { ok: true, device };
  }

  const aktif = terdaftar.filter((d) => d.status === 'AKTIF');

  // Ponsel yang sama setelah aplikasi dipasang ulang: penandanya diperbarui.
  const sama = info.fingerprint
    ? aktif.find((d) => d.fingerprint && d.fingerprint === info.fingerprint)
    : undefined;
  if (sama) {
    const device = await prisma.userDevice.update({
      where: { id: sama.id },
      data: {
        deviceId,
        lastSeenAt: new Date(),
        appVersion: info.appVersion ?? sama.appVersion,
        note: 'Penanda diperbarui setelah aplikasi dipasang ulang pada ponsel yang sama',
      },
    });
    return { ok: true, device };
  }

  // Belum punya perangkat: masuk pertama mengikat akun.
  if (aktif.length === 0) {
    const device = await prisma.userDevice.create({
      data: {
        userId,
        deviceId,
        fingerprint: info.fingerprint ?? null,
        label: info.label ?? null,
        platform: info.platform ?? null,
        osVersion: info.osVersion ?? null,
        appVersion: info.appVersion ?? null,
        isPhysical: info.isPhysical ?? true,
      },
    });
    return { ok: true, device };
  }

  // Perangkat lain: ditolak, dan percobaannya dicatat.
  await catatPelanggaran({
    userId,
    type: 'PERANGKAT_ASING',
    action: 'MASUK',
    deviceId,
    detail: `Mencoba masuk dari ${info.label ?? 'perangkat tak dikenal'}; akun terikat pada ${aktif[0].label ?? aktif[0].deviceId}`,
    meta: { fingerprint: info.fingerprint, terikatPada: aktif[0].label },
    ip,
  });
  return {
    ok: false,
    pesan:
      'Akun ini terikat pada ponsel lain. Bila Anda berganti ponsel, minta administrator melepaskan ikatan perangkat lebih dulu.',
  };
}
