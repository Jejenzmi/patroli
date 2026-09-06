import { prisma } from './prisma';
import { dayjs, TZ } from './time';
import { rp, persen } from './uang';

/**
 * Rekonsiliasi manning dan penyusunan tagihan.
 *
 * Tagihan tidak disusun dari angka kontrak begitu saja, melainkan dari pos
 * yang benar-benar terisi menurut presensi bergeofence. Pos yang kosong
 * memotong tagihan secara pro-rata, dan pelanggaran SLA menambah denda —
 * keduanya berdasarkan data operasional yang sama yang dilihat klien.
 */

export interface BarisTagihan {
  kind: 'POS' | 'TAMBAHAN' | 'POTONGAN' | 'DENDA';
  siteId: string | null;
  description: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  meta?: any;
}

export interface HasilRekonsiliasi {
  period: string;
  hariPeriode: number;
  lines: BarisTagihan[];
  subtotal: number;
  deductionTotal: number;
  penaltyTotal: number;
  additionTotal: number;
  managementFee: number;
  dpp: number;
  ppn: number;
  pph23: number;
  total: number;
  netReceivable: number;
  /** Rekap per site untuk ditayangkan sebelum tagihan dikunci */
  rekap: {
    siteId: string;
    siteName: string;
    hariOrangKontrak: number;
    hariOrangTerisi: number;
    hariOrangKosong: number;
  }[];
}

/** Menyusun seluruh baris tagihan satu kontrak pada satu periode. */
export async function rekonsiliasi(contractId: string, period: string): Promise<HasilRekonsiliasi> {
  const kontrak = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      posts: { include: { site: { select: { id: true, name: true } }, shift: { select: { id: true, name: true } } } },
      penalties: { where: { isActive: true } },
    },
  });
  if (!kontrak) throw Object.assign(new Error('Kontrak tidak ditemukan'), { status: 404 });

  const awal = dayjs.tz(`${period}-01 00:00`, TZ).toDate();
  const akhir = dayjs(awal).add(1, 'month').toDate();
  const hariPeriode = dayjs(awal).daysInMonth();

  const siteIds = [...new Set(kontrak.posts.map((p) => p.siteId))];

  // Hari-orang yang benar-benar terisi: satu presensi masuk = satu hari-orang.
  const presensi = siteIds.length
    ? await prisma.attendance.findMany({
        where: { siteId: { in: siteIds }, checkInAt: { gte: awal, lt: akhir } },
        select: { siteId: true, status: true, schedule: { select: { shiftId: true } } },
      })
    : [];

  const terisi = new Map<string, number>();
  const terisiSite = new Map<string, number>();
  presensi.forEach((a) => {
    terisi.set(
      `${a.siteId}|${a.schedule?.shiftId || ''}`,
      (terisi.get(`${a.siteId}|${a.schedule?.shiftId || ''}`) || 0) + 1
    );
    terisiSite.set(a.siteId, (terisiSite.get(a.siteId) || 0) + 1);
  });

  const lines: BarisTagihan[] = [];
  const rekap: HasilRekonsiliasi['rekap'] = [];
  const kosongPerSite = new Map<string, number>();

  // Pos bershift dihitung lebih dulu, lalu sisa presensi site menjadi jatah pos
  // yang tidak terikat shift — supaya satu kehadiran tidak dihitung dua kali
  // sebagai pemenuhan dua pos sekaligus.
  const terpakai = new Map<string, number>();
  const urutan = [...kontrak.posts].sort((a, b) => (a.shiftId ? 0 : 1) - (b.shiftId ? 0 : 1));

  for (const pos of urutan) {
    const kontrakHariOrang = pos.headcount * hariPeriode;
    const isi = pos.shiftId
      ? Math.min(kontrakHariOrang, terisi.get(`${pos.siteId}|${pos.shiftId}`) || 0)
      : Math.min(
          kontrakHariOrang,
          Math.max(0, (terisiSite.get(pos.siteId) || 0) - (terpakai.get(pos.siteId) || 0))
        );
    terpakai.set(pos.siteId, (terpakai.get(pos.siteId) || 0) + isi);
    const kosong = Math.max(0, kontrakHariOrang - isi);

    const nilai = rp(pos.headcount * pos.ratePerPerson);
    lines.push({
      kind: 'POS',
      siteId: pos.siteId,
      description: `${pos.site.name} — ${pos.positionName}${pos.shift ? ` (${pos.shift.name})` : ''}`,
      qty: pos.headcount,
      unit: 'orang/bulan',
      unitPrice: pos.ratePerPerson,
      amount: nilai,
      meta: { postId: pos.id, kontrakHariOrang, hariOrangTerisi: isi },
    });

    if (kosong > 0) {
      const perHariOrang = pos.ratePerPerson / hariPeriode;
      lines.push({
        kind: 'POTONGAN',
        siteId: pos.siteId,
        description: `Potongan pos kosong — ${pos.positionName}${pos.shift ? ` (${pos.shift.name})` : ''}`,
        qty: kosong,
        unit: 'hari-orang',
        unitPrice: rp(perHariOrang),
        amount: -rp(perHariOrang * kosong),
        meta: { postId: pos.id, kontrakHariOrang, hariOrangTerisi: isi, hariOrangKosong: kosong },
      });
      kosongPerSite.set(pos.siteId, (kosongPerSite.get(pos.siteId) || 0) + kosong);
    }

    const baris = rekap.find((r) => r.siteId === pos.siteId);
    if (baris) {
      baris.hariOrangKontrak += kontrakHariOrang;
      baris.hariOrangTerisi += isi;
      baris.hariOrangKosong += kosong;
    } else {
      rekap.push({
        siteId: pos.siteId,
        siteName: pos.site.name,
        hariOrangKontrak: kontrakHariOrang,
        hariOrangTerisi: isi,
        hariOrangKosong: kosong,
      });
    }
  }

  /* ── Denda SLA dari data operasional ── */
  if (kontrak.penalties.length && siteIds.length) {
    const [mangkir, ronde, insidenTelat] = await Promise.all([
      prisma.attendance.count({
        where: { siteId: { in: siteIds }, checkInAt: { gte: awal, lt: akhir }, status: 'ABSENT' },
      }),
      prisma.patrolSession.count({
        where: {
          siteId: { in: siteIds },
          startedAt: { gte: awal, lt: akhir },
          OR: [{ status: 'ABANDONED' }, { missedCount: { gt: 0 } }],
        },
      }),
      // Perbandingan dua kolom dilakukan di sini, bukan di kueri, agar tidak
      // bergantung pada dukungan field reference Prisma.
      prisma.incident
        .findMany({
          where: { siteId: { in: siteIds }, occurredAt: { gte: awal, lt: akhir }, slaDueAt: { not: null } },
          select: { slaDueAt: true, resolvedAt: true },
        })
        .then((rows) =>
          rows.filter((i) => (i.resolvedAt ? i.resolvedAt > i.slaDueAt! : i.slaDueAt! < new Date())).length
        ),
    ]);

    const kosongTotal = [...kosongPerSite.values()].reduce((a, b) => a + b, 0);
    const jumlahKejadian: Record<string, number> = {
      POS_KOSONG: kosongTotal,
      MANGKIR: mangkir,
      RONDE: ronde,
      INSIDEN: insidenTelat,
      LAINNYA: 0,
    };

    const nilaiPos = lines.filter((l) => l.kind === 'POS').reduce((a, l) => a + l.amount, 0);
    // Denda dibatasi agar satu bulan buruk tidak membuat tagihan menjadi nol
    // atau negatif — batasnya bagian dari kesepakatan kontrak.
    const batasDenda = rp((nilaiPos * (kontrak.penaltyCapPct ?? 100)) / 100);
    let dendaTerpakai = 0;

    for (const aturan of kontrak.penalties) {
      const kejadian = Math.max(0, (jumlahKejadian[aturan.kind] || 0) - aturan.threshold);
      if (kejadian <= 0) continue;
      const kotor =
        aturan.unit === 'PERSEN_TAGIHAN' ? persen(nilaiPos, aturan.amount) : rp(aturan.amount * kejadian);
      if (kotor <= 0) continue;
      const nilai = Math.min(kotor, Math.max(0, batasDenda - dendaTerpakai));
      if (nilai <= 0) break;
      dendaTerpakai += nilai;
      lines.push({
        kind: 'DENDA',
        siteId: null,
        description: `Denda SLA — ${aturan.description}`,
        qty: aturan.unit === 'PERSEN_TAGIHAN' ? 1 : kejadian,
        unit: aturan.unit === 'PER_HARI_ORANG' ? 'hari-orang' : aturan.unit === 'PERSEN_TAGIHAN' ? 'lot' : 'kejadian',
        unitPrice: aturan.unit === 'PERSEN_TAGIHAN' ? nilai : rp(aturan.amount),
        amount: -nilai,
        meta: {
          ruleId: aturan.id,
          kind: aturan.kind,
          kejadian,
          toleransi: aturan.threshold,
          ...(nilai < kotor ? { dibatasi: true, seharusnya: kotor, batasDenda } : {}),
        },
      });
    }
  }

  return hitungTotal(lines, kontrak, period, hariPeriode, rekap);
}

