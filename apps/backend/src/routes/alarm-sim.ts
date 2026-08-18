import { Router } from "express";
import { redis } from "../lib/redis";

/**
 * Tiruan papan relai sirene.
 *
 * Perangkat sungguhan berada di jaringan lokal klien dan tidak dapat dipanggil
 * dari sini. Tiruan ini memakai antarmuka yang sama persis dengan perangkat
 * nyata (HTTP GET bergaya Shelly maupun JSON), sehingga seluruh rangkaian —
 * tombol darurat, perutean divisi, sampai pembunyian sirene — dapat diuji dan
 * diperagakan sebelum perangkat terpasang. Saat perangkat asli datang, cukup
 * ganti alamatnya pada data sirene; tidak ada kode yang perlu diubah.
 */

const router = Router();
const KUNCI = (code: string) => `alarm:sim:${code}`;

/**
 * Tiruan hanya menjawab bila token yang disepakati ikut dikirim. Perangkat
 * relai sungguhan pun lazim memakai token sederhana seperti ini.
 */
const TOKEN = process.env.ALARM_SIM_TOKEN || 'sirene-uji';
router.use((req, res, next) => {
  const kiriman = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.query.token || '');
  if (kiriman !== TOKEN) return res.status(401).json({ message: 'Token perangkat tidak cocok' });
  next();
});

async function setState(code: string, state: string, reason: string) {
  const isi = JSON.stringify({ state, reason, at: new Date().toISOString() });
  try {
    await redis.set(KUNCI(code), isi, "EX", 7200);
  } catch {
    // Tiruan tetap menjawab walau Redis sedang tidak tersedia.
  }
  console.log(`[sirene ${code}] ${state} — ${reason}`);
  return JSON.parse(isi);
}

/** Gaya Shelly/Tasmota: GET /alarm-sim/SRN-01?turn=on */
router.get("/:code", async (req, res) => {
  const turn = String(req.query.turn || req.query.action || "on").toUpperCase();
  const state = turn === "OFF" ? "OFF" : "ON";
  res.json(await setState(req.params.code, state, String(req.query.reason || "-")));
});

/** Gaya perangkat berbasis JSON. */
router.post("/:code", async (req, res) => {
  const state = String(req.body?.action || "ON").toUpperCase() === "OFF" ? "OFF" : "ON";
  res.json(await setState(req.params.code, state, String(req.body?.reason || "-")));
});

/** Dipakai pengujian untuk memastikan sirene benar-benar berbunyi. */
router.get("/:code/state", async (req, res) => {
  try {
    const isi = await redis.get(KUNCI(req.params.code));
    return res.json(isi ? JSON.parse(isi) : { state: "UNKNOWN" });
  } catch {
    return res.json({ state: "UNKNOWN" });
  }
});

export default router;
