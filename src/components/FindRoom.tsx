"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOOKING_WINDOW_DAYS, CLOSE_HOUR, MAX_DURATION_HOURS, OPENING_SUMMARY } from "@/lib/config";
import {
  addDays,
  type CampusNow,
  earliestStartHour,
  firstBookableDate,
  formatDate,
  formatHour,
  formatRange,
  greeting,
  isOpenDay,
  lastBookableDate,
  nextOpenDay,
  openDaysFrom,
  previousOpenDay,
  relativeDayLabel,
  weekdayName,
} from "@/lib/time";
import type { ApiError, AvailabilityResponse } from "@/lib/types";
import { AlertIcon, BoltIcon, ClockIcon, InfoIcon, LogoMark, MoonIcon, SunriseIcon } from "./Icons";
import { RoomCard } from "./RoomCard";

const REFRESH_MS = 30_000;
const PILL_DAYS = 5;

export interface FindRoomProps {
  /** Campus "now", from the server, so the first render matches on server and client. */
  now: CampusNow;
  initial: { date: string; start: number; duration: number };
}

/** Keep a search on an open weekday, inside opening hours and the booking window. */
function clamp(date: string, start: number, duration: number, now: CampusNow) {
  const first = firstBookableDate(now);
  const last = lastBookableDate(now.date);
  let d = date < first ? first : date > last ? last : date;
  if (!isOpenDay(d)) {
    const next = nextOpenDay(d);
    d = next <= last ? next : previousOpenDay(d);
  }
  const earliest = earliestStartHour(d, now);
  const s = Math.min(Math.max(start, earliest), CLOSE_HOUR - 1);
  const dur = Math.max(1, Math.min(duration, MAX_DURATION_HOURS, CLOSE_HOUR - s));
  return { date: d, start: s, duration: dur };
}

