# Deploy & maintain LibSpace Lite with GitHub

> **Optional.** The team currently runs LibSpace Lite locally; see [LOCAL-SETUP.md](LOCAL-SETUP.md). Use this guide only if you decide to host it.

LibSpace Lite runs on three free services. The code lives on **GitHub**, where every pull request is checked by GitHub Actions. **Vercel** builds and hosts the app, and **Turso** stores the bookings. On your laptop the app uses `data/libspace.db` instead, so development needs no accounts.

Vercel can't keep a SQLite file between requests, which is why the live site needs a hosted database ([Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)). Turso is hosted SQLite, so the same SQL runs in both places. The app switches automatically: if `TURSO_DATABASE_URL` is set it uses Turso, otherwise the local file.

```
Your laptop ──git push──▶ Pull request ──▶ Vercel preview ──▶ Turso staging   (sample bookings)
(local SQLite)            CI + QA review
                               │ merge
                               ▼
                          main branch ──▶ Vercel production ──▶ Turso production (real bookings)
```

| Service | Job in this project | Plan | Cost |
| --- | --- | --- | --- |
| GitHub | Code, pull requests, CI checks, Dependabot updates | Free | RM 0 |
| Vercel | Builds and hosts the app; a preview link for every pull request | Hobby (personal, non-commercial use) | RM 0 |
| Turso | Hosted SQLite: a production and a staging database | Free | RM 0 |

---

## 1. Put the project on GitHub

Create the repo on your **personal account** (`Hew04`) and make it **public**. Free plans only allow branch protection on public repos. Personal repos can't give anyone read-only access, so add only teammates as collaborators and send your lecturer the link. Making it public is safe: the repo holds no secrets and only synthetic data.

1. **Install** Node.js 22 LTS and Git. Unzip the project, then in its folder run `npm install` and `npm run check`.
   - `npm install` creates `package-lock.json`, which must be committed because CI installs from it.
   - `npm run check` runs the type check, the tests and a production build. All three must pass.
2. **Create the repo:** *New repository* → owner `Hew04` → `libspace-lite` → **Public**, with no README. Then push:
   ```bash
   git init -b main
   git add .
   git commit -m "LIB-1 Initial LibSpace Lite MVP"
   git remote add origin https://github.com/Hew04/libspace-lite.git
   git push -u origin main
   ```
   The push needs a token with the `workflow` scope, or a login through `gh auth login`, because the project includes a CI workflow file.
3. **Add teammates:** repo → *Settings* → *Collaborators* → *Add people*: Law Kok Liang and Mun Pin Pin. They get write access once they accept the email invite. Your lecturer needs nothing: send them the repo link.
4. **Protect `main`:** repo → *Settings* → *Rules* → *Rulesets* → *New branch ruleset*. Target the default branch and turn on:
   - Require a pull request before merging, with 1 approval
   - Require status checks to pass, adding **Typecheck, test, build**. It appears after CI has run once.
   - Block force pushes

   Leave the ruleset's bypass list empty. The rules then apply to you as the owner too, so every change gets a real review.

If the team wants the repo **private**, branch protection needs GitHub Pro. Students can get it free through the GitHub Student Developer Pack. Your lecturer then has to be added as a collaborator, which means write access, but the protected `main` branch still blocks direct pushes.

## 2. Create the Turso databases

You need two databases, `libspace-prod` and `libspace-staging`, plus a URL and a token for each. The app creates its tables and the 16 rooms on its first request.

```bash
# Install: brew install tursodatabase/tap/turso   (macOS)
#          curl -sSfL https://get.tur.so/install.sh | bash   (Linux / WSL)
turso auth signup                 # or: turso auth login
turso db locations --closest      # choose this location if asked (Singapore if listed)

turso db create libspace-prod
turso db create libspace-staging
turso db show libspace-prod --url
turso db tokens create libspace-prod
turso db show libspace-staging --url
turso db tokens create libspace-staging
```

Keep the URLs and tokens in a password manager. They go only into Vercel's settings, never into the repo, chat apps or AI tools (the charter's AI-use rules prohibit putting credentials into AI tools).