/** Menjumlahkan baris menjadi nilai tagihan, termasuk pajak. */
export function hitungTotal(
  lines: BarisTagihan[],
  kontrak: { managementFeePct: number; ppnPct: number; pph23Pct: number; pph23Dipotong: boolean },
  period: string,
  hariPeriode: number,
  rekap: HasilRekonsiliasi['rekap'] = []
): HasilRekonsiliasi {
  const jumlah = (k: BarisTagihan['kind']) =>
    rp(lines.filter((l) => l.kind === k).reduce((a, l) => a + l.amount, 0));

  const subtotal = jumlah('POS');
  const deductionTotal = jumlah('POTONGAN'); // bernilai negatif
  const penaltyTotal = jumlah('DENDA'); // bernilai negatif
  const additionTotal = jumlah('TAMBAHAN');

  const dasarFee = subtotal + deductionTotal + additionTotal;
  const managementFee = kontrak.managementFeePct ? persen(dasarFee, kontrak.managementFeePct) : 0;

  const dpp = rp(dasarFee + penaltyTotal + managementFee);
  const ppn = persen(dpp, kontrak.ppnPct);
  const pph23 = persen(dpp, kontrak.pph23Pct);
  const total = rp(dpp + ppn);
  const netReceivable = rp(total - (kontrak.pph23Dipotong ? pph23 : 0));

  return {
    period,
    hariPeriode,
    lines,
    subtotal,
    deductionTotal,
    penaltyTotal,
    additionTotal,
    managementFee,
    dpp,
    ppn,
    pph23,
    total,
    netReceivable,
    rekap,
  };
}

/** Nomor tagihan berurutan: INV/2026-09/0007 */
export async function nomorTagihanBaru(period: string) {
  const n = await prisma.invoice.count({ where: { period } });
  return `INV/${period}/${String(n + 1).padStart(4, '0')}`;
}
