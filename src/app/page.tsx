import { FindRoom } from "@/components/FindRoom";
import { defaultSearch, nowInCampus } from "@/lib/time";

// "Now" changes every request — never prerender this page at build time.
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Feature 1 — Room Availability Viewer. */
export default async function HomePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const now = nowInCampus();
  const def = defaultSearch(now);

  const date = typeof sp.date === "string" ? sp.date : def.date;
  const start = Number(sp.start) || def.start;
  const duration = Number(sp.duration) || 2;

  return <FindRoom now={now} initial={{ date, start, duration }} />;
}
