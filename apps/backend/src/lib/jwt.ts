import jwt from 'jsonwebtoken';
import type { Role } from '@patroli/shared';

export const JWT_SECRET = process.env.JWT_SECRET || 'patroli-dev-secret-change-me';
const EXPIRES = process.env.JWT_EXPIRES || '30d';

export interface TokenPayload {
  sub: string;
  role: Role;
  name: string;
  username: string;
  clientId: string | null;
}

export function signToken(p: TokenPayload) {
  return jwt.sign(p, JWT_SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
