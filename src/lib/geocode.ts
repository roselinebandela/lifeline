// Turning what someone types (an address, city or ZIP) into a point.
// Uses OpenStreetMap Nominatim, limited to Louisiana. The query is sent to
// Nominatim and nowhere else; the result is kept in memory only.

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

const LOUISIANA_VIEWBOX = "-94.05,33.02,-88.80,28.90";

export async function searchLouisiana(query: string): Promise<Place[]> {
  const q = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "us",
    viewbox: LOUISIANA_VIEWBOX,
    bounded: "1",
    addressdetails: "1",
    limit: "5",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string; address?: { state?: string } }[];
  return rows
    .filter((r) => !r.address?.state || r.address.state === "Louisiana")
    .map((r) => ({ label: r.display_name.replace(/, United States$/, ""), lat: Number(r.lat), lon: Number(r.lon) }));
}

export function currentPosition(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser cannot share its location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ label: "Your current location", lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? "Location permission was denied. Type an address or ZIP instead." : "Your location could not be found.")),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  });
}

/** Rough Louisiana bounds check, so out-of-state points get a clear message. */
export const inLouisiana = (p: { lat: number; lon: number }) => p.lat > 28.8 && p.lat < 33.1 && p.lon > -94.1 && p.lon < -88.7;
