import { useState, type FormEvent } from "react";
import { Icon } from "./Icons";
import { currentPosition, inLouisiana, searchLouisiana, type Place } from "../lib/geocode";
import "./search.css";

export function LocationSearch({ onPick, compact }: { onPick: (p: Place) => void; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await searchLouisiana(q.trim());
      if (r.length === 1) onPick(r[0]);
      else setResults(r);
      if (!r.length) setError("No Louisiana match. Try a street address with the city, or a 5-digit ZIP code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  };

  const locate = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await currentPosition();
      if (!inLouisiana(p)) setError("Your location appears to be outside Louisiana. LIFELINE covers Louisiana only. Type a Louisiana address instead.");
      else onPick(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Location unavailable.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`lsearch ${compact ? "lsearch-compact" : ""}`}>
      <form onSubmit={submit} className="lsearch-form" role="search">
        <label htmlFor="where" className="lsearch-label">
          Where do you live?
        </label>
        <div className="lsearch-row">
          <input
            id="where"
            type="text"
            inputMode="search"
            autoComplete="street-address"
            placeholder="Street address, city, or ZIP"
            value={q}
            onChange={(e) => { setQ(e.target.value); setResults(null); }}
          />
          <button type="submit" className="btn btn-solid" disabled={busy}>
            {busy ? "Searching" : "Find my care"}
          </button>
        </div>
      </form>
      <button type="button" className="link-btn lsearch-locate" onClick={locate} disabled={busy}>
        <Icon name="locate" size={18} /> Use my current location
      </button>
      <p className="lsearch-privacy">
        Your search goes to OpenStreetMap to find the point. LIFELINE keeps it on this device only, and only if you choose to save your plan.
      </p>
      <div aria-live="polite">
        {error && <p className="error">{error}</p>}
        {results && results.length > 1 && (
          <ul className="lsearch-results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button type="button" onClick={() => onPick(r)}>{r.label}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
