import "server-only";
import type { Db } from "./db";

/**
 * Schema changes, applied in order, once each. The applied ids are recorded in
 * the `schema_migrations` table, so this is safe to run on every start — in
 * development and against the live Turso database.
 *
 * To change the schema: ADD a new migration at the end (next id). Never edit or
 * delete one that has already been deployed — the live database has run it.
 * See docs/DEPLOYMENT.md → "Changing the database".
 */
export interface Migration {
  id: number;
  name: string;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: "initial schema",
    statements: [
      `CREATE TABLE IF NOT EXISTS rooms (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,
        floor       TEXT NOT NULL,
        capacity    INTEGER NOT NULL CHECK (capacity > 0),
        amenities   TEXT NOT NULL DEFAULT '',   -- comma-separated
        description TEXT NOT NULL DEFAULT '',
        sort_order  INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS bookings (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        reference     TEXT NOT NULL UNIQUE,
        room_id       TEXT NOT NULL REFERENCES rooms(id),
        date          TEXT NOT NULL,              -- YYYY-MM-DD, campus time, Mon–Fri
        start_hour    INTEGER NOT NULL CHECK (start_hour >= 8),
        end_hour      INTEGER NOT NULL CHECK (end_hour <= 22),
        student_name  TEXT NOT NULL,
        -- UTeM matric: [B|D] faculty(2) session(2) semester[1|2] registration(4)
        matric_no     TEXT NOT NULL CHECK (matric_no GLOB '[BD][0-9][0-9][0-9][0-9][12][0-9][0-9][0-9][0-9]'),
        group_size    INTEGER NOT NULL CHECK (group_size > 0),
        purpose       TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
        created_at    TEXT NOT NULL,
        cancelled_at  TEXT,

        -- Derived from the matric number by SQLite, so they can never disagree with it.
        email           TEXT GENERATED ALWAYS AS (matric_no || '@student.utem.edu.my') VIRTUAL,
        programme_code  TEXT GENERATED ALWAYS AS (substr(matric_no, 1, 1)) VIRTUAL,
        faculty_code    TEXT GENERATED ALWAYS AS (substr(matric_no, 2, 2)) VIRTUAL,
        session_code    TEXT GENERATED ALWAYS AS (substr(matric_no, 4, 2)) VIRTUAL,
        admission_sem   INTEGER GENERATED ALWAYS AS (CAST(substr(matric_no, 6, 1) AS INTEGER)) VIRTUAL,
        registration_no TEXT GENERATED ALWAYS AS (substr(matric_no, 7, 4)) VIRTUAL,

        CHECK (end_hour > start_hour AND end_hour - start_hour <= 3),
        CHECK (CAST(strftime('%w', date) AS INTEGER) BETWEEN 1 AND 5)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings (room_id, date, status)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_matric_date ON bookings (matric_no, date, status)`,
    ],
  },
  {
    id: 2,
    name: "per-room group size and booking length",
    statements: [
      // Discussion rooms: 5–8 people, 2 hours per use. Carrel rooms: 1 person.
      "ALTER TABLE rooms ADD COLUMN min_group INTEGER NOT NULL DEFAULT 1 CHECK (min_group >= 1)",
      "ALTER TABLE rooms ADD COLUMN max_hours INTEGER NOT NULL DEFAULT 3 CHECK (max_hours BETWEEN 1 AND 3)",
    ],
  },
  // Next change goes here, e.g.:
  // { id: 3, name: "add rooms.is_active", statements: ["ALTER TABLE rooms ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"] },
];

export async function migrate(db: Db): Promise<void> {
  await db.run(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
    )`,
  );

  const applied = new Set(
    (await db.all<{ id: number }>("SELECT id FROM schema_migrations")).map((r) => Number(r.id)),
  );

  // Local databases made by the first MVP builds had no migrations table. They
  // only ever held demo data, so rebuild them. (Never happens on Turso.)
  if (db.kind === "local" && applied.size === 0) {
    const legacy = await db.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'bookings'");
    if (legacy) {
      console.warn("[libspace] Rebuilding a local database from an older MVP build.");
      await db.batch(["DROP TABLE IF EXISTS bookings", "DROP TABLE IF EXISTS rooms"]);
    }
  }

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    const name = m.name.replace(/'/g, "''");
    await db.batch([
      ...m.statements,
      `INSERT OR IGNORE INTO schema_migrations (id, name, applied_at) VALUES (${m.id}, '${name}', '${new Date().toISOString()}')`,
    ]);
    console.info(`[libspace] Applied migration ${m.id}: ${m.name}`);
  }
}
