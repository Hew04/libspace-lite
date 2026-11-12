// npm run db:restore -- <file.db>
// Replaces your local database with a snapshot (yours or one a teammate sent).
// Your current database is saved to snapshots/before-restore-<time>.db first.
// Stop the app (Ctrl + C) before running this.
import fs from "node:fs";
import path from "node:path";
import { DB_PATH, SNAPSHOT_DIR, describe, fail, openDatabase, rel, removeDatabaseFiles, stamp, vacuumInto } from "./db-common.mjs";

const arg = process.argv[2];
if (!arg) {
  const available = fs.existsSync(SNAPSHOT_DIR) ? fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith(".db")) : [];
  console.log("\nUsage: npm run db:restore -- <snapshot.db>");
  console.log("  The file can be anywhere (e.g. Downloads), or just a name from snapshots/.\n");
  console.log(available.length ? `Snapshots here:\n${available.map((f) => `  ${f}`).join("\n")}\n` : "No snapshots in snapshots/ yet.\n");
  process.exit(1);
}

// Accept a path, or a name inside snapshots/ (with or without .db).
const candidates = [arg, path.join(SNAPSHOT_DIR, arg), path.join(SNAPSHOT_DIR, `${arg}.db`)];
const source = candidates.map((c) => path.resolve(c)).find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
if (!source) fail(`Can't find "${arg}". Give the path to the .db file, or a name from snapshots/.`);
if (source === DB_PATH) fail("That's the database already in use.");

// Check the snapshot before touching anything.
const snap = await openDatabase(source, { readonly: true, fileMustExist: true });
let info;
try {
  info = describe(snap);
} catch {
  fail(`${rel(source)} isn't a SQLite database.`);
} finally {
  snap.close();
}
if (!info.ok) fail(`${rel(source)} isn't a LibSpace snapshot (missing: ${info.missing.join(", ")}).`);

// Keep a copy of what's there now.
if (fs.existsSync(DB_PATH)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const backup = path.join(SNAPSHOT_DIR, `before-restore-${stamp()}.db`);
  const current = await openDatabase(DB_PATH, { readonly: true, fileMustExist: true });
  vacuumInto(current, backup);
  current.close();
  console.log(`\n  Your previous database was saved to ${rel(backup)}`);
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
removeDatabaseFiles(DB_PATH);
fs.copyFileSync(source, DB_PATH);

console.log(`\n✔ Restored ${rel(source)} → ${rel(DB_PATH)}`);
console.log(`  ${info.rooms} rooms, ${info.bookings} bookings (${info.confirmed} confirmed)`);
console.log("\n  Start the app: npm run dev\n");
