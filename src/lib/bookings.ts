import "server-only";
import { CLOSE_HOUR, MAX_DURATION_HOURS, OPEN_HOUR } from "./config";
import { getDb, type Queryable } from "./db";
import { generateReference } from "./reference";
import { isOpenDay, isValidDateString, nowInCampus, slotHasEnded, slotHasStarted } from "./time";
import type {
  AvailabilityResponse,
  BookingStatus,
  NewBookingInput,
  PublicBooking,
  Room,
  RoomType,
  StaffBooking,
  StaffSchedule,
  StoredStatus,
} from "./types";
import {
  type FieldErrors,
  isWellFormedReference,
  maskMatric,
  normaliseReference,
  parseMatric,
  validateSlot,
  validateStudentDetails,
} from "./validation";

export class BookingError extends Error {
  status: number;
  code: string;
  fields?: FieldErrors;
  constructor(message: string, status: number, code: string, fields?: FieldErrors) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface RoomRow {
  id: string;
  name: string;
  type: string;
  floor: string;
  capacity: number;
  min_group: number | null;
  max_hours: number | null;
  amenities: string;
  description: string;
}

interface BookingRow {
  reference: string;
  room_id: string;
  date: string;
  start_hour: number;
  end_hour: number;
  student_name: string;
  matric_no: string;
  group_size: number;
  purpose: string;
  status: StoredStatus;
  created_at: string;
  cancelled_at: string | null;
  room_name: string;
  room_type: string;
  room_floor: string;
  room_capacity: number;
  room_min_group: number | null;
  room_max_hours: number | null;
}

function toRoom(r: RoomRow): Room {
  return {
    id: r.id,
    name: r.name,
    type: r.type as RoomType,
    floor: r.floor,
    capacity: Number(r.capacity),
    minGroup: Number(r.min_group ?? 1),
    maxHours: Number(r.max_hours ?? MAX_DURATION_HOURS),
    amenities: r.amenities ? r.amenities.split(",") : [],
    description: r.description,
  };
}

function derivedStatus(b: Pick<BookingRow, "status" | "date" | "end_hour">, now = nowInCampus()): BookingStatus {
  return b.status === "confirmed" && slotHasEnded(b.date, Number(b.end_hour), now) ? "completed" : b.status;
}

function toPublic(b: BookingRow, now = nowInCampus()): PublicBooking {
  const matric = parseMatric(b.matric_no, now);
  return {
    reference: b.reference,
    status: derivedStatus(b, now),
    canCancel: b.status === "confirmed" && !slotHasStarted(b.date, Number(b.start_hour), now),
    room: {
      id: b.room_id,
      name: b.room_name,
      type: b.room_type as RoomType,
      floor: b.room_floor,
      capacity: Number(b.room_capacity),
      minGroup: Number(b.room_min_group ?? 1),
      maxHours: Number(b.room_max_hours ?? MAX_DURATION_HOURS),
    },
    date: b.date,
    start: Number(b.start_hour),
    end: Number(b.end_hour),
    studentName: b.student_name,
    matricMasked: maskMatric(b.matric_no),
    programme: matric.ok ? matric.info.programme : "",
    groupSize: Number(b.group_size),
    purpose: b.purpose,
    createdAt: b.created_at,
    cancelledAt: b.cancelled_at,
  };
}

const BOOKING_SELECT = `
  SELECT b.reference, b.room_id, b.date, b.start_hour, b.end_hour, b.student_name, b.matric_no,
         b.group_size, b.purpose, b.status, b.created_at, b.cancelled_at,
         r.name AS room_name, r.type AS room_type, r.floor AS room_floor, r.capacity AS room_capacity,
         r.min_group AS room_min_group, r.max_hours AS room_max_hours
  FROM bookings b JOIN rooms r ON r.id = b.room_id`;

async function findBooking(q: Queryable, ref: string): Promise<BookingRow | undefined> {
  return q.get<BookingRow>(`${BOOKING_SELECT} WHERE b.reference = ?`, [ref]);
}

async function listRooms(q: Queryable): Promise<Room[]> {
  return (await q.all<RoomRow>("SELECT * FROM rooms ORDER BY sort_order")).map(toRoom);
}

/* ------------------------------------------------------------------ */
/* Feature 1 — Room Availability Viewer                                */
/* ------------------------------------------------------------------ */

export async function getAvailability(date: string, start: number, end: number): Promise<AvailabilityResponse> {
  const slotError = validateSlot(date, start, end);
  if (slotError) throw new BookingError(slotError, 400, "invalid_slot");

  const db = await getDb();
  const rooms = await listRooms(db);
  const bookings = await db.all<{ room_id: string; start_hour: number; end_hour: number }>(
    `SELECT room_id, start_hour, end_hour FROM bookings
     WHERE date = ? AND status = 'confirmed' ORDER BY start_hour`,
    [date],
  );

  return {
    date,
    start,
    end,
    checkedAt: new Date().toISOString(),
    rooms: rooms.map((room) => {
      const booked = bookings
        .filter((b) => b.room_id === room.id)
        .map((b) => [Number(b.start_hour), Number(b.end_hour)] as [number, number]);
      const clash = booked.some(([s, e]) => s < end && e > start);
      const tooLong = end - start > room.maxHours;
      const reason = clash ? ("booked" as const) : tooLong ? ("too_long" as const) : undefined;
      return { ...room, available: !reason, ...(reason ? { reason } : {}), booked };
    }),
  };
}

export async function getRoom(id: string): Promise<Room | null> {
  const db = await getDb();
  const row = await db.get<RoomRow>("SELECT * FROM rooms WHERE id = ?", [id]);
  return row ? toRoom(row) : null;
}

/* ------------------------------------------------------------------ */
/* Feature 2 — Room Booking Form                                       */
/* ------------------------------------------------------------------ */

export async function createBooking(input: NewBookingInput): Promise<PublicBooking> {
  const slotError = validateSlot(input.date, input.start, input.end);
  if (slotError) throw new BookingError(slotError, 400, "invalid_slot");

  const room = await getRoom(input.roomId);
  if (!room) throw new BookingError("That room doesn't exist.", 404, "room_not_found");

  if (input.end - input.start > room.maxHours) {
    throw new BookingError(
      `${room.name} can be booked for at most ${room.maxHours} hour${room.maxHours > 1 ? "s" : ""} at a time.`,
      400,
      "too_long",
    );
  }

  const fields = validateStudentDetails(input, room);
  if (Object.keys(fields).length) {
    throw new BookingError("Please fix the highlighted fields.", 400, "invalid_fields", fields);
  }
  const parsed = parseMatric(input.matricNo); // already validated above
  const matric = parsed.ok ? parsed.info.matric : "";

  const db = await getDb();
  // The write transaction holds the write lock *before* the availability check,
  // so two students submitting the same slot at the same moment are serialised:
  // the second one sees the first booking and gets a 409 (charter risk #1).
  const reference = await db.write(async (tx) => {
    const roomClash = await tx.get(
      `SELECT 1 FROM bookings WHERE room_id = ? AND date = ? AND status = 'confirmed'
       AND start_hour < ? AND end_hour > ? LIMIT 1`,
      [room.id, input.date, input.end, input.start],
    );
    if (roomClash) {
      throw new BookingError(
        "Sorry, someone just booked this room for an overlapping time. Please pick another slot.",
        409,
        "slot_taken",
      );
    }

    const studentClash = await tx.get<{ room_name: string }>(
      `SELECT r.name AS room_name FROM bookings b JOIN rooms r ON r.id = b.room_id
       WHERE b.matric_no = ? AND b.date = ? AND b.status = 'confirmed'
       AND b.start_hour < ? AND b.end_hour > ? LIMIT 1`,
      [matric, input.date, input.end, input.start],
    );
    if (studentClash) {
      throw new BookingError(
        `You already have ${studentClash.room_name} booked at an overlapping time.`,
        409,
        "student_overlap",
      );
    }

    // Pick a reference that isn't taken (a clash is astronomically rare).
    let ref = generateReference();
    for (let i = 0; i < 5 && (await tx.get("SELECT 1 FROM bookings WHERE reference = ?", [ref])); i++) {
      ref = generateReference();
    }

    await tx.run(
      `INSERT INTO bookings (reference, room_id, date, start_hour, end_hour, student_name, matric_no,
         group_size, purpose, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
      [
        ref,
        room.id,
        input.date,
        input.start,
        input.end,
        input.studentName.trim().replace(/\s+/g, " "),
        matric,
        input.groupSize,
        input.purpose,
        new Date().toISOString(),
      ],
    );
    return ref;
  });

  return (await getBooking(reference))!;
}

/* ------------------------------------------------------------------ */
/* Feature 3 — Booking Status Tracker                                  */
/* ------------------------------------------------------------------ */

export async function getBooking(rawRef: string): Promise<PublicBooking | null> {
  const ref = normaliseReference(rawRef);
  if (!isWellFormedReference(ref)) return null;
  const row = await findBooking(await getDb(), ref);
  return row ? toPublic(row) : null;
}

/**
 * There's no login in the MVP, so the matric number used to book acts as a
 * light second factor: knowing the reference alone isn't enough to cancel.
 */
export async function cancelBooking(rawRef: string, rawMatric: string): Promise<PublicBooking> {
  const ref = normaliseReference(rawRef);
  const parsed = parseMatric(rawMatric);
  if (!parsed.ok) {
    throw new BookingError(parsed.error, 400, "invalid_matric", { matricNo: parsed.error });
  }

  const db = await getDb();
  await db.write(async (tx) => {
    const row = await findBooking(tx, ref);
    if (!row) throw new BookingError("No booking found with that reference.", 404, "not_found");
    if (parsed.info.matric !== row.matric_no) {
      throw new BookingError("That matric number doesn't match this booking.", 403, "matric_mismatch", {
        matricNo: "Doesn't match the matric number used to book.",
      });
    }
    const current = toPublic(row);
    if (current.status === "cancelled") {
      throw new BookingError("This booking is already cancelled.", 409, "already_cancelled");
    }
    if (!current.canCancel) {
      throw new BookingError("This booking has already started, so it can't be cancelled.", 409, "too_late");
    }
    await tx.run(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE reference = ? AND status = 'confirmed'`,
      [new Date().toISOString(), ref],
    );
  });
  return (await getBooking(ref))!;
}

/* ------------------------------------------------------------------ */
/* Could-have — Room schedule dashboard for library staff              */
/* ------------------------------------------------------------------ */

export async function getStaffSchedule(date: string): Promise<StaffSchedule> {
  if (!isValidDateString(date)) throw new BookingError("Choose a valid date.", 400, "invalid_date");
  const now = nowInCampus();
  const db = await getDb();
  const rooms = await listRooms(db);

  const rows = await db.all<
    Pick<
      BookingRow,
      | "reference"
      | "room_id"
      | "date"
      | "start_hour"
      | "end_hour"
      | "student_name"
      | "matric_no"
      | "group_size"
      | "purpose"
      | "status"
      | "created_at"
    >
  >(
    `SELECT reference, room_id, date, start_hour, end_hour, student_name, matric_no, group_size,
            purpose, status, created_at
     FROM bookings WHERE date = ? ORDER BY start_hour, room_id`,
    [date],
  );

  const bookings: StaffBooking[] = rows.map((b) => {
    const m = parseMatric(b.matric_no, now);
    return {
      reference: b.reference,
      roomId: b.room_id,
      start: Number(b.start_hour),
      end: Number(b.end_hour),
      status: derivedStatus(b, now),
      studentName: b.student_name,
      matricMasked: maskMatric(b.matric_no),
      programme: m.ok ? m.info.programme : "Unknown",
      facultyCode: m.ok ? m.info.facultyCode : b.matric_no.slice(1, 3),
      facultyShort: m.ok ? m.info.facultyShort : "Unknown",
      facultyName: m.ok ? m.info.facultyName : "Unknown faculty",
      session: m.ok ? m.info.session : "",
      semesterLabel: m.ok ? m.info.semesterLabel : "",
      groupSize: Number(b.group_size),
      purpose: b.purpose,
      createdAt: b.created_at,
    };
  });

  const active = bookings.filter((b) => b.status !== "cancelled");
  const bookedHours = active.reduce((sum, b) => sum + (b.end - b.start), 0);
  const isToday = date === now.date;

  // Uses the generated programme_code column on the bookings table.
  const byProgramme = (
    await db.all<{ code: string; n: number }>(
      `SELECT programme_code AS code, COUNT(*) AS n FROM bookings
       WHERE date = ? AND status = 'confirmed' GROUP BY programme_code ORDER BY programme_code`,
      [date],
    )
  ).map((r) => ({
    programme: r.code === "B" ? "Bachelor's Degree" : r.code === "D" ? "Diploma" : r.code,
    count: Number(r.n),
  }));

  return {
    date,
    closed: !isOpenDay(date),
    isToday,
    nowHour: now.hour,
    nowMinute: now.minute,
    rooms,
    bookings,
    stats: {
      confirmed: active.length,
      cancelled: bookings.length - active.length,
      bookedHours,
      utilisation: rooms.length ? bookedHours / (rooms.length * (CLOSE_HOUR - OPEN_HOUR)) : 0,
      inUseNow: isToday ? active.filter((b) => b.start <= now.hour && now.hour < b.end).length : 0,
      byProgramme,
    },
  };
}
