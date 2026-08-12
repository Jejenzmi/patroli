import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwt';

let io: SocketServer | null = null;

export function initWs(server: HttpServer) {
  io = new SocketServer(server, {
    path: '/socket.io',
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string) ||
      '';
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      (socket.data as any).user = payload;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket.data as any).user;
    socket.join(`user:${user.sub}`);
    socket.join(`role:${user.role}`);
    if (user.role !== 'GUARD') socket.join('command-center');

    socket.on('site:join', (siteId: string) => {
      if (typeof siteId === 'string') socket.join(`site:${siteId}`);
    });
    socket.on('site:leave', (siteId: string) => {
      if (typeof siteId === 'string') socket.leave(`site:${siteId}`);
    });
  });

  return io;
}

/** Siaran ke pusat komando + pemantau site terkait. */
export function emitOps(event: string, payload: unknown, siteId?: string | null) {
  if (!io) return;
  io.to('command-center').emit(event, payload);
  if (siteId) io.to(`site:${siteId}`).emit(event, payload);
}

export function emitUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
