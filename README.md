# LibSpace Lite

Library room booking MVP for UTeM students (Software Project Management, Assignment 1).

Students pick a weekday and time, see which library rooms are free, book one, and get a reference code. They use the code to check the booking's status or cancel it. Library staff get a read-only schedule of each day's bookings. There's no login, no payment and no hardware, as defined in the project charter (§6.3).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · SQLite (a local file in development, [Turso](https://turso.tech) when deployed) · plain CSS with the Catppuccin palettes (Mauve primary)

**Team setup:** the project runs locally. [docs/LOCAL-SETUP.md](docs/LOCAL-SETUP.md) covers setup, editing the data and sharing it with teammates. Hosting is optional; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Getting started

Requires **Node.js 20.9 or newer**.

```bash
npm install
npm run dev
```

Open http://localhost:3000. On the first request the app creates `data/libspace.db` from the default data: the rooms in `seed/rooms.json` and the sample bookings in `seed/demo-bookings.json`, placed on the next few weekdays. There's nothing else to set up. To change the defaults, see [seed/README.md](seed/README.md).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | API tests against a throwaway database |
| `npm run check` | Type check, tests and production build. This is what CI runs; run it before every push. |
| `npm run build && npm start` | Production build and run |
| `npm run db:snapshot [-- name]` | Save a copy of your database to `snapshots/` to send to a teammate |
| `npm run db:restore -- <file>` | Replace your database with a snapshot (your current one is backed up first) |
| `npm run db:reset` | Delete your database. It's recreated from the default data in `seed/` on the next start (stop the app first). |

> **Windows note:** `better-sqlite3` ships prebuilt binaries for current Node versions. If `npm install` tries to compile it and fails, use a Node LTS release (20, 22 or 24).
>
> **Upgrading from an earlier zip:** an older `data/libspace.db` is rebuilt and re-seeded automatically on start. It only ever held demo data.

---

## Features

| # | Feature | Where | Notes |
| --- | --- | --- | --- |
| 1 | **Room Availability Viewer** | `/` | Pick a weekday (up to 14 days ahead), a start time and a duration of 1–3 hours. The 16 Main Campus rooms are listed with their group size, time limit and a timeline of the day. Results refresh every 30 seconds. |
| 2 | **Room Booking Form** | `/book` | Name, matric number (checked and decoded as you type), group size and purpose. The student email fills in from the matric number. Creates a unique `LS-XXXXXX` reference. |
| 3 | **Booking Status Tracker** | `/track` | Look up a booking by its reference to see its status (Confirmed / Cancelled / Completed). Cancelling also asks for the matric number used to book. |
| + | **Room schedule (library staff)** | `/staff` | The could-have staff dashboard: a day timeline of every room, daily stats (bookings, room usage, rooms in use now, bookings per programme) and a booking list. Click any booking for its details. |

**Extras:**

- **Recents:** the sidebar lists bookings made on this device (stored in localStorage), the way Claude lists recent chats.
- **Themes:** all 4 Catppuccin flavours (Latte, Frappé, Macchiato, Mocha) with Mauve as the primary colour. The default follows the OS light/dark setting.
- **Mobile layout:** below 860px the sidebar becomes a drawer. On phones the day and quick-pick rows scroll sideways, the staff timeline scrolls sideways with the room names pinned, and the booking list turns into cards. Form fields use 16px text, so iOS doesn't zoom in on them. Every page was tested at 360px and 390px wide for sideways overflow.

---

## Business rules

