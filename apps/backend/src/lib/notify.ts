import { prisma } from './prisma';
import { emitOps, emitUser } from './ws';
import { WS_EVENTS } from '@patroli/shared';
import { kirimPush, type KanalPush } from './push';

/**
 * Simpan notifikasi ke DB, dorong lewat WebSocket, lalu kirim ke ponsel.
 *
 * Seluruh pemberitahuan sistem melewati fungsi ini, jadi cukup di sini pula
 * pengiriman ke ponsel disambungkan — tidak perlu ditambahkan satu per satu
 * pada setiap kejadian, dan tidak ada kejadian yang terlewat.
 */
export async function notifyUsers(
  userIds: string[],
  n: { type: string; title: string; body: string; data?: any; kanal?: KanalPush }
) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data ?? undefined,
    })),
  });
  for (const id of unique) emitUser(id, WS_EVENTS.NOTIFICATION, n);

  // Pengiriman ke ponsel tidak boleh menahan jawaban permintaan, dan
  // kegagalannya tidak boleh menggagalkan tindakan yang memicunya.
  kirimPush(unique, {
    title: n.title,
    body: n.body,
    kanal: n.kanal ?? (n.type === 'PANIC' || n.type === 'DARURAT' ? 'darurat' : 'umum'),
    data: {
      type: n.type,
      ...(n.data && typeof n.data === 'object'
        ? Object.fromEntries(
            Object.entries(n.data as Record<string, unknown>)
              .filter(([, v]) => v !== null && v !== undefined)
              .map(([k, v]) => [k, String(v)])
          )
        : {}),
    },
  }).catch((e) => console.warn('[push]', e.message));
}

/** Notifikasi ke seluruh pengawas: admin, supervisor, super admin. */
export async function notifyCommand(
  n: { type: string; title: string; body: string; data?: any },
  siteId?: string | null
) {
  const supervisors = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] }, status: 'ACTIVE' },
    select: { id: true },
  });
  await notifyUsers(
    supervisors.map((s) => s.id),
    n
  );
  emitOps(WS_EVENTS.NOTIFICATION, n, siteId ?? undefined);
}

/** Perwakilan klien pemilik site — dipakai untuk sinyal darurat & insiden. */
export async function klienDariSite(siteId: string | null | undefined): Promise<string[]> {
  if (!siteId) return [];
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { clientId: true } });
  if (!site) return [];
  const users = await prisma.user.findMany({
    where: { role: 'CLIENT', clientId: site.clientId, status: 'ACTIVE' },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: any,
  ip?: string
) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? undefined, action, entity, entityId: entityId ?? undefined, meta, ip },
    });
  } catch (e: any) {
    console.warn('[audit] gagal:', e.message);
  }
}
