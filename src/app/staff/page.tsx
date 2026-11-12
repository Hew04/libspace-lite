import type { Metadata } from "next";
import { StaffSchedule } from "@/components/StaffSchedule";
import { isValidDateString, nextOpenDay, nowInCampus } from "@/lib/time";

export const metadata: Metadata = { title: "Room schedule (staff)" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Could-have — room schedule dashboard for library staff. /staff?date=2026-11-12 */
export default async function StaffPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const now = nowInCampus();
  const date = typeof sp.date === "string" && isValidDateString(sp.date) ? sp.date : nextOpenDay(now.date);
  return <StaffSchedule now={now} initialDate={date} />;
}
