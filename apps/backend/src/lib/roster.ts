import { prisma } from './prisma';
import { dayjs, TZ, dateKey } from './time';
import { haversineMeters } from '@patroli/shared';
import { DOKUMEN_WAJIB, blokirBerkasMati } from './kepatuhan';

/**
 * Pagar jam kerja dan mesin pencari pengganti.
 *
 * Dua hal yang dijaga bersamaan: pos tidak boleh kosong, tetapi mengisinya
 * dengan orang yang sudah jaga tujuh hari berturut-turut hanya memindahkan
 * masalah menjadi kecelakaan kerja.
 */

export interface KonfigKelelahan {
  /** Jumlah hari jaga berturut-turut yang masih diizinkan */
  maksHariBerturut: number;
  /** Batas jam kerja terjadwal dalam sepekan */
  maksJamPekan: number;
  /** Jeda minimal antar shift (jam) */
  minJedaJam: number;
  /** Bila mati, pelanggaran hanya menjadi peringatan, bukan penolakan */
  tegakkan: boolean;
}

export const KELELAHAN_BAWAAN: KonfigKelelahan = {
  maksHariBerturut: 6,
  maksJamPekan: 60,
  minJedaJam: 8,
  tegakkan: true,
};

export async function konfigKelelahan(): Promise<KonfigKelelahan> {
  const s = await prisma.setting.findUnique({ where: { key: 'roster.kelelahan' } });
  return { ...KELELAHAN_BAWAAN, ...((s?.value as any) || {}) };
}

/** Lama satu shift dalam jam, memperhitungkan shift yang melewati tengah malam. */
export function jamShift(shift: { startTime: string; endTime: string; crossesMidnight: boolean }) {
  const [h1, m1] = shift.startTime.split(':').map(Number);
  const [h2, m2] = shift.endTime.split(':').map(Number);
  let menit = h2 * 60 + m2 - (h1 * 60 + m1);
  if (menit <= 0 || shift.crossesMidnight) menit += 24 * 60;
  return menit / 60;
}

export interface PelanggaranKelelahan {
  jenis: 'HARI_BERTURUT' | 'JAM_PEKAN' | 'JEDA_SHIFT';
  pesan: string;
}

/**
 * Memeriksa apakah menambahkan satu penugasan melanggar pagar jam kerja.
 * Mengembalikan daftar pelanggaran; kosong berarti aman.
 */
export interface JadwalRingkas {
  date: Date;
  shift: { startTime: string; endTime: string; crossesMidnight: boolean };
}

/**
 * Inti penilaian, tanpa menyentuh basis data.
 *
 * Dipisah supaya pencarian calon pengganti dapat menilai puluhan orang dari
 * satu kali pengambilan jadwal, bukan dua kueri per orang.
 */
export function nilaiKelelahan(
  jadwal: JadwalRingkas[],
  shift: { startTime: string; endTime: string; crossesMidnight: boolean },
  tanggal: Date,
  k: KonfigKelelahan
): PelanggaranKelelahan[] {
  const hasil: PelanggaranKelelahan[] = [];

  const kunci = dayjs(tanggal).format('YYYY-MM-DD');
  const terpakai = new Set(jadwal.map((j) => dayjs(j.date).format('YYYY-MM-DD')));
  terpakai.add(kunci);

  // 1. Hari jaga berturut-turut, dihitung dari tanggal yang diminta ke belakang
  //    lalu ke depan agar penyisipan di tengah rantai ikut ketahuan.
  let berturut = 1;
  for (let i = 1; i <= k.maksHariBerturut + 1; i++) {
    if (terpakai.has(dayjs(tanggal).subtract(i, 'day').format('YYYY-MM-DD'))) berturut++;
    else break;
  }
  for (let i = 1; i <= k.maksHariBerturut + 1; i++) {
    if (terpakai.has(dayjs(tanggal).add(i, 'day').format('YYYY-MM-DD'))) berturut++;
    else break;
  }
  if (berturut > k.maksHariBerturut)
    hasil.push({
      jenis: 'HARI_BERTURUT',
      pesan: `Menjadi ${berturut} hari jaga berturut-turut, melewati batas ${k.maksHariBerturut} hari`,
    });

  // 2. Jam terjadwal dalam pekan yang sama (Senin–Minggu).
  const awalPekan = dayjs(tanggal).tz(TZ).startOf('isoWeek');
  const akhirPekan = awalPekan.add(7, 'day');
  const jamPekan =
    jadwal
      .filter((j) => {
        const t = dayjs(j.date);
        return !t.isBefore(awalPekan) && t.isBefore(akhirPekan);
      })
      .reduce((a, j) => a + jamShift(j.shift), 0) + jamShift(shift);
  if (jamPekan > k.maksJamPekan)
    hasil.push({
      jenis: 'JAM_PEKAN',
      pesan: `Total ${Math.round(jamPekan)} jam sepekan, melewati batas ${k.maksJamPekan} jam`,
    });

  // 3. Jeda dengan shift sehari sebelum dan sesudahnya.
  const mulaiBaru = dayjs.tz(`${kunci} ${shift.startTime}`, TZ);
  const selesaiBaru = mulaiBaru.add(jamShift(shift), 'hour');
  for (const j of jadwal) {
    const hari = dayjs(j.date).format('YYYY-MM-DD');
    if (hari === kunci) continue;
    const mulaiLama = dayjs.tz(`${hari} ${j.shift.startTime}`, TZ);
    const selesaiLama = mulaiLama.add(jamShift(j.shift), 'hour');
    const jeda = Math.min(
      Math.abs(mulaiBaru.diff(selesaiLama, 'minute')) / 60,
      Math.abs(mulaiLama.diff(selesaiBaru, 'minute')) / 60
    );
    // Hanya shift yang berdempetan yang relevan.
    if (Math.abs(mulaiLama.diff(mulaiBaru, 'hour')) <= 36 && jeda < k.minJedaJam) {
      hasil.push({
        jenis: 'JEDA_SHIFT',
        pesan: `Jeda hanya ${jeda.toFixed(1)} jam dari shift ${hari}, minimal ${k.minJedaJam} jam`,
      });
      break;
    }
  }

  return hasil;
}

