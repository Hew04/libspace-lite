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
export interface FacultyInfo {
  short: string;
  name: string;
  nameBM: string;
  /** True when the code was retired (legacy students keep old matric numbers until graduation). */
  legacy?: boolean;
}

/** Session the Engineering/Engineering Technology merger took effect. Legacy codes 07–09 retired after this. */
export const MERGER_SESSION = "23";

/** FAIX faculty code. */
export const FAIX_CODE = "12";

/** Session FAIX code 12 became valid. */
export const FAIX_SESSION = "24";

/** Codes retired at the 2023 merger; still valid only for students admitted before session 24. */
export const LEGACY_CODES = ["07", "08", "09"] as const;

export const FACULTIES: Record<string, FacultyInfo> = {
  "01": { short: "FTKE", name: "Faculty of Electrical Technology and Engineering", nameBM: "Fakulti Teknologi dan Kejuruteraan Elektrik" },
  "02": { short: "FTKEK", name: "Faculty of Electronics and Computer Technology and Engineering", nameBM: "Fakulti Teknologi dan Kejuruteraan Elektronik dan Komputer" },
  "03": { short: "FTMK", name: "Faculty of Information and Communications Technology", nameBM: "Fakulti Teknologi Maklumat dan Komunikasi" },
  "04": { short: "FTKM", name: "Faculty of Mechanical Technology and Engineering", nameBM: "Fakulti Teknologi dan Kejuruteraan Mekanikal" },
  "05": { short: "FTKIP", name: "Faculty of Industrial and Manufacturing Technology and Engineering", nameBM: "Fakulti Teknologi dan Kejuruteraan Industri dan Pembuatan" },
  "06": { short: "FPTT", name: "Faculty of Technology Management and Technopreneurship", nameBM: "Fakulti Pengurusan Teknologi dan Teknousahawanan" },
  "07": { short: "FTK", name: "Engineering Technology (Legacy)", nameBM: "Teknologi Kejuruteraan (Legasi)", legacy: true },
  "08": { short: "FTKEE", name: "Electrical and Electronic Engineering Technology (Legacy)", nameBM: "Teknologi Kejuruteraan Elektrik dan Elektronik (Legasi)", legacy: true },
  "09": { short: "FTKMP", name: "Mechanical and Manufacturing Engineering Technology (Legacy)", nameBM: "Teknologi Kejuruteraan Mekanikal dan Pembuatan (Legasi)", legacy: true },
  "12": { short: "FAIX", name: "Faculty of Artificial Intelligence and Cyber Security", nameBM: "Fakulti Kecerdasan Buatan dan Keselamatan Siber" },
};
export const MATRIC_PATTERN = /^[BD]\d{2}\d{2}[12]\d{4}$/;

/**
 * How many academic sessions back an admission may be and still be a current
 * student. A 4-year degree plus extensions fits comfortably inside 8.
 */
export const MAX_SESSIONS_BACK = 8;

export const STUDENT_EMAIL_DOMAIN = "@student.utem.edu.my";

export const REFERENCE_PREFIX = "LS-";
