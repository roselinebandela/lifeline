import type { ScreenProps } from "../App";
import { InstallApp } from "../components/InstallApp";
import { LocationSearch } from "../components/LocationSearch";
import { TYPES, TYPE_PLURAL } from "../data/facilities";
import "./home.css";

// Aerial: USDA NAIP via USGS, public domain. Calcasieu Ship Channel from
// Hackberry (top) to Cameron and the Gulf (bottom). Bounding box below is the
// exported extent, used to place the annotation circles on real towns.
const AERIAL = { file: "imagery/calcasieu-portrait.jpg", w: 1050, h: 1500, west: -93.45, east: -93.2, south: 29.74, north: 30.05 };
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const onAerial = (lon: number, lat: number) => [
  ((lon - AERIAL.west) / (AERIAL.east - AERIAL.west)) * AERIAL.w,
  ((mercY(AERIAL.north) - mercY(lat)) / (mercY(AERIAL.north) - mercY(AERIAL.south))) * AERIAL.h,
];
const MARKS = [
  { label: "HACKBERRY", lon: -93.3647, lat: 29.9921, r: 70 },
  { label: "CAMERON", lon: -93.3254, lat: 29.7977, r: 90 },
];

export function Home({ go, facilities, planApi }: ScreenProps) {
  const d = facilities.data;
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-image" aria-hidden>
          <img src={AERIAL.file} alt="" width={AERIAL.w} height={AERIAL.h} />
          <svg viewBox={`0 0 ${AERIAL.w} ${AERIAL.h}`} preserveAspectRatio="xMidYMid slice">
            {[160, 320, 520, 760].map((r) => {
              const [x, y] = onAerial(-93.3254, 29.7977);
              return <circle key={r} cx={x} cy={y} r={r} className="hero-contour" />;
            })}
            {MARKS.map((m) => {
              const [x, y] = onAerial(m.lon, m.lat);
              return (
                <g key={m.label}>
                  <circle cx={x} cy={y} r={m.r} className="hero-mark" />
                  <text x={x + m.r + 14} y={y + 8} className="hero-mark-label">{m.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="hero-grid" aria-hidden />

        <div className="hero-corner hero-corner-l kicker">
          Louisiana
          <br />
          care continuity
        </div>
        <div className="hero-corner hero-corner-r kicker">
          30.0° N
          <br />
          93.3° W
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            <span className="light">when the world is disrupted,</span>
            <span className="heavy">care shouldn't be.</span>
          </h1>
          <p className="hero-lede">
            Find the real pharmacies, hospitals, dialysis centers and health centers around you, see which sit in flood zones, and pick backups before the storm.
          </p>
          <LocationSearch
            onPick={(place) => {
              planApi.update({ place, usual: {} });
              go("plan");
            }}
          />
          <p className="hero-alt">
            Or <a href="#/map">explore every provider on the map</a>, or see <a href="#/now">what is happening in Louisiana right now</a>.
          </p>
        </div>

        <p className="hero-caption">
          Calcasieu Ship Channel, from Hackberry south to Cameron and the Gulf. USDA NAIP aerial photograph, public domain.
        </p>
      </section>

      <section className="home-band">
        <p className="kicker">What is inside</p>
        {d ? (
          <ul className="home-counts">
            {TYPES.map((t) => (
              <li key={t}>
                <span className="home-count">{d.totals[t].toLocaleString()}</span>
                <span className="home-count-l">{TYPE_PLURAL[t]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{facilities.error ?? "Loading provider records"}</p>
        )}
        <p className="home-src">
          Every listing comes from a federal record: CMS Care Compare for hospitals and dialysis, HRSA for community health centers, and the NPI Registry for
          pharmacies. Each one is checked against FEMA's flood maps.{d ? ` Updated ${d.generated}.` : ""} Live alerts, forecasts, river levels and open shelters
          load from NWS, NHC, USGS and FEMA each time you open the app.
        </p>
        <div className="home-install">
          <p className="kicker">Keep it on your phone</p>
          <InstallApp />
        </div>
      </section>
    </div>
  );
}
