import { useEffect, useState } from "react";
import { subscribeSync, syncNow, type SyncState } from "@/lib/syncEngine";

/** Three-colour sync indicator:
 *   green  — everything is safely on Drive
 *   yellow — a sync is in flight
 *   red    — offline or the last attempt failed (changes are queued locally)
 * Hidden entirely when sync is disabled, so the local-only app is unchanged. */
export function SyncStatusLight() {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => subscribeSync(setState), []);

  if (!state || state.status === "disabled") return null;

  const tone =
    state.status === "synced"
      ? { dot: "bg-neon-green", glow: "shadow-[0_0_8px_rgba(57,255,136,0.8)]", label: "Synced" }
      : state.status === "syncing"
        ? { dot: "bg-neon-yellow", glow: "shadow-[0_0_8px_rgba(255,217,61,0.8)]", label: "Syncing" }
        : { dot: "bg-neon-red", glow: "shadow-[0_0_8px_rgba(255,46,91,0.8)]", label: "Not synced" };

  const retryable = state.status === "error";

  return (
    <button
      onClick={() => retryable && void syncNow()}
      disabled={!retryable}
      title={`${tone.label} — ${state.message}`}
      className={`flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11px] ${
        retryable ? "text-ink hover:bg-white/10" : "cursor-default text-muted"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${tone.dot} ${tone.glow} ${
          state.status === "syncing" ? "animate-pulse" : ""
        }`}
      />
      <span className="hidden sm:inline">{tone.label}</span>
    </button>
  );
}
