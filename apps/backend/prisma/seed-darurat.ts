/**
 * Data awal keadaan darurat: divisi penanggap, perutean jenis darurat, dan
 * sirene tiang. Idempoten — dijalankan ulang tidak menggandakan apa pun, dan
 * sirene yang alamatnya sudah diarahkan ke perangkat asli tidak ditimpa.
 */
import { PrismaClient } from "@prisma/client";

// Klien sendiri, bukan meminjam dari src/: berkas sumber tidak ikut ke dalam
// image produksi, hanya hasil kompilasinya — dan seeder dijalankan lewat tsx
// langsung dari folder prisma.
const prisma = new PrismaClient();

const BASIS_SIM = process.env.ALARM_SIM_BASE || "http://localhost:5027/api/alarm-sim";
const TOKEN_SIM = process.env.ALARM_SIM_TOKEN || "sirene-uji";

const DIVISI = [
  { code: "DAMKAR", name: "Pemadam Kebakaran & Tanggap Api", phone: "113" },
  { code: "MEDIS", name: "Klinik & Pertolongan Pertama", phone: "119" },
  { code: "K3", name: "Keselamatan & Kesehatan Kerja", phone: "0800-1000-234" },
  { code: "SEKURITI", name: "Komando Sekuriti", phone: "110" },
  { code: "TANGGAP", name: "Tim Tanggap Bencana", phone: "129" },
];

const PERUTEAN: [string, string[]][] = [
  ["KEBAKARAN", ["DAMKAR", "K3", "SEKURITI"]],
  ["KECELAKAAN", ["K3", "MEDIS", "SEKURITI"]],
  ["MEDIS", ["MEDIS", "K3"]],
  ["KRIMINAL", ["SEKURITI"]],
  ["BENCANA", ["TANGGAP", "K3", "SEKURITI"]],
  ["UMUM", ["SEKURITI"]],
];

async function main() {
  // ── Divisi ──
  const petaDivisi = new Map<string, string>();
  for (const d of DIVISI) {
    const ada = await prisma.emergencyDivision.upsert({
      where: { code: d.code },
      update: { name: d.name, phone: d.phone },
      create: d,
    });
    petaDivisi.set(d.code, ada.id);
  }

  // Supervisor dimasukkan ke Komando Sekuriti agar pemberitahuan divisi
  // benar-benar sampai ke akun yang ada.
  const spv = await prisma.user.findMany({ where: { role: "SUPERVISOR" }, select: { id: true } });
  if (spv.length)
    await prisma.user.updateMany({
      where: { id: { in: spv.map((s) => s.id) }, divisionId: null },
      data: { divisionId: petaDivisi.get("SEKURITI") },
    });

  // ── Perutean jenis darurat → divisi ──
  let rute = 0;
  for (const [type, kode] of PERUTEAN) {
    for (const k of kode) {
      const divisionId = petaDivisi.get(k)!;
      const ada = await prisma.panicRoute.findFirst({ where: { type: type as any, divisionId, siteId: null } });
      if (!ada) {
        await prisma.panicRoute.create({ data: { type: type as any, divisionId } });
        rute++;
      }
    }
  }

  // ── Sirene tiang: satu di gerbang tiap site, satu per lantai ──
  //
  // Hanya dipasang bila tiruan papan relai memang dinyalakan. Di instans
  // produksi tiruannya mati, sehingga sirene contoh yang mengarah ke sana
  // hanya akan menjadi perangkat yang tombol ujinya selalu gagal. Sirene
  // sungguhan didaftarkan sendiri beserta alamat perangkatnya.
  const simAktif = !!process.env.ALARM_SIM_TOKEN && process.env.ALARM_SIM_TOKEN !== "sirene-uji";
  if (!simAktif && process.env.SEED_DEMO !== "true") {
    console.log("  · sirene contoh dilewati — daftarkan perangkat aslinya lewat halaman Darurat & Sirene");
    console.log("▸ selesai");
    return;
  }

  const sites = await prisma.site.findMany({ include: { floors: { orderBy: { level: "asc" } } } });
  let sirene = 0;
  for (const s of sites) {
    const kodeGerbang = `SRN-${s.code}-GATE`;
    if (!(await prisma.alarmDevice.findUnique({ where: { code: kodeGerbang } }))) {
      await prisma.alarmDevice.create({
        data: {
          siteId: s.id,
          code: kodeGerbang,
          name: `Sirene tiang gerbang ${s.name}`,
          location: "Tiang gerbang utama",
          lat: s.lat,
          lng: s.lng,
          driver: "HTTP_GET",
          endpointOn: `${BASIS_SIM}/${kodeGerbang}?turn=on&reason={reason}`,
          endpointOff: `${BASIS_SIM}/${kodeGerbang}?turn=off`,
          authToken: TOKEN_SIM,
          durationS: 90,
        },
      });
      sirene++;
    }

    for (const f of s.floors) {
      const kode = `SRN-${s.code}-L${f.level ?? 0}`;
      if (await prisma.alarmDevice.findUnique({ where: { code: kode } })) continue;
      await prisma.alarmDevice.create({
        data: {
          siteId: s.id,
          floorId: f.id,
          code: kode,
          name: `Pengeras suara ${f.name}`,
          location: f.name,
          driver: "HTTP_JSON",
          endpointOn: `${BASIS_SIM}/${kode}`,
          endpointOff: `${BASIS_SIM}/${kode}`,
          authToken: TOKEN_SIM,
          durationS: 60,
        },
      });
      sirene++;
    }
  }

  console.log(`▸ Divisi ${DIVISI.length}, perutean baru ${rute}, sirene baru ${sirene}.`);
}

main().finally(() => prisma.$disconnect());
