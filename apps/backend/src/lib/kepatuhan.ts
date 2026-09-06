import { prisma } from './prisma';
import { dayjs } from './time';
import { notifyCommand, notifyUsers } from './notify';

/**
 * Kepatuhan berkas personel.
 *
 * Dua hal yang dijaga: (1) berkas wajib tidak boleh mati tanpa ada yang tahu,
 * dan (2) personel dengan berkas mati tidak boleh dijadwalkan menjaga. Aturan
 * kedua itulah yang membedakan sistem ini dari sekadar arsip pemindaian.
 */

/** Berkas yang membuat seseorang sah bertugas sebagai satpam. */
export const DOKUMEN_WAJIB = ['KTA_POLRI', 'GADA_PRATAMA'] as const;

export const LABEL_DOKUMEN: Record<string, string> = {
  KTA_POLRI: 'KTA Polri',
  GADA_PRATAMA: 'Sertifikat Gada Pratama',
  GADA_MADYA: 'Sertifikat Gada Madya',
  GADA_UTAMA: 'Sertifikat Gada Utama',
  SKCK: 'SKCK',
  MCU: 'Hasil MCU',
  KTP: 'KTP',
  SIM_A: 'SIM A',
  SIM_C: 'SIM C',
  DAMKAR: 'Sertifikat Damkar',
  P3K: 'Sertifikat P3K',
  IJAZAH: 'Ijazah',
  SERTIFIKAT_LAIN: 'Sertifikat lain',
};

/** Ambang pengingat sebelum berkas kedaluwarsa. */
export const AMBANG_PERINGATAN = [90, 60, 30, 0];

export interface StatusBerkas {
  berlaku: boolean;
  kedaluwarsa: { type: string; expiresAt: Date | null }[];
  belumAda: string[];
}

/**
 * Memeriksa kelayakan satu personel untuk ditugaskan.
 * `belumAda` sengaja dipisah dari `kedaluwarsa`: berkas yang belum pernah
 * diunggah bukan pelanggaran yang sama dengan berkas yang sudah mati.
 */
export async function statusBerkas(guardId: string): Promise<StatusBerkas> {
  const berkas = await prisma.personnelDocument.findMany({
    where: { guardId, type: { in: DOKUMEN_WAJIB as unknown as any[] } },
    select: { type: true, expiresAt: true },
  });

  const sekarang = new Date();
  const kedaluwarsa = berkas
    .filter((b) => b.expiresAt && b.expiresAt < sekarang)
    .map((b) => ({ type: b.type as string, expiresAt: b.expiresAt }));
  const dimiliki = new Set(berkas.map((b) => b.type as string));
  const belumAda = DOKUMEN_WAJIB.filter((d) => !dimiliki.has(d));

  return { berlaku: kedaluwarsa.length === 0, kedaluwarsa, belumAda: [...belumAda] };
}

/** Apakah penjadwalan diblokir bila berkas wajib mati. Bawaan: ya. */
export async function blokirBerkasMati(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: 'kepatuhan.blokirBerkasMati' } });
  return (s?.value as any)?.aktif ?? true;
}

/**
 * Alasan penolakan penugasan, atau null bila boleh dijadwalkan.
 * Dipakai penjadwalan tunggal maupun massal.
 */
export async function alasanTidakBolehBertugas(guardId: string): Promise<string | null> {
  const orang = await prisma.user.findUnique({
    where: { id: guardId },
    select: { name: true, blacklisted: true, status: true },
  });
  if (!orang) return 'Personel tidak ditemukan';
  if (orang.blacklisted) return `${orang.name} berstatus daftar hitam dan tidak boleh ditugaskan`;
  if (orang.status !== 'ACTIVE') return `${orang.name} tidak berstatus aktif`;

  if (!(await blokirBerkasMati())) return null;

  const st = await statusBerkas(guardId);
  if (st.kedaluwarsa.length) {
    const daftar = st.kedaluwarsa
      .map((k) => `${LABEL_DOKUMEN[k.type] || k.type} (habis ${dayjs(k.expiresAt).format('DD MMM YYYY')})`)
      .join(', ');
    return `Berkas ${orang.name} sudah kedaluwarsa: ${daftar}`;
  }
  return null;
}

/**
 * Pemenuhan syarat kompetensi satu site pada satu tanggal.
 * Yang dihitung hanyalah personel yang benar-benar dijadwalkan hari itu.
 */
