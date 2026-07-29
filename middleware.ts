export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except the login page, NextAuth's own routes, the
  // secret-guarded cron endpoint, and static assets.
  matcher: [
    "/((?!login|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
