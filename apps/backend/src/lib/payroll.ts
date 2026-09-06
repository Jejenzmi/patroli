import { prisma } from './prisma';
import { dayjs, TZ } from './time';
import { rp, persen, type BarisUang, jumlahBaris } from './uang';
import { pph21Bulanan, pph21Desember, kategoriTer } from './pajak';

/**
 * Mesin penggajian.
 *
 * Sumber angkanya adalah data operasional yang sudah dikumpulkan sistem:
 * roster (Schedule), presensi bergeofence (Attendance), dan pengajuan lembur
 * yang disetujui (LeaveRequest bertipe LEMBUR). Tidak ada entri manual kecuali
 * kasbon dan penyesuaian yang dicatat sebagai baris tersendiri.
 */

export interface KonfigBpjs {
  /** Iuran ditanggung perusahaan (%) */
  jkm: number;
  jhtPerusahaan: number;
  jpPerusahaan: number;
  kesPerusahaan: number;
  /** Iuran ditanggung pekerja (%) */
  jhtPekerja: number;
  jpPekerja: number;
  kesPekerja: number;
  /** Batas upah dasar perhitungan */
  batasUpahJp: number;
  batasUpahKes: number;
}

export const BPJS_BAWAAN: KonfigBpjs = {
  jkm: 0.3,
  jhtPerusahaan: 3.7,
  jpPerusahaan: 2,
  kesPerusahaan: 4,
  jhtPekerja: 2,
  jpPekerja: 1,
  kesPekerja: 1,
  // Batas upah JP diperbarui pemerintah tiap tahun — disimpan sebagai pengaturan
  // agar dapat disesuaikan tanpa mengubah kode.
  batasUpahJp: 10_547_400,
  batasUpahKes: 12_000_000,
};

export interface KonfigUpah {
  /** Hari kerja standar sebulan — dasar potongan mangkir dan pro-rata */
  hariKerjaStandar: number;
  /** 5 atau 6 hari kerja seminggu — menentukan pengali lembur hari libur */
  hariKerjaSeminggu: number;
  /** Pembagi upah sebulan menjadi upah sejam (Kepmen 102/2004) */
  pembagiLembur: number;
}

export const UPAH_BAWAAN: KonfigUpah = {
  hariKerjaStandar: 25,
  hariKerjaSeminggu: 6,
  pembagiLembur: 173,
};

export async function konfigBpjs(): Promise<KonfigBpjs> {
  const s = await prisma.setting.findUnique({ where: { key: 'payroll.bpjs' } });
  return { ...BPJS_BAWAAN, ...((s?.value as any) || {}) };
}

export async function konfigUpah(): Promise<KonfigUpah> {
  const s = await prisma.setting.findUnique({ where: { key: 'payroll.upah' } });
  return { ...UPAH_BAWAAN, ...((s?.value as any) || {}) };
}

/**
 * Upah lembur satu pengajuan menurut Kepmen 102/2004.
 * Hari kerja  : jam ke-1 ×1,5 lalu ×2.
 * Hari libur  : ×2 sampai jam ke-7 (6 hari kerja) atau ke-8 (5 hari kerja),
 *               jam berikutnya ×3, sisanya ×4.
 */
export function upahLembur(
  upahSejam: number,
  jam: number,
  hariLibur: boolean,
  hariKerjaSeminggu = 6
): number {
  if (jam <= 0) return 0;
  if (!hariLibur) {
    const pertama = Math.min(1, jam);
    return rp(upahSejam * (pertama * 1.5 + Math.max(0, jam - 1) * 2));
  }
  const batasDua = hariKerjaSeminggu >= 6 ? 7 : 8;
  const dua = Math.min(jam, batasDua);
  const tiga = Math.min(Math.max(0, jam - batasDua), 1);
  const empat = Math.max(0, jam - batasDua - 1);
  return rp(upahSejam * (dua * 2 + tiga * 3 + empat * 4));
}

