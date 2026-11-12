// npm run db:snapshot [-- name]
// Saves a copy of your local database to snapshots/<name>.db, ready to send to
// a teammate. Safe to run while the app is running.
import fs from "node:fs";
import path from "node:path";
import { DB_PATH, SNAPSHOT_DIR, describe, fail, openDatabase, rel, stamp, vacuumInto } from "./db-common.mjs";

if (!fs.existsSync(DB_PATH)) fail(`No database at ${rel(DB_PATH)} yet. Run the app once (npm run dev) to create it.`);

const raw = process.argv[2] ?? `libspace-${stamp()}`;
const name = raw.replace(/\.db$/i, "").replace(/[^\w.-]+/g, "-");
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
const target = path.join(SNAPSHOT_DIR, `${name}.db`);
if (fs.existsSync(target)) fail(`${rel(target)} already exists. Pick another name: npm run db:snapshot -- my-name`);

const db = await openDatabase(DB_PATH, { readonly: true, fileMustExist: true });
const info = describe(db);
if (!info.ok) fail(`${rel(DB_PATH)} isn't a LibSpace database (missing: ${info.missing.join(", ")}).`);
vacuumInto(db, target);
db.close();

const kb = Math.ceil(fs.statSync(target).size / 1024);
console.log(`\n✔ Snapshot saved: ${rel(target)}  (${kb} KB)`);
console.log(`  ${info.rooms} rooms, ${info.bookings} bookings (${info.confirmed} confirmed)`);
console.log(`\n  Send this one file to your teammate. They load it with:`);
console.log(`  npm run db:restore -- ${path.basename(target)}\n`);
