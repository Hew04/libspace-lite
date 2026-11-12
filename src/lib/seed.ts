import "server-only";
import fs from "node:fs";
import path from "node:path";
import { CLOSE_HOUR, MAX_DURATION_HOURS, OPEN_HOUR, PURPOSES } from "./config";
import type { Db } from "./db";
import { generateReference } from "./reference";
import { type CampusNow, nowInCampus, openDaysFrom } from "./time";
import type { Room, RoomType } from "./types";
import { parseMatric } from "./validation";

/**
 * Default data for a new, empty database, read from two JSON files you can edit:
 *
 *   seed/rooms.json          the library rooms (synthetic — charter §14)
 *   seed/demo-bookings.json  sample bookings on the next few weekdays
 *
 * Changes apply to NEW databases only: after editing, stop the app, run
 * `npm run db:reset`, and start it again. See seed/README.md.
 */
const SEED_DIR = process.env.LIBSPACE_SEED_DIR ?? path.join(process.cwd(), "seed");

const ROOM_TYPES: RoomType[] = ["Discussion room", "Carrel room"];

interface DemoBooking {
  room: string;
  /** 0 = the first open weekday from today, 1 = the next one, … */
  day: number;
  start: number;
  end: number;
  name: string;
  matric: string;
  groupSize: number;
  purpose: string;
  status?: "confirmed" | "cancelled";
}

class SeedError extends Error {
  constructor(file: string, where: string, problem: string) {
    super(`[libspace] ${path.join(path.basename(SEED_DIR), file)}, ${where}: ${problem}`);
  }
}

