import { useState } from "react";
import { signInWithGoogle } from "@/lib/googleAuth";
import { setGoogleClientId } from "@/lib/localConfig";

export function LoginScreen({
  clientId,
  onSignedIn,
  onResetClientId,
}: {
  clientId: string;
  onSignedIn: (accessToken: string) => void;
  onResetClientId: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const token = await signInWithGoogle(clientId);
      onSignedIn(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  function handleChangeClientId() {
    setGoogleClientId("");
    onResetClientId();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-2 text-3xl">✈️</div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Flight Tracker</h1>
        <p className="mb-6 text-sm text-slate-500">
          Sign in with Google to sync flights detected in your calendar.
        </p>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Opening Google sign-in…" : "Sign in with Google"}
        </button>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <button onClick={handleChangeClientId} className="mt-4 text-xs text-slate-400 hover:text-slate-600">
          Wrong Google Client ID? Change it
        </button>
      </div>
    </main>
  );
}
