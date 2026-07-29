import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getICloudCredentialsFromEnv } from "@/lib/icloudCalendar";

function mask(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const creds = getICloudCredentialsFromEnv();
  return NextResponse.json({
    configured: Boolean(creds),
    appleId: creds ? mask(creds.appleId) : null,
  });
}
