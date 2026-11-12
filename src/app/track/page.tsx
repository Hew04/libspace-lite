import type { Metadata } from "next";
import { Tracker } from "@/components/Tracker";

export const metadata: Metadata = { title: "Track a booking" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Feature 3 — Booking Status Tracker. /track?ref=LS-7K3QXM */
export default async function TrackPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return <Tracker initialRef={typeof sp.ref === "string" ? sp.ref : ""} isNew={sp.new === "1"} />;
}
