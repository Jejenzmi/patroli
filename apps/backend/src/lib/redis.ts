import Redis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(url, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

redis.on('error', (e) => console.error('[redis]', e.message));

/** Posisi terakhir setiap anggota disimpan di Redis (TTL 1 jam) agar peta live cepat. */
const PRESENCE_KEY = 'patroli:presence';

export interface Presence {
  guardId: string;
  name: string;
  siteId: string | null;
  lat: number;
  lng: number;
  batteryPct?: number | null;
  speedKph?: number | null;
  sessionId?: string | null;
  at: string;
}

export async function setPresence(p: Presence) {
  await redis.hset(PRESENCE_KEY, p.guardId, JSON.stringify(p));
  await redis.expire(PRESENCE_KEY, 3600);
}

export async function getPresence(): Promise<Presence[]> {
  const raw = await redis.hgetall(PRESENCE_KEY);
  const cutoff = Date.now() - 30 * 60 * 1000;
  return Object.values(raw)
    .map((v) => {
      try {
        return JSON.parse(v) as Presence;
      } catch {
        return null;
      }
    })
    .filter((p): p is Presence => !!p && new Date(p.at).getTime() > cutoff);
}

/** Cache sederhana untuk agregasi dasbor. */
export async function cached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    /* cache miss tidak boleh menggagalkan request */
  }
  const value = await fn();
  try {
    await redis.setex(key, ttlSec, JSON.stringify(value));
  } catch {
    /* abaikan */
  }
  return value;
}

export async function invalidate(prefix: string) {
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* abaikan */
  }
}
