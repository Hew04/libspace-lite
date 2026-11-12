"use client";

import { useCallback, useEffect, useState } from "react";
import { CLOSE_HOUR, OPEN_HOUR, OPENING_SUMMARY } from "@/lib/config";
import {
  addDays,
  type CampusNow,
  formatDate,
  formatRange,
  isOpenDay,
  nextOpenDay,
  previousOpenDay,
} from "@/lib/time";
import type { ApiError, StaffBooking, StaffSchedule as Schedule } from "@/lib/types";
import { AlertIcon, ArrowLeftIcon, InfoIcon, XIcon } from "./Icons";
import { StatusBadge } from "./Tracker";

const HOURS = CLOSE_HOUR - OPEN_HOUR;
const pct = (h: number) => `${((h - OPEN_HOUR) / HOURS) * 100}%`;
const hourLabel = (h: number) => (h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`);
const REFRESH_MS = 60_000;

export function StaffSchedule({ now, initialDate }: { now: CampusNow; initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/schedule?date=${date}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error((json as ApiError).error);
      setData(json as Schedule);
      setError(null);
    } catch (e) {
      setError((e as Error).message || "Couldn't load the schedule.");
    }
  }, [date]);

  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    setSelected(null);
    const qs = `?date=${date}`;
    if (window.location.search !== qs) window.history.replaceState(null, "", qs);
  }, [date]);

  const stale = data && data.date !== date;
  const bookings = (data?.bookings ?? []).filter((b) => showCancelled || b.status !== "cancelled");
  const current = data?.bookings.find((b) => b.reference === selected) ?? null;
  const roomName = (id: string) => data?.rooms.find((r) => r.id === id)?.name ?? id;
  const nowHourFloat = data ? data.nowHour + data.nowMinute / 60 : 0;
  const showNowLine = data?.isToday && nowHourFloat >= OPEN_HOUR && nowHourFloat < CLOSE_HOUR;

  return (
    <main className="page page-staff">
      <div className="staff-head">
        <div>
          <span className="badge" style={{ ["--tone" as string]: "var(--accent)" }}>
            Library staff
          </span>
          <h1 className="page-title" style={{ marginTop: 10 }}>
            Room schedule
          </h1>
          <p className="page-lede" style={{ marginBottom: 0 }}>
            All bookings for the day. Read-only. Matric numbers are masked.
          </p>
        </div>

        <div className="date-nav" role="group" aria-label="Choose day">
          <button
            type="button"
            className="icon-btn bordered"
            aria-label="Previous open day"
            onClick={() => setDate(previousOpenDay(addDays(date, -1)))}
          >
            <ArrowLeftIcon size={16} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDate(isOpenDay(now.date) ? now.date : nextOpenDay(now.date))}
            disabled={date === now.date}
          >
            Today
          </button>
          <input
            type="date"
            className="input date-input"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Date"
          />
          <button
            type="button"
            className="icon-btn bordered"
            aria-label="Next open day"
            onClick={() => setDate(nextOpenDay(addDays(date, 1)))}
          >
            <ArrowLeftIcon size={16} style={{ transform: "scaleX(-1)" }} />
          </button>
        </div>
      </div>

      <h2 className="staff-date">{formatDate(date, { year: true })}</h2>

      {error && (
        <div className="alert" style={{ ["--tone" as string]: "var(--red)" }} role="alert">
          <AlertIcon size={18} />
          <div>{error}</div>
        </div>
      )}

      {!data && !error && <div className="skeleton" style={{ height: 420 }} />}

      {data && data.closed && !stale && (
        <div className="empty">
          The library is closed on {formatDate(date).split(" ")[0]}. Bookings are for {OPENING_SUMMARY}.
        </div>
      )}

      {data && !data.closed && (
        <div style={{ opacity: stale ? 0.5 : 1, transition: "opacity 0.15s" }}>
          <section className="stats" aria-label="Summary">
            <div className="stat">
              <div className="stat-label">Bookings</div>
              <div className="stat-value">{data.stats.confirmed}</div>
              <div className="stat-sub">{data.stats.cancelled} cancelled</div>
            </div>
            <div className="stat">
              <div className="stat-label">Room usage</div>
              <div className="stat-value">{Math.round(data.stats.utilisation * 100)}%</div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${Math.min(100, data.stats.utilisation * 100)}%` }} />
              </div>
              <div className="stat-sub">
                {data.stats.bookedHours} of {data.rooms.length * HOURS} room-hours
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">In use now</div>
              <div className="stat-value">{data.isToday ? data.stats.inUseNow : "—"}</div>
              <div className="stat-sub">{data.isToday ? `of ${data.rooms.length} rooms` : "Only shown for today"}</div>
            </div>
            <div className="stat">
              <div className="stat-label">By programme</div>
              {data.stats.byProgramme.length === 0 ? (
                <div className="stat-value">—</div>
              ) : (
                <ul className="stat-list">
                  {data.stats.byProgramme.map((p) => (
                    <li key={p.programme}>
                      <span>{p.programme}</span>
                      <b>{p.count}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card sched-card" aria-label="Timeline">
            <div className="sched-toolbar">
              <h3 className="section-title">Timeline</h3>
              <label className="switch">
                <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
                <span className="switch-track" aria-hidden="true" />
                Show cancelled
              </label>
            </div>
            <div className="sched-scroll">
              <div className="sched">
                <div className="sched-row sched-header">
                  <div className="sched-room">Room</div>
                  <div className="sched-track">
                    {Array.from({ length: HOURS + 1 }, (_, i) => OPEN_HOUR + i)
                      .filter((h) => h % 2 === 0)
                      .map((h) => (
                        <span key={h} className="sched-hour" style={{ left: pct(h) }}>
                          {hourLabel(h)}
                        </span>
                      ))}
                  </div>
                </div>
                {data.rooms.map((room) => (
                  <div key={room.id} className="sched-row">
                    <div className="sched-room">
                      <b>{room.name}</b>
                      <small>
                        {room.floor ? `${room.floor} · ` : ""}
                        {room.capacity === 1 ? "1 seat" : `${room.minGroup}–${room.capacity} people`}
                      </small>
                    </div>
                    <div className="sched-track">
                      {showNowLine && <span className="now-line" style={{ left: pct(nowHourFloat) }} />}
                      {bookings
                        .filter((b) => b.roomId === room.id)
                        .map((b) => (
                          <button
                            key={b.reference}
                            type="button"
                            className="sched-block"
                            data-status={b.status}
                            aria-pressed={selected === b.reference}
                            style={{ left: pct(b.start), width: `calc(${((b.end - b.start) / HOURS) * 100}% - 3px)` }}
                            onClick={() => setSelected(b.reference === selected ? null : b.reference)}
                            title={`${b.studentName} · ${formatRange(b.start, b.end)}`}
                          >
                            <b>{b.studentName}</b>
                            <span>{formatRange(b.start, b.end).replace(/:00 /g, " ")}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {current && <BookingDetail b={current} room={roomName(current.roomId)} onClose={() => setSelected(null)} />}

          <section className="card" style={{ marginTop: 16 }} aria-label="Booking list">
            <h3 className="section-title" style={{ marginBottom: 12 }}>
              Bookings ({bookings.length})
            </h3>
            {bookings.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No bookings for this day yet.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Student</th>
                    <th>Programme</th>
                    <th>Group</th>
                    <th>Purpose</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr
                      key={b.reference}
                      aria-selected={selected === b.reference}
                      onClick={() => setSelected(b.reference)}
                      tabIndex={0}
                      onKeyDown={(e: { key: string }) => e.key === "Enter" && setSelected(b.reference)}
                    >
                      <td data-label="Time">
                        <div className="nowrap">{formatRange(b.start, b.end)}</div>
                      </td>
                      <td data-label="Room">
                        <div>{roomName(b.roomId)}</div>
                      </td>
                      <td data-label="Student">
                        <div>
                          {b.studentName}
                          <div className="mono muted small">{b.reference}</div>
                        </div>
                      </td>
                      <td data-label="Programme">
                        <div>
                          {b.programme}
                          <div className="muted small" title={b.facultyName}>
                            {b.facultyShort} ({b.facultyCode})
                          </div>
                        </div>
                      </td>
                      <td data-label="Group">
                        <div>{b.groupSize}</div>
                      </td>
                      <td data-label="Purpose">
                        <div>{b.purpose}</div>
                      </td>
                      <td data-label="Status">
                        <div>
                          <StatusBadge status={b.status} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      <p className="footnote">
        <InfoIcon size={12} style={{ verticalAlign: -1 }} /> Refreshes every minute. There&apos;s no staff login in this
        MVP, so this page shows nothing private.
      </p>
    </main>
  );
}

function BookingDetail({ b, room, onClose }: { b: StaffBooking; room: string; onClose: () => void }) {
  return (
    <section className="card detail-card" aria-label="Selected booking">
      <div className="booking-head">
        <span className="ref">{b.reference}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusBadge status={b.status} />
          <button type="button" className="icon-btn" aria-label="Close details" onClick={onClose}>
            <XIcon size={16} />
          </button>
        </div>
      </div>
      <h3 className="booking-room" style={{ fontSize: 22 }}>
        {room} · {formatRange(b.start, b.end)}
      </h3>
      <dl className="kv detail-kv">
        <dt>Student</dt>
        <dd>{b.studentName}</dd>
        <dt>Matric</dt>
        <dd className="mono">{b.matricMasked}</dd>
        <dt>Programme</dt>
        <dd>{b.programme}</dd>
        <dt>Faculty</dt>
        <dd>
          {b.facultyName} ({b.facultyShort}, {b.facultyCode})
        </dd>
        <dt>Admitted</dt>
        <dd>
          Session {b.session}, {b.semesterLabel}
        </dd>
        <dt>Group</dt>
        <dd>{b.groupSize === 1 ? "1 person" : `${b.groupSize} people`}</dd>
        <dt>Purpose</dt>
        <dd>{b.purpose}</dd>
      </dl>
    </section>
  );
}
