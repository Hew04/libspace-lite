"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRecentBookings, forgetBooking } from "@/lib/recent";
import { formatDate, formatHour, nowInCampus, slotHasEnded } from "@/lib/time";
import { GridIcon, LogoMark, MenuIcon, PlusIcon, SearchIcon, SidebarIcon, TicketIcon, XIcon } from "./Icons";
import { ThemeSwitcher } from "./ThemeSwitcher";

const COLLAPSE_KEY = "libspace:sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const recents = useRecentBookings();
  const now = nowInCampus();
  const [notFoundRefs, setNotFoundRefs] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [pathname]);

  // Check each recent booking against the API; mark not-found refs so they can be removed.
  useEffect(() => {
    let cancelled = false;
    const checkRefs = async () => {
      const notFound = new Set<string>();
      await Promise.all(
        recents.map(async (r) => {
          try {
            const res = await fetch(`/api/bookings/${encodeURIComponent(r.reference)}`, {
              cache: "no-store",
            });
            if (res.status === 404) notFound.add(r.reference);
          } catch {
            /* network failure — leave ref out of notFound set */
          }
        }),
      );
      if (!cancelled) setNotFoundRefs(notFound);
    };
    checkRefs();
    return () => {
      cancelled = true;
    };
  }, [recents]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  const nav = [
    { href: "/", label: "Find a room", icon: SearchIcon },
    { href: "/track", label: "Track booking", icon: TicketIcon },
  ];

  return (
    <div className="shell" data-collapsed={collapsed} data-mobile-open={mobileOpen}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-top">
          <Link href="/" className="brand hide-collapsed" aria-label="LibSpace Lite home">
            <LogoMark className="brand-mark" />
            <span className="brand-name">
              LibSpace <span>Lite</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn collapse-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <SidebarIcon />
          </button>
        </div>

        <Link href="/" className="nav-item new-booking" title="New booking">
          <span className="plus">
            <PlusIcon size={15} strokeWidth={2.4} />
          </span>
          <span className="hide-collapsed">New booking</span>
        </Link>

        {nav.map(({ href, label, icon: I }) => (
          <Link
            key={href}
            href={href}
            className="nav-item"
            aria-current={pathname === href ? "page" : undefined}
            title={label}
          >
            <I />
            <span className="hide-collapsed">{label}</span>
          </Link>
        ))}

        <div className="sidebar-section hide-collapsed">Library staff</div>
        <Link
          href="/staff"
          className="nav-item"
          aria-current={pathname === "/staff" ? "page" : undefined}
          title="Room schedule"
        >
          <GridIcon />
          <span className="hide-collapsed">Room schedule</span>
        </Link>

        <div className="sidebar-section hide-collapsed">Recents</div>
        <nav className="recents hide-collapsed" aria-label="Recent bookings">
          {recents.length === 0 ? (
            <p className="recents-empty">Bookings you make on this device will appear here.</p>
          ) : (
            recents.map((r) => (
              <Link
                key={r.reference}
                href={`/track?ref=${r.reference}`}
                className="nav-item recent-item"
                style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}
              >
                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="r-title">{r.roomName}</span>
                  <span className="r-sub">
                    {formatDate(r.date)} · {formatHour(r.start)} · <span className="mono">{r.reference}</span>
                  </span>
                </div>
                {(slotHasEnded(r.date, r.end, now) || notFoundRefs.has(r.reference)) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      forgetBooking(r.reference);
                    }}
                    aria-label={`Remove ${r.reference}`}
                    style={{
                      padding: 2,
                      background: "transparent",
                      border: 0,
                      color: "var(--muted)",
                      cursor: "pointer",
                      flex: "none",
                    }}
                  >
                    <XIcon size={12} strokeWidth={1.6} />
                  </button>
                )}
              </Link>
            ))
          )}
        </nav>

        <div className="sidebar-footer">
          <ThemeSwitcher />
          <div className="profile">
            <span className="avatar">UT</span>
            <span className="hide-collapsed">
              <div className="p-name">UTeM Student</div>
              <div className="p-sub">No sign-in needed</div>
            </span>
          </div>
        </div>
      </aside>

      <div className="scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <Link href="/" className="brand">
            <LogoMark className="brand-mark" size={22} />
            <span className="brand-name" style={{ fontSize: 17 }}>
              LibSpace <span>Lite</span>
            </span>
          </Link>
          <Link href="/" className="icon-btn" aria-label="New booking">
            <PlusIcon />
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