/** Memeriksa satu rencana penugasan; mengambil sendiri data yang diperlukan. */
export async function periksaKelelahan(
  guardId: string,
  shiftId: string,
  tanggal: Date,
  konfig?: KonfigKelelahan
): Promise<PelanggaranKelelahan[]> {
  const k = konfig ?? (await konfigKelelahan());
  const [jadwal, shift] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        guardId,
        date: {
          gte: dayjs(tanggal).subtract(k.maksHariBerturut + 1, 'day').toDate(),
          lte: dayjs(tanggal).add(k.maksHariBerturut + 1, 'day').toDate(),
        },
        status: { not: 'SWAPPED' },
      },
      include: { shift: { select: { startTime: true, endTime: true, crossesMidnight: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.shift.findUnique({
      where: { id: shiftId },
      select: { startTime: true, endTime: true, crossesMidnight: true },
    }),
  ]);
  if (!shift) return [];
  return nilaiKelelahan(jadwal, shift, tanggal, k);
}

export interface Calon {
  guardId: string;
  name: string;
  employeeId: string | null;
  avatarUrl: string | null;
  homeSite: string | null;
  score: number;
  distanceM: number | null;
  reasons: { faktor: string; nilai: number; catatan: string }[];
}

/**
 * Mencari personel yang paling layak mengisi satu shift kosong.
 *
 * Penilaian sengaja disimpan per faktor, bukan hanya angka akhir: komandan
 * regu harus dapat melihat mengapa seseorang direkomendasikan.
 */