export interface SlipHitung {
  guardId: string;
  siteId: string | null;
  gradeId: string | null;
  hariJadwal: number;
  hariHadir: number;
  hariMangkir: number;
  menitTelat: number;
  jamLembur: number;
  masaKerjaBulan: number;
  upahDasar: number;
  earnings: BarisUang[];
  deductions: BarisUang[];
  bruto: number;
  totalPotongan: number;
  netto: number;
  pph21: number;
  pph21Basis: string | null;
  bpjsPekerja: number;
  bpjsPerusahaan: number;
  biayaPerusahaan: number;
  bankName: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  note: string | null;
  /** Rencana potongan kasbon, dipakai saat run dikunci */
  cicilan: { loanId: string; jumlah: number }[];
}

/** Rentang waktu satu periode YYYY-MM dalam zona waktu aplikasi. */
export function rentangPeriode(period: string) {
  const awal = dayjs.tz(`${period}-01 00:00`, TZ).toDate();
  const akhir = dayjs(awal).add(1, 'month').toDate();
  return { awal, akhir };
}

/**
 * Menghitung seluruh slip pada satu periode tanpa menyimpannya.
 * Pemanggil yang menentukan apakah hasilnya ditulis sebagai draf.
 */
export async function hitungPenggajian(period: string, type: 'BULANAN' | 'THR') {
  const { awal, akhir } = rentangPeriode(period);
  const [bpjs, upah] = await Promise.all([konfigBpjs(), konfigUpah()]);
  const hariKalender = dayjs(awal).daysInMonth();
  const desember = period.endsWith('-12');

  const anggota = await prisma.user.findMany({
    where: {
      role: { in: ['GUARD', 'SUPERVISOR'] },
      gradeId: { not: null },
      // Yang berhenti di tengah periode tetap digaji untuk hari yang dijalani.
      OR: [{ status: 'ACTIVE' }, { resignedAt: { gte: awal } }],
    },
    include: { grade: true, homeSite: { select: { id: true } } },
    orderBy: { name: 'asc' },
  });

  // Belum masuk kerja pada periode ini → belum berhak gaji.
  const ikut = anggota.filter((a) => !a.joinedAt || a.joinedAt < akhir);
  const ids = ikut.map((a) => a.id);
  if (!ids.length) return { slips: [] as SlipHitung[], workingDays: upah.hariKerjaStandar };

  const [jadwal, presensi, lembur, liburRows, kasbon, slipSebelumnya] = await Promise.all([
    prisma.schedule.groupBy({
      by: ['guardId'],
      // Jadwal yang sudah dialihkan ke pengganti bukan lagi kewajiban orang
      // ini — tanpa penyaringan ini ia tercatat mangkir dan gajinya dipotong.
      where: { guardId: { in: ids }, date: { gte: awal, lt: akhir }, status: { not: 'SWAPPED' } },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: { guardId: { in: ids }, checkInAt: { gte: awal, lt: akhir } },
      select: { guardId: true, siteId: true, status: true, lateMinutes: true, workedMinutes: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: ids },
        type: 'LEMBUR',
        status: 'DISETUJUI',
        startDate: { gte: awal, lt: akhir },
      },
      select: { userId: true, startDate: true, hours: true },
    }),
    prisma.holiday.findMany({ where: { date: { gte: awal, lt: akhir } }, select: { date: true } }),
    prisma.employeeLoan.findMany({
      where: { guardId: { in: ids }, status: 'AKTIF', startPeriod: { lte: period } },
      include: { payments: { select: { period: true, amount: true } } },
    }),
    // PPh 21 yang sudah dipotong sepanjang tahun berjalan (untuk masa Desember)
    desember
      ? prisma.payslip.findMany({
          where: {
            guardId: { in: ids },
            run: { period: { startsWith: `${period.slice(0, 4)}-` }, status: { not: 'DRAFT' } },
          },
          select: { guardId: true, pph21: true, bruto: true, bpjsPekerja: true },
        })
      : Promise.resolve([] as any[]),
  ]);

  const libur = new Set(liburRows.map((h) => dayjs(h.date).tz(TZ).format('YYYY-MM-DD')));
  const mJadwal = new Map(jadwal.map((j) => [j.guardId, j._count._all]));
  const mPresensi = new Map<string, typeof presensi>();
  presensi.forEach((p) => mPresensi.set(p.guardId, [...(mPresensi.get(p.guardId) || []), p]));
  const mLembur = new Map<string, typeof lembur>();
  lembur.forEach((l) => mLembur.set(l.userId, [...(mLembur.get(l.userId) || []), l]));
  const mKasbon = new Map<string, typeof kasbon>();
  kasbon.forEach((k) => mKasbon.set(k.guardId, [...(mKasbon.get(k.guardId) || []), k]));
  const mTahunan = new Map<string, { pph21: number; bruto: number; iuran: number }>();
  slipSebelumnya.forEach((s: any) => {
    const cur = mTahunan.get(s.guardId) || { pph21: 0, bruto: 0, iuran: 0 };
    mTahunan.set(s.guardId, {
      pph21: cur.pph21 + s.pph21,
      bruto: cur.bruto + s.bruto,
      iuran: cur.iuran + s.bpjsPekerja,
    });
  });

  const slips: SlipHitung[] = [];

  for (const a of ikut) {
    const g = a.grade;
    if (!g) continue; // tanpa golongan upah tidak dapat digaji

    const pr = mPresensi.get(a.id) || [];
    const hariHadir = pr.length;
    const hariJadwal = mJadwal.get(a.id) || 0;
    const hariMangkir = Math.max(0, hariJadwal - hariHadir);
    const menitTelat = pr.reduce((s, x) => s + (x.lateMinutes || 0), 0);

    // Site pembebanan biaya: penempatan utama, atau site tempat paling sering hadir.
    const hitungSite = new Map<string, number>();
    pr.forEach((x) => hitungSite.set(x.siteId, (hitungSite.get(x.siteId) || 0) + 1));
    const siteTerbanyak = [...hitungSite.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
    const siteId = a.homeSiteId || siteTerbanyak || null;

    const upahSebulan = rp(g.baseSalary + g.positionAllowance);
    const masaKerjaBulan = a.joinedAt
      ? Math.max(0, dayjs(akhir).diff(dayjs(a.joinedAt), 'month'))
      : 12;

    // Pro-rata bila masuk atau berhenti di tengah periode.
    const mulai = a.joinedAt && a.joinedAt > awal ? dayjs(a.joinedAt).tz(TZ) : dayjs(awal).tz(TZ);
    const selesai =
      a.resignedAt && a.resignedAt < akhir ? dayjs(a.resignedAt).tz(TZ) : dayjs(akhir).tz(TZ).subtract(1, 'day');
    const hariAktif = Math.max(0, Math.min(hariKalender, selesai.diff(mulai, 'day') + 1));
    const rasio = hariKalender ? hariAktif / hariKalender : 1;
    const proRata = rasio < 1;

    const earnings: BarisUang[] = [];
    const deductions: BarisUang[] = [];
    const cicilan: { loanId: string; jumlah: number }[] = [];

    if (type === 'THR') {
      // THR: satu kali upah sebulan bagi masa kerja ≥ 12 bulan, selebihnya
      // pro-rata masa kerja (PP 36/2021 Pasal 9).
      if (masaKerjaBulan < 1) continue;
      const nilai = masaKerjaBulan >= 12 ? upahSebulan : rp((masaKerjaBulan / 12) * upahSebulan);
      earnings.push({
        kode: 'THR',
        label: 'Tunjangan Hari Raya',
        jumlah: nilai,
        catatan: masaKerjaBulan >= 12 ? '1× upah sebulan' : `pro-rata ${masaKerjaBulan}/12 bulan`,
      });
    } else {
      earnings.push({
        kode: 'POKOK',
        label: 'Gaji pokok',
        jumlah: rp(g.baseSalary * rasio),
        catatan: proRata ? `pro-rata ${hariAktif}/${hariKalender} hari` : undefined,
      });
      if (g.positionAllowance)
        earnings.push({
          kode: 'TJ_JABATAN',
          label: 'Tunjangan jabatan',
          jumlah: rp(g.positionAllowance * rasio),
        });
      if (g.mealPerDay)
        earnings.push({
          kode: 'UANG_MAKAN',
          label: 'Uang makan',
          jumlah: rp(g.mealPerDay * hariHadir),
          catatan: `${hariHadir} hari × ${g.mealPerDay}`,
        });
      if (g.transportPerDay)
        earnings.push({
          kode: 'TRANSPORT',
          label: 'Uang transport',
          jumlah: rp(g.transportPerDay * hariHadir),
          catatan: `${hariHadir} hari × ${g.transportPerDay}`,
        });
      if (g.attendanceBonus && hariMangkir === 0 && hariHadir > 0)
        earnings.push({ kode: 'BONUS_HADIR', label: 'Bonus kehadiran penuh', jumlah: rp(g.attendanceBonus) });
    }

    // ── Lembur ──
    let jamLembur = 0;
    let nilaiLembur = 0;
    if (type === 'BULANAN' && g.overtimeEligible) {
      const upahSejam = upahSebulan / upah.pembagiLembur;
      for (const l of mLembur.get(a.id) || []) {
        const jam = l.hours || 0;
        if (jam <= 0) continue;
        jamLembur += jam;
        nilaiLembur += upahLembur(
          upahSejam,
          jam,
          libur.has(dayjs(l.startDate).tz(TZ).format('YYYY-MM-DD')),
          upah.hariKerjaSeminggu
        );
      }
      if (nilaiLembur)
        earnings.push({
          kode: 'LEMBUR',
          label: 'Upah lembur',
          jumlah: rp(nilaiLembur),
          catatan: `${jamLembur} jam · Kepmen 102/2004`,
        });
    }

    // ── Potongan kedisiplinan ──
    if (type === 'BULANAN') {
      if (hariMangkir > 0) {
        const perHari = g.absentDeduction || upahSebulan / upah.hariKerjaStandar;
        deductions.push({
          kode: 'MANGKIR',
          label: 'Potongan mangkir',
          jumlah: rp(perHari * hariMangkir),
          catatan: `${hariMangkir} hari tidak terisi dari ${hariJadwal} jadwal`,
        });
      }
      if (menitTelat > 0 && g.latePenaltyPerMin > 0)
        deductions.push({
          kode: 'TELAT',
          label: 'Potongan keterlambatan',
          jumlah: rp(g.latePenaltyPerMin * menitTelat),
          catatan: `${menitTelat} menit`,
        });
    }

    const bruto = jumlahBaris(earnings);

    // ── BPJS: dasar iuran adalah upah sebulan, bukan bruto ──
    const dasarBpjs = type === 'THR' ? 0 : upahSebulan;
    const dasarJp = Math.min(dasarBpjs, bpjs.batasUpahJp);
    const dasarKes = Math.min(dasarBpjs, bpjs.batasUpahKes);

    let bpjsPekerja = 0;
    let bpjsPerusahaan = 0;
    if (g.bpjsTkEnrolled && dasarBpjs > 0) {
      const jhtP = persen(dasarBpjs, bpjs.jhtPekerja);
      const jpP = persen(dasarJp, bpjs.jpPekerja);
      deductions.push({ kode: 'JHT', label: 'BPJS TK — JHT (2%)', jumlah: jhtP });
      deductions.push({ kode: 'JP', label: 'BPJS TK — Jaminan Pensiun (1%)', jumlah: jpP });
      bpjsPekerja += jhtP + jpP;
      bpjsPerusahaan +=
        persen(dasarBpjs, g.jkkRatePct) +
        persen(dasarBpjs, bpjs.jkm) +
        persen(dasarBpjs, bpjs.jhtPerusahaan) +
        persen(dasarJp, bpjs.jpPerusahaan);
    }
    if (g.bpjsKesEnrolled && dasarBpjs > 0) {
      const kesP = persen(dasarKes, bpjs.kesPekerja);
      deductions.push({ kode: 'BPJS_KES', label: 'BPJS Kesehatan (1%)', jumlah: kesP });
      bpjsPekerja += kesP;
      bpjsPerusahaan += persen(dasarKes, bpjs.kesPerusahaan);
    }

    // ── PPh 21 ──
    let pph21 = 0;
    let pph21Basis: string | null = null;
    const brutoPajak = bruto + (type === 'BULANAN' ? persen(dasarBpjs, g.jkkRatePct) + persen(dasarBpjs, bpjs.jkm) : 0);
    if (desember && type === 'BULANAN') {
      const tahunan = mTahunan.get(a.id) || { pph21: 0, bruto: 0, iuran: 0 };
      const h = pph21Desember({
        brutoSetahun: tahunan.bruto + brutoPajak,
        iuranPekerjaSetahun: tahunan.iuran + bpjsPekerja,
        bulanKerja: Math.min(12, Math.max(1, masaKerjaBulan || 12)),
        ptkp: a.ptkp,
        sudahDipotong: tahunan.pph21,
      });
      pph21 = h.pajakMasaIni;
      pph21Basis = 'DESEMBER';
    } else {
      const h = await pph21Bulanan(brutoPajak, a.ptkp);
      pph21 = h.pajak;
      pph21Basis = `TER-${h.kategori} ${h.tarif}%`;
    }
    if (pph21 !== 0)
      deductions.push({
        kode: 'PPH21',
        label: 'PPh 21',
        jumlah: pph21,
        catatan: pph21Basis ?? undefined,
      });

    // ── Cicilan kasbon ──
    if (type === 'BULANAN') {
      for (const k of mKasbon.get(a.id) || []) {
        if (k.payments.some((p) => p.period === period)) continue;
        const sisa = rp(k.amount - k.paidAmount);
        if (sisa <= 0) continue;
        const jumlah = Math.min(rp(k.installmentAmount), sisa);
        deductions.push({
          kode: 'KASBON',
          label: 'Cicilan kasbon',
          jumlah,
          catatan: `sisa setelah potongan ini ${rp(sisa - jumlah)}`,
        });
        cicilan.push({ loanId: k.id, jumlah });
      }
    }

    const totalPotongan = jumlahBaris(deductions);
    const netto = rp(bruto - totalPotongan);

    slips.push({
      guardId: a.id,
      siteId,
      gradeId: g.id,
      hariJadwal,
      hariHadir,
      hariMangkir,
      menitTelat,
      jamLembur,
      masaKerjaBulan,
      upahDasar: upahSebulan,
      earnings,
      deductions,
      bruto,
      totalPotongan,
      netto,
      pph21,
      pph21Basis,
      bpjsPekerja: rp(bpjsPekerja),
      bpjsPerusahaan: rp(bpjsPerusahaan),
      biayaPerusahaan: rp(bruto + bpjsPerusahaan),
      bankName: a.bankName,
      bankAccount: a.bankAccount,
      bankAccountName: a.bankAccountName || a.name,
      note: null,
      cicilan,
    });
  }

  return { slips, workingDays: upah.hariKerjaStandar };
}

/** Ringkasan kategori TER seorang personel — dipakai halaman personel. */
export const terUntuk = (ptkp: string | null | undefined) => kategoriTer(ptkp);