function readJson<T>(file: string): T {
  const full = path.join(SEED_DIR, file);
  let text: string;
  try {
    text = fs.readFileSync(full, "utf8");
  } catch {
    throw new SeedError(file, "file", `not found at ${full}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new SeedError(file, "file", `isn't valid JSON (${(e as Error).message})`);
  }
}

/** Reads and checks seed/rooms.json. */
export function loadSeedRooms(): Room[] {
  const rooms = readJson<Room[]>("rooms.json");
  if (!Array.isArray(rooms) || rooms.length === 0) throw new SeedError("rooms.json", "file", "must be a non-empty list");
  const ids = new Set<string>();
  rooms.forEach((r, i) => {
    const at = `room ${i + 1}${r?.id ? ` (${r.id})` : ""}`;
    if (!r || typeof r.id !== "string" || !r.id.trim()) throw new SeedError("rooms.json", at, '"id" is required');
    if (ids.has(r.id)) throw new SeedError("rooms.json", at, `"id" ${r.id} is used twice`);
    ids.add(r.id);
    if (typeof r.name !== "string" || !r.name.trim()) throw new SeedError("rooms.json", at, '"name" is required');
    if (!ROOM_TYPES.includes(r.type)) throw new SeedError("rooms.json", at, `"type" must be one of: ${ROOM_TYPES.join(", ")}`);
    if (!Number.isInteger(r.capacity) || r.capacity < 1) throw new SeedError("rooms.json", at, '"capacity" must be a whole number, 1 or more');
    if (r.minGroup !== undefined && (!Number.isInteger(r.minGroup) || r.minGroup < 1 || r.minGroup > r.capacity))
      throw new SeedError("rooms.json", at, `"minGroup" must be a whole number from 1 to the capacity (${r.capacity})`);
    if (r.maxHours !== undefined && (!Number.isInteger(r.maxHours) || r.maxHours < 1 || r.maxHours > MAX_DURATION_HOURS))
      throw new SeedError("rooms.json", at, `"maxHours" must be a whole number from 1 to ${MAX_DURATION_HOURS}`);
    if (r.amenities !== undefined && !Array.isArray(r.amenities)) throw new SeedError("rooms.json", at, '"amenities" must be a list of words');
  });
  return rooms.map((r) => ({
    id: r.id.trim(),
    name: r.name.trim(),
    type: r.type,
    floor: String(r.floor ?? ""),
    capacity: r.capacity,
    minGroup: r.minGroup ?? 1,
    maxHours: r.maxHours ?? MAX_DURATION_HOURS,
    amenities: (r.amenities ?? []).map(String),
    description: String(r.description ?? ""),
  }));
}

/** Reads and checks seed/demo-bookings.json against the rooms and the booking rules. */
export function loadDemoBookings(rooms: Room[], now: CampusNow = nowInCampus()): DemoBooking[] {
  const list = readJson<DemoBooking[]>("demo-bookings.json");
  if (!Array.isArray(list)) throw new SeedError("demo-bookings.json", "file", "must be a list (use [] for none)");
  const byId = new Map(rooms.map((r) => [r.id, r]));
  list.forEach((b, i) => {
    const at = `booking ${i + 1}${b?.name ? ` (${b.name})` : ""}`;
    const room = byId.get(b?.room);
    if (!room) throw new SeedError("demo-bookings.json", at, `"room" ${b?.room} isn't in rooms.json`);
    if (!Number.isInteger(b.day) || b.day < 0 || b.day > 9) throw new SeedError("demo-bookings.json", at, '"day" must be 0–9 (0 = first open weekday)');
    if (!Number.isInteger(b.start) || !Number.isInteger(b.end) || b.start < OPEN_HOUR || b.end > CLOSE_HOUR || b.end <= b.start)
      throw new SeedError("demo-bookings.json", at, `"start"/"end" must be whole hours between ${OPEN_HOUR} and ${CLOSE_HOUR}, end after start`);
    if (b.end - b.start > room.maxHours) throw new SeedError("demo-bookings.json", at, `${room.id} can be booked for at most ${room.maxHours} hours`);
    if (typeof b.name !== "string" || b.name.trim().length < 2) throw new SeedError("demo-bookings.json", at, '"name" is required');
    const m = parseMatric(String(b.matric ?? ""), now);
    if (!m.ok) throw new SeedError("demo-bookings.json", at, `"matric" ${b.matric}: ${m.error}`);
    if (!Number.isInteger(b.groupSize) || b.groupSize < room.minGroup || b.groupSize > room.capacity)
      throw new SeedError("demo-bookings.json", at, `"groupSize" must be ${room.minGroup}–${room.capacity} for ${room.id}`);
    if (!(PURPOSES as readonly string[]).includes(b.purpose)) throw new SeedError("demo-bookings.json", at, `"purpose" must be one of: ${PURPOSES.join(", ")}`);
    if (b.status !== undefined && b.status !== "confirmed" && b.status !== "cancelled")
      throw new SeedError("demo-bookings.json", at, '"status" must be "confirmed" or "cancelled"');
  });

  // Two confirmed bookings for one room can't overlap — the app would never allow it.
  const active = list.filter((b) => b.status !== "cancelled");
  active.forEach((a, i) =>
    active.slice(i + 1).forEach((b) => {
      if (a.room === b.room && a.day === b.day && a.start < b.end && b.start < a.end)
        throw new SeedError("demo-bookings.json", `${a.name} and ${b.name}`, `overlap in ${a.room} on day ${a.day}`);
    }),
  );
  return list;
}

/**
 * Rooms are always seeded (once). Demo bookings are added to an empty bookings
 * table locally by default, and on Turso only when SEED_DEMO_BOOKINGS=true.
 */
export async function seed(db: Db): Promise<void> {
  const roomCount = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM rooms");
  const rooms = loadSeedRooms();
  if (Number(roomCount?.n ?? 0) === 0) {
    await db.write(async (tx) => {
      for (const [i, r] of rooms.entries()) {
        await tx.run(
          `INSERT OR IGNORE INTO rooms (id, name, type, floor, capacity, min_group, max_hours, amenities, description, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.name, r.type, r.floor, r.capacity, r.minGroup, r.maxHours, r.amenities.join(","), r.description, i],
        );
      }
    });
  }

  const flag = process.env.SEED_DEMO_BOOKINGS;
  const wantDemo = flag ? flag === "true" : db.kind === "local";
  if (!wantDemo) return;

  const now = nowInCampus();
  const demo = loadDemoBookings(rooms, now);
  if (demo.length === 0) return;
  const days = openDaysFrom(now.date, Math.max(...demo.map((b) => b.day)) + 1);

  await db.write(async (tx) => {
    const existing = await tx.get<{ n: number }>("SELECT COUNT(*) AS n FROM bookings");
    if (Number(existing?.n ?? 0) > 0) return;
    const created = new Date().toISOString();
    for (const b of demo) {
      const cancelled = b.status === "cancelled";
      await tx.run(
        `INSERT INTO bookings (reference, room_id, date, start_hour, end_hour, student_name, matric_no,
           group_size, purpose, status, created_at, cancelled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateReference(),
          b.room,
          days.at(b.day)!,
          b.start,
          b.end,
          b.name.trim(),
          b.matric.trim().toUpperCase(),
          b.groupSize,
          b.purpose,
          cancelled ? "cancelled" : "confirmed",
          created,
          cancelled ? created : null,
        ],
      );
    }
  });
}
