// Real Louisiana care facilities, built by scripts/build-facilities.mjs from
// federal sources and served as a static file so the app needs no backend.
export type FacilityType = "pharmacy" | "hospital" | "dialysis" | "health-center";

export interface FloodZone {
  zone: string;
  sfha: boolean;
  subtype?: string | null;
}

export interface Facility {
  id: string;
  type: FacilityType;
  name: string;
  legalName?: string;
  address: string;
  city: string;
  zip: string;
  phone: string | null;
  parish?: string;
  lat?: number | null;
  lon?: number | null;
  geocode?: "exact" | "approximate";
  /** null when the FEMA lookup failed; zone "unmapped" when FEMA has no zone there. */
  flood?: FloodZone | null;
  details: {
    emergency?: boolean;
    hospitalType?: string;
    stations?: number | null;
    lateShift?: boolean;
    homeTraining?: boolean;
    hoursPerWeek?: number | null;
    web?: string | null;
    organization?: string;
    npi?: string;
    ccn?: string;
    lastUpdated?: string;
    setting?: string | null;
  };
  source: string;
}

export interface Located extends Facility {
  lat: number;
  lon: number;
}

export interface FacilityData {
  generated: string;
  sources: Record<string, { name: string; url: string; retrieved: string }>;
  totals: Record<FacilityType, number>;
  mapped: Record<FacilityType, number>;
  facilities: Facility[];
}

export const TYPE_LABEL: Record<FacilityType, string> = {
  pharmacy: "Pharmacy",
  hospital: "Hospital",
  dialysis: "Dialysis center",
  "health-center": "Community health center",
};

export const TYPE_PLURAL: Record<FacilityType, string> = {
  pharmacy: "Pharmacies",
  hospital: "Hospitals",
  dialysis: "Dialysis centers",
  "health-center": "Community health centers",
};

export const TYPES: FacilityType[] = ["pharmacy", "hospital", "dialysis", "health-center"];

let cache: Promise<FacilityData> | null = null;

export function loadFacilities(): Promise<FacilityData> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/facilities.json`).then((r) => {
    if (!r.ok) throw new Error(`Facility data could not be loaded (${r.status})`);
    return r.json() as Promise<FacilityData>;
  });
  return cache;
}

export const isLocated = (f: Facility): f is Located => f.lat != null && f.lon != null;

export function floodLabel(f: { flood?: FloodZone | null }): string {
  if (!f.flood) return "Flood zone not checked";
  if (f.flood.zone === "unmapped") return "No FEMA flood zone mapped";
  return f.flood.sfha ? `FEMA Zone ${f.flood.zone}, high-risk flood area` : `FEMA Zone ${f.flood.zone}`;
}