## 3. Connect Vercel

1. **Import the repo:** sign in at vercel.com with GitHub. Go to *Add New* → *Project* and import `Hew04/libspace-lite` (grant Vercel access to that repo when asked). It detects Next.js, so keep the build settings as they are.
2. **Add the environment variables before the first deploy:**

| Variable | Production | Preview |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | URL of `libspace-prod` | URL of `libspace-staging` |
| `TURSO_AUTH_TOKEN` | token for `libspace-prod` | token for `libspace-staging` |
| `SEED_DEMO_BOOKINGS` | unset (live site starts clean) | `true` (testers see sample bookings) |

3. **Deploy.** The site goes live at a `*.vercel.app` address, which you can rename under *Settings* → *Domains*.
4. **Set the region:** *Settings* → *Functions* → region **Singapore (sin1)**, then redeploy.
5. **Set Node.js 22:** *Settings* → *Build and Deployment* → Node.js **22.x**.

Changing an environment variable doesn't affect the running site until you redeploy. If `TURSO_DATABASE_URL` is missing on Vercel, the app stops with that message in the logs instead of quietly losing bookings.

## 4. Smoke-test the first deploy

- [ ] The home page lists 16 rooms (6 discussion, 10 carrel) for the next weekday, with no demo bookings
- [ ] Book a room; a `LS-XXXXXX` reference appears and the email shows as `<matric>@student.utem.edu.my`
- [ ] *Track booking*: look it up, then cancel it with the same matric number
- [ ] *Room schedule* shows it as Cancelled when *Show cancelled* is on
- [ ] `turso db shell libspace-prod "SELECT reference, room_id, date, status FROM bookings"` shows it
- [ ] A test PR gets a green CI check and a Vercel preview link with sample bookings

## 5. Everyday workflow: Jira issue to live site

1. **Start:** move the Jira issue to *In Progress*, then `git switch main && git pull && git switch -c LIB-23-short-name`.
2. **Build and check locally:** `npm run dev` while working, then `npm run check` before every push.
3. **Commit with the key:** `git commit -m "LIB-23 What changed"`, then `git push -u origin HEAD`.
4. **Open a PR** titled `LIB-23 …` saying what changed and how to test it. CI runs and Vercel comments a preview link that uses the staging database.
5. **Review (QA/UX lead):** test the preview against the acceptance criteria, then approve or request changes. When she wrote the change herself, Hew Hao Hnam or Law Kok Liang reviews it instead.
6. **Merge:** *Squash and merge* once green and approved. Vercel updates the live site within minutes. Delete the branch.
7. **Close the loop:** move the Jira issue to *Done* and attach the PR link and screenshots (Definition of Done).

Install **GitHub for Jira** in Jira (*Apps* → *Explore more apps*) and connect `Hew04/libspace-lite`. Branches, commits and PRs mentioning `LIB-23` then appear on that issue. Dependabot's weekly PRs follow the same review.

## 6. Changing the database

Schema changes are numbered migrations in `src/lib/migrations.ts`. Each runs once per database, and the database remembers which ones it has run.

- **Add, don't edit:** add a new migration at the end. Never edit or delete one that has been deployed.
- **Where it runs, in order:**
  1. Your laptop, on the next request.
  2. The staging database, on the PR preview's first request.
  3. Production, on the first request after the merge deploys.
- **Failures are safe:** a failed migration rolls back completely.

```ts
{ id: 3, name: "add rooms.is_active",
  statements: ["ALTER TABLE rooms ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"] },
```

**Prefer additive changes** (new columns with defaults, new tables), so rolling back on Vercel stays safe. To rename or remove something, do it over two releases.

**Rules that live in two places:** opening hours, weekdays only, the 3-hour limit and the matric format are set in `src/lib/config.ts` *and* enforced as `CHECK` constraints in migration 1.

- **Tightening a rule:** change `config.ts` only.
- **Loosening one** (e.g. opening on Saturday): also add a migration that rebuilds the table.

