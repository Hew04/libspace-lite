// npm run db:reset
// Deletes your local database. Start the app again and it's recreated with the
// default data from seed/rooms.json and seed/demo-bookings.json.
// Stop the app (Ctrl + C) before running this. Want to keep your data? Run
// `npm run db:snapshot` first.
import fs from "node:fs";
import { DB_PATH, rel, removeDatabaseFiles } from "./db-common.mjs";

if (!fs.existsSync(DB_PATH)) {
  console.log(`\nNothing to reset: no database at ${rel(DB_PATH)}. Start the app to create it.\n`);
} else {
  removeDatabaseFiles(DB_PATH);
  console.log(`\n✔ Removed ${rel(DB_PATH)}. Start the app (npm run dev) to recreate it with the default data.\n`);
}
