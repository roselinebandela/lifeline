// Live public data. All sources are free, keyless and allow browser requests.
// Nothing is cached or invented: a failed request is shown as a failure.

export interface LiveResult<T> {
  data: T;
  fetchedAt: Date;
  source: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/geo+json, application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const live = <T,>(source: string, data: T): LiveResult<T> => ({ data, fetchedAt: new Date(), source });

// ---------- National Weather Service ----------

export interface Alert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  areaDesc: string;
  ends: string | null;
  senderName: string;
  instruction: string | null;
  /** Louisiana parish FIPS codes (e.g. "22019") the alert covers, from its SAME codes. */
  parishFips: string[];
}

interface NwsFeature {
  properties: {
    id: string; event: string; severity: string; headline: string | null; areaDesc: string; ends: string | null; expires: string;
    senderName: string; instruction: string | null; geocode?: { SAME?: string[] };
  };
}

function toAlert({ properties: p }: NwsFeature): Alert {
  return {
    id: p.id,
    event: p.event,
    severity: p.severity,
    headline: p.headline ?? p.event,
    areaDesc: p.areaDesc,
    ends: p.ends ?? p.expires,
    senderName: p.senderName,
    instruction: p.instruction,
    // SAME codes are 0 + state FIPS + county FIPS, e.g. "022019" for Calcasieu.
    parishFips: (p.geocode?.SAME ?? []).filter((s) => s.startsWith("022")).map((s) => s.slice(1)),
  };
}

export async function alertsAt(lat: number, lon: number) {
  const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  const j = await getJson<{ features: NwsFeature[] }>(url);
  return live(url, j.features.map(toAlert));
}

export async function alertsStatewide() {
  const url = "https://api.weather.gov/alerts/active?area=LA";
  const j = await getJson<{ features: NwsFeature[] }>(url);
  return live(url, j.features.map(toAlert));
}

export interface ForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
}

export async function forecastAt(lat: number, lon: number) {
  const point = await getJson<{ properties: { forecast: string; relativeLocation?: { properties: { city: string } } } }>(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
  );
  const url = point.properties.forecast;
  const j = await getJson<{ properties: { periods: ForecastPeriod[] } }>(url);
  return live(url, { place: point.properties.relativeLocation?.properties.city ?? null, periods: j.properties.periods.slice(0, 4) });
}

// ---------- FEMA ----------

export interface FloodZoneLive {
  zone: string;
  subtype: string | null;
  sfha: boolean;
}

export async function floodZoneAt(lat: number, lon: number) {
  const q = new URLSearchParams({
    geometry: `${lon},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF", returnGeometry: "false", f: "json",
  });
  const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${q}`;
  const j = await getJson<{ features?: { attributes: { FLD_ZONE: string; ZONE_SUBTY: string | null; SFHA_TF: string } }[]; error?: { message: string } }>(url);
  if (j.error) throw new Error(j.error.message);
  const a = j.features?.[0]?.attributes;
  return live(url, a ? ({ zone: a.FLD_ZONE, subtype: a.ZONE_SUBTY, sfha: a.SFHA_TF === "T" } as FloodZoneLive) : null);
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
  organization: string;
  ada: boolean;
  pets: string | null;
  lat: number;
  lon: number;
}

/** Shelters currently reported open to FEMA's National Shelter System in Louisiana. */
export async function openShelters() {
  const q = new URLSearchParams({ where: "STATE='LA'", outFields: "*", returnGeometry: "true", outSR: "4326", f: "json" });
  const url = `https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/MapServer/0/query?${q}`;
  const j = await getJson<{ features?: { attributes: Record<string, string | number | null>; geometry: { x: number; y: number } }[]; error?: { message: string } }>(url);
  if (j.error) throw new Error(j.error.message);
  return live(
    url,
    (j.features ?? []).map(({ attributes: a, geometry: g }) => ({
      id: String(a.shelter_id),
      name: String(a.shelter_name),
      address: String(a.address ?? ""),
      city: String(a.city ?? ""),
      status: String(a.shelter_status ?? ""),
      organization: String(a.org_name ?? ""),
      ada: a.ada_compliant === "YES" || a.ada_compliant === "Y",
      pets: a.pet_accommodations_desc ? String(a.pet_accommodations_desc) : null,
      lat: g.y,
      lon: g.x,
    })),
  );
}

// ---------- National Hurricane Center ----------

export interface Storm {
  name: string;
  type: string;
  maxWindKt: number | null;
  lat: number;
  lon: number;
  advisory: string;
  advisoryDate: string;
}

const NHC = "https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer";
/** "Forecast Points" layers for Atlantic storm slots AT1 to AT5. */
const ATLANTIC_POINT_LAYERS = [6, 32, 58, 84, 110];

export async function activeStorms() {
  const q = new URLSearchParams({ where: "tau=0", outFields: "stormname,stormtype,maxwind,lat,lon,advisnum,advdate", returnGeometry: "false", f: "json" });
  const layers = await Promise.all(
    ATLANTIC_POINT_LAYERS.map((l) =>
      getJson<{ features?: { attributes: { stormname: string; stormtype: string; maxwind: number | null; lat: number; lon: number; advisnum: string; advdate: string } }[] }>(
        `${NHC}/${l}/query?${q}`,
      ),
    ),
  );
  return live(
    "https://www.nhc.noaa.gov/",
    layers.flatMap((l) => l.features ?? []).map(({ attributes: a }) => ({
      name: a.stormname,
      type: a.stormtype,
      maxWindKt: a.maxwind,
      lat: a.lat,
      lon: a.lon,
      advisory: a.advisnum,
      advisoryDate: a.advdate,
    })),
  );
}

// ---------- USGS river and lake stage ----------

export interface Gauge {
  id: string;
  value: number;
  unit: string;
  time: string;
  lat: number;
  lon: number;
}

/** Latest gage height (parameter 00065) at USGS sites within roughly `radiusKm` of a point. */
export async function gaugesNear(lat: number, lon: number, radiusKm = 30) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => v.toFixed(3)).join(",");
  const url = `https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&bbox=${bbox}&parameter_code=00065&limit=100`;
  const j = await getJson<{ features: { properties: { monitoring_location_id: string; time: string; value: string; unit_of_measure: string }; geometry: { coordinates: [number, number] } }[] }>(url);
  const latest = new Map<string, Gauge>();
  const weekAgo = Date.now() - 7 * 86400000;
  for (const f of j.features) {
    const p = f.properties;
    if (Date.parse(p.time) < weekAgo) continue; // skip retired or seasonal sites
    const g = { id: p.monitoring_location_id, value: Number(p.value), unit: p.unit_of_measure, time: p.time, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
    const prev = latest.get(g.id);
    if (!prev || g.time > prev.time) latest.set(g.id, g);
  }
  return live(url, [...latest.values()]);
}

export async function gaugeName(id: string): Promise<string> {
  const j = await getJson<{ properties: { monitoring_location_name: string } }>(
    `https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations/items/${id}?f=json`,
  );
  return j.properties.monitoring_location_name;
}
