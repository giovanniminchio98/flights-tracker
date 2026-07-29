import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import { persistGoogleRefreshToken } from "./config";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

interface GoogleTokenRefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshed = (await res.json()) as GoogleTokenRefreshResponse;
    if (!res.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      // Google only returns a new refresh_token occasionally; keep the old one otherwise.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in.
      if (account) {
        if (account.refresh_token) {
          persistGoogleRefreshToken(account.refresh_token);
        }
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : 0,
        };
      }

      if (Date.now() < ((token.accessTokenExpires as number) ?? 0)) {
        return token;
      }

      return refreshGoogleAccessToken(token);
    },
    async session({ session, token }): Promise<Session> {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        error: token.error as string | undefined,
      };
    },
  },
  pages: {
    signIn: "/login",
  },
};
