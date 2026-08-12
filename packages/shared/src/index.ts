/**
 * @patroli/shared — kontrak tipe & konstanta yang dipakai bersama
 * oleh backend (Node/TS) dan web (React/TS).
 */

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'GUARD', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  SUPERVISOR: 'Supervisor / Danru',
  GUARD: 'Anggota Security',
  CLIENT: 'Klien',
};

export const INCIDENT_SEVERITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITY)[number];

/** Batas waktu penanganan insiden (jam) berdasarkan tingkat keparahan. */
export const SLA_HOURS: Record<IncidentSeverity, number> = {
  LOW: 72,
  MEDIUM: 24,
  HIGH: 8,
  CRITICAL: 1,
};

export const INCIDENT_STATUS = ['OPEN', 'IN_REVIEW', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUS)[number];

export const INCIDENT_CATEGORIES = [
  'PENCURIAN',
  'PERUSAKAN',
  'KEBAKARAN',
  'ORANG_MENCURIGAKAN',
  'KECELAKAAN',
  'KERUSAKAN_FASILITAS',
  'PELANGGARAN_TAMU',
  'MEDIS',
  'LAINNYA',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const SCAN_METHODS = ['QR', 'NFC', 'GPS', 'MANUAL'] as const;
export type ScanMethod = (typeof SCAN_METHODS)[number];

export const PATROL_STATUS = ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'] as const;
export type PatrolStatus = (typeof PATROL_STATUS)[number];

/** Nama event realtime pada kanal Socket.IO. */
export const WS_EVENTS = {
  LOCATION: 'location:update',
  PANIC: 'panic:new',
  PANIC_ACK: 'panic:ack',
  SCAN: 'patrol:scan',
  PATROL_START: 'patrol:start',
  PATROL_END: 'patrol:end',
  INCIDENT: 'incident:new',
  ATTENDANCE: 'attendance:update',
  NOTIFICATION: 'notification:new',
} as const;

/** Jari-jari bumi (meter) untuk perhitungan haversine. */
export const EARTH_RADIUS_M = 6_371_000;

/** Jarak dua titik koordinat dalam meter. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  clientId: string | null;
  avatarUrl: string | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
