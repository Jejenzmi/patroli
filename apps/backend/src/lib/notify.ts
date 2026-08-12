import { prisma } from './prisma';
import { emitOps, emitUser } from './ws';
import { WS_EVENTS } from '@patroli/shared';

/** Simpan notifikasi ke DB lalu dorong lewat WebSocket. */
export async function notifyUsers(
  userIds: string[],
  n: { type: string; title: string; body: string; data?: any }
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
