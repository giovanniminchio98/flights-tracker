import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getICloudCredentialsFromEnv, testICloudConnection } from "@/lib/icloudCalendar";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const creds = getICloudCredentialsFromEnv();
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "ICLOUD_APPLE_ID / ICLOUD_APP_PASSWORD are not configured" },
      { status: 200 }
    );
  }

  const result = await testICloudConnection(creds);
  return NextResponse.json(result);
}
