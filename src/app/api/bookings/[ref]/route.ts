import { handleError } from "@/lib/api";
import { getBooking } from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bookings/LS-7K3QXM — public status lookup (matric number is masked). */
export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await ctx.params;
    const booking = await getBooking(decodeURIComponent(ref));
    if (!booking) {
      return Response.json(
        { error: "No booking found with that reference. Check the code and try again.", code: "not_found" },
        { status: 404 },
      );
    }
    return Response.json(booking, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handleError(e);
  }
}
