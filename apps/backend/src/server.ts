import 'dotenv/config';
import express from 'express';
// Express 4 tidak meneruskan Promise yang ditolak dari handler async ke middleware
// penanganan galat; tanpa patch ini satu galat Prisma bisa mematikan proses.
import 'express-async-errors';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { prisma } from './lib/prisma';
import { ensureBucket } from './lib/storage';
import { initWs } from './lib/ws';
import { redis } from './lib/redis';
import { mulaiPenjadwalRetensi } from './lib/retention';
import { mulaiPenjadwalKepatuhan } from './lib/kepatuhan';
import { wajahDiaktifkan } from './lib/face';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import masterRoutes from './routes/masters';
import scheduleRoutes from './routes/schedules';
import patrolRoutes from './routes/patrol';
import incidentRoutes from './routes/incidents';
import frontdeskRoutes from './routes/frontdesk';
import reportRoutes from './routes/reports';
import uploadRoutes from './routes/uploads';
import taskRoutes from './routes/tasks';
import kpiRoutes from './routes/kpi';
import payrollRoutes from './routes/payroll';
import billingRoutes from './routes/billing';
import financeRoutes from './routes/finance';
import complianceRoutes from './routes/compliance';
import reliefRoutes from './routes/relief';
import alarmSimRoutes from './routes/alarm-sim';

const app = express();
const PORT = Number(process.env.PORT || 5027);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Pembatas khusus pintu masuk agar tidak jadi sasaran tebak sandi.
app.use(
  '/api/auth/login',
  rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false })
);
app.use('/api', rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', async (_req, res) => {
  const db = await prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'down');
  const cache = await redis.ping().then(() => 'ok').catch(() => 'down');
  const face = wajahDiaktifkan()
    ? await fetch(`${process.env.FACE_SERVICE_URL}/health`)
        .then((r) => (r.ok ? 'ok' : 'down'))
        .catch(() => 'down')
    : 'nonaktif';
  res.json({ status: 'ok', service: 'patroli-api', db, cache, face, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/patrols', patrolRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/frontdesk', frontdeskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/relief', reliefRoutes);
// Tiruan papan relai sirene untuk peragaan dan pengujian; perangkat asli
// berada di jaringan lokal klien dan dipanggil lewat alamatnya sendiri.
app.use('/api/alarm-sim', alarmSimRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  if (err?.code === 'P2002')
    return res.status(409).json({ message: 'Data dengan kunci unik tersebut sudah ada' });
  if (err?.code === 'P2025') return res.status(404).json({ message: 'Data tidak ditemukan' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Ukuran berkas terlalu besar' });
  res.status(err?.status || 500).json({ message: err?.message || 'Terjadi kesalahan pada server' });
});

const server = http.createServer(app);
initWs(server);

async function bootstrap() {
  await ensureBucket().catch((e) => console.warn('[minio] bucket:', e.message));
  mulaiPenjadwalRetensi();
  mulaiPenjadwalKepatuhan();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`▸ DHARMAPATI API siap di :${PORT}`);
  });
}

bootstrap();

// Jaring pengaman terakhir: catat, jangan matikan layanan yang sedang melayani pos jaga.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
