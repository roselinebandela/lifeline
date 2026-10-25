import { describe, expect, it } from "vitest";
import type { Located } from "../data/facilities";
import { findings, km, nearest, recommendBackup } from "./plan";

const home = { lat: 30.2266, lon: -93.2174 }; // Lake Charles

function fac(id: string, lat: number, lon: number, opts: Partial<Located> = {}): Located {
  return { id, type: "pharmacy", name: id, address: "", city: "", zip: "", phone: null, lat, lon, details: {}, source: "test", flood: { zone: "X", sfha: false }, ...opts };
}

describe("distance", () => {
  it("measures Lake Charles to Sulphur at about 16 km", () => {
    expect(km(home, { lat: 30.2366, lon: -93.3774 })).toBeGreaterThan(14);
    expect(km(home, { lat: 30.2366, lon: -93.3774 })).toBeLessThan(18);
  });
});

describe("nearest", () => {
  const list = [fac("far", 30.5, -93.2), fac("near", 30.23, -93.22), fac("mid", 30.3, -93.2)];
  it("sorts by distance", () => {
    expect(nearest(list, home, "pharmacy").map((r) => r.facility.id)).toEqual(["near", "mid", "far"]);
  });
  it("only counts hospitals with emergency services", () => {
    const hs = [fac("er", 30.23, -93.22, { type: "hospital", details: { emergency: true } }), fac("rehab", 30.23, -93.21, { type: "hospital", details: { emergency: false } })];
    expect(nearest(hs, home, "hospital").map((r) => r.facility.id)).toEqual(["er"]);
  });
});

describe("backup", () => {
  const usual = fac("usual", 30.227, -93.218);
  it("skips flood-zone and too-close options", () => {
    const list = [usual, fac("close", 30.23, -93.21), fac("wet", 30.4, -93.2, { flood: { zone: "AE", sfha: true } }), fac("good", 30.38, -93.2)];
    const b = recommendBackup(list, home, "pharmacy", usual);
    expect(b.pick?.facility.id).toBe("good");
    expect(b.relaxed).toEqual([]);
  });
  it("relaxes the separation rule and says so", () => {
    const list = [usual, fac("close", 30.23, -93.21)];
    const b = recommendBackup(list, home, "pharmacy", usual);
    expect(b.pick?.facility.id).toBe("close");
    expect(b.relaxed.length).toBe(1);
  });
  it("returns no pick when nothing else exists", () => {
    expect(recommendBackup([usual], home, "pharmacy", usual).pick).toBeNull();
  });
});

describe("findings", () => {
  it("flags a usual provider in a flood area", () => {
    const usual = fac("u", 30.23, -93.22, { flood: { zone: "AE", sfha: true } });
    const f = findings(false, "pharmacy", usual, null, [{ facility: usual, km: 1 }]);
    expect(f.some((x) => x.severity === "warning" && x.text.includes("Zone AE"))).toBe(true);
  });
});
