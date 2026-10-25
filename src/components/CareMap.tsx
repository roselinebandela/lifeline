// Satellite map of real facilities. Tiles: USGS The National Map imagery
// (public domain). Facility shapes match TypeGlyph: circle pharmacy, square
// hospital, diamond dialysis, triangle health center. Ochre fill = inside a
// FEMA high-risk flood area. Markers are drawn on canvas so thousands stay fast.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { FacilityType, Located } from "../data/facilities";
import type { Shelter } from "../live/api";
import "./caremap.css";

type ShapeOptions = L.CircleMarkerOptions & { shape: FacilityType };

// A CircleMarker that draws one of four shapes on the canvas renderer.
const ShapeMarker = L.CircleMarker.extend({
  _updatePath(this: L.CircleMarker & { _renderer: any; _point: L.Point; _radius: number; options: ShapeOptions; _empty(): boolean }) {
    const r = this._renderer;
    if (!r._drawing || this._empty()) return;
    const { x, y } = this._point;
    const s = this._radius;
    const ctx: CanvasRenderingContext2D = r._ctx;
    ctx.beginPath();
    switch (this.options.shape) {
      case "hospital":
        ctx.rect(x - s, y - s, s * 2, s * 2);
        break;
      case "dialysis":
        ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 1.3, y); ctx.lineTo(x, y + s * 1.3); ctx.lineTo(x - s * 1.3, y); ctx.closePath();
        break;
      case "health-center":
        ctx.moveTo(x, y - s * 1.25); ctx.lineTo(x + s * 1.2, y + s); ctx.lineTo(x - s * 1.2, y + s); ctx.closePath();
        break;
      default:
        ctx.arc(x, y, s, 0, Math.PI * 2);
    }
    r._fillStroke(ctx, this);
  },
}) as unknown as new (latlng: L.LatLngExpression, options: ShapeOptions) => L.CircleMarker;

export interface Annotation {
  id: string;
  label: string;
}

