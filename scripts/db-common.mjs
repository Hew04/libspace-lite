// Shared helpers for the db:* scripts. Plain Node — no build step needed.
import fs from "node:fs";
import path from "node:path";

export const DB_PATH = path.resolve(process.env.LIBSPACE_DB_PATH ?? path.join(process.cwd(), "data", "libspace.db"));
export const SNAPSHOT_DIR = path.resolve(process.cwd(), "snapshots");

export const rel = (p) => path.relative(process.cwd(), p) || p;

export async function openDatabase(file, options = {}) {
  try {
    const { default: Database } = await import("better-sqlite3");
    return new Database(file, options);
  } catch (e) {
    fail(`Couldn't load the SQLite driver (better-sqlite3). Run "npm install" first.\n  ${e.message}`);
  }
}

/** "2026-11-12-2130" in Malaysia time. */
export function stamp(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
}

/** Writes a compact, self-contained copy of `db` to `target` (safe while the app runs). */
export function vacuumInto(db, target) {
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
}

/** Row counts and checks that this is a LibSpace database. */
export function describe(db) {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
  const missing = ["rooms", "bookings", "schema_migrations"].filter((t) => !tables.has(t));
  if (missing.length) return { ok: false, missing };
  const count = (sql) => Number(db.prepare(sql).get().n);
  return {
    ok: true,
    rooms: count("SELECT COUNT(*) AS n FROM rooms"),
    bookings: count("SELECT COUNT(*) AS n FROM bookings"),
    confirmed: count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed'"),
    migrations: count("SELECT COUNT(*) AS n FROM schema_migrations"),
  };
}

export function removeDatabaseFiles(file) {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
}

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