export async function calonPengganti(
  siteId: string,
  shiftId: string,
  tanggal: Date,
  batas = 10
): Promise<Calon[]> {
  const k = await konfigKelelahan();

  const [site, syarat, kandidat, jadwalHariItu] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { lat: true, lng: true, name: true } }),
    prisma.competencyRequirement.findMany({ where: { siteId }, select: { docType: true } }),
    prisma.user.findMany({
      where: { role: { in: ['GUARD', 'SUPERVISOR'] }, status: 'ACTIVE', blacklisted: false },
      select: {
        id: true,
        name: true,
        employeeId: true,
        avatarUrl: true,
        homeSiteId: true,
        homeSite: { select: { name: true, lat: true, lng: true } },
      },
    }),
    prisma.schedule.findMany({ where: { date: tanggal }, select: { guardId: true, siteId: true } }),
  ]);
  if (!site) return [];

  const sudahDijadwalkan = new Set(jadwalHariItu.map((j) => j.guardId));
  const ids = kandidat.map((c) => c.id);

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { startTime: true, endTime: true, crossesMidnight: true },
  });

  const [cuti, berkas, riwayat, bebanPekan, berkasWajib, jadwalSekitar] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: ids },
        status: 'DISETUJUI',
        type: { in: ['CUTI', 'IZIN'] },
        startDate: { lte: tanggal },
        endDate: { gte: tanggal },
      },
      select: { userId: true },
    }),
    syarat.length
      ? prisma.personnelDocument.findMany({
          where: {
            guardId: { in: ids },
            type: { in: syarat.map((s) => s.docType) },
            OR: [{ expiresAt: null }, { expiresAt: { gte: tanggal } }],
          },
          select: { guardId: true, type: true },
        })
      : Promise.resolve([] as { guardId: string; type: any }[]),
    prisma.attendance.groupBy({
      by: ['guardId'],
      where: { guardId: { in: ids }, siteId, checkInAt: { gte: dayjs(tanggal).subtract(90, 'day').toDate() } },
      _count: { _all: true },
    }),
    prisma.schedule.groupBy({
      by: ['guardId'],
      where: {
        guardId: { in: ids },
        date: {
          gte: dayjs(tanggal).tz(TZ).startOf('isoWeek').toDate(),
          lt: dayjs(tanggal).tz(TZ).startOf('isoWeek').add(7, 'day').toDate(),
        },
      },
      _count: { _all: true },
    }),
    // Berkas wajib seluruh calon diambil sekali; menanyakannya satu per satu
    // membuat pencarian calon menembak basis data ratusan kali.
    prisma.personnelDocument.findMany({
      where: { guardId: { in: ids }, type: { in: DOKUMEN_WAJIB as unknown as any[] } },
      select: { guardId: true, type: true, expiresAt: true },
    }),
    prisma.schedule.findMany({
      where: {
        guardId: { in: ids },
        date: {
          gte: dayjs(tanggal).subtract(k.maksHariBerturut + 1, 'day').toDate(),
          lte: dayjs(tanggal).add(k.maksHariBerturut + 1, 'day').toDate(),
        },
        status: { not: 'SWAPPED' },
      },
      select: {
        guardId: true,
        date: true,
        shift: { select: { startTime: true, endTime: true, crossesMidnight: true } },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  const sedangCuti = new Set(cuti.map((c) => c.userId));
  const punyaSertifikat = new Map<string, number>();
  berkas.forEach((b) => punyaSertifikat.set(b.guardId, (punyaSertifikat.get(b.guardId) || 0) + 1));
  const pernahDiSite = new Map(riwayat.map((r) => [r.guardId, r._count._all]));
  const beban = new Map(bebanPekan.map((b) => [b.guardId, b._count._all]));

  // Berkas wajib yang sudah mati menggugurkan calon — dihitung dari satu
  // pengambilan data, bukan satu kueri per orang.
  const sekarang = new Date();
  const berkasMati = new Set(
    berkasWajib.filter((b) => b.expiresAt && b.expiresAt < sekarang).map((b) => b.guardId)
  );
  const tegakkanBerkas = await blokirBerkasMati();

  const jadwalPer = new Map<string, JadwalRingkas[]>();
  jadwalSekitar.forEach((j) =>
    jadwalPer.set(j.guardId, [...(jadwalPer.get(j.guardId) || []), { date: j.date, shift: j.shift }])
  );

  const hasil: Calon[] = [];

  for (const c of kandidat) {
    if (sudahDijadwalkan.has(c.id) || sedangCuti.has(c.id)) continue;
    if (tegakkanBerkas && berkasMati.has(c.id)) continue;
    const pelanggaran = shift
      ? nilaiKelelahan(jadwalPer.get(c.id) || [], shift, tanggal, k)
      : [];
    if (pelanggaran.length && k.tegakkan) continue;

    const reasons: { faktor: string; nilai: number; catatan: string }[] = [];
    let skor = 0;

    // Jarak dari penempatan utama — makin dekat makin mudah dijangkau.
    let jarak: number | null = null;
    if (c.homeSite?.lat != null && c.homeSite?.lng != null) {
      jarak = Math.round(haversineMeters(c.homeSite.lat, c.homeSite.lng, site.lat, site.lng));
      const nilai = jarak <= 3000 ? 30 : jarak <= 10000 ? 22 : jarak <= 25000 ? 14 : jarak <= 50000 ? 6 : 0;
      skor += nilai;
      reasons.push({
        faktor: 'Jarak',
        nilai,
        catatan: jarak < 1000 ? 'penempatan di site yang sama' : `${(jarak / 1000).toFixed(1)} km dari penempatan`,
      });
    }

    // Kompetensi yang dituntut site.
    if (syarat.length) {
      const punya = punyaSertifikat.get(c.id) || 0;
      const nilai = Math.round((punya / syarat.length) * 25);
      skor += nilai;
      reasons.push({
        faktor: 'Kompetensi',
        nilai,
        catatan: `${punya} dari ${syarat.length} sertifikat yang disyaratkan site`,
      });
    }

    // Pengenalan medan.
    const kali = pernahDiSite.get(c.id) || 0;
    const nilaiMedan = kali >= 10 ? 20 : kali >= 3 ? 14 : kali > 0 ? 8 : 0;
    skor += nilaiMedan;
    reasons.push({
      faktor: 'Pengenalan medan',
      nilai: nilaiMedan,
      catatan: kali ? `${kali} kali bertugas di ${site.name} dalam 90 hari` : 'belum pernah bertugas di site ini',
    });

    // Beban pekan berjalan — yang paling longgar didahulukan.
    const shiftPekan = beban.get(c.id) || 0;
    const nilaiBeban = shiftPekan <= 2 ? 25 : shiftPekan <= 4 ? 18 : shiftPekan <= 5 ? 10 : 4;
    skor += nilaiBeban;
    reasons.push({
      faktor: 'Beban pekan ini',
      nilai: nilaiBeban,
      catatan: `${shiftPekan} shift terjadwal pekan ini`,
    });

    if (pelanggaran.length)
      reasons.push({ faktor: 'Peringatan jam kerja', nilai: 0, catatan: pelanggaran.map((p) => p.pesan).join('; ') });

    hasil.push({
      guardId: c.id,
      name: c.name,
      employeeId: c.employeeId,
      avatarUrl: c.avatarUrl,
      homeSite: c.homeSite?.name || null,
      score: skor,
      distanceM: jarak,
      reasons,
    });
  }

  hasil.sort((a, b) => b.score - a.score);
  return hasil.slice(0, batas);
}

/**
 * Pos yang tidak terisi pada satu tanggal, dibandingkan manning table kontrak.
 * Nilai potongan tagihan ikut dihitung agar besarnya kerugian langsung terlihat.
 */
export async function posKosong(tanggal: Date, siteId?: string) {
  const hariPeriode = dayjs(tanggal).daysInMonth();

  const [pos, jadwal] = await Promise.all([
    prisma.contractPost.findMany({
      where: { ...(siteId ? { siteId } : {}), contract: { status: 'AKTIF' } },
      include: {
        site: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        contract: { select: { id: true, number: true, client: { select: { name: true } } } },
      },
    }),
    prisma.schedule.findMany({
      where: { date: tanggal, ...(siteId ? { siteId } : {}), status: { not: 'SWAPPED' } },
      select: { siteId: true, shiftId: true, guardId: true },
    }),
  ]);

  const terisi = new Map<string, number>();
  const terisiSite = new Map<string, number>();
  jadwal.forEach((j) => {
    terisi.set(`${j.siteId}|${j.shiftId}`, (terisi.get(`${j.siteId}|${j.shiftId}`) || 0) + 1);
    terisiSite.set(j.siteId, (terisiSite.get(j.siteId) || 0) + 1);
  });

  // Urutan sama dengan rekonsiliasi tagihan: pos bershift lebih dulu.
  const terpakai = new Map<string, number>();
  const urutan = [...pos].sort((a, b) => (a.shiftId ? 0 : 1) - (b.shiftId ? 0 : 1));

  const baris = urutan.map((p) => {
    const isi = p.shiftId
      ? Math.min(p.headcount, terisi.get(`${p.siteId}|${p.shiftId}`) || 0)
      : Math.min(p.headcount, Math.max(0, (terisiSite.get(p.siteId) || 0) - (terpakai.get(p.siteId) || 0)));
    terpakai.set(p.siteId, (terpakai.get(p.siteId) || 0) + isi);
    const kurang = Math.max(0, p.headcount - isi);
    return {
      postId: p.id,
      siteId: p.siteId,
      siteName: p.site.name,
      clientName: p.contract.client.name,
      contractNumber: p.contract.number,
      shiftId: p.shiftId,
      shiftName: p.shift?.name || 'Semua shift',
      positionName: p.positionName,
      wajib: p.headcount,
      terisi: isi,
      kurang,
      /// Potongan tagihan bila pos ini dibiarkan kosong sehari penuh
      potongan: Math.round((p.ratePerPerson / hariPeriode) * kurang),
    };
  });

  const kosong = baris.filter((b) => b.kurang > 0);
  return {
    tanggal,
    total: baris.length,
    posKosong: kosong.length,
    orangKurang: kosong.reduce((a, b) => a + b.kurang, 0),
    potonganHariIni: kosong.reduce((a, b) => a + b.potongan, 0),
    baris: [...kosong, ...baris.filter((b) => b.kurang === 0)],
  };
}

export { dateKey };