interface Props {
  facilities: Located[];
  home?: { lat: number; lon: number } | null;
  /** Rings around home, in miles. */
  rings?: number[];
  /** Facilities circled and labeled, e.g. USUAL and BACKUP. */
  annotations?: Annotation[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  shelters?: Shelter[];
  /** Fit to these points when they change. */
  fitKey?: string;
  className?: string;
  label: string;
}

const LOUISIANA: L.LatLngBoundsExpression = [[28.9, -94.05], [33.02, -88.8]];

export function CareMap({ facilities, home, rings = [], annotations = [], selectedId, onSelect, shelters = [], fitKey, className, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const overlay = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { preferCanvas: true, zoomControl: true, attributionControl: true, minZoom: 6, maxZoom: 16, maxBounds: [[27.5, -96], [34.5, -87]] });
    L.tileLayer("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 16,
      attribution: 'Imagery: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>',
    }).addTo(m);
    m.fitBounds(LOUISIANA);
    layer.current = L.layerGroup().addTo(m);
    overlay.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Facility markers
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const renderer = L.canvas({ padding: 0.3 });
    // Smaller marks when zoomed out to the whole state, so towns stay legible.
    const sizeFor = (z: number) => (z <= 7 ? 2.2 : z <= 9 ? 3.2 : z <= 11 ? 4.2 : 5.5);
    const m = map.current!;
    const markers: [L.CircleMarker, boolean][] = [];
    const resize = () => {
      const s = sizeFor(m.getZoom());
      for (const [mk, sel] of markers) mk.setRadius(sel ? s + 3 : s);
    };
    m.on("zoomend", resize);
    for (const f of facilities) {
      const wet = !!f.flood?.sfha;
      const mk = new ShapeMarker([f.lat, f.lon], {
        shape: f.type,
        renderer,
        radius: sizeFor(m.getZoom()) + (f.id === selectedId ? 3 : 0),
        color: "#0d1720",
        weight: 1.5,
        fillColor: wet ? "#e7b94f" : "#f0ede4",
        fillOpacity: 1,
      });
      mk.bindTooltip(`${f.name}${wet ? ` (flood zone ${f.flood!.zone})` : ""}`, { direction: "top", offset: [0, -6] });
      mk.on("click", () => selectRef.current?.(f.id));
      g.addLayer(mk);
      markers.push([mk, f.id === selectedId]);
    }
    return () => {
      m.off("zoomend", resize);
    };
  }, [facilities, selectedId]);

  // Home, rings, annotations, shelters
  useEffect(() => {
    const g = overlay.current;
    const m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    if (home) {
      for (const mi of rings) {
        L.circle([home.lat, home.lon], { radius: mi * 1609.34, color: "#f0ede4", weight: 1, opacity: 0.55, fill: false, dashArray: "2 5", interactive: false }).addTo(g);
        L.marker([home.lat + mi / 69, home.lon], {
          icon: L.divIcon({ className: "ring-label", html: `${mi} MI`, iconSize: [40, 14], iconAnchor: [20, 14] }),
          interactive: false,
          keyboard: false,
        }).addTo(g);
      }
      L.circleMarker([home.lat, home.lon], { radius: 7, color: "#0d1720", weight: 2, fillColor: "#f0ede4", fillOpacity: 1, interactive: false }).addTo(g);
      L.circleMarker([home.lat, home.lon], { radius: 13, color: "#f0ede4", weight: 1.5, fill: false, interactive: false }).addTo(g);
    }
    // One circle per annotated facility.
    const items = annotations
      .map((a) => ({ a, f: facilities.find((x) => x.id === a.id) }))
      .filter((x): x is { a: Annotation; f: Located } => !!x.f);
    for (const id of new Set(items.map((x) => x.f.id))) {
      const f = items.find((x) => x.f.id === id)!.f;
      L.circleMarker([f.lat, f.lon], { radius: 18, color: "#f0ede4", weight: 2, fill: false, interactive: false }).addTo(g);
    }
    // Labels are placed in screen space: annotations closer than 64 px share
    // one stacked label, and each label points toward the middle of the map so
    // it never runs off the edge. Re-placed whenever the view changes.
    const labels = L.layerGroup().addTo(g);
    const place = () => {
      labels.clearLayers();
      const size = m.getSize();
      const clusters: { p: L.Point; f: Located; text: string[] }[] = [];
      for (const { a, f } of items) {
        const p = m.latLngToContainerPoint([f.lat, f.lon]);
        const near = clusters.find((c) => c.p.distanceTo(p) < 64);
        if (near) near.text.push(a.label);
        else clusters.push({ p, f, text: [a.label] });
      }
      // Greedy placement: try the side facing the map's middle, then the other
      // side, then above, then below; take the first spot that stays inside the
      // map and clears every label already placed (ring labels included).
      const taken: L.Bounds[] = [];
      if (home) {
        for (const mi of rings) {
          const p = m.latLngToContainerPoint([home.lat + mi / 69, home.lon]);
          taken.push(L.bounds([p.x - 22, p.y - 15], [p.x + 22, p.y + 1]));
        }
      }
      for (const c of clusters) {
        const w = Math.max(...c.text.map((s) => s.length)) * 7.6 + 8;
        const h = c.text.length * 13;
        const facingRight = c.p.x <= size.x / 2;
        const spots: [string, number, number][] = [
          ["r", c.p.x + 24, c.p.y - h / 2],
          ["l", c.p.x - 24 - w, c.p.y - h / 2],
          ["t", c.p.x - w / 2, c.p.y - 24 - h],
          ["b", c.p.x - w / 2, c.p.y + 24],
        ];
        if (!facingRight) [spots[0], spots[1]] = [spots[1], spots[0]];
        const fits = ([, x, y]: [string, number, number]) => {
          const b = L.bounds([x, y], [x + w, y + h]);
          return x >= 4 && y >= 4 && x + w <= size.x - 4 && y + h <= size.y - 4 && !taken.some((t) => t.intersects(b));
        };
        const [side, x, y] = spots.find(fits) ?? spots[0];
        taken.push(L.bounds([x, y], [x + w, y + h]));
        L.marker([c.f.lat, c.f.lon], {
          icon: L.divIcon({
            className: `annot-label annot-${side}`,
            html: c.text.join("<br>"),
            iconSize: [w, h],
            iconAnchor: [c.p.x - x, c.p.y - y],
          }),
          interactive: false,
          keyboard: false,
        }).addTo(labels);
      }
    };
    place();
    m.on("zoomend moveend resize", place);
    for (const s of shelters) {
      L.circleMarker([s.lat, s.lon], { radius: 6, color: "#e0826f", weight: 2.5, fillColor: "#0d1720", fillOpacity: 1 })
        .bindTooltip(`Open shelter: ${s.name}`, { direction: "top" })
        .addTo(g);
    }
    return () => {
      m.off("zoomend moveend resize", place);
    };
  }, [home, rings, annotations, facilities, shelters]);

  // Framing
  useEffect(() => {
    const m = map.current;
    if (!m || !fitKey) return;
    const pts: L.LatLngExpression[] = [];
    if (home) pts.push([home.lat, home.lon]);
    for (const a of annotations) {
      const f = facilities.find((x) => x.id === a.id);
      if (f) pts.push([f.lat, f.lon]);
    }
    if (pts.length === 1) m.setView(pts[0], 12);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    const m = map.current;
    const f = facilities.find((x) => x.id === selectedId);
    if (m && f && !m.getBounds().contains([f.lat, f.lon])) m.panTo([f.lat, f.lon]);
  }, [selectedId, facilities]);

  return (
    <div className={`caremap ${className ?? ""}`}>
      <div ref={el} className="caremap-map" role="region" aria-label={label} />
      <div className="caremap-grid" aria-hidden />
    </div>
  );
}
