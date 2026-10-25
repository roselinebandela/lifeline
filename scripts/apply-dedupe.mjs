// One-off: apply dedupe.mjs to an existing facilities.json without refetching.
import { readFileSync, writeFileSync } from "node:fs";
import { dedupe, parishLocator, parishNormalizer } from "./dedupe.mjs";
const path = "public/data/facilities.json";
const d = JSON.parse(readFileSync(path, "utf8"));
const before = d.facilities.length;
d.facilities = dedupe(d.facilities);
const geo = JSON.parse(readFileSync("src/data/louisiana.geo.json", "utf8"));
const fix = parishNormalizer(geo.parishes.features.map((f) => f.properties.name));
const locate = parishLocator(geo.parishes.features);
for (const f of d.facilities) f.parish = fix(f.parish) ?? (f.lat != null ? locate(f.lon, f.lat) : undefined);
const count = (pred) => Object.fromEntries(["pharmacy", "hospital", "dialysis", "health-center"].map((t) => [t, d.facilities.filter((f) => f.type === t && pred(f)).length]));
d.totals = count(() => true);
d.mapped = count((f) => f.lat != null);
writeFileSync(path, JSON.stringify(d));
console.log(`removed ${before - d.facilities.length}`, d.totals, d.mapped);
