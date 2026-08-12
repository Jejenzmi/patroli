import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

export const TZ = process.env.APP_TZ || 'Asia/Jakarta';

export { dayjs };

/** Tanggal (tanpa jam) sebagai UTC-midnight — dipakai sebagai kunci roster harian. */
export function dateKey(input?: string | Date): Date {
  const d = input ? dayjs(input) : dayjs();
  return new Date(`${d.tz(TZ).format('YYYY-MM-DD')}T00:00:00.000Z`);
}

/** Gabungkan tanggal roster + jam shift "HH:mm" menjadi Date absolut. */
export function shiftStartAt(date: Date, hhmm: string): Date {
  const day = dayjs(date).utc().format('YYYY-MM-DD');
  return dayjs.tz(`${day} ${hhmm}`, TZ).toDate();
}

export function fmt(d: Date | string | null | undefined, pattern = 'DD MMM YYYY HH:mm') {
  if (!d) return '-';
  return dayjs(d).tz(TZ).format(pattern);
}

export function startOfDay(d?: Date) {
  return dayjs(d).tz(TZ).startOf('day').toDate();
}

export function endOfDay(d?: Date) {
  return dayjs(d).tz(TZ).endOf('day').toDate();
}
