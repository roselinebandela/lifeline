# LIFELINE

**When the world is disrupted, care shouldn't be.**

LIFELINE helps people in Louisiana plan for care before a disaster. Enter an address or ZIP and it shows the real pharmacies, emergency hospitals, dialysis centers and community health centers nearby, flags the ones inside FEMA flood hazard areas, checks live weather alerts, and suggests a backup provider for each one. The plan can be printed, shared, or saved on the device.

Built for the 2026 Congressional App Challenge.

## What is real

| Data | Source | How it gets in |
| --- | --- | --- |
| Pharmacies | NPPES NPI Registry (CMS), Community/Retail Pharmacy | Weekly build |
| Hospitals, with emergency services | CMS Care Compare, Hospital General Information | Weekly build |
| Dialysis centers | CMS Care Compare, Dialysis Facility Listing | Weekly build |
| Community health centers | HRSA Health Center Service Delivery Sites | Weekly build |
| Map positions | US Census Bureau geocoder, OpenStreetMap fallback | Weekly build |
| Flood zone of every provider | FEMA National Flood Hazard Layer | Weekly build |
| Flood zone at your address | FEMA National Flood Hazard Layer | Live |
| Weather alerts and forecast | National Weather Service API | Live |
| Open shelters | FEMA National Shelter System | Live |
| Tropical storms | National Hurricane Center | Live |
| Satellite imagery | NASA GIBS (daily), USGS The National Map (base map) | Live |

There is no fictional data in the app. The patient story in the competition video lives in a separate project (`../lifeline-video`).

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev               # http://localhost:5173
npm test                  # plan logic tests
npm run build             # static site in dist/
npm run data:facilities   # refresh provider data from federal sources (about 10 minutes)
```

No accounts, API keys or backend. Provider data is a static file (`public/data/facilities.json`); live data is requested from the agencies in the browser.

## Live app

**https://roselinebandela.github.io/lifeline/**

LIFELINE is an installable web app. On Android or a computer, open it in Chrome or Edge and choose **Install** (or use the button on the home screen). On iPhone, open it in Safari, tap **Share**, then **Add to Home Screen**. Once installed it opens like any other app, and the provider list and a saved plan still work without a connection.

## Built with

| Part | Tools |
| --- | --- |
| App | React 19, TypeScript, Vite |
| Maps | Leaflet on USGS The National Map imagery |
| Design | Hand-written CSS, Mona Sans and Martian Mono, custom SVG icons |
| Data pipeline | Node.js scripts over the NPI Registry, CMS, HRSA, the Census geocoder and FEMA's flood layer |
| Live data | National Weather Service, National Hurricane Center, FEMA, USGS, NASA GIBS |
| Tests | Vitest |
| Hosting | GitHub Pages, built and refreshed weekly by GitHub Actions |
| Installable app | Web app manifest and a service worker |

## Screens

- **Home**: address search, or use current location.
- **My plan**: live conditions at your address, nearest providers for each type of care you choose, your usual provider, a suggested backup with the reasons, weak-link warnings, and a printable plan sheet.
- **Map**: every provider in Louisiana on public-domain USGS satellite imagery, with search and filters (type, parish, flood zone, emergency services).
- **Right now**: statewide NWS alerts, open FEMA shelters, active Atlantic storms, links to Rx Open and outage trackers, and today's satellite image.
- **About**: sources with dates, method, limits, privacy.

## How backups are chosen (`src/lib/plan.ts`)

For each type of care, the suggested backup is the nearest provider of the same type that is:

1. not the usual provider (and, for hospitals, lists emergency services with CMS),
2. outside FEMA's high-risk flood areas,
3. at least 15 km from the usual provider, so one local flood or outage is less likely to close both,
4. within 120 km of home.

If nothing meets rules 2 and 3, they are relaxed one at a time and the app says which. Distances are straight-line.

## Data pipeline (`scripts/`)

`build-facilities.mjs` downloads all four federal datasets, merges duplicate listings (`dedupe.mjs` normalizes addresses such as "Ave" and "Avenue"), geocodes addresses in Census batches with an OpenStreetMap fallback, assigns official parish names, and checks each point against FEMA's flood layer. The GitHub Actions workflow re-runs it every Monday and redeploys; if a source is down, the last good snapshot stays.

## Limits

- A listing means a provider is registered with a federal program, not that it is open today. The app tells people to call ahead.
- The NPI Registry can lag behind store closures and name changes.
- FEMA flood zones describe long-term risk, not current water.
- No public statewide source exists for live pharmacy status or power outages, so the app links to Rx Open and outage trackers instead.
- Urgent care and home health agencies are not yet included.

## Privacy

No server of its own. An address search goes to OpenStreetMap; the resulting point goes to the National Weather Service and FEMA for alerts and flood zones. Nothing is stored unless the person turns on "Save this plan on this device", which keeps their location, chosen care types and providers in that browser only. The app never asks about diagnoses or medications.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml`. In the repository settings, set **Pages > Source** to **GitHub Actions**. Routing uses the URL hash, so no server configuration is needed.

## Design

Satellite-atlas art direction: dark imagery, a thin survey grid, contour rings around your location, and white annotation circles on your providers. Typefaces: Mona Sans (with its width axis) and Martian Mono, bundled locally. All icons are drawn for the project (`src/components/Icons.tsx`). Flood risk is always ochre plus a word and a diamond glyph; official alerts are always coral plus a word and a triangle glyph.
