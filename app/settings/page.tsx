"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Nav } from "@/components/Nav";

interface ICloudStatus {
  configured: boolean;
  appleId: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [icloud, setIcloud] = useState<ICloudStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testOk, setTestOk] = useState(false);

  useEffect(() => {
    fetch("/api/icloud/status")
      .then((r) => r.json())
      .then(setIcloud)
      .catch(() => setIcloud({ configured: false, appleId: null }));
  }, []);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/icloud/test", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTestOk(true);
        setTestResult(`Connected — found ${data.calendarCount} calendar(s).`);
      } else {
        setTestOk(false);
        setTestResult(data.error ?? "Connection failed");
      }
    } catch (err) {
      setTestOk(false);
      setTestResult(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <Nav />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-semibold text-ink">Settings</h1>

        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-ink">Google account</h2>
          <p className="text-sm text-slate-500">
            Signed in as <span className="font-medium text-ink">{session?.user?.email}</span>. Calendar and
            Sheets access were granted when you signed in.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-ink">iCloud Calendar (CalDAV)</h2>
          <p className="mb-3 text-sm text-slate-500">
            iCloud has no OAuth API for calendar access, so this connects using an
            app-specific password instead of your real Apple ID password. Generate one at{" "}
            <span className="font-medium">appleid.apple.com → Sign-In and Security → App-Specific Passwords</span>,
            then set <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">ICLOUD_APPLE_ID</code> and{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">ICLOUD_APP_PASSWORD</code> in this app's
            environment variables (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.env</code> locally),
            then restart the app.
          </p>

          {icloud === null ? (
            <div className="text-sm text-slate-400">Checking configuration…</div>
          ) : icloud.configured ? (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>
                Configured for <span className="font-medium">{icloud.appleId}</span>
              </span>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span className="text-slate-500">Not configured yet</span>
            </div>
          )}

          <button
            onClick={handleTest}
            disabled={testing || !icloud?.configured}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>

          {testResult && (
            <div className={`mt-3 text-sm ${testOk ? "text-green-600" : "text-red-600"}`}>{testResult}</div>
          )}
        </section>
      </div>
    </main>
  );
}
