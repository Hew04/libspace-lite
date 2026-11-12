import Link from "next/link";
import { CLOSE_HOUR, MAX_DURATION_HOURS, OPEN_HOUR } from "@/lib/config";
import type { RoomAvailability, RoomType } from "@/lib/types";
import { ClockIcon, DiscussionIcon, PinIcon, PodIcon, UsersIcon } from "./Icons";

const TYPE_STYLE: Record<RoomType, { icon: typeof PodIcon; tone: string }> = {
  "Discussion room": { icon: DiscussionIcon, tone: "var(--blue)" },
  "Carrel room": { icon: PodIcon, tone: "var(--peach)" },
};

/** "1 person", "5–8 people" or "Up to 8". */
export function groupLabel(room: { capacity: number; minGroup: number }): string {
  if (room.capacity === 1) return "1 person";
  if (room.minGroup > 1) return `${room.minGroup}–${room.capacity} people`;
  return `Up to ${room.capacity}`;
}

/** A strip of the library's opening hours, booked hours in red, the searched slot outlined. */
export function DayTimeline({
  booked,
  start,
  end,
  pastBefore,
}: {
  booked: [number, number][];
  start: number;
  end: number;
  /** Hours before this are already over (today only). */
  pastBefore: number;
}) {
  const hours = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
  const label = (h: number) => (h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`);
  return (
    <div className="timeline" aria-hidden="true">
      <div className="timeline-track" style={{ ["--hours" as string]: hours.length }}>
        {hours.map((h) => (
          <div
            key={h}
            className="t-cell"
            data-booked={booked.some(([s, e]) => h >= s && h < e)}
            data-past={h < pastBefore}
            data-selected={h >= start && h < end}
            title={`${label(h)}`}
          />
        ))}
      </div>
      <div className="timeline-labels">
        {[8, 11, 14, 17, 20, 22].map((h) => (
          <span key={h} style={{ left: `${((h - OPEN_HOUR) / (CLOSE_HOUR - OPEN_HOUR)) * 100}%` }}>
            {label(h)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RoomCard({
  room,
  date,
  start,
  end,
  pastBefore,
}: {
  room: RoomAvailability;
  date: string;
  start: number;
  end: number;
  pastBefore: number;
}) {
  const { icon: TypeIcon, tone } = TYPE_STYLE[room.type] ?? TYPE_STYLE["Discussion room"];
  const href = `/book?room=${room.id}&date=${date}&start=${start}&end=${end}`;
  return (
    <article className="room" data-available={room.available}>
      <div className="room-tile" style={{ ["--tile" as string]: tone }}>
        <TypeIcon size={22} />
      </div>
      <div className="room-body">
        <h3 className="room-name">{room.name}</h3>
        <div className="room-meta">
          <span>{room.type}</span>
          {room.floor && (
            <span>
              <PinIcon size={14} /> {room.floor}
            </span>
          )}
          <span>
            <UsersIcon size={14} /> {groupLabel(room)}
          </span>
          {room.maxHours < MAX_DURATION_HOURS && (
            <span>
              <ClockIcon size={14} /> Max {room.maxHours} hr{room.maxHours > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {room.amenities.length > 0 && (
          <div className="amenities">
            {room.amenities.map((a) => (
              <span key={a} className="amenity">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="room-action">
        {room.available ? (
          <Link href={href} className="btn btn-primary" aria-label={`Book ${room.name}`}>
            Book
          </Link>
        ) : room.reason === "too_long" ? (
          <span
            className="badge"
            style={{ ["--tone" as string]: "var(--yellow)" }}
            title={`${room.name} can be booked for at most ${room.maxHours} hours`}
          >
            {room.maxHours} hr max
          </span>
        ) : (
          <span className="badge" style={{ ["--tone" as string]: "var(--red)" }}>
            Booked
          </span>
        )}
      </div>
      <DayTimeline booked={room.booked} start={start} end={end} pastBefore={pastBefore} />
    </article>
  );
}
