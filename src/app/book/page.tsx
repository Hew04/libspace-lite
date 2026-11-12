import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";

export const metadata: Metadata = { title: "Book a room" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

/** Feature 2 — Room Booking Form. /book?room=DR-01&date=2026-11-12&start=14&end=16 */
export default async function BookPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <BookingForm
      roomId={String(sp.room ?? "")}
      date={String(sp.date ?? "")}
      start={Number(sp.start)}
      end={Number(sp.end)}
    />
  );
}
