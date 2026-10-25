// Builds public/data/facilities.json: every pharmacy, hospital, dialysis
// facility and community health center in Louisiana from federal sources,
// geocoded and tagged with its FEMA flood zone.
//
//   Pharmacies       NPPES NPI Registry (CMS), taxonomy "Community/Retail Pharmacy"
//   Hospitals        CMS Care Compare, Hospital General Information (xubh-q36u)
//   Dialysis         CMS Care Compare, Dialysis Facility Listing (23ew-n7w9)
//   Health centers   HRSA Health Center Service Delivery and Look-Alike Sites
//   Geocoding        US Census Bureau batch geocoder (HRSA ships its own coordinates)
//   Flood zones      FEMA National Flood Hazard Layer, layer 28
//
// Run: node scripts/build-facilities.mjs   (takes several minutes)
// The GitHub Actions workflow re-runs it weekly so the data stays current.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dedupe, parishLocator, parishNormalizer } from "./dedupe.mjs";

const today = new Date().toISOString().slice(0, 10);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "LIFELINE data build (educational project)" } });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1500 * (i + 1));
    }
  }
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const SMALL = new Set(["of", "and", "the", "at", "in", "for", "de", "la", "du"]);
function titleCase(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((w, i) => {
      if (/^(llc|inc|lp|llp|pllc|ltd|cvs|ii|iii|iv|er|rx|usa|dba|fmc|bmc|ltc|ccc|lsu|lcmc|ochsner)$/.test(w)) return w.toUpperCase().replace("OCHSNER", "Ochsner");
      if (i > 0 && SMALL.has(w)) return w;
      return w.replace(/^(\w)/, (c) => c.toUpperCase()).replace(/^(Mc)(\w)/, (_, a, b) => a + b.toUpperCase());
    })
    .join("");
}
const phone = (p) => {
  const d = String(p ?? "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
};
const zip5 = (z) => String(z ?? "").slice(0, 5);

// ---------- Pharmacies: NPPES ----------
async function pharmacies() {
  const out = new Map();
  for (let prefix = 700; prefix <= 714; prefix++) {
    for (let skip = 0; skip <= 1000; skip += 200) {
      const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&state=LA&enumeration_type=NPI-2&taxonomy_description=${encodeURIComponent("Community/Retail Pharmacy")}&postal_code=${prefix}*&limit=200&skip=${skip}`;
      const j = await getJson(url);
      const results = j.results ?? [];
      for (const r of results) {
        const loc = r.addresses.find((a) => a.address_purpose === "LOCATION");
        if (!loc || loc.state !== "LA") continue;
        const dba = (r.other_names ?? []).find((o) => /doing business/i.test(o.type ?? o.code ?? "") || o.code === "3");
        const name = titleCase(dba?.organization_name ?? r.basic.organization_name);
        out.set(String(r.number), {
          id: `npi-${r.number}`,
          type: "pharmacy",
          name,
          legalName: dba ? titleCase(r.basic.organization_name) : undefined,
          address: titleCase([loc.address_1, loc.address_2].filter(Boolean).join(", ")),
          city: titleCase(loc.city),
          zip: zip5(loc.postal_code),
          phone: phone(loc.telephone_number),
          details: { npi: String(r.number), lastUpdated: r.basic.last_updated },
          source: "NPPES NPI Registry",
        });
      }
      if (results.length < 200) break;
      await sleep(250);
    }
    log(`pharmacies through ZIP ${prefix}xx: ${out.size}`);
  }
  return [...out.values()];
}

// ---------- CMS Care Compare ----------
async function cmsDataset(id) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const url = `https://data.cms.gov/provider-data/api/1/datastore/query/${id}/0?conditions[0][property]=state&conditions[0][value]=LA&limit=500&offset=${offset}`;
    const j = await getJson(url);
    rows.push(...j.results);
    if (j.results.length < 500) break;
  }
  return rows;
}

async function hospitals() {
  const rows = await cmsDataset("xubh-q36u");
  return rows.map((r) => ({
    id: `cms-${r.facility_id}`,
    type: "hospital",
    name: titleCase(r.facility_name),
    address: titleCase(r.address),
    city: titleCase(r.citytown),
    zip: zip5(r.zip_code),
    phone: phone(r.telephone_number),
    parish: titleCase(r.countyparish),
    details: { emergency: r.emergency_services === "Yes", hospitalType: r.hospital_type, ccn: r.facility_id },
    source: "CMS Care Compare, Hospital General Information",
  }));
}

async function dialysis() {
  const rows = await cmsDataset("23ew-n7w9");
  return rows.map((r) => ({
    id: `cms-${r.cms_certification_number_ccn}`,
    type: "dialysis",
    name: titleCase(r.facility_name),
    address: titleCase([r.address_line_1, r.address_line_2].filter(Boolean).join(", ")),
    city: titleCase(r.citytown),
    zip: zip5(r.zip_code),
    phone: phone(r.telephone_number),
    parish: titleCase(r.countyparish),
    details: {
      stations: Number(r.of_dialysis_stations) || null,
      lateShift: r.late_shift === "Yes",
      homeTraining: r.offers_home_hemodialysis_training === "Yes",
      ccn: r.cms_certification_number_ccn,
    },
    source: "CMS Care Compare, Dialysis Facility Listing",
  }));
}

// ---------- HRSA health centers ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function healthCenters() {
  const res = await fetch("https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv");
  const [head, ...rows] = parseCsv(await res.text());
  const col = (name) => head.indexOf(name);
  const C = {
    name: col("Site Name"), addr: col("Site Address"), city: col("Site City"), state: col("Site State Abbreviation"), zip: col("Site Postal Code"),
    tel: col("Site Telephone Number"), web: col("Site Web Address"), hours: col("Operating Hours per Week"), status: col("Site Status Description"),
    type: col("Health Center Location Type Description"), org: col("Health Center Name"), x: col("Geocoding Artifact Address Primary X Coordinate"),
    y: col("Geocoding Artifact Address Primary Y Coordinate"), county: col("County Equivalent Name"), setting: col("Health Center Service Delivery Site Location Setting Description"),
    id: col("BPHC Assigned Number"),
  };
  return rows
    .filter((r) => r[C.state] === "LA" && /active/i.test(r[C.status]) && !/administrative/i.test(r[C.type]))
    .map((r) => ({
      id: `hrsa-${r[C.id]}`,
      type: "health-center",
      name: titleCase(r[C.name]),
      address: titleCase(r[C.addr]),
      city: titleCase(r[C.city]),
      zip: zip5(r[C.zip]),
      phone: phone(r[C.tel]),
      parish: titleCase(r[C.county]).replace(/ Parish$/i, ""),
      lat: Number(r[C.y]) || null,
      lon: Number(r[C.x]) || null,
      details: { organization: titleCase(r[C.org]), hoursPerWeek: Number(r[C.hours]) || null, web: r[C.web] || null, setting: r[C.setting] || null },
      source: "HRSA Health Center Service Delivery Sites",
    }));
}

// ---------- Census batch geocoder ----------
async function geocode(list) {
  const todo = list.filter((f) => f.lat == null);
  for (let i = 0; i < todo.length; i += 900) {
    const chunk = todo.slice(i, i + 900);
    const csv = chunk.map((f, k) => [k, f.address, f.city, "LA", f.zip].map((v) => `"${String(v ?? "").replace(/"/g, "")}"`).join(",")).join("\n");
    const form = new FormData();
    form.append("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");
    form.append("benchmark", "Public_AR_Current");
    form.append("vintage", "Current_Current");
    let text = "";
    for (let t = 0; t < 4; t++) {
      try {
        const res = await fetch("https://geocoding.geo.census.gov/geocoder/geographies/addressbatch", { method: "POST", body: form });
        text = await res.text();
        if (res.ok) break;
      } catch { /* retry */ }
      await sleep(3000);
    }
    for (const r of parseCsv(text)) {
      const f = chunk[Number(r[0])];
      if (!f || r[2] !== "Match") continue;
      const [lon, lat] = r[5].split(",").map(Number);
      f.lat = +lat.toFixed(5);
      f.lon = +lon.toFixed(5);
      f.countyFips = r[8] && r[9] ? `${r[8]}${r[9]}` : undefined;
      f.geocode = r[3] === "Exact" ? "exact" : "approximate";
    }
    log(`geocoded ${Math.min(i + 900, todo.length)} of ${todo.length}`);
  }
}

// Second pass for addresses the Census geocoder could not match: OpenStreetMap
// Nominatim, one request per second as its usage policy requires. Marked approximate.
async function geocodeFallback(list) {
  const todo = list.filter((f) => f.lat == null);
  for (const f of todo) {
    const q = new URLSearchParams({ street: f.address.split(",")[0], city: f.city, state: "Louisiana", postalcode: f.zip, country: "us", format: "jsonv2", limit: "1" });
    try {
      const j = await getJson(`https://nominatim.openstreetmap.org/search?${q}`, 2);
      if (j[0]) {
        f.lat = +Number(j[0].lat).toFixed(5);
        f.lon = +Number(j[0].lon).toFixed(5);
        f.geocode = "approximate";
      }
    } catch { /* leave unmapped */ }
    await sleep(1100);
  }
  log(`fallback geocoded ${todo.filter((f) => f.lat != null).length} of ${todo.length}`);
}

// ---------- FEMA flood zones ----------
async function floodZone(f) {
  const q = new URLSearchParams({
    geometry: `${f.lon},${f.lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
    outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF", returnGeometry: "false", f: "json",
  });
  try {
    const j = await getJson(`https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${q}`, 3);
    const a = j.features?.[0]?.attributes;
    return a ? { zone: a.FLD_ZONE, sfha: a.SFHA_TF === "T", subtype: a.ZONE_SUBTY || null } : { zone: "unmapped", sfha: false };
  } catch {
    return null;
  }
}

// ---------- Run ----------
log("downloading");
const [ph, ho, di, hc] = await Promise.all([pharmacies(), hospitals(), dialysis(), healthCenters()]);
log(`pharmacies ${ph.length}, hospitals ${ho.length}, dialysis ${di.length}, health centers ${hc.length}`);
const all = dedupe([...ph, ...ho, ...di, ...hc]);

await geocode(all);
await geocodeFallback(all);

const geo = JSON.parse(readFileSync("src/data/louisiana.geo.json", "utf8"));
const parishByFips = new Map(geo.parishes.features.map((f) => [f.properties.fips, f.properties.name]));
// Census county codes are the most reliable parish source; otherwise normalize the source spelling.
const fixParish = parishNormalizer([...parishByFips.values()]);
const locateParish = parishLocator(geo.parishes.features);
for (const f of all) {
  f.parish = (f.countyFips && parishByFips.get(f.countyFips)) || fixParish(f.parish) || (f.lat != null ? locateParish(f.lon, f.lat) : undefined);
  delete f.countyFips;
}

const mapped = all.filter((f) => f.lat != null);
log(`flood zones for ${mapped.length} facilities`);
let done = 0;
await pool(mapped, 8, async (f) => {
  f.flood = await floodZone(f);
  if (++done % 200 === 0) log(`  ${done}`);
});

const count = (list) => Object.fromEntries(["pharmacy", "hospital", "dialysis", "health-center"].map((t) => [t, list.filter((f) => f.type === t).length]));
const out = {
  generated: today,
  sources: {
    pharmacy: { name: "NPPES NPI Registry, Community/Retail Pharmacy", url: "https://npiregistry.cms.hhs.gov/", retrieved: today },
    hospital: { name: "CMS Care Compare, Hospital General Information", url: "https://data.cms.gov/provider-data/dataset/xubh-q36u", retrieved: today },
    dialysis: { name: "CMS Care Compare, Dialysis Facility Listing", url: "https://data.cms.gov/provider-data/dataset/23ew-n7w9", retrieved: today },
    "health-center": { name: "HRSA Health Center Service Delivery Sites", url: "https://data.hrsa.gov/data/download", retrieved: today },
    geocoding: { name: "US Census Bureau Geocoder", url: "https://geocoding.geo.census.gov/", retrieved: today },
    flood: { name: "FEMA National Flood Hazard Layer", url: "https://www.fema.gov/flood-maps/national-flood-hazard-layer", retrieved: today },
  },
  totals: count(all),
  mapped: count(mapped),
  facilities: all.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
};
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/facilities.json", JSON.stringify(out));
log("totals", out.totals, "mapped", out.mapped);
