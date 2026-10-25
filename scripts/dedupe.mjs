// Removes duplicate listings: the NPI Registry often has one store under
// several NPIs, with small spelling differences ("Ave" vs "Avenue", "Inc").
// Two records of the same type are the same place when their normalized
// street address and ZIP match and they share a phone number or a first word.

const SUFFIX = {
  avenue: "ave", street: "st", boulevard: "blvd", road: "rd", drive: "dr", highway: "hwy", lane: "ln", parkway: "pkwy",
  place: "pl", court: "ct", circle: "cir", suite: "ste", north: "n", south: "s", east: "e", west: "w", expressway: "expy",
};

export function normAddress(a) {
  return String(a ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(ste|suite|unit|bldg|building|apt)\s*\w+/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIX[w] ?? w)
    .join(" ");
}

const firstWord = (n) => String(n).toLowerCase().replace(/^the\s+/, "").split(/\W+/)[0];

export function dedupe(list) {
  const kept = [];
  const byKey = new Map();
  for (const f of list) {
    const key = `${f.type}|${normAddress(f.address)}|${f.zip}`;
    const same = (byKey.get(key) ?? []).find((g) => (f.phone && f.phone === g.phone) || firstWord(f.name) === firstWord(g.name));
    if (same) {
      // Prefer the shorter, store-facing name (drops "Inc", "LLC" variants).
      if (f.name.length < same.name.length) Object.assign(same, { name: f.name });
      continue;
    }
    byKey.set(key, [...(byKey.get(key) ?? []), f]);
    kept.push(f);
  }
  return kept;
}

// Parish names arrive spelled many ways across CMS, HRSA and the Census
// ("Saint Bernard", "St. Bernard", "E. Baton Rouge", even "Jeffrson Davis").
// Map each to the official Census name, allowing a small typo distance.
const key = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\bparish\b/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/^e\.?\s/, "east ")
    .replace(/^w\.?\s/, "west ")
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z]/g, "");

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function parishNormalizer(officialNames) {
  const table = officialNames.map((n) => [key(n), n]);
  return (raw) => {
    if (!raw) return raw;
    const k = key(raw);
    const exact = table.find(([t]) => t === k);
    if (exact) return exact[1];
    const close = table.map(([t, n]) => [lev(t, k), n]).sort((a, b) => a[0] - b[0])[0];
    return close && close[0] <= 2 ? close[1] : raw;
  };
}

// Point-in-polygon parish lookup for records with coordinates but no parish.
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function parishLocator(parishFeatures) {
  return (lon, lat) => {
    for (const f of parishFeatures) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const [outer, ...holes] of polys) {
        if (inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h))) return f.properties.name;
      }
    }
    return undefined;
  };
}
