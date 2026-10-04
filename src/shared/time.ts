// Business time is Asia/Kolkata (UTC+05:30, no DST). Never use the machine's local time zone:
// hosting platforms usually run in UTC (Batch 1 §6.2).

export interface Clock {
  now(): Date;
}

export interface IstNow {
  instant: Date;
  /** `YYYY-MM-DD` business date in IST. */
  date: string;
  /** Zero-padded `HH:mm` in IST. */
  time: string;
}

// hourCycle 'h23' on purpose: `hour12: false` can produce "24:00" at midnight.
const istFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function istParts(instant: Date): IstNow {
  const parts: Record<string, string> = {};
  for (const p of istFormat.formatToParts(instant)) parts[p.type] = p.value;
  return {
    instant,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function nowIST(clock: Clock): IstNow {
  return istParts(clock.now());
}

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isValidHHmm(value: string): boolean {
  return HHMM.test(value);
}

/** Zero-padded HH:mm strings compare correctly as plain strings. */
export function compareHHmm(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function addMinutesIST(instant: Date, minutes: number): string {
  return istParts(new Date(instant.getTime() + minutes * 60_000)).time;
}

function split12h(hhmm: string): { text: string; meridiem: 'AM' | 'PM' } {
  const [hStr = '0', mStr = '00'] = hhmm.split(':');
  const h = Number(hStr);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { text: `${h12}:${mStr}`, meridiem };
}

/** `20:00` → `8:00 PM`. */
export function formatTime12h(hhmm: string): string {
  const { text, meridiem } = split12h(hhmm);
  return `${text} ${meridiem}`;
}

/** `19:40`,`19:50` → `7:40–7:50 PM`; `11:50`,`12:00` → `11:50 AM–12:00 PM`. */
export function formatWindow(from: string, to: string): string {
  const a = split12h(from);
  const b = split12h(to);
  return a.meridiem === b.meridiem
    ? `${a.text}–${b.text} ${b.meridiem}`
    : `${a.text} ${a.meridiem}–${b.text} ${b.meridiem}`;
}

/** `30`,`40` → `30–40 minutes` (en dash). The customer never sees an exact ETA. */
export function etaText(min: number, max: number): string {
  return `${min}–${max} minutes`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** `2026-10-04` → `Sun, 4 Oct`. Locale-independent. */
export function formatBusinessDate(date: string): string {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d} ${MONTHS[m - 1]}`;
}
