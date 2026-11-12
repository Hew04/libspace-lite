import { handleError } from "@/lib/api";
import { cancelBooking } from "@/lib/bookings";

export const runtime = "nodejs";

/** POST /api/bookings/LS-7K3QXM/cancel  { "matricNo": "B032410567" } */
export async function POST(req: Request, ctx: { params: Promise<{ ref: string }> }) {
  try {
    const { ref } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { matricNo?: unknown };
    return Response.json(await cancelBooking(decodeURIComponent(ref), String(body.matricNo ?? "")));
  } catch (e) {
    return handleError(e);
  }
}
