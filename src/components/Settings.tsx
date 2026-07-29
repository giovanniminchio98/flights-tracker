import { getGoogleClientId, getStoredSpreadsheetId, setGoogleClientId, clearStoredSpreadsheetId } from "@/lib/localConfig";

export function Settings({ onClientIdReset }: { onClientIdReset: () => void }) {
  const clientId = getGoogleClientId();
  const spreadsheetId = getStoredSpreadsheetId();

  function handleChangeClientId() {
    if (!confirm("This signs you out and clears the saved Google Client ID. Continue?")) return;
    setGoogleClientId("");
    onClientIdReset();
  }

  function handleForgetSpreadsheet() {
    if (
      !confirm(
        "This only forgets the spreadsheet ID saved in this browser — it does not delete the Google Sheet itself. The next sync will create a new one unless you paste the existing ID back in. Continue?"
      )
    )
      return;
    clearStoredSpreadsheetId();
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold text-ink">Settings</h1>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-ink">Google</h2>
        <p className="mb-3 text-sm text-slate-500">
          OAuth Client ID in use (public, safe to display):
        </p>
        <div className="mb-3 break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs">{clientId}</div>
        <button
          onClick={handleChangeClientId}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Change Client ID
        </button>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-ink">Google Sheet</h2>
        {spreadsheetId ? (
          <>
            <p className="mb-3 text-sm text-slate-500">
              Flights are stored in{" "}
              <a
                className="text-blue-600 underline"
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
              >
                this spreadsheet
              </a>
              .
            </p>
            <button
              onClick={handleForgetSpreadsheet}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Forget spreadsheet (use a different one)
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            No spreadsheet yet — one is created automatically the first time you sync or add a flight.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-ink">iCloud calendar</h2>
        <p className="mb-3 text-sm text-slate-500">
          There's no live iCloud connection (this app is static, so it can't hold an Apple app-specific
          password or make cross-origin CalDAV calls). Instead, export your calendar as an .ics file and
          import it from the dashboard:
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            On Mac: open <span className="font-medium">Calendar</span> → select your iCloud calendar in the
            sidebar → <span className="font-medium">File → Export → Export...</span>
          </li>
          <li>
            Or on{" "}
            <a className="text-blue-600 underline" href="https://www.icloud.com/calendar" target="_blank" rel="noreferrer">
              iCloud.com
            </a>
            : calendar settings → share the calendar publicly → open the given link in a browser to download
            its .ics feed.
          </li>
          <li>Go to the dashboard's "Import iCloud calendar (.ics)" panel and upload that file.</li>
        </ol>
      </section>
    </div>
  );
}
