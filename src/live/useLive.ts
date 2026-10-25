import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/** Runs a live request on mount and on refresh. Keeps the last good data visible while reloading. */
export function useLive<T>(load: () => Promise<T>, enabled = true): LiveState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    loadRef.current()
      .then((d) => setData(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Request failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { data, error, loading, refresh };
}

export function formatTime(d: Date | string | null) {
  if (!d) return "unknown";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
