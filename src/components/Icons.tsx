// LIFELINE's own symbol set. One construction rule for all of them:
// 24 x 24 grid, 1.75 stroke, square caps, mitered joins. No icon library.
import type { ReactNode } from "react";
import type { FacilityType } from "../data/facilities";

export type IconName = "plan" | "map" | "now" | "about" | "warning" | "check" | "alert" | "phone" | "locate" | "search" | "close";

const paths: Record<IconName, ReactNode> = {
  // Two points joined by one bent route: a usual path and its backup
  plan: (
    <>
      <circle cx="5" cy="5" r="2.25" />
      <circle cx="19" cy="19" r="2.25" />
      <path d="M7.2 5H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7.8" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.25" />
    </>
  ),
  // Station mast with two arcs: live readings
  now: (
    <>
      <path d="M12 11v10M9 21h6" />
      <circle cx="12" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <path d="M8.3 5.5a5 5 0 0 0 0 7M15.7 5.5a5 5 0 0 1 0 7M5.5 3a9 9 0 0 0 0 12M18.5 3a9 9 0 0 1 0 12" />
    </>
  ),
  about: (
    <>
      <path d="M12 6.5C10 5 7 4.5 3 5v13.5c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5Z" />
      <path d="M12 6.5V20" />
    </>
  ),
  // Hazard diamond, from the flood-sign reference
  warning: (
    <>
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
      <path d="M12 7.5v6" />
      <circle cx="12" cy="16.3" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.5 12.3 3 3 6-6.3" />
    </>
  ),
  // Official alert: a broadcast triangle
  alert: (
    <>
      <path d="M12 3 22 20H2Z" />
      <path d="M12 9v5.5" />
      <circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4.5-2.2 1.4a11 11 0 0 0 5.8 5.8l1.4-2.2 4.5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />,
  locate: (
    <>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5.5 5.5" />
    </>
  ),
  close: <path d="m5 5 14 14M19 5 5 19" />,
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
      {paths[name]}
    </svg>
  );
}

/** Facility shapes. The map uses exactly the same four shapes. */
export function TypeGlyph({ type, size = 14 }: { type: FacilityType; size?: number }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 2 };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      {type === "pharmacy" && <circle cx="8" cy="8" r="5.5" {...s} />}
      {type === "hospital" && <rect x="2.5" y="2.5" width="11" height="11" {...s} />}
      {type === "dialysis" && <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" {...s} />}
      {type === "health-center" && <path d="M8 2 14.5 13.5h-13Z" {...s} />}
    </svg>
  );
}
