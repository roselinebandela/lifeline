import { useState } from "react";
import type { ScreenProps } from "../App";
import { Icon } from "../components/Icons";
import { activeStorms, alertsStatewide, openShelters } from "../live/api";
import { formatTime, useLive, type LiveState } from "../live/useLive";
import { km, miles } from "../lib/plan";
import "./now.css";

const NEW_ORLEANS = { lat: 29.9511, lon: -90.0715 };

function gibsUrl(date: string) {
  const q = new URLSearchParams({
    SERVICE: "WMS", REQUEST: "GetMap", VERSION: "1.3.0", LAYERS: "VIIRS_SNPP_CorrectedReflectance_TrueColor", CRS: "EPSG:4326",
    BBOX: "28.6,-94.3,33.2,-88.6", WIDTH: "1400", HEIGHT: "1300", FORMAT: "image/jpeg", TIME: date,
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q}`;
}
const utcDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

function Status({ state, href, name }: { state: LiveState<{ fetchedAt: Date }>; href: string; name: string }) {
  return (
    <p className="source now-src">
      <a href={href}>{name}</a>
      {state.data && ` · ${formatTime(state.data.fetchedAt)}`}
      {state.error && <span className="error"> · did not respond</span>}{" "}
      <button type="button" className="link-btn" onClick={state.refresh} disabled={state.loading}>{state.loading ? "loading" : "refresh"}</button>
    </p>
  );
}

export function NowScreen(_: ScreenProps) {
  const alerts = useLive(alertsStatewide);
  const shelters = useLive(openShelters);
  const storms = useLive(activeStorms);
  const [day, setDay] = useState(1);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="page now">
      <header className="page-head">
        <p className="kicker">Live · requested from public agencies when you open this page</p>
        <h1 className="page-title">
          <span className="light">louisiana,</span>
          <span className="heavy">right now.</span>
        </h1>
        <p className="lede">LIFELINE does not create, edit or predict any of this. When an agency gives an instruction, follow the agency.</p>
      </header>

      <section className="section" aria-labelledby="al-h">
        <div className="section-head">
          <h2 id="al-h" className="section-title">Weather alerts</h2>
          <Status state={alerts} href="https://alerts.weather.gov/" name="National Weather Service" />
        </div>
        {alerts.data && !alerts.data.data.length && <p className="calm"><Icon name="check" /> No active watches, warnings or advisories in Louisiana.</p>}
        <ul className="alert-list">
          {alerts.data?.data.map((a) => (
            <li key={a.id} className="alert-strip">
              <Icon name="alert" size={26} />
              <div>
                <p className="alert-event">{a.event}</p>
                <p className="kicker">{a.senderName} · {a.severity} · until {formatTime(a.ends)}</p>
                <p className="alert-area">{a.areaDesc}</p>
                {a.instruction && (
                  <details>
                    <summary>Official instructions</summary>
                    <p className="alert-instr">{a.instruction}</p>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="now-cols">
        <section className="section" aria-labelledby="sh-h">
          <div className="section-head">
            <h2 id="sh-h" className="section-title">Open shelters</h2>
            <Status state={shelters} href="https://www.fema.gov/disaster/shelter" name="FEMA National Shelter System" />
          </div>
          {shelters.data && !shelters.data.data.length && <p className="calm"><Icon name="check" /> No Louisiana shelters are reported open in FEMA's system.</p>}
          <ul className="flist">
            {shelters.data?.data.map((s) => (
              <li key={s.id} className="frow frow-plain">
                <div>
                  <p className="frow-name">{s.name}</p>
                  <p className="frow-meta">{s.address}, {s.city} · {s.organization}</p>
                  <p className="frow-meta">{[s.status, s.ada ? "ADA accessible" : null, s.pets].filter(Boolean).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small">Parish shelters are not always listed here. Dial 211 or check <a href="https://gohsep.la.gov/">GOHSEP</a> for local openings.</p>
        </section>

        <section className="section" aria-labelledby="st-h">
          <div className="section-head">
            <h2 id="st-h" className="section-title">Tropical storms</h2>
            <Status state={storms} href="https://www.nhc.noaa.gov/" name="National Hurricane Center" />
          </div>
          {storms.data && !storms.data.data.length && <p className="calm"><Icon name="check" /> No active Atlantic tropical cyclones.</p>}
          <ul className="flist">
            {storms.data?.data.map((s) => (
              <li key={s.name + s.advisory} className="frow frow-plain">
                <div>
                  <p className="frow-name">{/storm|hurricane|depression/i.test(s.name) ? s.name : `${s.type} ${s.name}`}</p>
                  <p className="frow-meta">
                    Maximum wind {s.maxWindKt ?? "not reported"} kt. Center {Math.round(miles(km(s, NEW_ORLEANS))).toLocaleString()} mi from New Orleans. Advisory {s.advisory}, {s.advisoryDate}.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="section" aria-labelledby="more-h">
        <div className="section-head">
          <h2 id="more-h" className="section-title">Where to check what LIFELINE cannot</h2>
        </div>
        <ul className="links">
          <li><a href="https://rxopen.org/">Rx Open</a> <span className="muted">shows which pharmacies are open in disaster areas (Healthcare Ready).</span></li>
          <li><a href="https://poweroutage.us/area/state/louisiana">PowerOutage.us</a> <span className="muted">tracks power outages by parish (independent tracker; utilities publish their own maps).</span></li>
          <li><a href="https://www.kcercoalition.com/">KCER</a> <span className="muted">emergency resources for people on dialysis.</span></li>
          <li><a href="https://getagameplan.org/">Get a Game Plan</a> <span className="muted">Louisiana's official preparedness guide (GOHSEP).</span></li>
        </ul>
      </section>

      <section className="section" aria-labelledby="sat-h">
        <div className="section-head">
          <h2 id="sat-h" className="section-title">From orbit</h2>
          <p className="source"><a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api">NASA GIBS</a> · VIIRS true color, {utcDate(day)} UTC</p>
        </div>
        <div className="chips">
          {[1, 2, 3].map((d) => (
            <label key={d} className="chip chip-small">
              <input type="radio" name="satday" checked={day === d} onChange={() => { setDay(d); setImgError(false); }} />
              {new Date(`${utcDate(d)}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
            </label>
          ))}
        </div>
        <figure className="sat">
          {imgError ? <p className="notice">NASA returned no image for this day.</p> : (
            <img src={gibsUrl(utcDate(day))} alt={`Satellite image of Louisiana on ${utcDate(day)}`} loading="lazy" onError={() => setImgError(true)} />
          )}
        </figure>
      </section>
    </div>
  );
}
