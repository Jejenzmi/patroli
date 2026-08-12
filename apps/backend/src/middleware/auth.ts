import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../lib/jwt';
import type { Role } from '@patroli/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ message: 'Sesi tidak valid atau kedaluwarsa' });
  }
}

export function allow(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Belum masuk' });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: 'Hak akses tidak mencukupi' });
    next();
  };
}

/** Peran pengawas — boleh melihat & mengubah data operasional. */
export const COMMAND: Role[] = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'];
export const ADMIN_ONLY: Role[] = ['SUPER_ADMIN', 'ADMIN'];
