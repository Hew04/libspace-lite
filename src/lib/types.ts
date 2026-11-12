export type RoomType = "Discussion room" | "Carrel room";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  floor: string;
  capacity: number;
  /** Smallest group allowed (discussion rooms: 5). */
  minGroup: number;
  /** Longest booking allowed in this room, in hours (discussion rooms: 2). */
  maxHours: number;
  amenities: string[];
  description: string;
}

export interface RoomAvailability extends Room {
  available: boolean;
  /** Why it can't be booked for the searched time: already booked, or longer than the room allows. */
  reason?: "booked" | "too_long";
  /** Confirmed bookings on the searched date, as [startHour, endHour] pairs. */
  booked: [number, number][];
}

export interface AvailabilityResponse {
  date: string;
  start: number;
  end: number;
  checkedAt: string;
  rooms: RoomAvailability[];
}

/** Stored status. "completed" is derived at read time once the slot has ended. */
export type StoredStatus = "confirmed" | "cancelled";
export type BookingStatus = StoredStatus | "completed";

/** What the public tracker sees: no full matric number or email. */
export interface PublicBooking {
  reference: string;
  status: BookingStatus;
  canCancel: boolean;
  room: Pick<Room, "id" | "name" | "type" | "floor" | "capacity" | "minGroup" | "maxHours">;
  date: string;
  start: number;
  end: number;
  studentName: string;
  matricMasked: string;
  /** Decoded from the matric number, e.g. "Bachelor's Degree". */
  programme: string;
  groupSize: number;
  purpose: string;
  createdAt: string;
  cancelledAt: string | null;
}

export interface NewBookingInput {
  roomId: string;
  date: string;
  start: number;
  end: number;
  studentName: string;
  matricNo: string;
  /** Optional: always <matricNo>@student.utem.edu.my. If sent, it must match. */
  email?: string;
  groupSize: number;
  purpose: string;
}

export interface ApiError {
  error: string;
  code: string;
  fields?: Record<string, string>;
}

/** Staff schedule view: one booking with its matric number decoded. */
export interface StaffBooking {
  reference: string;
  roomId: string;
  start: number;
  end: number;
  status: BookingStatus;
  studentName: string;
  matricMasked: string;
  programme: string;
  facultyCode: string;
  /** e.g. "FTMK" */
  facultyShort: string;
  /** e.g. "Faculty of Information and Communication Technology" */
  facultyName: string;
  session: string;
  semesterLabel: string;
  groupSize: number;
  purpose: string;
  createdAt: string;
}

export interface StaffSchedule {
  date: string;
  /** Weekend: the library is closed. */
  closed: boolean;
  isToday: boolean;
  /** Campus hour now (for the "now" line), only meaningful when isToday. */
  nowHour: number;
  nowMinute: number;
  rooms: Room[];
  bookings: StaffBooking[];
  stats: {
    confirmed: number;
    cancelled: number;
    bookedHours: number;
    /** Booked hours ÷ (rooms × opening hours), 0–1. */
    utilisation: number;
    inUseNow: number;
    byProgramme: { programme: string; count: number }[];
  };
}
