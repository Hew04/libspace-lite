/**
 * API tests for LibSpace Lite — run with `npm test`.
 * They call the real route handlers against a throwaway SQLite file, covering
 * the charter's test cases (§12) plus the weekday, matric and email rules.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { before, describe, test } from "node:test";

// Configure a fresh, empty database before any app module loads.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "libspace-test-"));
process.env.LIBSPACE_DB_PATH = path.join(tmp, "test.db");
process.env.SEED_DEMO_BOOKINGS = "false";
// Tests use their own copy of the rooms, so editing seed/ never breaks them.
process.env.LIBSPACE_SEED_DIR = path.join(process.cwd(), "tests", "fixtures");
delete process.env.TURSO_DATABASE_URL;

type Handler = (req: Request, ctx?: { params: Promise<{ ref: string }> }) => Promise<Response>;
let availability: Handler, create: Handler, getOne: Handler, cancel: Handler, staff: Handler;
let time: typeof import("../src/lib/time");
let validation: typeof import("../src/lib/validation");

const B = "http://test.local";
const ctx = (ref: string) => ({ params: Promise.resolve({ ref }) });
const post = (url: string, body: unknown) =>
  new Request(B + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (r: Response): Promise<any> => r.json();

let date: string; // an open weekday a few days ahead
let weekend: string;
const student = { studentName: "Hew Hao Hnam", matricNo: "B032410567", groupSize: 5, purpose: "Group discussion" };
const book = (over: Record<string, unknown> = {}) =>
  create(post("/api/bookings", { roomId: "DR-01", date, start: 10, end: 12, ...student, ...over }));

before(async () => {
  availability = (await import("../src/app/api/rooms/availability/route")).GET;
  create = (await import("../src/app/api/bookings/route")).POST;
  getOne = (await import("../src/app/api/bookings/[ref]/route")).GET as Handler;
  cancel = (await import("../src/app/api/bookings/[ref]/cancel/route")).POST as Handler;
  staff = (await import("../src/app/api/staff/schedule/route")).GET;
  time = await import("../src/lib/time");
  validation = await import("../src/lib/validation");

  const today = time.nowInCampus().date;
  date = time.openDaysFrom(time.addDays(today, 2), 1)[0];
  weekend = today;
  while (time.isOpenDay(weekend)) weekend = time.addDays(weekend, 1);
});

describe("Room availability", () => {
  test("lists all 16 rooms as free on an empty day", async () => {
    const r = await availability(new Request(`${B}/api/rooms/availability?date=${date}&start=10&end=12`));
    const body = await json(r);
    assert.equal(r.status, 200);
    assert.equal(body.rooms.length, 16);
    assert.ok(body.rooms.every((x: { available: boolean }) => x.available));
  });

  test("rejects weekends", async () => {
    const r = await availability(new Request(`${B}/api/rooms/availability?date=${weekend}&start=10&end=12`));
    assert.equal(r.status, 400);
    assert.match((await json(r)).error, /weekends/);
  });
});

describe("Booking (TC1, TC2, TC5)", () => {
  let ref = "";

  test("TC1: valid booking returns a reference", async () => {
    const r = await book();
    const body = await json(r);
    assert.equal(r.status, 201);
    assert.match(body.reference, /^LS-[A-Z0-9]{6}$/);
    assert.equal(body.matricMasked, "B03241****");
    assert.equal(body.programme, "Bachelor's Degree");
    ref = body.reference;
  });

  test("TC2: overlapping slot in the same room is refused", async () => {
    const r = await book({ start: 11, end: 13, matricNo: "B032410569" });
    assert.equal(r.status, 409);
    assert.equal((await json(r)).code, "slot_taken");
  });

  test("back-to-back slot is allowed", async () => {
    const r = await book({ start: 12, end: 14, matricNo: "B032410569" });
    assert.equal(r.status, 201);
  });

  test("same student can't hold two overlapping bookings", async () => {
    const r = await book({ roomId: "DR-02", start: 11, end: 12 });
    assert.equal(r.status, 409);
    assert.equal((await json(r)).code, "student_overlap");
  });

  test("simultaneous requests for one slot: exactly one wins", async () => {
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => book({ roomId: "DR-05", start: 15, end: 17, matricNo: `B0324100${i}1` })),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
  });

  test("TC5: empty form returns an error for every field", async () => {
    const r = await create(
      post("/api/bookings", { roomId: "DR-04", date, start: 10, end: 11, studentName: "", matricNo: "", groupSize: 9, purpose: "" }),
    );
    const body = await json(r);
    assert.equal(r.status, 400);
    for (const k of ["studentName", "matricNo", "groupSize", "purpose"]) assert.ok(body.fields?.[k], k);
  });

  test("edge cases: past date, too long, after closing, weekend, bad JSON", async () => {
    assert.equal((await book({ date: "2020-01-06" })).status, 400);
    assert.equal((await book({ roomId: "DR-04", start: 10, end: 14 })).status, 400);
    assert.equal((await book({ roomId: "DR-04", start: 21, end: 23 })).status, 400);
    assert.equal((await book({ roomId: "DR-04", date: weekend })).status, 400);
    assert.equal((await create(new Request(B + "/api/bookings", { method: "POST", body: "nope" }))).status, 400);
  });

  test("TC3: lookup works without prefix and in lower case", async () => {
    const r = await getOne(new Request(B), ctx(ref.slice(3).toLowerCase()));
    const body = await json(r);
    assert.equal(r.status, 200);
    assert.equal(body.reference, ref);
    assert.equal(body.status, "confirmed");
    assert.equal((await getOne(new Request(B), ctx("LS-ZZZZZZ"))).status, 404);
  });

  test("TC4: cancel needs the matching matric number", async () => {
    assert.equal((await cancel(post(`/x`, { matricNo: "123" }), ctx(ref))).status, 400);
    assert.equal((await cancel(post(`/x`, { matricNo: "B032410569" }), ctx(ref))).status, 403);
    const r = await cancel(post(`/x`, { matricNo: "b032410567" }), ctx(ref));
    assert.equal(r.status, 200);
    assert.equal((await json(r)).status, "cancelled");
    assert.equal((await cancel(post(`/x`, { matricNo: "B032410567" }), ctx(ref))).status, 409);

    const after = await json(await availability(new Request(`${B}/api/rooms/availability?date=${date}&start=10&end=11`)));
    assert.equal(after.rooms.find((x: { id: string }) => x.id === "DR-01").available, true);
  });
});

describe("Room rules (Main Campus)", () => {
  test("discussion rooms need at least 5 people and fit at most 8", async () => {
    let r = await book({ roomId: "DR-06", start: 8, end: 9, groupSize: 4 });
    assert.equal(r.status, 400);
    assert.match((await json(r)).fields.groupSize, /at least 5/);
    r = await book({ roomId: "DR-06", start: 8, end: 9, groupSize: 9 });
    assert.equal(r.status, 400);
    assert.match((await json(r)).fields.groupSize, /up to 8/);
  });

  test("discussion rooms allow at most 2 hours; carrel rooms allow 3", async () => {
    const r = await book({ roomId: "DR-06", start: 8, end: 11 });
    assert.equal(r.status, 400);
    assert.equal((await json(r)).code, "too_long");
    const c = await book({ roomId: "CR-02", start: 8, end: 11, groupSize: 1, matricNo: "B012410231" });
    assert.equal(c.status, 201);
  });

  test("carrel rooms are for one person", async () => {
    const r = await book({ roomId: "CR-03", start: 8, end: 9, groupSize: 2, matricNo: "B092410044" });
    assert.equal(r.status, 400);
    assert.match((await json(r)).fields.groupSize, /up to 1/);
  });

  test("a 3-hour search marks discussion rooms as too long, not booked", async () => {
    const body = await json(await availability(new Request(`${B}/api/rooms/availability?date=${date}&start=18&end=21`)));
    const dr = body.rooms.find((x: { id: string }) => x.id === "DR-02");
    const cr = body.rooms.find((x: { id: string }) => x.id === "CR-04");
    assert.equal(dr.available, false);
    assert.equal(dr.reason, "too_long");
    assert.equal(cr.available, true);
  });
});

describe("Student email = <matricNo>@student.utem.edu.my", () => {
  test("email is optional (derived from the matric number)", async () => {
    const r = await book({ roomId: "DR-03", start: 18, end: 19, matricNo: "D042520123" });
    assert.equal(r.status, 201);
  });

  test("a matching email is accepted, any case", async () => {
    const r = await book({ roomId: "DR-04", start: 18, end: 19, matricNo: "B052410777", email: "b052410777@Student.UTeM.edu.my" });
    assert.equal(r.status, 201);
  });

  test("a different email is rejected", async () => {
    for (const email of ["hew@student.utem.edu.my", "B032410567@gmail.com"]) {
      const r = await book({ roomId: "CR-01", start: 18, end: 19, groupSize: 1, email });
      assert.equal(r.status, 400, email);
      assert.match((await json(r)).fields.email, /matric number/);
    }
  });

  test("studentEmailFor builds the address", () => {
    assert.equal(validation.studentEmailFor(" b032410567 "), "B032410567@student.utem.edu.my");
  });
});

describe("Matric number structure", () => {
  const cases: [string, RegExp][] = [
    ["X032410567", /start with B/],
    ["B03241056", /10 characters/],
    ["B0324105678", /10 characters/],
    ["B03A410567", /digits only/],
    ["B002410567", /faculty/],
    ["B102410567", /faculty/],
    ["B039910567", /future/],
    ["B031010567", /too old/],
    ["B032430567", /semester/],
    ["B032410000", /registration/],
  ];
  for (const [m, re] of cases) {
    test(`rejects ${m}`, () => {
      const r = validation.parseMatric(m);
      assert.equal(r.ok, false);
      if (!r.ok) assert.match(r.error, re);
    });
  }

  test("decodes a diploma number", () => {
    const r = validation.parseMatric("d042520123");
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.info.programme, "Diploma");
      assert.equal(r.info.facultyCode, "04");
      assert.equal(r.info.facultyShort, "FTKM");
      assert.equal(r.info.facultyName, "Faculty of Mechanical Technology and Engineering");
      assert.equal(r.info.session, "2025/2026");
      assert.equal(r.info.semesterLabel, "Semester II");
      assert.equal(r.info.registrationNo, "0123");
    }
  });
});

describe("Exception path", () => {
  test("malformed date string is rejected", async () => {
    const r = await book({ date: "not-a-date" });
    assert.equal(r.status, 400);
    assert.match((await json(r)).error, /valid date/);
  });

  test("start time at or after end time is rejected", async () => {
    const r = await book({ start: 10, end: 10 });
    assert.equal(r.status, 400);
    assert.match((await json(r)).error, /after start/);
    const r2 = await book({ start: 12, end: 10 });
    assert.equal(r2.status, 400);
  });

  test("booking beyond 14-day window is rejected", async () => {
    const tooFar = time.addDays(time.lastBookableDate(date), 1);
    const r = await book({ date: tooFar });
    assert.equal(r.status, 400);
    assert.match((await json(r)).error, /14 days/);
  });

  test("start time before 8 AM is rejected", async () => {
    const r = await book({ start: 6, end: 8 });
    assert.equal(r.status, 400);
    assert.match((await json(r)).error, /8:00 AM/);
  });

  test("FAIX faculty code (12) valid from session 24", async () => {
    const r = await book({
      roomId: "CR-07",
      start: 8,
      end: 9,
      groupSize: 1,
      matricNo: "B122610001",
    });
    assert.equal(r.status, 201);
    const body = await json(r);
    assert.match(body.reference, /^LS-[A-Z0-9]{6}$/);
  });

  test("legacy faculty code (07-09) rejected for session 24+", async () => {
    const r = await book({
      roomId: "CR-08",
      start: 8,
      end: 9,
      groupSize: 1,
      matricNo: "B072410001",
    });
    assert.equal(r.status, 400);
    const body = await json(r);
    assert.match(body.fields.matricNo, /legacy/);
  });
});

describe("Staff schedule", () => {
  test("lists the day's bookings with decoded, masked matric numbers", async () => {
    const r = await staff(new Request(`${B}/api/staff/schedule?date=${date}`));
    const body = await json(r);
    assert.equal(r.status, 200);
    assert.equal(body.closed, false);
    assert.ok(body.bookings.length >= 3);
    assert.ok(body.bookings.every((b: { matricMasked: string }) => b.matricMasked.endsWith("****")));
    assert.ok(body.stats.byProgramme.some((p: { programme: string }) => p.programme === "Diploma"));
  });

  test("marks weekends as closed", async () => {
    const body = await json(await staff(new Request(`${B}/api/staff/schedule?date=${weekend}`)));
    assert.equal(body.closed, true);
  });
});
