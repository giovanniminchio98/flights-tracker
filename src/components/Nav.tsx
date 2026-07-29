export function Nav({
  view,
  onNavigate,
  onSignOut,
}: {
  view: "dashboard" | "settings";
  onNavigate: (view: "dashboard" | "settings") => void;
  onSignOut: () => void;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <button onClick={() => onNavigate("dashboard")} className="flex items-center gap-2 font-semibold text-ink">
          <span>✈️</span>
          <span>Flight Tracker</span>
        </button>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <button
            onClick={() => onNavigate(view === "settings" ? "dashboard" : "settings")}
            className="hover:text-ink"
          >
            {view === "settings" ? "Dashboard" : "Settings"}
          </button>
          <button onClick={onSignOut} className="hover:text-ink">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
