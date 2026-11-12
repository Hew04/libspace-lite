import {
  CLOSE_HOUR,
  FAIX_CODE,
  FAIX_SESSION,
  FACULTIES,
  LEGACY_CODES,
  MAX_DURATION_HOURS,
  MAX_SESSIONS_BACK,
  MERGER_SESSION,
  OPEN_HOUR,
  OPENING_SUMMARY,
  PROGRAMMES,
  type ProgrammeCode,
  PURPOSES,
  REFERENCE_PREFIX,
  STUDENT_EMAIL_DOMAIN,
} from "./config";
import {
  type CampusNow,
  earliestStartHour,
  isOpenDay,
  isValidDateString,
  lastBookableDate,
  nowInCampus,
} from "./time";

export type FieldErrors = Record<string, string>;

/* ---- Slot ---------------------------------------------------------------- */

/** Checks a date + time range is a weekday, inside opening hours and the booking window. */
export function validateSlot(date: string, start: number, end: number, now: CampusNow = nowInCampus()): string | null {
  if (!isValidDateString(date)) return "Choose a valid date.";
  if (date < now.date) return "That date has already passed.";
  if (!isOpenDay(date)) return `The library is closed on weekends. It's open ${OPENING_SUMMARY}.`;
  if (date > lastBookableDate(now.date)) return "Bookings open up to 14 days ahead.";
  if (!Number.isInteger(start) || !Number.isInteger(end)) return "Choose a valid time.";
  if (start < OPEN_HOUR || end > CLOSE_HOUR) return `The library is open ${OPENING_SUMMARY}.`;
  if (end <= start) return "End time must be after start time.";
  if (end - start > MAX_DURATION_HOURS) return `Bookings can be at most ${MAX_DURATION_HOURS} hours.`;
  if (start < earliestStartHour(date, now)) return "That time has already started. Pick a later slot.";
  return null;
}

/* ---- Matric number ------------------------------------------------------- */

export interface MatricInfo {
  matric: string;
  programmeCode: ProgrammeCode;
  programme: string;
  facultyCode: string;
  /** e.g. "FTMK" */
  facultyShort: string;
  /** e.g. "Faculty of Information and Communication Technology" */
  facultyName: string;
  /** True when the faculty code was retired (legacy student admitted before session 24). */
  legacy: boolean;
  sessionCode: string;
  /** e.g. "2024/2025" */
  session: string;
  semester: 1 | 2;
  /** e.g. "Semester I" */
  semesterLabel: string;
  /** e.g. "0567" */
  registrationNo: string;
}

export type MatricResult = { ok: true; info: MatricInfo } | { ok: false; error: string };

