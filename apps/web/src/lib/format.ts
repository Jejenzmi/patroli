import dayjs from 'dayjs';
import 'dayjs/locale/id';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';

dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.locale('id');

export { dayjs };

export const dt = (v?: string | Date | null, p = 'DD MMM YYYY · HH:mm') => (v ? dayjs(v).format(p) : '—');
export const d = (v?: string | Date | null) => (v ? dayjs(v).format('DD MMM YYYY') : '—');
export const t = (v?: string | Date | null) => (v ? dayjs(v).format('HH:mm') : '—');
export const ago = (v?: string | Date | null) => (v ? dayjs(v).fromNow() : '—');

export const rupiah = (v?: number | string | null) =>
  v == null ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID', { maximumFractionDigits: 0 });

export const num = (v?: number | null, digits = 0) =>
  v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits });

export const pct = (v?: number | null) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export const SEVERITY_TONE: Record<string, string> = {
  LOW: 'text-emerald border-emerald/40 bg-emerald/10',
  MEDIUM: 'text-amber border-amber/40 bg-amber/10',
  HIGH: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
  CRITICAL: 'text-danger border-danger/50 bg-danger/15',
};

export const STATUS_TONE: Record<string, string> = {
  OPEN: 'text-cyan border-cyan/40 bg-cyan/10',
  IN_REVIEW: 'text-violet border-violet/40 bg-violet/10',
  ESCALATED: 'text-danger border-danger/40 bg-danger/10',
  RESOLVED: 'text-emerald border-emerald/40 bg-emerald/10',
  CLOSED: 'text-muted border-line bg-white/5',
  IN_PROGRESS: 'text-cyan border-cyan/40 bg-cyan/10',
  COMPLETED: 'text-emerald border-emerald/40 bg-emerald/10',
  ABANDONED: 'text-danger border-danger/40 bg-danger/10',
  ON_TIME: 'text-emerald border-emerald/40 bg-emerald/10',
  LATE: 'text-amber border-amber/40 bg-amber/10',
  ABSENT: 'text-danger border-danger/40 bg-danger/10',
  EARLY_LEAVE: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
  ACTIVE: 'text-danger border-danger/50 bg-danger/15',
  ACKNOWLEDGED: 'text-amber border-amber/40 bg-amber/10',
  INSIDE: 'text-cyan border-cyan/40 bg-cyan/10',
  CHECKED_OUT: 'text-muted border-line bg-white/5',
  PLANNED: 'text-muted border-line bg-white/5',
  CONFIRMED: 'text-cyan border-cyan/40 bg-cyan/10',
  DONE: 'text-emerald border-emerald/40 bg-emerald/10',
};

export const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Baru',
  IN_REVIEW: 'Ditangani',
  ESCALATED: 'Eskalasi',
  RESOLVED: 'Selesai',
  CLOSED: 'Ditutup',
  IN_PROGRESS: 'Berjalan',
  COMPLETED: 'Tuntas',
  ABANDONED: 'Terbengkalai',
  ON_TIME: 'Tepat Waktu',
  LATE: 'Terlambat',
  ABSENT: 'Absen',
  EARLY_LEAVE: 'Pulang Awal',
  ACTIVE: 'Aktif',
  ACKNOWLEDGED: 'Direspons',
  INSIDE: 'Di Dalam',
  CHECKED_OUT: 'Keluar',
  PLANNED: 'Rencana',
  CONFIRMED: 'Dikonfirmasi',
  DONE: 'Selesai',
  LOW: 'Rendah',
  MEDIUM: 'Sedang',
  HIGH: 'Tinggi',
  CRITICAL: 'Kritis',
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  SUPERVISOR: 'Supervisor',
  GUARD: 'Anggota',
  CLIENT: 'Klien',
};

export const label = (k?: string | null) => (k ? STATUS_LABEL[k] || k.replace(/_/g, ' ') : '—');

export const CATEGORY_LABEL: Record<string, string> = {
  PENCURIAN: 'Pencurian',
  PERUSAKAN: 'Perusakan',
  KEBAKARAN: 'Kebakaran',
  ORANG_MENCURIGAKAN: 'Orang Mencurigakan',
  KECELAKAAN: 'Kecelakaan',
  KERUSAKAN_FASILITAS: 'Kerusakan Fasilitas',
  PELANGGARAN_TAMU: 'Pelanggaran Tamu',
  MEDIS: 'Medis',
  LAINNYA: 'Lainnya',
};
