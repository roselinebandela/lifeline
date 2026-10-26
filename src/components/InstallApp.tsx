import { useEffect, useState } from "react";

// The browser's install prompt event (Chrome, Edge, Android). Not in the DOM typings yet.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** "Add LIFELINE to your home screen", using the real browser install flow. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(standalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="muted small">LIFELINE is installed on this device.</p>;

  return (
    <div className="install">
      {prompt ? (
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
        >
          Install LIFELINE on this device
        </button>
      ) : isIOS() ? (
        <p className="small">On iPhone or iPad: tap the Share button in Safari, then <strong>Add to Home Screen</strong>.</p>
      ) : (
        <p className="small">Use your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</p>
      )}
      <p className="muted small">Once installed, your saved plan and the provider list open even without a connection. Live alerts still need one.</p>
    </div>
  );
}

/** A quiet notice while the device is offline. */
export function OfflineNotice() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <p className="offline" role="status">
      You are offline. Providers and your saved plan still work. Live alerts, forecasts and maps need a connection.
    </p>
  );
}
