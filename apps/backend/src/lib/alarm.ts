import { prisma } from "./prisma";

/**
 * Sirene tiang (pengeras suara luar ruang).
 *
 * Perangkat di lapangan umumnya berupa papan relai yang dapat dipanggil lewat
 * jaringan lokal: Shelly dan Tasmota cukup dengan HTTP GET, perangkat berbasis
 * ESP32 buatan sendiri biasanya menerima JSON. Dua-duanya didukung tanpa
 * memaksa satu merek tertentu.
 *
 * Setiap perintah dicatat sebagai AlarmEvent — termasuk yang gagal — supaya
 * dapat dibuktikan bahwa alarm memang dibunyikan saat kejadian.
 */

const BATAS_WAKTU_MS = Number(process.env.ALARM_TIMEOUT_MS || 6000);

export interface HasilAlarm {
  deviceId: string;
  code: string;
  name: string;
  ok: boolean;
  detail: string;
  latencyMs: number;
}

function isiTemplat(url: string, ganti: Record<string, string>) {
  return url.replace(/\{(\w+)\}/g, (_, k) => ganti[k] ?? "");
}

async function kirimPerintah(
  perangkat: any,
  aksi: "ON" | "OFF",
  alasan: string
): Promise<{ ok: boolean; detail: string; latencyMs: number }> {
  const mulai = Date.now();
  const ganti = {
    action: aksi.toLowerCase(),
    duration: String(perangkat.durationS ?? 60),
    reason: alasan,
  };
  const alamat =
    aksi === "ON"
      ? perangkat.endpointOn
      : perangkat.endpointOff || perangkat.endpointOn;
  if (!alamat) return { ok: false, detail: "Alamat perangkat kosong", latencyMs: 0 };

  const kendali = new AbortController();
  const jam = setTimeout(() => kendali.abort(), BATAS_WAKTU_MS);
  try {
    const kepala: Record<string, string> = {};
    if (perangkat.authToken) kepala.Authorization = `Bearer ${perangkat.authToken}`;

    let r: Response;
    if (perangkat.driver === "HTTP_JSON") {
      kepala["Content-Type"] = "application/json";
      r = await fetch(isiTemplat(alamat, ganti), {
        method: "POST",
        headers: kepala,
        signal: kendali.signal,
        body: JSON.stringify({
          action: aksi,
          durationS: perangkat.durationS ?? 60,
          reason: alasan,
          code: perangkat.code,
        }),
      });
    } else {
      r = await fetch(isiTemplat(alamat, ganti), { headers: kepala, signal: kendali.signal });
    }
    const isi = (await r.text()).slice(0, 180);
    return {
      ok: r.ok,
      detail: r.ok ? isi || `HTTP ${r.status}` : `HTTP ${r.status}: ${isi}`,
      latencyMs: Date.now() - mulai,
    };
  } catch (e: any) {
    return {
      ok: false,
      detail: e.name === "AbortError" ? "Perangkat tidak menjawab (batas waktu)" : e.message,
      latencyMs: Date.now() - mulai,
    };
  } finally {
    clearTimeout(jam);
  }
}

/** Menyalakan atau mematikan sekumpulan sirene, lalu mencatat hasilnya. */
export async function jalankanAlarm(opsi: {
  perangkat: any[];
  aksi: "ON" | "OFF";
  alasan: string;
  panicId?: string | null;
  sumber?: "PANIC" | "MANUAL" | "UJI";
  olehId?: string | null;
}): Promise<HasilAlarm[]> {
  const hasil: HasilAlarm[] = [];
  await Promise.all(
    opsi.perangkat.map(async (d) => {
      const r = await kirimPerintah(d, opsi.aksi, opsi.alasan);
      hasil.push({ deviceId: d.id, code: d.code, name: d.name, ...r });
      await prisma.alarmEvent.create({
        data: {
          deviceId: d.id,
          panicId: opsi.panicId ?? null,
          action: opsi.aksi,
          source: opsi.sumber ?? "PANIC",
          ok: r.ok,
          detail: r.detail,
          latencyMs: r.latencyMs,
          triggeredById: opsi.olehId ?? null,
        },
      });
      await prisma.alarmDevice.update({
        where: { id: d.id },
        data: {
          lastState: r.ok ? opsi.aksi : d.lastState,
          lastSeenAt: r.ok ? new Date() : d.lastSeenAt,
        },
      });
    })
  );
  return hasil;
}

/**
 * Memilih sirene yang dibunyikan untuk satu kejadian.
 *
 * Bila lantai kejadian diketahui, sirene di lantai itu dibunyikan bersama
 * sirene yang tidak terikat lantai (biasanya yang di tiang luar). Bila tidak,
 * seluruh sirene site dibunyikan.
 */
export async function sireneUntukKejadian(siteId: string, floorId?: string | null) {
  return prisma.alarmDevice.findMany({
    where: {
      siteId,
      isActive: true,
      ...(floorId ? { OR: [{ floorId }, { floorId: null }] } : {}),
    },
    orderBy: { code: "asc" },
  });
}
