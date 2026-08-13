import type { Request } from 'express';
import { prisma } from './prisma';

/**
 * Pembatasan data per peran.
 *
 * - SUPER_ADMIN / ADMIN / SUPERVISOR : seluruh site
 * - CLIENT                           : hanya site milik perusahaannya
 * - GUARD                            : hanya site penempatan & site yang dijadwalkan untuknya,
 *                                      serta hanya catatan miliknya sendiri
 */

export const PERAN_KOMANDO = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'];

export function isCommand(req: Request) {
  return PERAN_KOMANDO.includes(req.user!.role);
}

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

export function parsePaging(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Daftar site yang boleh dilihat pengguna. `null` berarti tanpa batas.
 * Hasilnya di-cache pada objek request agar satu permintaan hanya sekali menanya basis data.
 */
export async function allowedSiteIds(req: Request): Promise<string[] | null> {
  const u = req.user!;
  if (isCommand(req)) return null;

  const cache = (req as any)._siteIds;
  if (cache !== undefined) return cache;

  let ids: string[] = [];

  if (u.role === 'CLIENT') {
    const sites = await prisma.site.findMany({
      where: { clientId: u.clientId ?? '-' },
      select: { id: true },
    });
    ids = sites.map((s) => s.id);
  } else if (u.role === 'GUARD') {
    const [me, jadwal] = await Promise.all([
      prisma.user.findUnique({ where: { id: u.sub }, select: { homeSiteId: true } }),
      prisma.schedule.findMany({
        where: { guardId: u.sub },
        select: { siteId: true },
        distinct: ['siteId'],
        take: 50,
      }),
    ]);
    ids = [...new Set([me?.homeSiteId, ...jadwal.map((j) => j.siteId)].filter(Boolean) as string[])];
  }

  (req as any)._siteIds = ids;
  return ids;
}

/** Menyisipkan batasan site pada klausa `where` Prisma bila peran memerlukannya. */
export async function withSiteScope(req: Request, where: any = {}, kolom = 'siteId') {
  const ids = await allowedSiteIds(req);
  if (ids === null) return where;
  const diminta = where[kolom];
  if (typeof diminta === 'string') {
    // Site yang diminta harus termasuk yang boleh dilihat.
    return ids.includes(diminta) ? where : { ...where, [kolom]: '-tidak-boleh-' };
  }
  return { ...where, [kolom]: { in: ids.length ? ids : ['-tidak-boleh-'] } };
}

/** Memastikan satu site boleh diakses pengguna. */
export async function bolehSite(req: Request, siteId: string | null | undefined) {
  if (!siteId) return false;
  const ids = await allowedSiteIds(req);
  return ids === null || ids.includes(siteId);
}
