import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { putObject } from '../lib/storage';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime)|application\/pdf)$/;

router.post('/', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Berkas tidak ditemukan' });
  if (!ALLOWED.test(req.file.mimetype))
    return res.status(415).json({ message: 'Jenis berkas tidak didukung' });
  const folder = String(req.body?.folder || 'umum').replace(/[^a-z0-9-]/gi, '') || 'umum';
  const url = await putObject(folder, req.file.originalname, req.file.buffer, req.file.mimetype);
  res.status(201).json({ url, size: req.file.size, mimeType: req.file.mimetype });
});

router.post('/multi', auth, upload.array('files', 8), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) return res.status(400).json({ message: 'Berkas tidak ditemukan' });
  const folder = String(req.body?.folder || 'umum').replace(/[^a-z0-9-]/gi, '') || 'umum';
  const urls: string[] = [];
  for (const f of files) {
    if (!ALLOWED.test(f.mimetype)) continue;
    urls.push(await putObject(folder, f.originalname, f.buffer, f.mimetype));
  }
  res.status(201).json({ urls });
});

export default router;