export async function periksaKompetensi(siteId: string, tanggal: Date) {
  const [syarat, jadwal] = await Promise.all([
    prisma.competencyRequirement.findMany({ where: { siteId } }),
    prisma.schedule.findMany({
      where: { siteId, date: tanggal },
      select: { guardId: true, shiftId: true, shift: { select: { name: true } } },
    }),
  ]);
  if (!syarat.length) return { syarat: [], hasil: [] as any[] };

  const guardIds = [...new Set(jadwal.map((j) => j.guardId))];
  const berkas = guardIds.length
    ? await prisma.personnelDocument.findMany({
        where: {
          guardId: { in: guardIds },
          type: { in: syarat.map((s) => s.docType) },
          OR: [{ expiresAt: null }, { expiresAt: { gte: tanggal } }],
        },
        select: { guardId: true, type: true },
      })
    : [];

  const punya = new Map<string, Set<string>>();
  berkas.forEach((b) => {
    const k = punya.get(b.type as string) || new Set<string>();
    k.add(b.guardId);
    punya.set(b.type as string, k);
  });

  const hasil = syarat.flatMap((s) => {
    const pemilik = punya.get(s.docType as string) || new Set<string>();
    if (!s.perShift) {
      const terpenuhi = jadwal.filter((j) => pemilik.has(j.guardId)).length;
      return [
        {
          docType: s.docType as string,
          label: LABEL_DOKUMEN[s.docType] || (s.docType as string),
          lingkup: 'SITE',
          shift: null as string | null,
          wajib: s.minCount,
          ada: terpenuhi,
          memenuhi: terpenuhi >= s.minCount,
        },
      ];
    }
    const perShift = new Map<string, { nama: string; ada: number }>();
    jadwal.forEach((j) => {
      const cur = perShift.get(j.shiftId) || { nama: j.shift?.name || 'Shift', ada: 0 };
      if (pemilik.has(j.guardId)) cur.ada += 1;
      perShift.set(j.shiftId, cur);
    });
    return [...perShift.entries()].map(([, v]) => ({
      docType: s.docType as string,
      label: LABEL_DOKUMEN[s.docType] || (s.docType as string),
      lingkup: 'SHIFT',
      shift: v.nama,
      wajib: s.minCount,
      ada: v.ada,
      memenuhi: v.ada >= s.minCount,
    }));
  });

  return { syarat, hasil };
}

/**
 * Pemeriksaan harian masa berlaku berkas dan kontrak kerja.
 * Pengingat dikirim sekali per ambang, bukan tiap hari, supaya notifikasi
 * tidak berubah menjadi kebisingan yang diabaikan.
 */
export async function periksaMasaBerlaku() {
  const hasil = { berkas: 0, kontrak: 0 };
  try {
    const batas = dayjs().add(90, 'day').endOf('day').toDate();
    const berkas = await prisma.personnelDocument.findMany({
      where: { expiresAt: { not: null, lte: batas } },
      include: { guard: { select: { id: true, name: true, status: true } } },
    });

    for (const b of berkas) {
      if (b.guard.status !== 'ACTIVE') continue;
      const sisa = dayjs(b.expiresAt).endOf('day').diff(dayjs().startOf('day'), 'day');
      // Ambang terbesar yang sudah terlampaui — 0 berarti sudah mati.
      const ambang = AMBANG_PERINGATAN.find((a) => sisa <= a);
      if (ambang === undefined) continue;
      if (b.lastAlertDays !== null && b.lastAlertDays !== undefined && b.lastAlertDays <= ambang) continue;

      const nama = LABEL_DOKUMEN[b.type] || b.type;
      const isi =
        sisa < 0
          ? `${nama} milik ${b.guard.name} sudah kedaluwarsa ${Math.abs(sisa)} hari lalu.`
          : `${nama} milik ${b.guard.name} berakhir dalam ${sisa} hari (${dayjs(b.expiresAt).format('DD MMM YYYY')}).`;

      await notifyCommand({
        type: 'BERKAS_KEDALUWARSA',
        title: sisa < 0 ? 'Berkas personel kedaluwarsa' : 'Berkas personel mendekati kedaluwarsa',
        body: isi,
        data: { documentId: b.id, guardId: b.guardId, sisaHari: sisa },
      });
      await notifyUsers([b.guardId], {
        type: 'BERKAS_KEDALUWARSA',
        title: sisa < 0 ? `${nama} Anda kedaluwarsa` : `${nama} Anda segera berakhir`,
        body:
          sisa < 0
            ? `Segera urus perpanjangan ${nama}. Selama berkas mati, Anda tidak dapat dijadwalkan bertugas.`
            : `${nama} berakhir ${dayjs(b.expiresAt).format('DD MMM YYYY')}. Urus perpanjangannya sebelum tanggal itu.`,
        data: { documentId: b.id },
      });

      await prisma.personnelDocument.update({ where: { id: b.id }, data: { lastAlertDays: ambang } });
      hasil.berkas += 1;
    }

    // Kontrak kerja yang berakhir dalam 30 hari.
    const kontrak = await prisma.employmentContract.findMany({
      where: {
        status: 'BERJALAN',
        endDate: { not: null, lte: dayjs().add(30, 'day').toDate(), gte: dayjs().subtract(1, 'day').toDate() },
      },
      include: { guard: { select: { name: true } } },
    });
    for (const k of kontrak) {
      await notifyCommand({
        type: 'PKWT_BERAKHIR',
        title: 'Perjanjian kerja mendekati akhir',
        body: `${k.type} ${k.number} atas nama ${k.guard.name} berakhir ${dayjs(k.endDate).format('DD MMM YYYY')}.`,
        data: { contractId: k.id },
      });
      hasil.kontrak += 1;
    }

    if (hasil.berkas || hasil.kontrak)
      console.log('▸ Kepatuhan: pengingat terkirim', JSON.stringify(hasil));
  } catch (e: any) {
    console.warn('[kepatuhan] gagal:', e.message);
  }
  return hasil;
}

/** Menjalankan pemeriksaan saat mulai lalu setiap 24 jam. */
export function mulaiPenjadwalKepatuhan() {
  const jalan = () => void periksaMasaBerlaku();
  setTimeout(jalan, 90_000);
  setInterval(jalan, 24 * 3600 * 1000);
  console.log('▸ Pengingat berkas aktif — ambang 90/60/30 hari dan saat kedaluwarsa');
}
