/**
 * Business rules for LibSpace Lite. Shared by the server (validation) and the
 * browser (form limits), so keep this file free of Node-only imports.
 */

/** UTeM is in Malaysia; "today" and "now" are always judged in this zone. */
export const TIMEZONE = "Asia/Kuala_Lumpur";

/** Library opening hours, as whole hours on a 24-hour clock. */
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 22;

/** Days the library takes bookings: 0 = Sunday … 6 = Saturday. Monday–Friday. */
export const OPEN_WEEKDAYS = [1, 2, 3, 4, 5] as const;
export const OPENING_SUMMARY = "Mon–Fri, 8:00 AM – 10:00 PM";

/** Longest single booking in any room, in hours. A room can set a lower limit (rooms.json "maxHours"). */
export const MAX_DURATION_HOURS = 3;

/** How many calendar days ahead a student may book (today = day 0). */
export const BOOKING_WINDOW_DAYS = 14;

export const PURPOSES = [
  "Individual study",
  "Group discussion",
  "Assignment",
  "Project work",
] as const;
export type Purpose = (typeof PURPOSES)[number];

/* ---- Student identity ------------------------------------------------- */

/**
 * UTeM matric number: 10 characters, e.g. B032410567
 *   1     programme type   B = Bachelor's Degree, D = Diploma
 *   2–3   faculty code     03 (01–09, see FACULTIES)
 *   4–5   academic session 24  → session 2024/2025
 *   6     admission sem.   1 = Semester I, 2 = Semester II
 *   7–10  registration no. 0567
 */
export const PROGRAMMES = { B: "Bachelor's Degree", D: "Diploma" } as const;
export type ProgrammeCode = keyof typeof PROGRAMMES;

/** UTeM faculty codes (Academic Regulations, Jadual 3: Kod Fakulti). */
export const FACULTIES: Record<string, { short: string; name: string; nameBM: string }> = {
  "01": { short: "FKE", name: "Faculty of Electrical Engineering", nameBM: "Fakulti Kejuruteraan Elektrik" },
  "02": { short: "FKEKK", name: "Faculty of Electronics and Computer Engineering", nameBM: "Fakulti Kejuruteraan Elektronik dan Kejuruteraan Komputer" },
  "03": { short: "FTMK", name: "Faculty of Information and Communication Technology", nameBM: "Fakulti Teknologi Maklumat dan Komunikasi" },
  "04": { short: "FKM", name: "Faculty of Mechanical Engineering", nameBM: "Fakulti Kejuruteraan Mekanikal" },
  "05": { short: "FKP", name: "Faculty of Manufacturing Engineering", nameBM: "Fakulti Kejuruteraan Pembuatan" },
  "06": { short: "FPTT", name: "Faculty of Technology Management and Technopreneurship", nameBM: "Fakulti Pengurusan Teknologi dan Teknousahawanan" },
  "07": { short: "FTK", name: "Faculty of Engineering Technology", nameBM: "Fakulti Teknologi Kejuruteraan" },
  "08": { short: "FTKEE", name: "Faculty of Electrical and Electronic Engineering Technology", nameBM: "Fakulti Teknologi Kejuruteraan Elektrik dan Elektronik" },
  "09": { short: "FTKMP", name: "Faculty of Mechanical and Manufacturing Engineering Technology", nameBM: "Fakulti Teknologi Kejuruteraan Mekanikal dan Pembuatan" },
};
export const MATRIC_PATTERN = /^[BD]\d{2}\d{2}[12]\d{4}$/;

/**
 * How many academic sessions back an admission may be and still be a current
 * student. A 4-year degree plus extensions fits comfortably inside 8.
 */
export const MAX_SESSIONS_BACK = 8;

export const STUDENT_EMAIL_DOMAIN = "@student.utem.edu.my";

export const REFERENCE_PREFIX = "LS-";
