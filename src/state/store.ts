import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import geo from "../data/louisiana.geo.json";
import { loadFacilities, type FacilityData } from "../data/facilities";
import type { Place } from "../lib/geocode";
import type { Need } from "../lib/plan";

// ---------- Routing (hash based, works on any static host) ----------
export type Route = "home" | "plan" | "map" | "now" | "about";
const ROUTES: Route[] = ["home", "plan", "map", "now", "about"];

function readRoute(): Route {
  const r = window.location.hash.replace(/^#\/?/, "") as Route;
  return ROUTES.includes(r) ? r : "home";
}
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function useRoute(): [Route, (r: Route) => void] {
  const route = useSyncExternalStore(subscribeHash, readRoute, () => "home" as Route);
  const go = useCallback((r: Route) => {
    window.location.hash = `/${r}`;
  }, []);
  return [route, go];
}

// ---------- Facility data ----------
export function useFacilities() {
  const [state, setState] = useState<{ data: FacilityData | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    loadFacilities()
      .then((data) => setState({ data, error: null }))
      .catch((e: Error) => setState({ data: null, error: e.message }));
  }, []);
  return state;
}

// ---------- Parish names to FIPS, for matching live NWS alerts ----------
const norm = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/\s+parish$/, "").replace(/\s+/g, " ").trim();
const PARISH_FIPS = new Map<string, string>(
  (geo.parishes.features as { properties: { name: string; fips: string } }[]).map((f) => [norm(f.properties.name), f.properties.fips]),
);
export const parishFips = (name?: string) => (name ? PARISH_FIPS.get(norm(name)) : undefined);

// ---------- The person's plan ----------
// Kept in memory. Saved to this browser only if the person turns saving on,
// and it never contains medical details: only a place and chosen providers.
export interface PlanState {
  place: Place | null;
  needs: Need[];
  usual: Partial<Record<Need, string>>;
  save: boolean;
}

const KEY = "lifeline.plan.v1";
const EMPTY: PlanState = { place: null, needs: ["pharmacy", "hospital"], usual: {}, save: false };

function loadPlan(): PlanState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw), save: true };
  } catch { /* storage blocked: start fresh */ }
  return EMPTY;
}

export function usePlan() {
  const [plan, setPlan] = useState<PlanState>(loadPlan);
  useEffect(() => {
    try {
      if (plan.save) localStorage.setItem(KEY, JSON.stringify(plan));
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }, [plan]);
  const update = useCallback((patch: Partial<PlanState>) => setPlan((p) => ({ ...p, ...patch })), []);
  const clear = useCallback(() => setPlan(EMPTY), []);
  return { plan, update, clear };
}

export type PlanApi = ReturnType<typeof usePlan>;
