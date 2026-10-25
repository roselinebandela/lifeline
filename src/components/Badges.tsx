import type { Facility } from "../data/facilities";
import { Icon } from "./Icons";

/** Flood status of a facility, always as words plus a glyph. */
export function FloodBadge({ f }: { f: Pick<Facility, "flood"> }) {
  if (!f.flood) return <span className="badge badge-quiet">Flood zone unknown</span>;
  if (f.flood.sfha)
    return (
      <span className="badge badge-flood" title="Inside FEMA's Special Flood Hazard Area">
        <Icon name="warning" size={13} /> Flood zone {f.flood.zone}
      </span>
    );
  if (f.flood.zone === "unmapped") return <span className="badge badge-quiet">No FEMA zone mapped</span>;
  return <span className="badge badge-quiet">Zone {f.flood.zone}</span>;
}

export function AlertBadge({ events }: { events: string[] }) {
  if (!events.length) return null;
  return (
    <span className="badge badge-alert" title={events.join(", ")}>
      <Icon name="alert" size={13} /> {events.length === 1 ? events[0] : `${events.length} NWS alerts`}
    </span>
  );
}
