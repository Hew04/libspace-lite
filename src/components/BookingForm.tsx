"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { PURPOSES, STUDENT_EMAIL_DOMAIN } from "@/lib/config";
import { rememberBooking } from "@/lib/recent";
import { formatDate, formatRange } from "@/lib/time";
import type { ApiError, AvailabilityResponse, PublicBooking, RoomAvailability } from "@/lib/types";
import {
  type FieldErrors,
  normaliseMatric,
  parseMatric,
  studentEmailFor,
  validateStudentDetails,
} from "@/lib/validation";
import { AlertIcon, ArrowLeftIcon, CalendarIcon, CheckIcon, ClockIcon, PinIcon, UsersIcon } from "./Icons";
import { DayTimeline, groupLabel } from "./RoomCard";

export interface BookingFormProps {
  roomId: string;
  date: string;
  start: number;
  end: number;
}

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; room: RoomAvailability };

export function BookingForm({ roomId, date, start, end }: BookingFormProps) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [form, setForm] = useState({ studentName: "", matricNo: "", groupSize: 1, purpose: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<{ message: string; code: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const duration = end - start;
  const backHref = `/?date=${date}&start=${start}&duration=${duration}`;

  // Re-check the slot when the form opens, so nobody fills in details for a room that's gone.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/availability?date=${date}&start=${start}&end=${end}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) return setLoad({ state: "error", message: (json as ApiError).error });
        const room = (json as AvailabilityResponse).rooms.find((r) => r.id === roomId);
        if (!room) return setLoad({ state: "error", message: "We couldn't find that room." });
        setLoad({ state: "ready", room });
        setForm((f) => ({ ...f, groupSize: room.capacity > 1 ? Math.max(room.minGroup, Math.min(2, room.capacity)) : 1 }));
      })
      .catch(() => !cancelled && setLoad({ state: "error", message: "Couldn't reach the server. Check your connection." }));
    return () => {
      cancelled = true;
    };
  }, [roomId, date, start, end]);

  if (load.state === "loading") {
    return (
      <main className="page page-wide">
        <div className="skeleton" style={{ height: 380 }} />
      </main>
    );
  }
  if (load.state === "error") {
    return (
      <main className="page">
        <div className="alert" style={{ ["--tone" as string]: "var(--red)" }} role="alert">
          <AlertIcon size={18} />
          <div>
            {load.message} <Link href="/">Find another room</Link>
          </div>
        </div>
      </main>
    );
  }

  const { room } = load;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _, ...rest }) => rest);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const fieldErrors = validateStudentDetails(form, room);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      document.getElementById(`f-${Object.keys(fieldErrors)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          date,
          start,
          end,
          ...form,
          studentName: form.studentName.trim(),
          matricNo: normaliseMatric(form.matricNo),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = json as ApiError;
        if (err.fields) setErrors(err.fields);
        setSubmitError({ message: err.error, code: err.code });
        setSubmitting(false);
        return;
      }
      const booking = json as PublicBooking;
      rememberBooking({
        reference: booking.reference,
        roomName: booking.room.name,
        date: booking.date,
        start: booking.start,
        end: booking.end,
      });
      router.push(`/track?ref=${booking.reference}&new=1`);
    } catch {
      setSubmitError({ message: "Couldn't reach the server. Your booking was not made — please try again.", code: "network" });
      setSubmitting(false);
    }
  }

  const unavailable = !room.available;
  const matric = form.matricNo.length === 10 ? parseMatric(form.matricNo) : null;

  function checkMatric() {
    if (!form.matricNo) return;
    const r = parseMatric(form.matricNo);
    setErrors((e) => {
      const { matricNo: _, ...rest } = e;
      return r.ok ? rest : { ...rest, matricNo: r.error };
    });
  }

  return (
    <main className="page page-wide">
      <Link href={backHref} className="btn btn-ghost" style={{ marginLeft: -12, marginBottom: 12 }}>
        <ArrowLeftIcon size={16} /> Back to rooms
      </Link>
      <h1 className="page-title">Confirm your booking</h1>
      <p className="page-lede">Just a few details so the library knows who booked the room.</p>

      <div className="book-grid">
        <form className="card" onSubmit={submit} noValidate>
          {(unavailable || submitError) && (
            <div className="alert" style={{ ["--tone" as string]: "var(--red)", marginBottom: 20 }} role="alert">
              <AlertIcon size={18} />
              <div>
                {unavailable
                  ? room.reason === "too_long"
                    ? `${room.name} can be booked for at most ${room.maxHours} hours at a time.`
                    : "This room has just been booked for an overlapping time."
                  : submitError!.message}{" "}
                {(unavailable || submitError?.code === "slot_taken" || submitError?.code === "too_long") && (
                  <Link href={backHref}>Choose another time or room</Link>
                )}
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="f-studentName">{room.capacity > 1 ? "Group representative's full name" : "Full name"}</label>
            <input
              id="f-studentName"
              className="input"
              autoComplete="name"
              placeholder="YOUR NAME HERE"
              value={form.studentName}
              onChange={(e) => set("studentName", e.target.value)}
              aria-invalid={!!errors.studentName}
              aria-describedby={errors.studentName ? "e-studentName" : undefined}
            />
            {errors.studentName ? (
              <span id="e-studentName" className="err">{errors.studentName}</span>
            ) : (
              room.capacity > 1 && (
                <span className="hint">One person books for the whole group and is responsible for the room.</span>
              )
            )}
          </div>

          <div>
            <div className="field">
              <label htmlFor="f-matricNo">{room.capacity > 1 ? "Representative's matric number" : "Matric number"}</label>
              <input
                id="f-matricNo"
                className="input mono"
                placeholder="B012312345"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                maxLength={10}
                value={form.matricNo}
                onChange={(e) => {
                  const v = normaliseMatric(e.target.value).slice(0, 10);
                  set("matricNo", v);
                  if (v.length === 10) {
                    const r = parseMatric(v);
                    setErrors((x) => {
                      const { matricNo: _, ...rest } = x;
                      return r.ok ? rest : { ...rest, matricNo: r.error };
                    });
                  }
                }}
                onBlur={checkMatric}
                aria-invalid={!!errors.matricNo}
                aria-describedby="h-matricNo"
              />
              {errors.matricNo ? (
                <span id="h-matricNo" className="err">{errors.matricNo}</span>
              ) : matric?.ok ? (
                <span id="h-matricNo" className="matric-decoded">
                  <CheckIcon size={13} strokeWidth={2.6} />
                  <span>
                    {[
                      matric.info.programme,
                      matric.info.facultyShort,
                      `Session ${matric.info.session}`,
                      matric.info.semesterLabel,
                    ].map((part, i) => (
                      <Fragment key={part}>
                        {i > 0 && " · "}
                        <span className="nowrap">{part}</span>
                      </Fragment>
                    ))}
                  </span>
                </span>
              ) : (
                <span id="h-matricNo" className="hint">B or D + 9 digits. You&apos;ll need it to cancel.</span>
              )}
            </div>
            <div className="field">
              <span className="label" id="l-email">Student email</span>
              <div className="derived-email" aria-labelledby="l-email" aria-live="polite">
                {matric?.ok ? (
                  <span className="mono">{studentEmailFor(matric.info.matric)}</span>
                ) : (
                  <span className="muted">
                    <span className="mono">matric number</span>
                    {STUDENT_EMAIL_DOMAIN}
                  </span>
                )}
              </div>
              {errors.email ? (
                <span className="err">{errors.email}</span>
              ) : (
                <span className="hint">Filled in from your matric number.</span>
              )}
            </div>
          </div>

          {room.capacity > 1 && (
            <div className="field">
              <span className="label" id="l-groupSize">How many people in the group, including you?</span>
              <div className="stepper" role="group" aria-labelledby="l-groupSize">
                <button type="button" aria-label="Fewer people" disabled={form.groupSize <= room.minGroup} onClick={() => set("groupSize", form.groupSize - 1)}>
                  −
                </button>
                <output id="f-groupSize" aria-live="polite">{form.groupSize}</output>
                <button
                  type="button"
                  aria-label="More people"
                  disabled={form.groupSize >= room.capacity}
                  onClick={() => set("groupSize", form.groupSize + 1)}
                >
                  +
                </button>
              </div>
              {errors.groupSize ? (
                <span className="err">{errors.groupSize}</span>
              ) : (
                <span className="hint">This room is for {groupLabel(room).replace("Up to", "up to")}.</span>
              )}
            </div>
          )}

          <div className="field">
            <span className="label" id="l-purpose">What&apos;s it for?</span>
            <div className="composer-row" role="radiogroup" aria-labelledby="l-purpose">
              {PURPOSES.map((p, i) => (
                <button
                  key={p}
                  id={i === 0 ? "f-purpose" : undefined}
                  type="button"
                  role="radio"
                  className="pill"
                  aria-checked={form.purpose === p}
                  onClick={() => set("purpose", p)}
                >
                  {p}
                </button>
              ))}
            </div>
            {errors.purpose && <span className="err">{errors.purpose}</span>}
          </div>

          <hr className="divider" />
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting || unavailable}>
            {submitting ? "Booking…" : "Confirm booking"}
          </button>
          <p className="hint" style={{ textAlign: "center", marginTop: 10, marginBottom: 0, fontSize: 12, color: "var(--faint)" }}>
            You&apos;ll get a reference code to check or cancel this booking.
          </p>
        </form>

        <aside className="card summary" aria-label="Booking summary">
          <span className="badge" style={{ ["--tone" as string]: room.available ? "var(--green)" : "var(--red)" }}>
            {room.available ? "Available" : room.reason === "too_long" ? "Too long for this room" : "Just booked"}
          </span>
          <h3>{room.name}</h3>
          <div className="muted" style={{ fontSize: 14 }}>{room.type}</div>
          <hr className="divider" />
          <dl className="kv">
            <dt><CalendarIcon size={15} /> Date</dt>
            <dd>{formatDate(date, { year: true })}</dd>
            <dt><ClockIcon size={15} /> Time</dt>
            <dd>{formatRange(start, end)}</dd>
            {room.floor && (
              <>
                <dt><PinIcon size={15} /> Where</dt>
                <dd>{room.floor}</dd>
              </>
            )}
            <dt><UsersIcon size={15} /> Group</dt>
            <dd>{groupLabel(room)}</dd>
          </dl>
          <div className="summary-extra" style={{ marginTop: 18 }}>
            <DayTimeline booked={room.booked} start={start} end={end} pastBefore={0} />
          </div>
          <Link href={backHref} className="btn btn-secondary btn-block summary-extra" style={{ marginTop: 18 }}>
            Change time or room
          </Link>
          <Link href={backHref} className="summary-change">
            Change time or room
          </Link>
        </aside>
      </div>
    </main>
  );
}
