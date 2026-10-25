import { useMemo, useState } from "react";
import type { ScreenProps } from "../App";
import { CareMap } from "../components/CareMap";
import { FacilityRow } from "../components/FacilityRow";
import { TypeGlyph } from "../components/Icons";
import { isLocated, TYPE_PLURAL, TYPES, type Facility, type FacilityType } from "../data/facilities";
import "./mapscreen.css";

const PAGE = 60;

export function MapScreen({ facilities }: ScreenProps) {
  const [types, setTypes] = useState<Set<FacilityType>>(new Set(TYPES));
  const [floodOnly, setFloodOnly] = useState(false);
  const [erOnly, setErOnly] = useState(false);
  const [parish, setParish] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const all = facilities.data?.facilities ?? [];
  const parishes = useMemo(() => [...new Set(all.map((f) => f.parish).filter(Boolean) as string[])].sort(), [all]);

  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((f: Facility) => {
      if (!types.has(f.type)) return false;
      if (floodOnly && !f.flood?.sfha) return false;
      if (erOnly && f.type === "hospital" && !f.details.emergency) return false;
      if (parish && f.parish !== parish) return false;
      if (words.length) {
        const hay = `${f.name} ${f.legalName ?? ""} ${f.city} ${f.zip} ${f.address} ${f.parish ?? ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [all, types, floodOnly, erOnly, parish, q]);

  const located = useMemo(() => matches.filter(isLocated), [matches]);
  const sel = all.find((f) => f.id === selected);

  const toggle = (t: FacilityType) => {
    const next = new Set(types);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setTypes(next);
    setShown(PAGE);
  };

  return (
    <div className="mapscreen">
      <aside className="mapside" aria-label="Search and filters">
        <div className="mapside-head">
          <p className="kicker">Every provider in Louisiana</p>
          <label className="sr-only" htmlFor="mq">Search providers</label>
          <input id="mq" className="mapsearch" type="search" placeholder="Search name, city, ZIP or parish" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />

          <fieldset className="filters">
            <legend className="sr-only">Type of care</legend>
            {TYPES.map((t) => (
              <label key={t} className="chip chip-small">
                <input type="checkbox" checked={types.has(t)} onChange={() => toggle(t)} />
                <TypeGlyph type={t} /> {TYPE_PLURAL[t]}
                {facilities.data && <span className="chip-count">{facilities.data.totals[t]}</span>}
              </label>
            ))}
          </fieldset>

          <div className="filters">
            <label className="chip chip-small">
              <input type="checkbox" checked={floodOnly} onChange={(e) => setFloodOnly(e.target.checked)} />
              Only in FEMA high-risk flood areas
            </label>
            <label className="chip chip-small">
              <input type="checkbox" checked={erOnly} onChange={(e) => setErOnly(e.target.checked)} />
              Hospitals with emergency services
            </label>
          </div>

          <label className="parish-select">
            <span className="kicker">Parish</span>
            <select value={parish} onChange={(e) => { setParish(e.target.value); setShown(PAGE); }}>
              <option value="">All parishes</option>
              {parishes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <p className="result-count" aria-live="polite">
            {facilities.error ? <span className="error">{facilities.error}</span> : facilities.data ? `${matches.length.toLocaleString()} providers, ${located.length.toLocaleString()} on the map` : "Loading provider records"}
          </p>
        </div>

        {sel && (
          <div className="mapside-sel">
            <p className="kicker">Selected</p>
            <ul className="flist"><FacilityRow f={sel} /></ul>
            <p className="source">Source: {sel.source}{sel.details.npi ? `, NPI ${sel.details.npi}` : ""}{sel.details.ccn ? `, CMS ${sel.details.ccn}` : ""}</p>
          </div>
        )}

        <ul className="flist maplist">
          {matches.slice(0, shown).map((f) => (
            <FacilityRow key={f.id} f={f} selected={f.id === selected} onSelect={() => setSelected(f.id)} />
          ))}
        </ul>
        {matches.length > shown && (
          <button type="button" className="btn btn-small more" onClick={() => setShown((s) => s + PAGE)}>
            Show {Math.min(PAGE, matches.length - shown)} more
          </button>
        )}
      </aside>

      <div className="mapmain">
        <CareMap facilities={located} selectedId={selected} onSelect={setSelected} label="Map of Louisiana care providers" />
        <div className="maplegend" aria-hidden>
          {TYPES.map((t) => <span key={t}><TypeGlyph type={t} /> {TYPE_PLURAL[t]}</span>)}
          <span><span className="swatch swatch-flood" /> In FEMA high-risk flood area</span>
        </div>
      </div>
    </div>
  );
}
