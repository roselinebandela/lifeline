import type { ScreenProps } from "../App";
import { TYPES, TYPE_PLURAL } from "../data/facilities";
import { BACKUP_RANGE_KM, BACKUP_SEPARATION_KM } from "../lib/plan";
import "./about.css";

const LIVE = [
  { what: "Weather alerts and forecasts", who: "National Weather Service API", href: "https://www.weather.gov/documentation/services-web-api" },
  { what: "Flood zone at your address", who: "FEMA National Flood Hazard Layer", href: "https://www.fema.gov/flood-maps/national-flood-hazard-layer" },
  { what: "Open shelters", who: "FEMA National Shelter System", href: "https://gis.fema.gov/" },
  { what: "Tropical cyclones", who: "National Hurricane Center GIS", href: "https://www.nhc.noaa.gov/gis/" },
  { what: "Satellite imagery", who: "NASA GIBS", href: "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" },
  { what: "Map imagery", who: "USGS The National Map (public domain)", href: "https://www.usgs.gov/programs/national-geospatial-program/national-map" },
  { what: "Address search", who: "OpenStreetMap Nominatim", href: "https://nominatim.org/" },
];

export function AboutScreen({ facilities }: ScreenProps) {
  const d = facilities.data;
  return (
    <div className="page about">
      <header className="page-head">
        <p className="kicker">About LIFELINE</p>
        <h1 className="page-title">
          <span className="light">built from</span>
          <span className="heavy">public records.</span>
        </h1>
        <p className="lede">
          A storm can take out the road to your pharmacy, the power at your dialysis center, or the clinic itself. LIFELINE shows the real providers around you,
          which ones sit in flood zones, and which backups make sense, so you can decide before the storm instead of during it.
        </p>
      </header>

      <section className="section">
        <div className="section-head"><h2 className="section-title">Provider records</h2></div>
        <table className="srctable">
          <thead><tr><th scope="col">Providers</th><th scope="col">Source</th><th scope="col">Listed</th><th scope="col">On the map</th><th scope="col">Retrieved</th></tr></thead>
          <tbody>
            {TYPES.map((t) => (
              <tr key={t}>
                <th scope="row">{TYPE_PLURAL[t]}</th>
                <td>{d ? <a href={d.sources[t].url}>{d.sources[t].name}</a> : "Loading"}</td>
                <td className="mono">{d?.totals[t].toLocaleString()}</td>
                <td className="mono">{d?.mapped[t].toLocaleString()}</td>
                <td className="mono">{d?.sources[t].retrieved}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Addresses are placed on the map with the US Census Bureau geocoder, with OpenStreetMap as a fallback marked "approximate". Each mapped provider is then checked
          against FEMA's National Flood Hazard Layer. Providers that could not be placed still appear in search. The data is rebuilt every week.
        </p>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="section-title">Live sources</h2></div>
        <ul className="srclist">
          {LIVE.map((s) => (
            <li key={s.what}><span>{s.what}</span><a href={s.href}>{s.who}</a></li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="section-title">How backups are chosen</h2></div>
        <p className="measure">
          For each type of care you rely on, LIFELINE suggests a backup of the same type that is outside FEMA's high-risk flood areas, at least {BACKUP_SEPARATION_KM} km
          from your usual provider, and within {BACKUP_RANGE_KM} km of you, nearest first. If no provider meets every rule, it relaxes them one at a time and tells you
          which. Distances are straight-line.
        </p>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="section-title">Limits</h2></div>
        <ul className="limits">
          <li>A listing means a provider is registered with a federal program, not that it is open today. Call ahead, especially around a storm.</li>
          <li>Pharmacy records come from the NPI Registry, which can lag behind closures and name changes.</li>
          <li>FEMA flood zones describe long-term risk, not where water is right now.</li>
          <li>There is no public, statewide source for live pharmacy or clinic status, or for power outages. LIFELINE links to Rx Open and outage trackers instead of guessing.</li>
          <li>Urgent care clinics and home health agencies are not yet included.</li>
        </ul>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="section-title">Privacy</h2></div>
        <p className="measure">
          No accounts. LIFELINE has no server of its own. Your address search goes to OpenStreetMap, and the resulting point goes to the National Weather Service and FEMA to
          look up alerts and flood zones. Nothing is saved unless you turn on "Save this plan on this device", which keeps your location, the types of care you chose and
          your chosen providers in this browser only. LIFELINE never asks about diagnoses or medications.
        </p>
      </section>

      <p className="disclaimer">
        LIFELINE is an informational tool. It does not provide medical advice, guarantee medication availability, verify real-time healthcare operations, or replace
        emergency services or professional clinical judgment. In an emergency, call 911.
      </p>
    </div>
  );
}