export function normaliseMatric(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

/**
 * Parses and checks a UTeM matric number, e.g. B032410567:
 * B (Bachelor's) · 03 (faculty) · 24 (session 2024/2025) · 1 (Semester I) · 0567 (registration no.).
 * Returns a specific message for the first part that's wrong.
 */
export function parseMatric(raw: string, now: CampusNow = nowInCampus()): MatricResult {
  const m = normaliseMatric(raw);
  if (!m) return { ok: false, error: "Enter your matric number, e.g. B012312345." };

  const first = m[0];
  if (!(first in PROGRAMMES)) {
    return { ok: false, error: "Must start with B (Bachelor's Degree) or D (Diploma)." };
  }
  if (!/^[A-Z]\d+$/.test(m)) return { ok: false, error: "After the B or D, use digits only." };
  if (m.length !== 10) {
    return { ok: false, error: `Must be 10 characters (B or D + 9 digits). You entered ${m.length}.` };
  }

  const facultyCode = m.slice(1, 3);
  const sessionCode = m.slice(3, 5);
  const semester = Number(m[5]);
  const registrationNo = m.slice(6, 10);

  const currentYY = Number(now.date.slice(2, 4));
  const sessionYY = Number(sessionCode);
  if (sessionYY > currentYY) {
    return { ok: false, error: `Digits 4–5 (session ${sessionCode}) can't be a future session.` };
  }
  if (sessionYY < currentYY - MAX_SESSIONS_BACK) {
    return { ok: false, error: `Digits 4–5 (session ${sessionCode}) are too old for a current student.` };
  }

  const faculty = FACULTIES[facultyCode];
  if (!faculty) {
    return { ok: false, error: `Digits 2–3 (faculty code ${facultyCode}) must be a UTeM faculty, 01–09 or 12.` };
  }

  if (facultyCode === FAIX_CODE && sessionYY < Number(FAIX_SESSION)) {
    return { ok: false, error: `Digits 2–3 (faculty code ${facultyCode}) is for FAIX, which started in session ${FAIX_SESSION}.` };
  }

  if (LEGACY_CODES.includes(facultyCode as (typeof LEGACY_CODES)[number]) && sessionYY >= Number(FAIX_SESSION)) {
    return { ok: false, error: `Digits 2–3 (faculty code ${facultyCode}) is a legacy code retired after session ${MERGER_SESSION}.` };
  }

  if (semester !== 1 && semester !== 2) {
    return { ok: false, error: "Digit 6 (admission semester) must be 1 or 2." };
  }
  if (registrationNo === "0000") return { ok: false, error: "Digits 7–10 (registration number) can't be 0000." };

  const startYear = 2000 + sessionYY;
  return {
    ok: true,
    info: {
      matric: m,
      programmeCode: first as ProgrammeCode,
      programme: PROGRAMMES[first as ProgrammeCode],
      facultyCode,
      facultyShort: faculty.short,
      facultyName: faculty.name,
      legacy: Boolean(faculty.legacy),
      sessionCode,
      session: `${startYear}/${startYear + 1}`,
      semester: semester as 1 | 2,
      semesterLabel: semester === 1 ? "Semester I" : "Semester II",
      registrationNo,
    },
  };
}

/** Hides the registration number (the part unique to one student): B03241****. */
export function maskMatric(m: string): string {
  return m.length === 10 ? `${m.slice(0, 6)}****` : "****";
}

/* ---- Email ------------------------------------------------------------- */

/** A student's UTeM email is their matric number at the student domain: B032410567@student.utem.edu.my */
export function studentEmailFor(matric: string): string {
  return normaliseMatric(matric) + STUDENT_EMAIL_DOMAIN;
}

/**
 * The email isn't typed in — it's derived from the matric number. If a client
 * sends one anyway, it must be that student's address.
 */
export function checkEmailMatchesMatric(email: string | undefined, matric: string): string | null {
  if (!email || !email.trim()) return null;
  if (email.trim().toLowerCase() !== studentEmailFor(matric).toLowerCase()) {
    return `Student email must be your matric number ${STUDENT_EMAIL_DOMAIN}, e.g. ${studentEmailFor(matric)}.`;
  }
  return null;
}

/* ---- Booking form -------------------------------------------------------- */

/** Validates the student-entered fields of the booking form. */
export function validateStudentDetails(
  input: { studentName: string; matricNo: string; email?: string; groupSize: number; purpose: string },
  room: { capacity: number; minGroup: number },
  now: CampusNow = nowInCampus(),
): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.studentName.trim().replace(/\s+/g, " ");
  if (name.length < 2) errors.studentName = "Enter your full name.";
  else if (name.length > 80) errors.studentName = "Name is too long (80 characters max).";
  else if (!/^[\p{L}][\p{L}\p{M} .'@/-]*$/u.test(name)) errors.studentName = "Use letters only (plus spaces, ' . - / @).";

  const matric = parseMatric(input.matricNo, now);
  if (!matric.ok) errors.matricNo = matric.error;

  if (matric.ok) {
    const emailError = checkEmailMatchesMatric(input.email, matric.info.matric);
    if (emailError) errors.email = emailError;
  }

  if (!Number.isInteger(input.groupSize) || input.groupSize < 1) errors.groupSize = "At least 1 person.";
  else if (input.groupSize < room.minGroup) errors.groupSize = `This room is for groups of at least ${room.minGroup}.`;
  else if (input.groupSize > room.capacity) errors.groupSize = `This room fits up to ${room.capacity}.`;

  if (!(PURPOSES as readonly string[]).includes(input.purpose)) errors.purpose = "Choose a purpose.";
  return errors;
}

/* ---- Reference code ------------------------------------------------------ */

/** Accepts "ls-7k3qxm", "7K3QXM" or "LS-7K3QXM" and returns "LS-7K3QXM". */
export function normaliseReference(v: string): string {
  const raw = v.trim().toUpperCase().replace(/\s+/g, "");
  const body = raw.startsWith(REFERENCE_PREFIX) ? raw.slice(REFERENCE_PREFIX.length) : raw.replace(/^LS/, "");
  return REFERENCE_PREFIX + body.replace(/[^A-Z0-9]/g, "");
}

export function isWellFormedReference(ref: string): boolean {
  return /^LS-[A-Z0-9]{6}$/.test(ref);
}
