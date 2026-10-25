import { useMemo, useState } from "react";
import type { ScreenProps } from "../App";
import { CareMap, type Annotation } from "../components/CareMap";
import { FacilityRow, directionsUrl } from "../components/FacilityRow";
import { Icon, TypeGlyph } from "../components/Icons";
import { LocationSearch } from "../components/LocationSearch";
import { isLocated, TYPE_LABEL, TYPE_PLURAL, TYPES, type Located } from "../data/facilities";
import { alertsAt, alertsStatewide, floodZoneAt, forecastAt, openShelters } from "../live/api";
import { formatTime, useLive } from "../live/useLive";
import { BACKUP_RANGE_KM, BACKUP_SEPARATION_KM, findings, km, miles, nearest, recommendBackup, type Need } from "../lib/plan";
import { parishFips } from "../state/store";
import "./plan.css";

/** Short codes for map labels, which must fit on a phone-width map. */
const MAP_CODE: Record<Need, string> = { pharmacy: "RX", hospital: "ER", dialysis: "DIALYSIS", "health-center": "CLINIC" };

const NEED_LABEL: Record<Need, string> = {
  pharmacy: "Pharmacy",
  hospital: "Emergency hospital",
  dialysis: "Dialysis",
  "health-center": "Community health center",
};

export function PlanScreen({ facilities, planApi }: ScreenProps) {
  const { plan, update, clear } = planApi;

  if (!plan.place) {
    return (
      <div className="page">
        <header className="page-head">
          <p className="kicker">My care plan</p>
          <h1 className="page-title">
            <span className="light">start with</span>
            <span className="heavy">where you live.</span>
          </h1>
          <p className="lede">LIFELINE finds the real providers around you, checks each against FEMA flood maps and live alerts, and helps you choose backups.</p>
        </header>
        <LocationSearch onPick={(place) => update({ place, usual: {} })} />
      </div>
    );
  }

  if (!facilities.data) {
    return <div className="page"><p className={facilities.error ? "error" : "muted"}>{facilities.error ?? "Loading provider records"}</p></div>;
  }
  return <PlanBody key={`${plan.place.lat},${plan.place.lon}`} {...{ facilities: facilities.data.facilities.filter(isLocated), plan, update, clear }} />;
}

