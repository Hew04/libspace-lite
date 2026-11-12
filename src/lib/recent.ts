"use client";

import { useSyncExternalStore } from "react";

/**
 * Bookings made on this device, kept in localStorage so they show up under
 * "Recents" in the sidebar (the way Claude lists recent chats). This is a
 * convenience only — the database is the source of truth, and nothing here
 * is needed to look a booking up.
 */
export interface RecentBooking {
  reference: string;
  roomName: string;
  date: string;
  start: number;
  end: number;
}

const KEY = "libspace:recent-bookings";
const EVENT = "libspace:recent-changed";
const MAX = 10;
const EMPTY: RecentBooking[] = [];

let cacheRaw: string | null = null;
let cacheValue: RecentBooking[] = EMPTY;

function read(): RecentBooking[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cacheRaw) return cacheValue;
    cacheRaw = raw;
    cacheValue = raw ? (JSON.parse(raw) as RecentBooking[]) : EMPTY;
    return cacheValue;
  } catch {
    return EMPTY;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useRecentBookings(): RecentBooking[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function rememberBooking(b: RecentBooking) {
  try {
    const next = [b, ...read().filter((x) => x.reference !== b.reference)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable (private mode) — recents are optional */
  }
}
