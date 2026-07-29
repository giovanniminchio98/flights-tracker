import { NextResponse } from "next/server";
import { google } from "googleapis";
import { runSync } from "@/lib/sync";
import { getStoredGoogleRefreshToken } from "@/lib/config";

/** Unattended sync trigger for a scheduler (e.g. Vercel Cron) that has no
 * browser session to draw an access token from. Uses the refresh token
 * captured on the last interactive Google sign-in (see lib/auth.ts /
 * lib/config.ts) instead. Guarded by CRON_SECRET since it has no other auth. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; scheduled sync is disabled" },
      { status: 501 }
    );
  }

  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refreshToken = getStoredGoogleRefreshToken();
  if (!refreshToken) {
    return NextResponse.json(
      {
        error:
          "No Google refresh token available. Sign in interactively at least once so one can be captured, then set GOOGLE_REFRESH_TOKEN for serverless deploys.",
      },
      { status: 412 }
    );
  }

  try {
    const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new Error("Failed to obtain access token from refresh token");

    const summary = await runSync(credentials.access_token);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scheduled sync failed" },
      { status: 500 }
    );
  }
}
