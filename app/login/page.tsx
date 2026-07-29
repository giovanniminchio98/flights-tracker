"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-2 text-3xl">✈️</div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Flight Tracker</h1>
        <p className="mb-6 text-sm text-slate-500">
          Sign in with Google to sync flights detected in your calendars.
        </p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
