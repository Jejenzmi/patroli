import { Client } from 'minio';
import crypto from 'crypto';

const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = Number(process.env.MINIO_PORT || 9000);
const useSSL = process.env.MINIO_USE_SSL === 'true';

export const BUCKET = process.env.MINIO_BUCKET || 'patroli';

export const minio = new Client({
  endPoint,
  port,
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

/** Basis URL publik yang dilayani nginx (mis. https://dashboard.dharmapati.co.id/storage). */
const PUBLIC_BASE = process.env.STORAGE_PUBLIC_URL || '/storage';

export async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minio.makeBucket(BUCKET, 'us-east-1');
  }
  // Objek foto patroli/insiden dibaca langsung oleh browser & aplikasi.
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };
  await minio.setBucketPolicy(BUCKET, JSON.stringify(policy)).catch((e) => {
    console.warn('[minio] gagal set policy:', e.message);
  });
}

export async function putObject(
  folder: string,
  originalName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
  const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto
    .randomBytes(12)
    .toString('hex')}.${ext}`;
  await minio.putObject(BUCKET, key, buffer, buffer.length, { 'Content-Type': mimeType });
  return `${PUBLIC_BASE}/${key}`;
}
