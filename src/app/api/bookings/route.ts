import { handleError } from "@/lib/api";
import { createBooking } from "@/lib/bookings";
import type { NewBookingInput } from "@/lib/types";

export const runtime = "nodejs";

/** POST /api/bookings — creates a booking and returns it with its reference code. */
export async function POST(req: Request) {
  let body: Partial<Record<keyof NewBookingInput, unknown>>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body.", code: "bad_json" }, { status: 400 });
  }
  try {
    const booking = await createBooking({
      roomId: String(body.roomId ?? ""),
      date: String(body.date ?? ""),
      start: Number(body.start),
      end: Number(body.end),
      studentName: String(body.studentName ?? ""),
      matricNo: String(body.matricNo ?? ""),
      email: body.email == null ? undefined : String(body.email),
      groupSize: Number(body.groupSize),
      purpose: String(body.purpose ?? ""),
    });
    return Response.json(booking, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