export function FindRoom({ now, initial }: FindRoomProps) {
  const [search, setSearch] = useState(() => clamp(initial.date, initial.start, initial.duration, now));
  const [notice, setNotice] = useState<string | null>(null);
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const { date, start, duration } = search;
  const end = start + duration;
  const today = now.date;
  const first = firstBookableDate(now);

  const update = (patch: Partial<typeof search>) => {
    setNotice(null);
    setSearch((s) => {
      const next = { ...s, ...patch };
      return clamp(next.date, next.start, next.duration, now);
    });
  };

  function pickDate(value: string) {
    if (!value) return;
    const next = clamp(value, start, duration, now);
    setSearch(next);
    setNotice(
      next.date !== value
        ? !isOpenDay(value)
          ? `The library is closed on weekends, so we're showing ${weekdayName(next.date, "long")}, ${formatDate(next.date).split(" ").slice(1).join(" ")}.`
          : `That date can't be booked, so we're showing ${formatDate(next.date)}.`
        : null,
    );
  }

  const load = useCallback(
    async (opts: { quiet?: boolean } = {}) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (!opts.quiet) setLoading(true);
      try {
        const res = await fetch(`/api/rooms/availability?date=${date}&start=${start}&end=${end}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error((json as ApiError).error);
        setData(json as AvailabilityResponse);
        setError(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message || "Couldn't load rooms. Check your connection.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    },
    [date, start, end],
  );

  // Load on every change, then keep it fresh while the page is open.
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load({ quiet: true });
    }, REFRESH_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [load]);

  // Keep the URL shareable / restorable (used by "Change" on the booking page).
  useEffect(() => {
    const qs = `?date=${date}&start=${start}&duration=${duration}`;
    if (window.location.search !== qs) window.history.replaceState(null, "", qs);
  }, [date, start, duration]);

  const days = useMemo(() => openDaysFrom(first, PILL_DAYS), [first]);
  const startOptions = useMemo(() => {
    const e = earliestStartHour(date, now);
    return Array.from({ length: CLOSE_HOUR - e }, (_, i) => e + i);
  }, [date, now]);
  const maxDuration = Math.min(MAX_DURATION_HOURS, CLOSE_HOUR - start);

  // Quick picks, adjusted for weekends and for how late it is today.
  const nextDay = nextOpenDay(addDays(today, 1));
  const nextDayLabel = relativeDayLabel(nextDay, today) === "Tomorrow" ? "Tomorrow" : weekdayName(nextDay, "long");
  const tonightOk = isOpenDay(today) && earliestStartHour(today, now) <= 19;
  const chips = [
    { label: "Next free hour", icon: BoltIcon, apply: () => update({ date: first, start: 0, duration: 1 }) },
    tonightOk
      ? { label: "Tonight, 7 PM", icon: MoonIcon, apply: () => update({ date: today, start: 19, duration: 2 }) }
      : { label: `${nextDayLabel} evening`, icon: MoonIcon, apply: () => update({ date: nextDay, start: 19, duration: 2 }) },
    { label: `${nextDayLabel} morning`, icon: SunriseIcon, apply: () => update({ date: nextDay, start: 9, duration: 2 }) },
    { label: `${nextDayLabel}, 2 PM`, icon: ClockIcon, apply: () => update({ date: nextDay, start: 14, duration: 2 }) },
  ];

  const available = data?.rooms.filter((r) => r.available) ?? [];
  const booked = data?.rooms.filter((r) => !r.available) ?? [];
  const pastBefore = date === today ? earliestStartHour(date, now) : 0;
  const isStale = data && (data.date !== date || data.start !== start || data.end !== end);

  return (
    <main className="page">
      <h1 className="greeting">
        <LogoMark size={36} />
        <span>{greeting(now.hour)}, where will you study?</span>
      </h1>

      {!isOpenDay(today) && (
        <div className="alert" style={{ marginBottom: 16 }}>
          <InfoIcon size={18} />
          <div>The library is closed today. Bookings are for {OPENING_SUMMARY}.</div>
        </div>
      )}

      <section className="composer" aria-label="Choose a date and time">
        <div className="composer-label">Pick a day</div>
        <div className="composer-row day-row" role="group" aria-label="Day">
          {days.map((d) => (
            <button key={d} type="button" className="pill" aria-pressed={d === date} onClick={() => update({ date: d })}>
              {relativeDayLabel(d, today)}
              <span className="pill-sub">{Number(d.slice(8))}</span>
            </button>
          ))}
          <label className="date-more">
            <span className="sr-only">Another weekday</span>
            <input
              type="date"
              value={date}
              min={first}
              max={lastBookableDate(today)}
              onChange={(e) => pickDate(e.target.value)}
              title={`Weekdays only, up to ${BOOKING_WINDOW_DAYS} days ahead`}
            />
          </label>
        </div>
        {notice && (
          <p className="composer-notice" role="status">
            <InfoIcon size={15} /> {notice}
          </p>
        )}

        <div className="composer-bottom">
          <div className="composer-row time-row">
            <label className="select-wrap">
              <ClockIcon size={16} />
              <span className="sr-only">Start time</span>
              <select className="select" value={start} onChange={(e) => update({ start: Number(e.target.value) })}>
                {startOptions.map((h) => (
                  <option key={h} value={h}>
                    {formatHour(h)}
                  </option>
                ))}
              </select>
            </label>
            <div className="pill-group" role="radiogroup" aria-label="Duration">
              {[1, 2, 3].map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  className="pill"
                  aria-checked={duration === h}
                  disabled={h > maxDuration}
                  onClick={() => update({ duration: h })}
                >
                  {h} hr{h > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
          <span className="muted range-label">{formatRange(start, end)}</span>
        </div>
      </section>

      <div className="chips">
        {chips.map(({ label, icon: I, apply }) => (
          <button key={label} type="button" className="chip" onClick={apply}>
            <I size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="results-head">
        <h2 className="results-title">
          {data && !isStale ? `${available.length} of ${data.rooms.length} rooms free` : "Checking rooms…"}
          <span className="results-sub">
            {formatDate(date)} · {formatRange(start, end)}
          </span>
        </h2>
        {data && (
          <span className="live" title="Availability refreshes automatically every 30 seconds">
            <span className="live-dot" /> Live · updated{" "}
            {new Date(data.checkedAt).toLocaleTimeString("en-MY", {
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Asia/Kuala_Lumpur",
            })}
          </span>
        )}
      </div>

      <div className="legend" aria-hidden="true">
        <span><i style={{ background: "color-mix(in srgb, var(--green) 26%, transparent)" }} />Free</span>
        <span><i style={{ background: "color-mix(in srgb, var(--red) 45%, transparent)" }} />Booked</span>
        <span><i style={{ outline: "1.5px solid var(--accent)", background: "transparent" }} />Your time</span>
      </div>

      <div style={{ marginTop: 14 }} aria-live="polite" aria-busy={loading}>
        {error ? (
          <div className="alert" style={{ ["--tone" as string]: "var(--red)" }} role="alert">
            <AlertIcon size={18} />
            <div>
              {error}{" "}
              <button type="button" className="link-btn" onClick={() => load()}>
                Try again
              </button>
            </div>
          </div>
        ) : loading && !data ? (
          <div className="room-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" />
            ))}
          </div>
        ) : data ? (
          <div style={{ opacity: isStale ? 0.55 : 1, transition: "opacity 0.15s" }}>
            {available.length === 0 ? (
              <div className="empty">Every room is booked for this time. Try a different hour or another day.</div>
            ) : (
              <div className="room-list">
                {available.map((r) => (
                  <RoomCard key={r.id} room={r} date={date} start={start} end={end} pastBefore={pastBefore} />
                ))}
              </div>
            )}
            {booked.length > 0 && (
              <>
                <div className="subhead">Not available for this time</div>
                <div className="room-list">
                  {booked.map((r) => (
                    <RoomCard key={r.id} room={r} date={date} start={start} end={end} pastBefore={pastBefore} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <p className="footnote">
        Open {OPENING_SUMMARY} · Book up to {BOOKING_WINDOW_DAYS} days ahead · Max {MAX_DURATION_HOURS} hours per booking
      </p>
    </main>
  );
}