function PlanBody({ facilities, plan, update, clear }: { facilities: Located[]; plan: ScreenProps["planApi"]["plan"]; update: ScreenProps["planApi"]["update"]; clear: () => void }) {
  const place = plan.place!;
  const flood = useLive(() => floodZoneAt(place.lat, place.lon));
  const here = useLive(() => alertsAt(place.lat, place.lon));
  const state = useLive(alertsStatewide);
  const forecast = useLive(() => forecastAt(place.lat, place.lon));
  const shelters = useLive(openShelters);
  const [selected, setSelected] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  // Active NWS alerts by parish FIPS, for flagging providers.
  const alertsByParish = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of state.data?.data ?? []) for (const f of a.parishFips) m.set(f, (m.get(f) ?? new Set()).add(a.event));
    return m;
  }, [state.data]);
  const alertsFor = (f: Located) => [...(alertsByParish.get(parishFips(f.parish) ?? "") ?? [])];

  const sections = useMemo(
    () =>
      plan.needs.map((need) => {
        const near = nearest(facilities, place, need, 5);
        const usual = facilities.find((f) => f.id === plan.usual[need]) ?? near[0]?.facility ?? null;
        const backup = usual ? recommendBackup(facilities, place, need, usual) : null;
        return { need, near, usual, backup, notes: findings(flood.data?.data?.sfha ?? null, need, usual, backup, near) };
      }),
    [plan.needs, plan.usual, facilities, place, flood.data],
  );

  const annotations: Annotation[] = sections.flatMap((s) => [
    ...(s.usual ? [{ id: s.usual.id, label: `USUAL ${MAP_CODE[s.need]}` }] : []),
    ...(s.backup?.pick ? [{ id: s.backup.pick.facility.id, label: `BACKUP ${MAP_CODE[s.need]}` }] : []),
  ]);
  const onMap = useMemo(() => {
    const ids = new Set<string>();
    const list: Located[] = [];
    for (const s of sections) for (const f of [...s.near.map((r) => r.facility), s.usual, s.backup?.pick?.facility]) if (f && !ids.has(f.id)) { ids.add(f.id); list.push(f); }
    return list;
  }, [sections]);

  const toggleNeed = (n: Need) => update({ needs: plan.needs.includes(n) ? plan.needs.filter((x) => x !== n) : TYPES.filter((t) => t === n || plan.needs.includes(t)) });
  const placeName = forecast.data?.data.place ?? place.label.split(",")[0];

  const nearestShelter = shelters.data?.data
    .map((s) => ({ s, km: km(place, s) }))
    .sort((a, b) => a.km - b.km)[0];

  return (
    <div className="plan">
      <div className="plan-map no-print">
        <CareMap
          facilities={onMap}
          home={place}
          rings={[5, 15, 30]}
          annotations={annotations}
          selectedId={selected}
          onSelect={setSelected}
          shelters={shelters.data?.data ?? []}
          fitKey={`${place.lat},${place.lon},${annotations.map((a) => a.id).join()}`}
          label={`Map of providers near ${placeName}`}
        />
      </div>

      <div className="plan-body">
        <header className="plan-head">
          <p className="kicker">Your care lifeline</p>
          <h1 className="page-title">
            <span className="light">around</span>
            <span className="heavy plan-place">{placeName}</span>
          </h1>
          <p className="muted small">{place.label}</p>
          <button type="button" className="link-btn small no-print" onClick={() => setChanging((c) => !c)}>
            {changing ? "Keep this location" : "Change location"}
          </button>
          {changing && <LocationSearch compact onPick={(p) => { update({ place: p, usual: {} }); setChanging(false); }} />}
        </header>

        <section className="section" aria-labelledby="now-h">
          <div className="section-head">
            <h2 id="now-h" className="section-title">At your address, now</h2>
          </div>
          <dl className="facts">
            <div>
              <dt>FEMA flood zone</dt>
              <dd>
                {flood.error && <span className="error">FEMA did not respond. <button className="link-btn" onClick={flood.refresh}>Try again</button></span>}
                {!flood.error && !flood.data && "Checking"}
                {flood.data &&
                  (flood.data.data ? (
                    flood.data.data.sfha ? (
                      <span className="fact-warn"><Icon name="warning" size={16} /> Zone {flood.data.data.zone}: a FEMA high-risk flood area</span>
                    ) : (
                      `Zone ${flood.data.data.zone}: outside FEMA's high-risk flood areas`
                    )
                  ) : (
                    "No FEMA flood zone mapped at this point"
                  ))}
              </dd>
            </div>
            <div>
              <dt>NWS alerts here</dt>
              <dd>
                {here.error && <span className="error">The Weather Service did not respond.</span>}
                {here.data && !here.data.data.length && "None active"}
                {here.data?.data.map((a) => (
                  <span key={a.id} className="fact-alert"><Icon name="alert" size={16} /> {a.event}, until {formatTime(a.ends)}</span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Forecast</dt>
              <dd>{forecast.data ? `${forecast.data.data.periods[0].name}: ${forecast.data.data.periods[0].shortForecast}, ${forecast.data.data.periods[0].temperature}°${forecast.data.data.periods[0].temperatureUnit}` : forecast.error ? <span className="error">Unavailable</span> : "Loading"}</dd>
            </div>
            <div>
              <dt>Open shelters</dt>
              <dd>
                {shelters.error && <span className="error">FEMA shelter list unavailable.</span>}
                {shelters.data && !shelters.data.data.length && "None open in Louisiana in FEMA's shelter system"}
                {nearestShelter && `${shelters.data!.data.length} open in Louisiana. Nearest: ${nearestShelter.s.name}, ${nearestShelter.s.city} (${miles(nearestShelter.km).toFixed(0)} mi)`}
              </dd>
            </div>
          </dl>
          <p className="source">FEMA NFHL, National Weather Service and FEMA National Shelter System, requested {formatTime(new Date())}.</p>
        </section>

        <section className="section no-print" aria-labelledby="needs-h">
          <div className="section-head">
            <h2 id="needs-h" className="section-title">What do you rely on?</h2>
          </div>
          <div className="chips">
            {TYPES.map((t) => (
              <label key={t} className="chip">
                <input type="checkbox" checked={plan.needs.includes(t)} onChange={() => toggleNeed(t)} />
                <TypeGlyph type={t} /> {NEED_LABEL[t]}
              </label>
            ))}
          </div>
          <p className="muted small">This choice stays on your device. LIFELINE never asks about diagnoses or medications.</p>
        </section>

        {sections.map(({ need, near, usual, backup, notes }) => (
          <section key={need} className="section need" aria-labelledby={`h-${need}`}>
            <div className="section-head">
              <h2 id={`h-${need}`} className="section-title">
                <TypeGlyph type={need} size={18} /> {NEED_LABEL[need]}
              </h2>
              <span className="source">{near.length ? `${near.length} nearest` : ""}</span>
            </div>

            {!!notes.length && (
              <ul className="notes">
                {notes.map((n, i) => (
                  <li key={i} className={`notice ${n.severity === "warning" ? "" : "notice-info"}`}>{n.text}</li>
                ))}
              </ul>
            )}

            <fieldset className="choose">
              <legend className="kicker">Choose your usual {TYPE_LABEL[need].toLowerCase()}</legend>
              <ul className="flist">
                {near.map((r) => (
                  <FacilityRow key={r.facility.id} f={r.facility} km={r.km} alerts={alertsFor(r.facility)} selected={selected === r.facility.id} onSelect={() => setSelected(r.facility.id)}>
                    <label className="usual-pick no-print">
                      <input
                        type="radio"
                        name={`usual-${need}`}
                        checked={usual?.id === r.facility.id}
                        onChange={() => update({ usual: { ...plan.usual, [need]: r.facility.id } })}
                      />
                      My usual {TYPE_LABEL[need].toLowerCase()}
                    </label>
                  </FacilityRow>
                ))}
              </ul>
            </fieldset>

            {usual && backup && (
              <div className="backup">
                <p className="kicker backup-k">Suggested backup</p>
                {backup.pick ? (
                  <>
                    <ul className="flist">
                      <FacilityRow f={backup.pick.facility} km={backup.pick.km} alerts={alertsFor(backup.pick.facility)} selected={selected === backup.pick.facility.id} onSelect={() => setSelected(backup.pick!.facility.id)} />
                    </ul>
                    <p className="small muted">
                      Chosen because it is {backup.reasons.join(", ")}.{" "}
                      {backup.relaxed.map((r) => <span key={r}>{r} </span>)}
                    </p>
                  </>
                ) : (
                  <p className="notice">{backup.relaxed[0]}</p>
                )}
              </div>
            )}
          </section>
        ))}

        <PlanSheet sections={sections} placeName={placeName} plan={plan} update={update} clear={clear} />

        <section className="section" aria-labelledby="how-h">
          <div className="section-head">
            <h2 id="how-h" className="section-title">How backups are chosen</h2>
          </div>
          <ol className="rules">
            <li>Same type of care as your usual provider. Hospitals must list emergency services with CMS.</li>
            <li>Outside FEMA's high-risk flood areas (Special Flood Hazard Areas).</li>
            <li>At least {BACKUP_SEPARATION_KM} km ({Math.round(miles(BACKUP_SEPARATION_KM))} mi) from your usual provider, so one local flood or outage is less likely to close both.</li>
            <li>Within {BACKUP_RANGE_KM} km ({Math.round(miles(BACKUP_RANGE_KM))} mi) of your address, nearest first.</li>
          </ol>
          <p className="muted small">If no provider meets rules 2 and 3, LIFELINE relaxes them one at a time and tells you which. Distances are straight-line, not driving distance.</p>
        </section>
      </div>
    </div>
  );
}

type Section = { need: Need; usual: Located | null; backup: ReturnType<typeof recommendBackup> | null };

function PlanSheet({ sections, placeName, plan, update, clear }: { sections: Section[]; placeName: string; plan: ScreenProps["planApi"]["plan"]; update: ScreenProps["planApi"]["update"]; clear: () => void }) {
  const [shared, setShared] = useState<string | null>(null);
  const text = [
    `My care plan (LIFELINE), ${placeName}`,
    ...sections.flatMap((s) => [
      `${TYPE_PLURAL[s.need]}:`,
      s.usual ? `  Usual: ${s.usual.name}, ${s.usual.address}, ${s.usual.city}. ${s.usual.phone ?? ""}` : "  Usual: none chosen",
      s.backup?.pick ? `  Backup: ${s.backup.pick.facility.name}, ${s.backup.pick.facility.address}, ${s.backup.pick.facility.city}. ${s.backup.pick.facility.phone ?? ""}` : "  Backup: none found",
    ]),
    "Call ahead: listings come from federal records and may change.",
  ].join("\n");

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "My care plan", text });
        setShared("Shared.");
      } else {
        await navigator.clipboard.writeText(text);
        setShared("Copied to your clipboard.");
      }
    } catch {
      setShared("Sharing was cancelled.");
    }
  };

  return (
    <section className="sheet" aria-labelledby="sheet-h">
      <div className="sheet-head">
        <h2 id="sheet-h" className="sheet-title">
          <span className="light">my care plan,</span>
          <span className="heavy">{placeName}</span>
        </h2>
        <p className="sheet-date">Prepared {new Date().toLocaleDateString()}</p>
      </div>
      <table className="sheet-table">
        <thead>
          <tr><th scope="col">Care</th><th scope="col">Usual</th><th scope="col">Backup</th></tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <tr key={s.need}>
              <th scope="row">{NEED_LABEL[s.need]}</th>
              {[s.usual, s.backup?.pick?.facility ?? null].map((f, i) => (
                <td key={i}>
                  {f ? (
                    <>
                      <strong>{f.name}</strong>
                      <br />
                      {f.address}, {f.city} {f.zip}
                      <br />
                      {f.phone ?? "No phone listed"}
                      {f.flood?.sfha && <><br /><em>In FEMA flood zone {f.flood.zone}</em></>}
                      <br />
                      <a className="no-print" href={directionsUrl(f)} target="_blank" rel="noreferrer">Directions</a>
                    </>
                  ) : (
                    "None found"
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sheet-numbers">
        <p><strong>Emergency:</strong> 911</p>
        <p><strong>Help finding services:</strong> dial 211</p>
        <p><strong>Pharmacies open during a disaster:</strong> rxopen.org</p>
        <p><strong>Louisiana emergency preparedness:</strong> gohsep.la.gov</p>
      </div>
      <p className="sheet-note">Listings come from CMS, HRSA and the NPI Registry. Call ahead to confirm hours, especially before and after a storm.</p>
      <div className="sheet-actions no-print">
        <button type="button" className="btn btn-dark" onClick={() => window.print()}>Print</button>
        <button type="button" className="btn btn-dark" onClick={share}>Share</button>
        <label className="sheet-save">
          <input type="checkbox" checked={plan.save} onChange={(e) => update({ save: e.target.checked })} />
          Save this plan on this device
        </label>
        {plan.save && <button type="button" className="link-btn" onClick={clear}>Delete saved plan</button>}
        <p className="sheet-saved" aria-live="polite">{shared}</p>
      </div>
      <p className="sheet-privacy no-print">Saving keeps only your location, the types of care you chose and your chosen providers, in this browser. Nothing is sent to LIFELINE.</p>
    </section>
  );
}
