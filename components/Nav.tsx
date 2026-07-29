"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
          <span>✈️</span>
          <span>Flight Tracker</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <Link href="/settings" className="hover:text-ink">
            Settings
          </Link>
          {session?.user?.email && <span className="hidden sm:inline">{session.user.email}</span>}
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="hover:text-ink">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
