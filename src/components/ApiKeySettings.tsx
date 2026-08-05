import { useState } from "react";
import { getAeroDataBoxKey, setAeroDataBoxKey } from "@/lib/localConfig";

export function ApiKeySettings({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(getAeroDataBoxKey() ?? "");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setAeroDataBoxKey(key);
    setSaved(true);
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold text-ink">Flight lookup API</h2>
        <p className="mb-4 text-sm text-muted">
          Adding a flight number that isn't in your history looks up its real route and scheduled times
          automatically via{" "}
          <a
            className="text-blue-600 underline"
            href="https://rapidapi.com/aedbx-aedbx/api/aerodatabox"
            target="_blank"
            rel="noreferrer"
          >
            AeroDataBox
          </a>
          , through a free RapidAPI account.
        </p>

        <p className="mb-3 text-xs text-muted">
          There's no server here, so this key is stored only in this browser and sent directly from it —
          anyone with DevTools access to this device could read it. Fine for a personal key on the free
          tier; don't reuse a key you care more about.
        </p>

        <label className="block text-sm">
          RapidAPI key
          <input
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setSaved(false);
            }}
            placeholder="Paste your RapidAPI key"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </label>

        {saved && <div className="mt-2 text-xs text-green-600">Saved.</div>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-white/10">
            Close
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
