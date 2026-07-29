import { useState } from "react";
import { setGoogleClientId } from "@/lib/localConfig";

export function SetupScreen({ onSaved }: { onSaved: () => void }) {
  const [clientId, setClientId] = useState("");
  const origin = window.location.origin;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim()) return;
    setGoogleClientId(clientId);
    onSaved();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-2 text-3xl">✈️</div>
        <h1 className="mb-1 text-xl font-semibold text-ink">One-time setup</h1>
        <p className="mb-4 text-sm text-slate-500">
          This app runs entirely in your browser — no server. Google sign-in needs an OAuth Client ID you
          create yourself (it's public information, safe to paste here; it's stored only in this browser).
        </p>

        <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>
            Go to{" "}
            <a
              className="text-blue-600 underline"
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
            >
              Google Cloud Console → Credentials
            </a>{" "}
            and enable the <span className="font-medium">Google Calendar API</span> and{" "}
            <span className="font-medium">Google Sheets API</span> on your project.
          </li>
          <li>
            Create an <span className="font-medium">OAuth client ID</span> of type{" "}
            <span className="font-medium">Web application</span>.
          </li>
          <li>
            Under <span className="font-medium">Authorized JavaScript origins</span>, add exactly:
            <div className="mt-1 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs">{origin}</div>
          </li>
          <li>
            If the OAuth consent screen is in "Testing" mode, add your own Google account under{" "}
            <span className="font-medium">Test users</span>.
          </li>
          <li>Copy the generated Client ID and paste it below.</li>
        </ol>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="123456789-abc.apps.googleusercontent.com"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save and continue
          </button>
        </form>
      </div>
    </main>
  );
}
