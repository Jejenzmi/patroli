import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { auth } from '../middleware/auth';
import { audit } from '../lib/notify';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(4),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Nama pengguna dan kata sandi wajib diisi' });
  const { username, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() },
        { employeeId: username.toUpperCase() },
      ],
    },
    include: { homeSite: { select: { id: true, name: true, code: true } } },
  });
  if (!user) return res.status(401).json({ message: 'Akun tidak ditemukan' });
  if (user.status !== 'ACTIVE')
    return res.status(403).json({ message: 'Akun tidak aktif. Hubungi administrator.' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Kata sandi salah' });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
    clientId: user.clientId,
  });
  await audit(user.id, 'LOGIN', 'User', user.id, null, req.ip);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      employeeId: user.employeeId,
      role: user.role,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      rank: user.rank,
      clientId: user.clientId,
      homeSite: user.homeSite,
    },
  });
});

router.get('/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    include: {
      homeSite: { select: { id: true, name: true, code: true, lat: true, lng: true, radiusM: true } },
      client: { select: { id: true, name: true } },
    },
  });
  if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
  const { passwordHash, ...safe } = user as any;
  res.json(safe);
});

router.post('/change-password', auth, async (req, res) => {
  const schema = z.object({ oldPassword: z.string(), newPassword: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Kata sandi baru minimal 6 karakter' });
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
  if (!(await bcrypt.compare(parsed.data.oldPassword, user.passwordHash)))
    return res.status(400).json({ message: 'Kata sandi lama salah' });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  await audit(user.id, 'CHANGE_PASSWORD', 'User', user.id, null, req.ip);
  res.json({ message: 'Kata sandi berhasil diperbarui' });
});

router.post('/device-token', auth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user!.sub },
    data: { deviceToken: String(req.body?.token || '') },
  });
  res.json({ ok: true });
});

export default router;
