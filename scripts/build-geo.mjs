// Extracts Louisiana's state outline and parish boundaries from the
// US Census Bureau cartographic boundaries packaged in `us-atlas`
// (counties-10m, 1:10,000,000 scale). Output is a small GeoJSON file the
// app bundles, so no map tiles or external URLs are needed at runtime.
//
// Run: node scripts/build-geo.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature, merge } from "topojson-client";

const topo = JSON.parse(readFileSync("node_modules/us-atlas/counties-10m.json", "utf8"));
const LA = "22"; // Louisiana state FIPS code

const parishGeoms = topo.objects.counties.geometries.filter((g) => String(g.id).startsWith(LA));
// Neighboring Texas counties, so Port Arthur and the Sabine shore draw as land.
const TX_NEIGHBORS = ["48245", "48361", "48351", "48241", "48199", "48071"];
const txGeoms = topo.objects.counties.geometries.filter((g) => TX_NEIGHBORS.includes(String(g.id)));
const texas = feature(topo, { type: "GeometryCollection", geometries: txGeoms });
const parishes = feature(topo, { type: "GeometryCollection", geometries: parishGeoms });
const outline = merge(topo, parishGeoms);

// Round coordinates to ~10 m to keep the bundle small.
const round = (c) => (typeof c[0] === "number" ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(round));
for (const f of [...parishes.features, ...texas.features]) {
  f.geometry.coordinates = round(f.geometry.coordinates);
  f.properties = { fips: String(f.id), name: f.properties.name };
  delete f.id;
}

const out = {
  source: "US Census Bureau cartographic boundary files via us-atlas@3 (counties-10m)",
  outline: { type: "Feature", properties: { name: "Louisiana" }, geometry: { ...outline, coordinates: round(outline.coordinates) } },
  parishes,
  texas,
};
writeFileSync("src/data/louisiana.geo.json", JSON.stringify(out));
console.log(`wrote ${parishes.features.length} parishes`);
