# Default data

The defaults are UTeM's **Main Campus** library rooms: Discussion Rooms 1–6 (5–8 users, 2 hours per use, booked by one representative) and Carrel Rooms 1–10 (1 user). Floors and equipment are left blank until the team confirms them.

These two files decide what a **new** database starts with. Edit them, then:

```bash
# stop the app first (Ctrl + C)
npm run db:reset
npm run dev
```

Your old data is gone after a reset. Take a snapshot first if you want to keep it (`npm run db:snapshot`).

If an entry is wrong, the app stops on its first request and the terminal names the file, the entry and the problem, e.g. `seed/demo-bookings.json, booking 3 (Kavitha Raj): "matric" D04251002: Must be 10 characters…`.

## rooms.json: the library rooms

| Field | Required | Rules |
| --- | --- | --- |
| `id` | yes | Unique, short, e.g. `CR-11`. Shown nowhere; used in links. |
| `name` | yes | e.g. `Discussion Room 5` |
| `type` | yes | `Discussion room` or `Carrel room` (sets the icon and colour) |
| `floor` | no | e.g. `Level 2` |
| `capacity` | yes | Most people allowed, 1 or more. The booking form's group size stops here. |
| `minGroup` | no | Fewest people allowed (default 1). Discussion rooms use 5. |
| `maxHours` | no | Longest booking in this room, 1–3 hours (default 3). Discussion rooms use 2. |
| `amenities` | no | List of short words, e.g. `["Whiteboard", "Projector"]` |
| `description` | no | One sentence |

Rooms appear in the order listed.

## demo-bookings.json: sample bookings

Dates are **relative**: `"day": 0` is the first weekday from the day the database is created, `1` the next weekday, and so on. The sample data always looks current after a reset. Use `[]` for no demo bookings.

| Field | Required | Rules |
| --- | --- | --- |
| `room` | yes | An `id` from rooms.json |
| `day` | yes | 0–9: 0 = first open weekday, 1 = the next… (weekends are skipped) |
| `start`, `end` | yes | Whole hours, 8–22, end after start, no longer than the room's `maxHours` |
| `name` | yes | Student's name |
| `matric` | yes | A valid UTeM matric number with a faculty code 01–09, e.g. `B032510142`. The email is derived from it. |
| `groupSize` | yes | From the room's `minGroup` to its `capacity` |
| `purpose` | yes | `Individual study`, `Group discussion`, `Assignment` or `Project work` |
| `status` | no | `confirmed` (default) or `cancelled` |

Two confirmed bookings for the same room can't overlap on the same day.

Demo bookings are only added locally. On Turso they're added only when `SEED_DEMO_BOOKINGS=true`.
