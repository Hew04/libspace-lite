import { handleError } from "@/lib/api";
import { getAvailability } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/rooms/availability?date=2026-11-12&start=14&end=16 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? "";
    const start = Number(url.searchParams.get("start"));
    const end = Number(url.searchParams.get("end"));
    return Response.json(await getAvailability(date, start, end), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return handleError(e);
  }
}
