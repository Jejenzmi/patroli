import type { Request } from 'express';

/**
 * Pembatasan data per peran:
 * - CLIENT hanya melihat site milik perusahaannya
 * - GUARD hanya melihat datanya sendiri (ditangani per-route)
 */
export function siteWhere(req: Request) {
  const u = req.user!;
  if (u.role === 'CLIENT' && u.clientId) return { clientId: u.clientId };
  return {};
}

export function siteFilterFor(req: Request, siteId?: string) {
  const base: any = {};
  if (siteId) base.siteId = siteId;
  const u = req.user!;
  if (u.role === 'CLIENT' && u.clientId) base.site = { clientId: u.clientId };
  return base;
}

export function isCommand(req: Request) {
  return ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'].includes(req.user!.role);
}

export function parsePaging(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
