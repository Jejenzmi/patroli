import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Menghapus seluruh data operasional contoh dari instans ini.
 *
 * Yang DIHAPUS: klien, site, titik, rute, shift, regu, roster, presensi,
 * sesi patroli, insiden, sinyal darurat, tamu, kendaraan, serah terima,
 * inventaris, pengumuman, notifikasi, jejak audit, berkas & sanksi personel,
 * kontrak, tagihan, penggajian, kasbon, biaya site, tawaran pengganti, serta
 * seluruh akun selain administrator.
 *
 * Yang DIPERTAHANKAN: akun administrator, pengaturan sistem (iuran BPJS,
 * dasar upah, kepatuhan, pagar jam kerja), tabel tarif PPh 21, daftar upah
 * minimum, dan hari libur nasional — semuanya data acuan, bukan data contoh.
 *
 *   npx tsx prisma/hapus-data-contoh.ts --ya
 */

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes('--ya')) {
    console.log('Jalankan dengan --ya untuk benar-benar menghapus. Tidak ada yang diubah.');
    return;
  }

  const hitung: Record<string, number> = {};
  const hapus = async (nama: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn();
    if (r.count) hitung[nama] = r.count;
  };

  // Urutan mengikuti ketergantungan antar tabel: anak lebih dulu, induk
  // menyusul. Relasi bercascade sebenarnya menangani sebagian, tetapi urutan
  // eksplisit membuat hasilnya dapat dibaca dan dihitung.
  await hapus('tawaran pengganti — calon', () => prisma.reliefCandidate.deleteMany({}));
  await hapus('tawaran pengganti', () => prisma.reliefOffer.deleteMany({}));

  await hapus('cicilan kasbon', () => prisma.loanPayment.deleteMany({}));
  await hapus('kasbon', () => prisma.employeeLoan.deleteMany({}));
  await hapus('slip gaji', () => prisma.payslip.deleteMany({}));
  await hapus('periode penggajian', () => prisma.payrollRun.deleteMany({}));

  await hapus('pembayaran tagihan', () => prisma.payment.deleteMany({}));
  await hapus('baris tagihan', () => prisma.invoiceLine.deleteMany({}));
  await hapus('tagihan', () => prisma.invoice.deleteMany({}));
  await hapus('aturan denda', () => prisma.penaltyRule.deleteMany({}));
  await hapus('pos kontrak', () => prisma.contractPost.deleteMany({}));
  await hapus('kontrak', () => prisma.contract.deleteMany({}));
  await hapus('biaya site', () => prisma.siteExpense.deleteMany({}));

  await hapus('berkas personel', () => prisma.personnelDocument.deleteMany({}));
  await hapus('sanksi', () => prisma.discipline.deleteMany({}));
  await hapus('perjanjian kerja', () => prisma.employmentContract.deleteMany({}));
  await hapus('syarat kompetensi', () => prisma.competencyRequirement.deleteMany({}));

  await hapus('penilaian', () => prisma.assessment.deleteMany({}));
  await hapus('cuti & lembur', () => prisma.leaveRequest.deleteMany({}));
  await hapus('tanda terima instruksi', () => prisma.instructionRead.deleteMany({}));
  await hapus('instruksi', () => prisma.instruction.deleteMany({}));
  await hapus('tugas', () => prisma.task.deleteMany({}));

  await hapus('percobaan presensi', () => prisma.attendanceAttempt.deleteMany({}));
  await hapus('presensi', () => prisma.attendance.deleteMany({}));

  await hapus('pemindaian titik', () => prisma.patrolScan.deleteMany({}));
  await hapus('jejak lokasi', () => prisma.locationPing.deleteMany({}));
  await hapus('sesi patroli', () => prisma.patrolSession.deleteMany({}));

  await hapus('media insiden', () => prisma.incidentMedia.deleteMany({}));
  await hapus('perkembangan insiden', () => prisma.incidentUpdate.deleteMany({}));
  await hapus('insiden', () => prisma.incident.deleteMany({}));

  await hapus('kejadian alarm', () => prisma.alarmEvent.deleteMany({}));
  await hapus('perangkat sirene', () => prisma.alarmDevice.deleteMany({}));
  await hapus('perutean darurat', () => prisma.panicRoute.deleteMany({}));
  await hapus('sinyal darurat', () => prisma.panicAlert.deleteMany({}));
  await hapus('divisi penanggap', () => prisma.emergencyDivision.deleteMany({}));

  await hapus('buku tamu', () => prisma.visitor.deleteMany({}));
  await hapus('lalu lintas kendaraan', () => prisma.vehicleLog.deleteMany({}));
  await hapus('serah terima', () => prisma.handover.deleteMany({}));
  await hapus('inventaris', () => prisma.equipment.deleteMany({}));
  await hapus('pengumuman', () => prisma.announcement.deleteMany({}));
  await hapus('notifikasi', () => prisma.notification.deleteMany({}));
  await hapus('jejak audit', () => prisma.auditLog.deleteMany({}));

  await hapus('jadwal jaga', () => prisma.schedule.deleteMany({}));
  await hapus('titik pada rute', () => prisma.routeCheckpoint.deleteMany({}));
  await hapus('rute patroli', () => prisma.patrolRoute.deleteMany({}));
  await hapus('titik pemeriksaan', () => prisma.checkpoint.deleteMany({}));
  await hapus('zona', () => prisma.zone.deleteMany({}));
  await hapus('lantai', () => prisma.floor.deleteMany({}));
  await hapus('shift', () => prisma.shift.deleteMany({}));
  await hapus('regu', () => prisma.team.deleteMany({}));

  await hapus('kejadian integritas', () => prisma.integrityEvent.deleteMany({}));
  await hapus('perangkat terikat', () => prisma.userDevice.deleteMany({}));

  // Akun: administrator dipertahankan, selebihnya dihapus.
  const admin = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    select: { id: true, username: true },
  });
  await hapus('akun selain administrator', () =>
    prisma.user.deleteMany({ where: { id: { notIn: admin.map((a) => a.id) } } })
  );

  await hapus('site', () => prisma.site.deleteMany({}));
  await hapus('klien', () => prisma.client.deleteMany({}));
  await hapus('golongan upah', () => prisma.payGrade.deleteMany({}));

  console.log('▸ Data contoh dihapus:');
  const total = Object.entries(hitung).sort((a, b) => b[1] - a[1]);
  if (!total.length) console.log('  (tidak ada yang tersisa untuk dihapus)');
  total.forEach(([k, v]) => console.log('  · %s: %d', k, v));

  console.log('▸ Dipertahankan:');
  const [setting, ter, umk, libur] = await Promise.all([
    prisma.setting.count(),
    prisma.terBracket.count(),
    prisma.minimumWage.count(),
    prisma.holiday.count(),
  ]);
  console.log('  · %d akun administrator: %s', admin.length, admin.map((a) => a.username).join(', '));
  console.log('  · %d pengaturan sistem · %d lapisan tarif PPh 21 · %d data UMK · %d hari libur',
    setting, ter, umk, libur);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
