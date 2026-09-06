import { prisma } from "./prisma";
import { notifyUsers } from "./notify";

/**
 * Perutean keadaan darurat ke divisi penanggap.
 *
 * Satu jenis darurat dapat mengarah ke lebih dari satu divisi. Aturan khusus
 * site menimpa aturan umum: bila sebuah site punya klinik sendiri, kejadian
 * medis di site itu tidak lagi diteruskan ke klinik pusat.
 */

export const LABEL_DARURAT: Record<string, string> = {
  UMUM: "Bantuan umum",
  KEBAKARAN: "Kebakaran",
  KECELAKAAN: "Kecelakaan kerja",
  MEDIS: "Gawat medis",
  KRIMINAL: "Tindak kriminal",
  BENCANA: "Bencana alam",
  MAN_DOWN: "Anggota tidak bergerak",
};

export async function divisiUntuk(type: string, siteId: string) {
  const semua = await prisma.panicRoute.findMany({
    where: { type: type as any, OR: [{ siteId }, { siteId: null }] },
    include: {
      division: {
        include: { members: { where: { status: "ACTIVE" }, select: { id: true, name: true } } },
      },
    },
  });
  const khusus = semua.filter((r) => r.siteId === siteId);
  const dipakai = khusus.length ? khusus : semua;
  return dipakai.map((r) => r.division).filter((d) => d.isActive);
}

/** Memberi tahu seluruh anggota divisi penanggap dan mengembalikan ringkasannya. */
export async function beritahuDivisi(opsi: {
  type: string;
  siteId: string;
  isi: { type: string; title: string; body: string; data?: any };
}) {
  const divisi = await divisiUntuk(opsi.type, opsi.siteId);
  const penerima = [...new Set(divisi.flatMap((d) => d.members.map((m) => m.id)))];
  if (penerima.length) await notifyUsers(penerima, opsi.isi);
  return divisi.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    phone: d.phone,
    jumlahAnggota: d.members.length,
  }));
}