```sql
CREATE TABLE bookings_new ( /* migration 1's definition, with the new CHECK */ );
INSERT INTO bookings_new (id, reference, room_id, date, start_hour, end_hour, student_name,
  matric_no, group_size, purpose, status, created_at, cancelled_at)
  SELECT id, reference, room_id, date, start_hour, end_hour, student_name,
  matric_no, group_size, purpose, status, created_at, cancelled_at FROM bookings;
DROP TABLE bookings;
ALTER TABLE bookings_new RENAME TO bookings;
CREATE INDEX idx_bookings_room_date ON bookings (room_id, date, status);
CREATE INDEX idx_bookings_matric_date ON bookings (matric_no, date, status);
```

Back up before risky migrations: `turso db shell libspace-prod .dump > backup-YYYY-MM-DD.sql`.

## 7. Releases and rollback

- **Sprint release:**
  ```bash
  git tag -a v0.4.0 -m "Sprint 2"
  git push origin v0.4.0
  ```
  Then GitHub → *Releases* → *Draft a new release* → *Generate release notes*.
- **Site broken:** Vercel → *Deployments* → last good one → ⋯ → *Instant Rollback*. Then use *Revert* on the merged PR, or fix the bug on a new branch.
- **Database:** a rollback doesn't undo migrations, so keep them additive.
- **Restore data:**
  ```bash
  turso db create libspace-restore
  turso db shell libspace-restore < backup-YYYY-MM-DD.sql
  ```
  Then point Production's Turso variables at it and redeploy.

## 8. Routine maintenance

| When | Task | Owner |
| --- | --- | --- |
| Weekly (Monday) | Merge Dependabot PRs once CI is green | Development lead |
| Weekly | Check Vercel *Logs* and the latest deployment | Development lead |
| Weekly | Clear stale branches and PRs; Jira keys on open PRs | PM |
| Monthly | `.dump` backup of production to the team OneDrive | PM |
| Monthly | Check Turso and Vercel usage | Development lead |
| Each sprint | Release tag, README test cases, Jira evidence | PM, QA/UX lead |
| If a token leaks | `turso db tokens invalidate libspace-prod`, create a new one, update Vercel, redeploy | Development lead |
| End of semester | Final backup, archive the repo, remove unused Vercel and Turso resources | PM |

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Live site errors; logs say `TURSO_DATABASE_URL is not set` | Variable missing for that environment | Add it, redeploy |
| CI fails at `npm ci` | `package-lock.json` missing or stale | `npm install`, commit the lock file |
| Preview shows no bookings | Staging database empty | `SEED_DEMO_BOOKINGS=true` for Preview, redeploy |
| Bookings fail after changing hours or days | Old `CHECK` constraint in the database | Table-rebuild migration (section 6) |
| `[libspace] This Node.js … has no built-in SQLite` | Node.js older than 22.13 | Install Node.js 22, 24 or 26 LTS |
| Pushes stop deploying | Hobby plan's daily deployment limit reached | Wait for the reset; push fewer commits |

## 10. Alternative: Railway, keeping the SQLite file

Railway can run the app as a normal server with a persistent volume, with no code changes. New accounts get a one-time $5 trial credit, then the Hobby plan is $5 a month ([Railway pricing](https://docs.railway.com/pricing/plans)).

1. *New Project* → *Deploy from GitHub repo* → `libspace-lite`.
2. *Add Volume* mounted at `/data`.
3. Variables: `LIBSPACE_DB_PATH=/data/libspace.db` and `SEED_DEMO_BOOKINGS=false`.
4. *Settings* → *Networking* → *Generate Domain*.

Run a single instance only, and back up by downloading the file from the volume.

## Sources

- [Is SQLite supported in Vercel?](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel) · [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Turso pricing](https://turso.tech/pricing.md) · [Turso tokens](https://docs.turso.tech/sdk/authorization/tokens)
- [GitHub: about protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · [GitHub: personal repo permissions](https://docs.github.com/en/enterprise-cloud@latest/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository)
- [Railway pricing plans](https://docs.railway.com/pricing/plans)

Plans and limits change. Re-check them before relying on a number.
