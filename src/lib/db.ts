import "server-only";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "./migrations";
import { seed } from "./seed";

/**
 * Database access for LibSpace Lite.
 *
 * - Locally (no TURSO_DATABASE_URL): a SQLite file at data/libspace.db via better-sqlite3.
 * - Deployed (TURSO_DATABASE_URL set): Turso, hosted SQLite, via @libsql/client.
 *
 * Both speak the same SQL, so the rest of the app only sees the small `Db`
 * interface below. On first use the schema is migrated and rooms are seeded.
 */

export type SqlArg = string | number | null;

export interface Queryable {
  get<T>(sql: string, args?: SqlArg[]): Promise<T | undefined>;
  all<T>(sql: string, args?: SqlArg[]): Promise<T[]>;
  run(sql: string, args?: SqlArg[]): Promise<{ changes: number }>;
}

export interface Db extends Queryable {
  kind: "local" | "turso";
  /**
   * Runs `fn` in a write transaction (SQLite BEGIN IMMEDIATE): it holds the write
   * lock from the start, so check-then-insert can't race. Commits on success,
   * rolls back if `fn` throws.
   */
  write<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  /** Runs several statements atomically (used by migrations). */
  batch(statements: string[]): Promise<void>;
}

const LOCAL_DB_PATH = process.env.LIBSPACE_DB_PATH ?? path.join(process.cwd(), "data", "libspace.db");

// One connection per server process, reused across hot reloads in `next dev`.
const globalForDb = globalThis as unknown as { __libspaceDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__libspaceDb) {
    globalForDb.__libspaceDb = init().catch((e) => {
      globalForDb.__libspaceDb = undefined; // let the next request retry
      throw e;
    });
  }
  return globalForDb.__libspaceDb;
}

async function init(): Promise<Db> {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url && process.env.VERCEL) {
    // Vercel's disk is temporary — a local SQLite file would silently lose bookings.
    throw new Error("TURSO_DATABASE_URL is not set. Add it in Vercel → Project → Settings → Environment Variables.");
  }
  const db = url ? await openTurso(url, process.env.TURSO_AUTH_TOKEN) : await openLocal();
  await migrate(db);
  await seed(db);
  return db;
}

/* ---- Local file (better-sqlite3) ---------------------------------------- */

async function openLocal(): Promise<Db> {
  const { default: Database } = await import("better-sqlite3");
  fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
  const sqlite = new Database(LOCAL_DB_PATH);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");

  const q: Queryable = {
    get: async <T,>(sql: string, args: SqlArg[] = []) => sqlite.prepare(sql).get(...args) as T | undefined,
    all: async <T,>(sql: string, args: SqlArg[] = []) => sqlite.prepare(sql).all(...args) as T[],
    run: async (sql: string, args: SqlArg[] = []) => ({ changes: Number(sqlite.prepare(sql).run(...args).changes) }),
  };

  // One connection is shared by every request in this process, so write
  // transactions take turns rather than nesting.
  let queue: Promise<unknown> = Promise.resolve();
  function write<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const result = queue.then(async () => {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const value = await fn(q);
        sqlite.exec("COMMIT");
        return value;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    });
    queue = result.catch(() => undefined);
    return result;
  }

  return {
    kind: "local",
    ...q,
    write,
    batch: (statements) =>
      write(async () => {
        for (const s of statements) sqlite.exec(s);
      }),
  };
}

/* ---- Turso (@libsql/client) ---------------------------------------------- */

async function openTurso(url: string, authToken?: string): Promise<Db> {
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url, authToken });

  type Exec = (stmt: { sql: string; args: SqlArg[] }) => Promise<{ rows: unknown[]; rowsAffected: number }>;
  const wrap = (exec: Exec): Queryable => ({
    get: async <T,>(sql: string, args: SqlArg[] = []) => (await exec({ sql, args })).rows[0] as T | undefined,
    all: async <T,>(sql: string, args: SqlArg[] = []) => (await exec({ sql, args })).rows as T[],
    run: async (sql: string, args: SqlArg[] = []) => ({ changes: (await exec({ sql, args })).rowsAffected }),
  });

  return {
    kind: "turso",
    ...wrap((stmt) => client.execute(stmt)),
    async write<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
      const tx = await client.transaction("write");
      try {
        const value = await fn(wrap((stmt) => tx.execute(stmt)));
        await tx.commit();
        return value;
      } catch (e) {
        await tx.rollback().catch(() => undefined);
        throw e;
      } finally {
        tx.close();
      }
    },
    async batch(statements) {
      await client.batch(statements, "write");
    },
  };
}
