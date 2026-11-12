# Local setup & demo guide

LibSpace Lite runs entirely on each team member's laptop: no hosting, no online database. That matches the charter: a lightweight local stack, simple CRUD, synthetic data and a laptop demo. GitHub still holds the code, runs CI on every pull request and enforces the `main` ruleset.

- **The app:** `npm run dev`, then open http://localhost:3000.
- **The data:** one file, `data/libspace.db`, created from the default data on first run.
- **Each laptop has its own database.** Code is shared through GitHub; data isn't. Share data with snapshots (section 3).

Hosting on Vercel + Turso stays possible ([DEPLOYMENT.md](DEPLOYMENT.md)) but isn't needed. Leave `TURSO_DATABASE_URL` unset.

## 1. One-time setup on each laptop

1. **Install** [Node.js 22 LTS](https://nodejs.org) and [Git](https://git-scm.com).
2. **Accept the GitHub invite** from Hew Hao Hnam.
3. **Clone and install:**
   ```bash
   git clone https://github.com/Hew04/libspace-lite.git
   cd libspace-lite
   npm install
   ```
4. **Check everything works:** `npm run check` runs the type check, tests and build. All three must pass.
5. **Start the app:** `npm run dev`, then open http://localhost:3000.
6. **Set up a git login for pushing:** `gh auth login`, or a token with the `repo` and `workflow` scopes.

## 2. Everyday commands

| Command | What it does | When |
| --- | --- | --- |
| `npm run dev` | App at http://localhost:3000; reloads on save | Coding, testing |
| `npm run check` | Type check, tests and build (same as CI) | Before every push |
| `npm test` | The 32 API tests (own throwaway database and data) | After changing booking logic |
| `npm run build && npm start` | Optimised production version | Demo day |
| `npm run db:snapshot` | Copies your database to `snapshots/` to send to a teammate | To share or keep data |
| `npm run db:restore -- <file>` | Replaces your database with a snapshot (yours is backed up first) | When a teammate sends data |
| `npm run db:reset` | Deletes your database; it's recreated from the defaults on next start | Before a demo, or when data is messy |

Stop the app with **Ctrl + C**.

## 3. The local database

All data is in `data/libspace.db`. Git ignores it, so it's never pushed or overwritten by a pull.

- **Looking inside:** use [DB Browser for SQLite](https://sqlitebrowser.org) → *Open Database Read Only* → `data/libspace.db` → *Browse Data* → `bookings`. The `email`, `programme_code`, `faculty_code` and `session_code` columns are filled from the matric number.
- **Schema changes:** new entries in `src/lib/migrations.ts` apply automatically the next time you run the app after pulling. Existing bookings are kept.

### Send your data to a teammate (snapshots)

1. **Take the snapshot** (works while the app runs): `npm run db:snapshot -- demo-day` saves `snapshots/demo-day.db`.
2. **Send the file** via OneDrive, Telegram or email. `snapshots/` isn't pushed to GitHub: it holds names and matric numbers.
3. **The teammate loads it** with the app stopped:
   ```bash
   npm run db:restore -- ~/Downloads/demo-day.db
   npm run dev
   ```
   Their old database is saved first as `snapshots/before-restore-<time>.db`.

`npm run db:restore` with no file lists the snapshots in `snapshots/`.

### Change the default data

A new database starts with `seed/rooms.json` (rooms) and `seed/demo-bookings.json` (sample bookings). `seed/README.md` explains every field.

- **Rooms:** each needs an `id`, `name`, `type` (`Discussion room` or `Carrel room`) and `capacity`. Optional: `minGroup` (smallest group) and `maxHours` (longest booking).
- **Demo bookings:** `"day": 0` is the first weekday from the day the database is created, `1` the next, and so on. Use `[]` for none.

After editing: stop the app, run `npm run db:reset`, start it again. Snapshot first if you want to keep your current data.

Entries follow the booking rules: a valid matric number, whole hours 8–22, at most 3 hours, a group no bigger than the room, and no overlapping confirmed bookings. A broken entry stops the app with a message naming the file, the entry and the problem.

Commit changes to `seed/` through a PR so everyone shares the same defaults. `npm test` uses its own copy of the rooms, so editing the defaults never breaks the tests.

**Defaults or a snapshot?**
- **Edit the defaults** for permanent, shared data.
- **Use a snapshot** for one-off data, such as a demo state or a bug.

## 4. Team workflow without hosting

1. **Start:** `git switch main && git pull && git switch -c LIB-23-short-name`. Move the Jira issue to *In Progress*.
2. **Build:** code with `npm run dev` running. Run `npm run check` before pushing.
3. **Push:** `git add . && git commit -m "LIB-23 What changed"`, then `git push -u origin HEAD`. Open a PR titled `LIB-23 …` with how to test it. CI runs automatically.
4. **Review on your own laptop:** `git fetch && git switch LIB-23-short-name`, then `npm install` if dependencies changed, then `npm run dev`. Test against the acceptance criteria, then approve or request changes on GitHub.
5. **Merge:** *Squash and merge* once CI is green and the PR is approved.
6. **Everyone updates:** `git switch main && git pull`, then `npm install` if dependencies changed.
7. **Close the loop:** move the Jira issue to *Done* with the PR link and screenshots.

## 5. Demo day

**The day before**

- [ ] Demo laptop and backup laptop: `git switch main && git pull && npm install && npm run check`.
- [ ] Rehearse the test cases: book, clashing booking, track and cancel, staff schedule, weekend date, bad matric.

**Watch the dates:**
- A snapshot keeps its bookings' real dates. For a demo on another day, put the demo data in `seed/demo-bookings.json` and run `npm run db:reset` that morning; default bookings are always placed from the current day.
- At weekends the app shows Monday's rooms.

**On the day**

1. Run `npm run build`, then `npm start -- -H 0.0.0.0`. Allow the firewall prompt.
2. Find the laptop's address:
   - Windows: `ipconfig` → *IPv4 Address*
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
3. On a phone on the same Wi-Fi, open `http://<address>:3000`.
4. If the phone can't connect, campus Wi-Fi is probably blocking device-to-device traffic. Use a phone hotspot.

**Fallbacks:** screenshots in `docs/screenshots/` and a screen recording of the full flow.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `npm install` fails building `better-sqlite3` | No prebuilt driver for your Node version | Node 22 LTS, delete `node_modules`, reinstall |
| "Port 3000 is already in use" | App already running elsewhere | Close it, or `npm run dev -- -p 3001` |
| "Something went wrong"; terminal shows `[libspace] seed/…` | A default-data entry breaks a rule | Fix it, `npm run db:reset`, restart |
| Teammates see different bookings | Each laptop has its own database | Expected; use snapshots |
| `db:restore`: "isn't a LibSpace snapshot" | Wrong or damaged file | Ask for the file again |
| Rooms unchanged after editing `seed/rooms.json` | Defaults only apply to a new database | `npm run db:reset`, restart |
| Push rejected: token lacks `workflow` scope | Token permissions | `gh auth login`, or a token with `repo` + `workflow` |
| Push to `main` rejected: "repository rule violations" | Ruleset working as intended | Push a branch, open a PR |
| Phone can't open the app | Wi-Fi isolation or firewall | Phone hotspot; allow Node through the firewall |
