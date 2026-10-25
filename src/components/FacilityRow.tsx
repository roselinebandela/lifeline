import type { ReactNode } from "react";
import { AlertBadge, FloodBadge } from "./Badges";
import { Icon, TypeGlyph } from "./Icons";
import { TYPE_LABEL, type Facility } from "../data/facilities";
import { miles } from "../lib/plan";

export function directionsUrl(f: Facility) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${f.address}, ${f.city}, LA ${f.zip}`)}`;
}

/** Short, factual detail line drawn from the source record. */
export function detailLine(f: Facility): string | null {
  const d = f.details;
  if (f.type === "hospital") return [d.hospitalType, d.emergency ? "Emergency services" : "No emergency department listed"].filter(Boolean).join(" · ");
  if (f.type === "dialysis") return [d.stations ? `${d.stations} stations` : null, d.lateShift ? "Late shift" : null, d.homeTraining ? "Home training" : null].filter(Boolean).join(" · ") || null;
  if (f.type === "health-center") return [d.organization, d.hoursPerWeek ? `${d.hoursPerWeek} hours a week` : null].filter(Boolean).join(" · ");
  if (f.type === "pharmacy" && f.legalName && f.legalName !== f.name) return `Registered as ${f.legalName}`;
  return null;
}

interface Props {
  f: Facility;
  km?: number;
  alerts?: string[];
  selected?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}

export function FacilityRow({ f, km, alerts = [], selected, onSelect, children }: Props) {
  const detail = detailLine(f);
  return (
    <li className={`frow ${selected ? "is-selected" : ""}`}>
      <TypeGlyph type={f.type} size={16} />
      <div>
        {onSelect ? (
          <button type="button" className="frow-name link-plain" onClick={onSelect}>
            {f.name}
          </button>
        ) : (
          <p className="frow-name">{f.name}</p>
        )}
        <p className="frow-meta">
          {TYPE_LABEL[f.type]} · {f.address}, {f.city} {f.zip}
          {f.parish ? ` · ${f.parish} Parish` : ""}
        </p>
        {detail && <p className="frow-meta">{detail}</p>}
        <div className="frow-badges">
          <FloodBadge f={f} />
          <AlertBadge events={alerts} />
          {f.lat == null && <span className="badge badge-quiet">Location not mapped</span>}
          {f.geocode === "approximate" && <span className="badge badge-quiet">Approximate location</span>}
        </div>
        <div className="frow-actions">
          {f.phone && (
            <a href={`tel:${f.phone.replace(/\D/g, "")}`}>
              <Icon name="phone" size={15} /> {f.phone}
            </a>
          )}
          <a href={directionsUrl(f)} target="_blank" rel="noreferrer">Directions</a>
          {f.details.web && (
            <a href={/^https?:/.test(f.details.web) ? f.details.web : `https://${f.details.web}`} target="_blank" rel="noreferrer">Website</a>
          )}
        </div>
        {children}
      </div>
      {km != null && <p className="frow-dist">{miles(km).toFixed(1)} mi</p>}
    </li>
  );
}
