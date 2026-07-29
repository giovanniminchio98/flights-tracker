import { useState } from "react";
import { ApiKeySettings } from "./ApiKeySettings";

export function Nav() {
  const [showApiSettings, setShowApiSettings] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <span>✈️</span>
          <span>Flight Tracker</span>
        </span>
        <button onClick={() => setShowApiSettings(true)} className="text-sm text-slate-500 hover:text-ink">
          Flight lookup API
        </button>
      </div>
      {showApiSettings && <ApiKeySettings onClose={() => setShowApiSettings(false)} />}
    </header>
  );
}
