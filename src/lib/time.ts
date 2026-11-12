import { BOOKING_WINDOW_DAYS, CLOSE_HOUR, OPEN_HOUR, OPEN_WEEKDAYS, TIMEZONE } from "./config";

export interface CampusNow {
  date: string;
  hour: number;
  minute: number;
}

/** Current date (YYYY-MM-DD) and hour in Malaysia time, wherever the server runs. */
export function nowInCampus(now: Date = new Date()): CampusNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/* ---- Opening days ------------------------------------------------------ */

export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Is the library open on this date (Mon–Fri)? */
export function isOpenDay(date: string): boolean {
  return (OPEN_WEEKDAYS as readonly number[]).includes(weekday(date));
}

/** This date if the library is open, otherwise the next open day. */
export function nextOpenDay(date: string): string {
  let d = date;
  for (let i = 0; i < 7 && !isOpenDay(d); i++) d = addDays(d, 1);
  return d;
}

/** This date if the library is open, otherwise the previous open day. */
export function previousOpenDay(date: string): string {
  let d = date;
  for (let i = 0; i < 7 && !isOpenDay(d); i++) d = addDays(d, -1);
  return d;
}

/** The first `count` open days starting from `from` (inclusive). */
export function openDaysFrom(from: string, count: number): string[] {
  const out: string[] = [];
  let d = nextOpenDay(from);
  while (out.length < count) {
    out.push(d);
    d = nextOpenDay(addDays(d, 1));
  }
  return out;
}

/** Last bookable date, inclusive. */
export function lastBookableDate(today: string): string {
  return previousOpenDay(addDays(today, BOOKING_WINDOW_DAYS));
}

/**
 * The earliest start hour still bookable on `date`. Today, that's the next
 * full hour; on future dates, opening time.
 */
export function earliestStartHour(date: string, now: CampusNow = nowInCampus()): number {
  if (date !== now.date) return OPEN_HOUR;
  return Math.max(OPEN_HOUR, now.hour + 1);
}

/** Is there still at least one bookable hour on this date? */
export function hasBookableHours(date: string, now: CampusNow = nowInCampus()): boolean {
  return isOpenDay(date) && earliestStartHour(date, now) <= CLOSE_HOUR - 1;
}

/** The first date (from today) that still has a bookable hour. */
export function firstBookableDate(now: CampusNow = nowInCampus()): string {
  return hasBookableHours(now.date, now) ? now.date : nextOpenDay(addDays(now.date, 1));
}

/** Has a booked slot already finished / started, judged in campus time? */
export function slotHasEnded(date: string, endHour: number, now = nowInCampus()) {
  return date < now.date || (date === now.date && now.hour >= endHour);
}
export function slotHasStarted(date: string, startHour: number, now = nowInCampus()) {
  return date < now.date || (date === now.date && now.hour >= startHour);
}

/** A sensible default search: the next bookable hour on the next open day. */
export function defaultSearch(now: CampusNow = nowInCampus()) {
  const date = firstBookableDate(now);
  return { date, start: earliestStartHour(date, now) };
}

/* ---- Formatting -------------------------------------------------------- */

export function formatHour(h: number): string {
  const suffix = h >= 12 && h < 24 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatHour(start)} – ${formatHour(end)}`;
}

/** "Thu 12 Nov" — formatted in UTC so the calendar date never shifts. */
export function formatDate(date: string, opts: { year?: boolean } = {}): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(opts.year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function weekdayName(date: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: style, timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function relativeDayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return weekdayName(date);
}

export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
