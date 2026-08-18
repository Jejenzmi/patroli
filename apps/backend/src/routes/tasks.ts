import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { auth, allow, COMMAND } from '../middleware/auth';
import { withSiteScope, bolehSite, isCommand } from '../lib/scope';
import { audit, notifyUsers } from '../lib/notify';
import { emitOps } from '../lib/ws';

const router = Router();
router.use(auth);

/* ═══════════════ TUGAS INSIDENTAL (FR-TASK-001, FR-TASK-002) ═══════════════ */

router.get('/', async (req, res) => {
  let where: any = {};
  if (req.query.siteId) where.siteId = String(req.query.siteId);
  if (req.query.status) where.status = String(req.query.status);
  // Anggota hanya melihat tugas yang ditujukan kepadanya.
  if (req.user!.role === 'GUARD') where.assigneeId = req.user!.sub;
  else where = await withSiteScope(req, where);

  const rows = await prisma.task.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: Math.min(300, Number(req.query.limit) || 100),
    include: {
      site: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true, employeeId: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  res.json(rows);
});

const taskSchema = z.object({
  siteId: z.string(),
  assigneeId: z.string(),
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  priority: z.enum(['RENDAH', 'NORMAL', 'TINGGI', 'MENDESAK']).optional(),
  dueAt: z.string().optional().nullable(),
});

router.post('/', allow(...COMMAND), async (req, res) => {
  const p = taskSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tugas belum lengkap', issues: p.error.issues });

  const t = await prisma.task.create({
    data: {
      ...(p.data as any),
      dueAt: p.data.dueAt ? new Date(p.data.dueAt) : null,
      createdById: req.user!.sub,
    },
    include: { assignee: { select: { id: true, name: true } }, site: { select: { id: true, name: true } } },
  });

  await notifyUsers([t.assigneeId], {
    type: 'TASK',
    title: t.priority === 'MENDESAK' ? '⚠ Tugas mendesak' : 'Tugas baru',
    body: `${t.title}${t.dueAt ? ` — tenggat ${new Date(t.dueAt).toLocaleString('id-ID')}` : ''}`,
    data: { taskId: t.id },
  });
  await audit(req.user!.sub, 'CREATE', 'Task', t.id, { priority: t.priority }, req.ip);
  emitOps('task:new', t, t.siteId);
  res.status(201).json(t);
});

/** Petugas memperbarui status dan hasil pekerjaannya. */
router.put('/:id', async (req, res) => {
  const schema = z.object({
    status: z.enum(['BARU', 'DIKERJAKAN', 'SELESAI', 'DIBATALKAN']).optional(),
    result: z.string().optional().nullable(),
    proofUrls: z.array(z.string()).optional(),
    priority: z.enum(['RENDAH', 'NORMAL', 'TINGGI', 'MENDESAK']).optional(),
    dueAt: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data tidak valid' });

  const t = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ message: 'Tugas tidak ditemukan' });
  if (!isCommand(req) && t.assigneeId !== req.user!.sub)
    return res.status(403).json({ message: 'Tugas ini bukan milik Anda' });
  // Petugas hanya boleh mengubah status dan hasil, bukan prioritas atau tenggat.
  if (!isCommand(req) && (p.data.priority || p.data.dueAt !== undefined))
    return res.status(403).json({ message: 'Prioritas dan tenggat hanya dapat diubah pengawas' });

  const data: any = { ...p.data };
  if (p.data.dueAt) data.dueAt = new Date(p.data.dueAt);
  if (p.data.status === 'DIKERJAKAN' && !t.startedAt) data.startedAt = new Date();
  if (p.data.status === 'SELESAI') data.finishedAt = new Date();

  const updated = await prisma.task.update({
    where: { id: t.id },
    data,
    include: { assignee: { select: { id: true, name: true } } },
  });

  if (p.data.status === 'SELESAI') {
    await notifyUsers([t.createdById], {
      type: 'TASK_DONE',
      title: 'Tugas diselesaikan',
      body: `${updated.assignee.name}: ${updated.title}`,
      data: { taskId: t.id },
    });
  }
  await audit(req.user!.sub, 'UPDATE', 'Task', t.id, data, req.ip);
  res.json(updated);
});

router.delete('/:id', allow(...COMMAND), async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  await audit(req.user!.sub, 'DELETE', 'Task', req.params.id, null, req.ip);
  res.json({ message: 'Tugas dihapus' });
});

/* ═══════════════ INSTRUKSI (FR-TASK-003, FR-TASK-004) ═══════════════ */

router.get('/instructions/list', async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { teamId: true, homeSiteId: true },
  });

  // Anggota menerima instruksi untuk regunya atau untuk site penempatannya.
  const where: any = isCommand(req)
    ? {}
    : {
        OR: [
          { teamId: me?.teamId ?? '-' },
          { AND: [{ teamId: null }, { siteId: me?.homeSiteId ?? '-' }] },
          { AND: [{ teamId: null }, { siteId: null }] },
        ],
      };

  const rows = await prisma.instruction.findMany({
    where,
    orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
    take: 60,
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      team: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      reads: { where: { userId: req.user!.sub }, select: { readAt: true } },
    },
  });

  res.json(
    rows.map((r) => ({ ...r, sudahDibaca: r.reads.length > 0, readAt: r.reads[0]?.readAt ?? null }))
  );
});

