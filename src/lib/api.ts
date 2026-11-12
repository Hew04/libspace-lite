import "server-only";
import { BookingError } from "./bookings";
import type { ApiError } from "./types";

/** Turns thrown errors into consistent JSON responses for the route handlers. */
export function handleError(e: unknown): Response {
  if (e instanceof BookingError) {
    const body: ApiError = { error: e.message, code: e.code, ...(e.fields ? { fields: e.fields } : {}) };
    return Response.json(body, { status: e.status });
  }
  console.error(e);
  const body: ApiError = { error: "Something went wrong on our side. Please try again.", code: "server_error" };
  return Response.json(body, { status: 500 });
}
