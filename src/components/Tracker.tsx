"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatDate, formatRange } from "@/lib/time";
import type { ApiError, BookingStatus, PublicBooking } from "@/lib/types";
import { isWellFormedReference, normaliseMatric, normaliseReference, parseMatric } from "@/lib/validation";
import {
  AlertIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  InfoIcon,
  PinIcon,
  TicketIcon,
  UsersIcon,
} from "./Icons";

const STATUS: Record<BookingStatus, { label: string; tone: string }> = {
  confirmed: { label: "Confirmed", tone: "var(--green)" },
  cancelled: { label: "Cancelled", tone: "var(--red)" },
  completed: { label: "Completed", tone: "var(--overlay2)" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS[status];
  return (
    <span className="badge" style={{ ["--tone" as string]: s.tone }}>
      {s.label}
    </span>
  );
}

export interface TrackerProps {
  initialRef?: string;
  /** True right after a booking is made — shows the "You're booked" hero. */
  isNew?: boolean;
}

export function Tracker({ initialRef = "", isNew = false }: TrackerProps) {
  const router = useRouter();
  const [input, setInput] = useState(initialRef);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);

  const lookup = useCallback(async (raw: string) => {
    const ref = normaliseReference(raw);
    if (!isWellFormedReference(ref)) {
      setBooking(null);
      setError("Reference codes look like LS-7K3QXM (6 letters or numbers after LS-).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(ref)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setBooking(null);
        setError((json as ApiError).error);
      } else {
        setBooking(json as PublicBooking);
        setInput(ref);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setJustCancelled(false);
    if (initialRef) lookup(initialRef);
    else {
      setBooking(null);
      setError(null);
      setInput("");
    }
  }, [initialRef, lookup]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ref = normaliseReference(input);
    if (ref === normaliseReference(initialRef)) lookup(ref);
    else router.push(`/track?ref=${encodeURIComponent(ref)}`);
  }

  const showHero = isNew && booking && booking.status === "confirmed" && !justCancelled;

  return (
    <main className="page">
      {showHero ? (
        <div className="success-hero">
          <div className="success-icon">
            <CheckIcon size={26} strokeWidth={2.4} />
          </div>
          <h1>You&apos;re booked.</h1>
          <p className="muted" style={{ margin: 0 }}>
            Save this reference code. You&apos;ll need it to check or cancel your booking.
          </p>
          <div className="ref-box">
            <span className="ref-code">{booking.reference}</span>
            <CopyButton text={booking.reference} />
          </div>
        </div>
      ) : (
        <>
          <h1 className="greeting" style={{ marginBottom: 10 }}>
            <TicketIcon size={32} style={{ color: "var(--accent)" }} />
            <span>Track a booking</span>
          </h1>
          <p className="muted" style={{ textAlign: "center", margin: "0 0 26px" }}>
            Enter your reference code to see the status, or to cancel.
          </p>
          <form className="composer" onSubmit={submit} role="search">
            <label htmlFor="ref-input" className="sr-only">Booking reference</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                id="ref-input"
                className="composer-input mono"
                placeholder="LS-XXXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                autoFocus={!initialRef}
              />
              <button type="submit" className="send-btn" disabled={!input.trim() || loading} aria-label="Look up booking">
                <ArrowUpIcon size={18} strokeWidth={2.4} />
              </button>
            </div>
          </form>
        </>
      )}

      <div style={{ marginTop: 26 }} aria-live="polite">
        {error && (
          <div className="alert" style={{ ["--tone" as string]: "var(--red)" }} role="alert">
            <AlertIcon size={18} />
            <div>{error}</div>
          </div>
        )}
        {loading && !booking && <div className="skeleton" style={{ height: 260 }} />}
        {booking && (
          <BookingDetails
            booking={booking}
            justCancelled={justCancelled}
            onCancelled={(b) => {
              setBooking(b);
              setJustCancelled(true);
            }}
          />
        )}
      </div>
    </main>
  );
}

function BookingDetails({
  booking,
  justCancelled,
  onCancelled,
}: {
  booking: PublicBooking;
  justCancelled: boolean;
  onCancelled: (b: PublicBooking) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [matric, setMatric] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConfirming(false);
    setMatric("");
    setErr(null);
  }, [booking.reference]);

  async function cancel(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseMatric(matric);
    if (!parsed.ok) return setErr(parsed.error);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bookings/${booking.reference}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricNo: parsed.info.matric }),
      });
      const json = await res.json();
      if (!res.ok) setErr((json as ApiError).error);
      else {
        setConfirming(false);
        onCancelled(json as PublicBooking);
      }
    } catch {
      setErr("Couldn't reach the server. The booking was not cancelled.");
    } finally {
      setBusy(false);
    }
  }

  const b = booking;
  return (
    <article className="card">
      {justCancelled && (
        <div className="alert" style={{ ["--tone" as string]: "var(--green)", marginBottom: 18 }}>
          <CheckIcon size={18} />
          <div>Booking cancelled. The room is free again for other students.</div>
        </div>
      )}
      <div className="booking-head">
        <span className="ref">{b.reference}</span>
        <StatusBadge status={b.status} />
      </div>
      <h2 className="booking-room">{b.room.name}</h2>
      <div className="booking-when">
        {formatDate(b.date, { year: true })} · {formatRange(b.start, b.end)}
      </div>

      <hr className="divider" />
      <dl className="kv stack-mobile">
        <dt><PinIcon size={15} /> Location</dt>
        <dd>
          {b.room.type}
          {b.room.floor ? ` · ${b.room.floor}` : ""}
        </dd>
        <dt><CalendarIcon size={15} /> Booked by</dt>
        <dd>
          {b.studentName}
          <div className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
            {b.programme} · <span className="mono">{b.matricMasked}</span>
          </div>
        </dd>
        <dt><UsersIcon size={15} /> Group size</dt>
        <dd>{b.groupSize === 1 ? "1 person" : `${b.groupSize} people`}</dd>
        <dt><InfoIcon size={15} /> Purpose</dt>
        <dd>{b.purpose}</dd>
        <dt><ClockIcon size={15} /> Booked on</dt>
        <dd>
          {new Date(b.createdAt).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Kuala_Lumpur",
          })}
        </dd>
        {b.cancelledAt && (
          <>
            <dt><AlertIcon size={15} /> Cancelled on</dt>
            <dd>
              {new Date(b.cancelledAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Asia/Kuala_Lumpur",
              })}
            </dd>
          </>
        )}
      </dl>

      {b.status === "confirmed" && !b.canCancel && (
        <div className="alert" style={{ marginTop: 18 }}>
          <InfoIcon size={18} />
          <div>This booking is in progress, so it can no longer be cancelled.</div>
        </div>
      )}
      {b.status === "completed" && (
        <div className="alert" style={{ marginTop: 18, ["--tone" as string]: "var(--overlay2)" }}>
          <InfoIcon size={18} />
          <div>This booking has ended.</div>
        </div>
      )}

      {confirming ? (
        <form className="cancel-panel" onSubmit={cancel}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="cancel-matric">Confirm with the matric number used to book</label>
            <input
              id="cancel-matric"
              className="input mono"
              placeholder="B032410567"
              maxLength={10}
              autoFocus
              value={matric}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setMatric(normaliseMatric(e.target.value).slice(0, 10));
                setErr(null);
              }}
              aria-invalid={!!err}
            />
            {err && <span className="err">{err}</span>}
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              {busy ? "Cancelling…" : "Yes, cancel booking"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Keep booking
            </button>
          </div>
        </form>
      ) : (
        <div className="actions">
          {b.canCancel && (
            <button type="button" className="btn btn-danger-outline" onClick={() => setConfirming(true)}>
              Cancel booking
            </button>
          )}
          <Link href="/" className="btn btn-secondary">
            Book another room
          </Link>
        </div>
      )}
    </article>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={copied ? "Copied" : "Copy reference code"}
      title={copied ? "Copied" : "Copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
    >
      {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
    </button>
  );
}