router.post('/instructions', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    title: z.string().min(3),
    body: z.string().min(3),
    siteId: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    urgent: z.boolean().optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Judul dan isi instruksi wajib diisi' });

  const ins = await prisma.instruction.create({
    data: { ...(p.data as any), senderId: req.user!.sub },
    include: { team: { select: { name: true } } },
  });

  // Penerima ditentukan dari regu bila diisi, selain itu dari site.
  const penerima = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { in: ['GUARD', 'SUPERVISOR'] },
      ...(p.data.teamId
        ? { teamId: p.data.teamId }
        : p.data.siteId
          ? { homeSiteId: p.data.siteId }
          : {}),
    },
    select: { id: true },
  });
  await notifyUsers(
    penerima.map((u) => u.id),
    {
      type: 'INSTRUCTION',
      title: ins.urgent ? '⚠ Instruksi mendesak' : 'Instruksi baru',
      body: ins.title,
      data: { instructionId: ins.id },
    }
  );
  await audit(req.user!.sub, 'CREATE', 'Instruction', ins.id, { urgent: ins.urgent }, req.ip);
  emitOps('instruction:new', ins, p.data.siteId ?? undefined);
  res.status(201).json({ ...ins, penerima: penerima.length });
});

/** Menandai instruksi telah dibaca. */
router.post('/instructions/:id/read', async (req, res) => {
  const r = await prisma.instructionRead.upsert({
    where: { instructionId_userId: { instructionId: req.params.id, userId: req.user!.sub } },
    create: { instructionId: req.params.id, userId: req.user!.sub },
    update: {},
  });
  res.json(r);
});

/** Siapa saja yang sudah membaca — untuk pengawas. */
router.get('/instructions/:id/reads', allow(...COMMAND), async (req, res) => {
  const rows = await prisma.instructionRead.findMany({
    where: { instructionId: req.params.id },
    include: { user: { select: { id: true, name: true, employeeId: true } } },
    orderBy: { readAt: 'asc' },
  });
  res.json(rows);
});

router.delete('/instructions/:id', allow(...COMMAND), async (req, res) => {
  await prisma.instruction.delete({ where: { id: req.params.id } });
  res.json({ message: 'Instruksi dihapus' });
});

/* ═══════════════ CUTI, IZIN, DAN LEMBUR ═══════════════ */

router.get('/leaves/list', async (req, res) => {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  if (!isCommand(req)) where.userId = req.user!.sub;

  const rows = await prisma.leaveRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: { select: { id: true, name: true, employeeId: true, avatarUrl: true } },
      approver: { select: { id: true, name: true } },
    },
  });
  res.json(rows);
});

router.post('/leaves', async (req, res) => {
  const schema = z.object({
    type: z.enum(['CUTI', 'IZIN', 'LEMBUR']),
    startDate: z.string(),
    endDate: z.string(),
    hours: z.number().optional().nullable(),
    reason: z.string().min(3),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Data pengajuan belum lengkap' });

  const l = await prisma.leaveRequest.create({
    data: {
      ...(p.data as any),
      startDate: new Date(p.data.startDate),
      endDate: new Date(p.data.endDate),
      userId: req.user!.sub,
    },
    include: { user: { select: { name: true } } },
  });
  const pengawas = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'] }, status: 'ACTIVE' },
    select: { id: true },
  });
  await notifyUsers(
    pengawas.map((u) => u.id),
    {
      type: 'LEAVE',
      title: `Pengajuan ${l.type.toLowerCase()}`,
      body: `${l.user.name}: ${l.reason}`,
      data: { leaveId: l.id },
    }
  );
  res.status(201).json(l);
});

router.post('/leaves/:id/decide', allow(...COMMAND), async (req, res) => {
  const schema = z.object({
    status: z.enum(['DISETUJUI', 'DITOLAK']),
    decisionNote: z.string().optional().nullable(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: 'Keputusan tidak valid' });

  const l = await prisma.leaveRequest.update({
    where: { id: req.params.id },
    data: {
      status: p.data.status,
      decisionNote: p.data.decisionNote ?? null,
      approverId: req.user!.sub,
      decidedAt: new Date(),
    },
  });
  await notifyUsers([l.userId], {
    type: 'LEAVE_DECISION',
    title: `Pengajuan ${l.type.toLowerCase()} ${p.data.status.toLowerCase()}`,
    body: p.data.decisionNote || 'Silakan periksa rincian pengajuan Anda.',
    data: { leaveId: l.id },
  });
  await audit(req.user!.sub, 'DECIDE', 'LeaveRequest', l.id, { status: l.status }, req.ip);
  res.json(l);
});

export default router;