| Rule | Value |
| --- | --- |
| Opening days and hours | **Monday–Friday, 8:00 AM – 10:00 PM** (Malaysia time, whatever the server's timezone). Weekends are closed. |
| Rooms (Main Campus) | **Discussion Rooms 1–6:** 5–8 people, at most 2 hours, booked by one group representative. **Carrel Rooms 1–10:** 1 person, at most 3 hours. Set per room in `seed/rooms.json`. |
| Booking length | Whole hours, up to the room's limit, booked up to 14 calendar days ahead |
| Room conflicts | A room can't have overlapping confirmed bookings. This is the double-booking risk in the charter. |
| Student conflicts | A student (matric number) can't hold two overlapping bookings |
| Email | Always `<matricNo>@student.utem.edu.my`, e.g. `B032410567@student.utem.edu.my`. It's derived from the matric number, not typed. The database stores it as a generated column, and the API rejects any other address. |
| Cancellation | Only before the booking starts, and only with the matching matric number |
| Privacy | The tracker and staff view mask the registration digits (`B03241****`) and never show the email |

### Matric number format

A UTeM matric number has 10 characters, e.g. **`B032410567`**:

| Position | Example | Meaning | Check |
| --- | --- | --- | --- |
| 1 | `B` | Programme type: **B** = Bachelor's Degree, **D** = Diploma | Must be B or D |
| 2–3 | `03` | Faculty code | Must be 01–09 (table below) |
| 4–5 | `24` | Academic session code → session 2024/2025 | Not in the future, and at most 8 sessions back |
| 6 | `1` | Admission semester: 1 = Semester I, 2 = Semester II | Must be 1 or 2 |
| 7–10 | `0567` | Unique student registration number | Four digits, not `0000` |

**Faculty codes** (UTeM Academic Regulations, Jadual 3: Kod Fakulti), shown in the booking form and the staff schedule:

| Code | Short | Faculty |
| --- | --- | --- |
| 01 | FKE | Faculty of Electrical Engineering |
| 02 | FKEKK | Faculty of Electronics and Computer Engineering |
| 03 | FTMK | Faculty of Information and Communication Technology |
| 04 | FKM | Faculty of Mechanical Engineering |
| 05 | FKP | Faculty of Manufacturing Engineering |
| 06 | FPTT | Faculty of Technology Management and Technopreneurship |
| 07 | FTK | Faculty of Engineering Technology |
| 08 | FTKEE | Faculty of Electrical and Electronic Engineering Technology |
| 09 | FTKMP | Faculty of Mechanical and Manufacturing Engineering Technology |

The same rules are applied everywhere:

- **Browser:** `parseMatric()` in `src/lib/validation.ts` gives a specific message for the first part that's wrong (e.g. *"Digit 6 (admission semester) must be 1 or 2"*). When the number is valid, the form shows what it decodes to: *Bachelor's Degree · Faculty 03 · Session 2024/2025 · Semester I*.
- **Server:** the API re-runs the same function, so a request that skips the form is still checked.
- **Database:** a `CHECK` constraint enforces the pattern `[BD]` + 4 digits + `[12]` + 4 digits. Generated columns (`programme_code`, `faculty_code`, `session_code`, `admission_sem`, `registration_no`) split the number into its parts, and the staff dashboard's "By programme" count reads them.

To change these rules (e.g. how many sessions back count as a current student), edit `src/lib/config.ts`.

---

## Data storage: SQLite locally, Turso when deployed

The charter asks for a *"lightweight local stack"* using *"simple CRUD operations"*. SQLite fits:

- **Development:** a single file, `data/libspace.db`, created automatically. No accounts or servers.
- **Deployed:** Vercel can't keep files between requests, so the live site uses **Turso**, which is hosted SQLite with the same SQL. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` and the app switches over (`src/lib/db.ts`). Setup is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **No double booking:** availability is checked and the booking inserted inside one write transaction, which holds the write lock from the start. If two students submit the same slot at the same moment, the second gets a friendly "someone just booked this" message. This holds in both modes.
- **Rules in the database too:** weekday-only dates, opening hours, the 3-hour limit and the matric format are also `CHECK` constraints, so bad data can't get in even through a bug.
- **Versioned migrations:** schema changes are numbered migrations in `src/lib/migrations.ts`. Each runs once per database and is recorded in `schema_migrations`, so deploys never wipe data.
- **Easy evidence:** open the local `.db` file in [DB Browser for SQLite](https://sqlitebrowser.org/), or run `turso db shell` against the live database.

**Schema** (migration 1):

```
rooms    (id PK, name, type, floor, capacity, amenities, description, sort_order)
bookings (id PK, reference UNIQUE, room_id → rooms, date [Mon–Fri], start_hour, end_hour,
          student_name, matric_no [UTeM format], group_size, purpose,
          status ['confirmed'|'cancelled'], created_at, cancelled_at,
          email, programme_code, faculty_code, session_code, admission_sem, registration_no  ← generated from matric_no)
```

"Completed" isn't stored. A confirmed booking shows as completed once its end time has passed.

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Use Turso instead of the local file |
| `SEED_DEMO_BOOKINGS` | `true` / `false`: add demo bookings to an empty database. Default: on locally, off on Turso. |
| `LIBSPACE_DB_PATH` | Location of the local file (default `data/libspace.db`) |

---

## Project structure

```
src/
  app/
    page.tsx                             Feature 1 – availability viewer
    book/page.tsx                        Feature 2 – booking form
    track/page.tsx                       Feature 3 – status tracker
    staff/page.tsx                       Staff room schedule
    api/rooms/availability/route.ts      GET  ?date&start&end
    api/bookings/route.ts                POST create booking
    api/bookings/[ref]/route.ts          GET  booking by reference
    api/bookings/[ref]/cancel/route.ts   POST { matricNo }
    api/staff/schedule/route.ts          GET  ?date
    layout.tsx, globals.css              Shell, fonts, Catppuccin theme tokens, responsive rules
  components/                            AppShell (sidebar), FindRoom, RoomCard, BookingForm,
                                         Tracker, StaffSchedule, ThemeSwitcher, Icons
  lib/
    config.ts       business rules (days, hours, matric format, email domain)
    validation.ts   shared browser/server validation, parseMatric()
    time.ts         Malaysia-time and weekday helpers
    db.ts           database layer: local SQLite file or Turso, write transactions
    migrations.ts   numbered schema migrations
    seed.ts         loads and checks the default data from seed/
    bookings.ts     availability / create / lookup / cancel / staff schedule
    recent.ts       "Recents" sidebar (localStorage)
seed/               default rooms and demo bookings (JSON, editable)
scripts/            db:snapshot, db:restore, db:reset
tests/              npm test: API tests (node:test), with their own fixture data
.github/            CI workflow (typecheck, test, build) and Dependabot
docs/LOCAL-SETUP.md local setup, data sharing, workflow, demo day
docs/DEPLOYMENT.md  optional: hosting on Vercel + Turso
```

## API

| Method | Path | Body / query | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/rooms/availability` | `date=YYYY-MM-DD&start=14&end=16` | 200 rooms with `available` and `booked` | 400 invalid slot or weekend |
| POST | `/api/bookings` | `{roomId, date, start, end, studentName, matricNo, groupSize, purpose}` (`email` optional; must equal `<matricNo>@student.utem.edu.my`) | 201 booking + `reference` | 400 with `fields`, 404 room, 409 `slot_taken` / `student_overlap` |
| GET | `/api/bookings/:ref` | – | 200 booking | 404 |
| POST | `/api/bookings/:ref/cancel` | `{matricNo}` | 200 booking (cancelled) | 400 malformed matric, 403 mismatch, 404, 409 already cancelled / started |
| GET | `/api/staff/schedule` | `date=YYYY-MM-DD` | 200 rooms, bookings, stats (`closed: true` on weekends) | 400 invalid date |

---

## Test cases (charter §12 testing gate)

`npm test` runs the API cases (32 tests, also in CI). The UI flows were also checked in a headless browser, including 360px and 390px phone widths:

| # | Case | Expected | Result |
| --- | --- | --- | --- |
| TC1 | Valid room booking | 201, `LS-XXXXXX` reference, room shows Booked for that slot | Pass |
| TC2 | Duplicate / overlapping slot | 409 "someone just booked this", including when the form was opened before the other booking | Pass |
| TC3 | Reference code lookup | Status shown; case-insensitive, `LS-` prefix optional | Pass |
| TC4 | Booking cancellation | Wrong matric → refused; right matric → Cancelled, slot freed | Pass |
| TC5 | Empty input handling | Inline errors on every required field; nothing saved | Pass |
| TC6 | Weekend | Saturday/Sunday rejected by the API; the date picker moves to Monday with a notice; the staff view shows "closed" | Pass |
| TC7 | Matric format | Wrong letter, length, non-digits, faculty outside 01–09, future/old session, semester ≠ 1/2, registration 0000 all rejected with a specific message; programme and faculty decoded | Pass |
| TC9 | Room rules | Discussion room: under 5 or over 8 people refused, over 2 hours refused; carrel room: more than 1 person refused | Pass |
| TC8 | Student email | Derived as `<matricNo>@student.utem.edu.my`; any other address rejected | Pass |
| – | Other edge cases | Past date, over 3 hours, after closing, beyond 14 days, malformed JSON → 400 | Pass |

## Deferred (charter §4.2 / §6.3)

User authentication, payments, IoT door locks, occupancy sensors and push notifications are deferred, as are capacity and room-type filters. The staff schedule has no login, so it's read-only and shows masked data. A simple next step would be a staff passcode set through an environment variable.

## Note on AI use

This MVP was generated with Claude (Anthropic) from the team's project charter and Assignment 1 report. Per the charter's AI-use agreement (§7.5), the team should review, test and adjust it, and record that in report section 10.
