import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** LibSpace mark: an open book with a small spark above it. */
export function LogoMark({ size = 26, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...rest}>
      <path
        d="M16 11.5c-2.6-2-6.3-2.8-10.5-2.4a1 1 0 0 0-.9 1v13.6a1 1 0 0 0 1.1 1c4-.3 7.5.5 10.3 2.5 2.8-2 6.3-2.8 10.3-2.5a1 1 0 0 0 1.1-1V10.1a1 1 0 0 0-.9-1c-4.2-.4-7.9.4-10.5 2.4Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M16 11.5v14.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16 1.8l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const PlusIcon = (p: P) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const SearchIcon = (p: P) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
export const TicketIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8Z" />
    <path d="M13 6v2M13 11v2M13 16v2" />
  </Icon>
);
export const SidebarIcon = (p: P) => <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></Icon>;
export const MenuIcon = (p: P) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h10" /></Icon>;
export const UsersIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.6c1.6.6 2.7 2.2 3 4.9" />
  </Icon>
);
export const PinIcon = (p: P) => <Icon {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></Icon>;
export const ClockIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>;
export const CalendarIcon = (p: P) => <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>;
export const CheckIcon = (p: P) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const CopyIcon = (p: P) => <Icon {...p}><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></Icon>;
export const XIcon = (p: P) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const ArrowUpIcon = (p: P) => <Icon {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Icon>;
export const ArrowLeftIcon = (p: P) => <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>;
export const AlertIcon = (p: P) => <Icon {...p}><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5v.01" /></Icon>;
export const InfoIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></Icon>;
export const MoonIcon = (p: P) => <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></Icon>;
export const SunriseIcon = (p: P) => <Icon {...p}><path d="M4 18h16M7 14.5a5 5 0 0 1 10 0M12 4v3M4.9 8.9l1.4 1.4M19.1 8.9l-1.4 1.4" /></Icon>;
export const GridIcon = (p: P) => <Icon {...p}><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M9 9.5V20M14.5 9.5V20" /></Icon>;
export const BoltIcon = (p: P) => <Icon {...p}><path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" /></Icon>;

/** Icons for room types. */
export const DiscussionIcon = (p: P) => (
  <Icon {...p}><path d="M4 5.5h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3H4A1.5 1.5 0 0 1 2.5 13V7A1.5 1.5 0 0 1 4 5.5Z" /><path d="M16.5 9H20a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 18h-1v3l-4-3h-3" /></Icon>
);
export const PodIcon = (p: P) => (
  <Icon {...p}><path d="M5 20V9a7 7 0 0 1 14 0v11" /><path d="M3 20h18M9 15h6" /></Icon>
);
export const ProjectIcon = (p: P) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="11" rx="1.5" /><path d="M12 15v3M8 21l4-3 4 3" /></Icon>
);
