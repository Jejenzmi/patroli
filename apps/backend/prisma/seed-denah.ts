/**
 * Memasang denah contoh pada lantai yang belum punya gambar, lalu menaruh
 * titik patroli di atasnya (FR-SITE/FR-GPS-003).
 *
 * Bersifat idempoten: lantai yang sudah punya denah tidak disentuh, sehingga
 * denah asli dari klien tidak akan tertimpa.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { putObject } from "../src/lib/storage";

const BERKAS = ["denah-lantai-1.png", "denah-lantai-2.png", "denah-lantai-3.png"];

async function main() {
  const lantai = await prisma.floor.findMany({
    where: { planUrl: null },
    orderBy: [{ siteId: "asc" }, { level: "asc" }],
    include: { checkpoints: { where: { isActive: true } } },
  });
  if (!lantai.length) {
    console.log("▸ Semua lantai sudah memiliki denah — tidak ada yang diubah.");
    return;
  }

  let dipasang = 0;
  let ditempatkan = 0;

  for (const [i, f] of lantai.entries()) {
    const nama = BERKAS[f.level ? (f.level - 1) % BERKAS.length : i % BERKAS.length];
    const jalur = path.join(__dirname, "assets", nama);
    if (!fs.existsSync(jalur)) continue;

    const url = await putObject("denah", nama, fs.readFileSync(jalur), "image/png");
    await prisma.floor.update({ where: { id: f.id }, data: { planUrl: url } });
    dipasang++;

    // Titik disebar merata pada tiga baris supaya tidak menumpuk di satu sudut.
    const belum = f.checkpoints.filter((c) => c.planX === null || c.planY === null);
    for (const [j, c] of belum.entries()) {
      const kolom = belum.length <= 1 ? 1 : Math.ceil(belum.length / 3);
      const x = 15 + ((j % kolom) * 70) / Math.max(1, kolom - 1 || 1);
      const y = 22 + Math.floor(j / kolom) * 28;
      await prisma.checkpoint.update({
        where: { id: c.id },
        data: { planX: Math.min(92, x), planY: Math.min(88, y) },
      });
      ditempatkan++;
    }
  }

  console.log(`▸ Denah dipasang pada ${dipasang} lantai, ${ditempatkan} titik ditempatkan.`);
}

main().finally(() => prisma.$disconnect());
