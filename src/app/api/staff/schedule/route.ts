import { handleError } from "@/lib/api";
import { getStaffSchedule } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/staff/schedule?date=2026-11-12 — every booking for one day, for library staff.
 * Read-only, and matric numbers stay masked: there's no staff login in the MVP.
 */
export async function GET(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get("date") ?? "";
    return Response.json(await getStaffSchedule(date), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
