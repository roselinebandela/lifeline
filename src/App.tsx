import { useEffect, useRef } from "react";
import { Icon, type IconName } from "./components/Icons";
import { OfflineNotice } from "./components/InstallApp";
import { Home } from "./screens/Home";
import { PlanScreen } from "./screens/Plan";
import { MapScreen } from "./screens/MapScreen";
import { NowScreen } from "./screens/Now";
import { AboutScreen } from "./screens/About";
import { useFacilities, usePlan, useRoute, type Route } from "./state/store";
import "./styles/app.css";

const NAV: { route: Route; label: string; icon: IconName }[] = [
  { route: "plan", label: "My plan", icon: "plan" },
  { route: "map", label: "Map", icon: "map" },
  { route: "now", label: "Right now", icon: "now" },
  { route: "about", label: "About", icon: "about" },
];

export default function App() {
  const [route, go] = useRoute();
  const facilities = useFacilities();
  const planApi = usePlan();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [route]);

  const props = { go, facilities, planApi };

  return (
    <div className={`shell route-${route}`}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Skip to content
      </a>
      <header className="bar">
        <a href="#/home" className="wordmark" aria-label="LIFELINE home">
          LIFELINE
        </a>
        <nav aria-label="Main" className="bar-nav">
          {NAV.map((n) => (
            <a key={n.route} href={`#/${n.route}`} aria-current={route === n.route ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <OfflineNotice />
      <main id="main" ref={mainRef} tabIndex={-1} className="main">
        <div className="screen-enter" key={route}>
          {route === "home" && <Home {...props} />}
          {route === "plan" && <PlanScreen {...props} />}
          {route === "map" && <MapScreen {...props} />}
          {route === "now" && <NowScreen {...props} />}
          {route === "about" && <AboutScreen {...props} />}
        </div>
        {route !== "map" && (
          <footer className="footer">
            <p>
              LIFELINE lists real providers from public federal records. It does not issue alerts, give medical advice, or confirm that a provider is open. Call ahead.
              For official instructions follow the <a href="https://www.weather.gov/">National Weather Service</a> and your parish officials. In an emergency, call 911.
            </p>
          </footer>
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.route} href={`#/${n.route}`} aria-current={route === n.route ? "page" : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export type ScreenProps = {
  go: (r: Route) => void;
  facilities: ReturnType<typeof useFacilities>;
  planApi: ReturnType<typeof usePlan>;
};
