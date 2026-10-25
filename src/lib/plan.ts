// Care-plan logic: nearest providers, backup recommendations, and weak-link
// findings. Every rule here is deterministic and is described in the UI.
import type { Facility, FacilityType, Located } from "../data/facilities";

export type LatLon = { lat: number; lon: number };

export function km(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const miles = (k: number) => k * 0.621371;

/** A "need" is a facility type, with hospitals limited to those offering emergency services. */
export type Need = FacilityType;

export function serves(f: Facility, need: Need): boolean {
  if (f.type !== need) return false;
  if (need === "hospital") return f.details.emergency === true;
  return true;
}

export interface Ranked {
  facility: Located;
  km: number;
}

export function nearest(list: Located[], from: LatLon, need: Need, n = 6, maxKm = 160): Ranked[] {
  return list
    .filter((f) => serves(f, need))
    .map((f) => ({ facility: f, km: km(from, f) }))
    .filter((r) => r.km <= maxKm)
    .sort((a, b) => a.km - b.km || a.facility.name.localeCompare(b.facility.name))
    .slice(0, n);
}

/** Minimum distance between a usual provider and its backup, so one local flood or outage is less likely to hit both. */
export const BACKUP_SEPARATION_KM = 15;
/** How far from home a backup may be. */
export const BACKUP_RANGE_KM = 120;

export interface Backup {
  pick: Ranked | null;
  /** Which rules the pick satisfies, in plain words. */
  reasons: string[];
  /** Rules that had to be relaxed because no provider met them. */
  relaxed: string[];
}

/**
 * Backup rule, applied in order:
 *  1. Same type of care as the usual provider, never the usual provider itself.
 *  2. Outside FEMA's high-risk flood area (Special Flood Hazard Area).
 *  3. At least 15 km from the usual provider.
 *  4. Within 120 km of home.
 *  5. Nearest to home among the rest.
 * If nothing satisfies 2 and 3, they are relaxed in that order and the UI says so.
 */
export function recommendBackup(list: Located[], home: LatLon, need: Need, usual: Located): Backup {
  const pool = list
    .filter((f) => serves(f, need) && f.id !== usual.id)
    .map((f) => ({ facility: f, km: km(home, f) }))
    .filter((r) => r.km <= BACKUP_RANGE_KM)
    .sort((a, b) => a.km - b.km || a.facility.name.localeCompare(b.facility.name));

  const dry = (r: Ranked) => !r.facility.flood?.sfha;
  const apart = (r: Ranked) => km(usual, r.facility) >= BACKUP_SEPARATION_KM;

  const tiers: { test: (r: Ranked) => boolean; relaxed: string[] }[] = [
    { test: (r) => dry(r) && apart(r), relaxed: [] },
    { test: dry, relaxed: [`No option outside the flood area is ${BACKUP_SEPARATION_KM} km or more from your usual provider.`] },
    { test: apart, relaxed: ["Every nearby option is inside a FEMA high-risk flood area."] },
    { test: () => true, relaxed: ["Every nearby option is in a flood area and close to your usual provider."] },
  ];
  for (const tier of tiers) {
    const pick = pool.find(tier.test);
    if (pick) {
      const reasons: string[] = [];
      if (dry(pick)) reasons.push("outside FEMA's high-risk flood area");
      if (apart(pick)) reasons.push(`${Math.round(km(usual, pick.facility))} km from your usual provider`);
      if (pick.facility.parish && pick.facility.parish !== usual.parish) reasons.push(`in a different parish (${pick.facility.parish})`);
      return { pick, reasons, relaxed: tier.relaxed };
    }
  }
  return { pick: null, reasons: [], relaxed: [`No other provider within ${BACKUP_RANGE_KM} km.`] };
}

export type Severity = "warning" | "info";
export interface Finding {
  severity: Severity;
  text: string;
}

/** Weak links in a plan, computed from flood zones, distances and parishes. */
export function findings(homeFloodSfha: boolean | null, need: Need, usual: Located | null, backup: Backup | null, nearby: Ranked[]): Finding[] {
  const out: Finding[] = [];
  if (!nearby.length) {
    out.push({ severity: "warning", text: "No provider of this type was found within 160 km." });
    return out;
  }
  if (usual?.flood?.sfha) out.push({ severity: "warning", text: `Your usual provider is inside a FEMA high-risk flood area (Zone ${usual.flood.zone}).` });
  const wet = nearby.filter((r) => r.facility.flood?.sfha).length;
  if (wet === nearby.length) out.push({ severity: "warning", text: `All ${nearby.length} of the nearest options are in FEMA high-risk flood areas.` });
  else if (wet > 0) out.push({ severity: "info", text: `${wet} of the ${nearby.length} nearest options are in FEMA high-risk flood areas.` });
  if (usual && backup?.pick && usual.parish && usual.parish === backup.pick.facility.parish) {
    out.push({ severity: "info", text: `Your usual provider and backup are both in ${usual.parish} Parish, so a parish-wide disruption could affect both.` });
  }
  if (nearby[0].km > 40) out.push({ severity: "warning", text: `The nearest option is ${Math.round(nearby[0].km)} km away. Plan transportation ahead of a storm.` });
  if (homeFloodSfha && need === "dialysis") out.push({ severity: "info", text: "Your address is in a high-risk flood area. Ask your dialysis center about its emergency plan before hurricane season." });
  return out;
}
