/** Client-side Google sign-in using Google Identity Services (GIS) — an
 * OAuth 2.0 token client that runs entirely in the browser with a public
 * client ID (no client secret, so nothing to keep server-side). This is
 * what makes the app deployable as static files on GitHub Pages: the
 * Client Secret a normal server-side OAuth flow needs simply doesn't
 * exist here. Tokens are access-token-only (no refresh token, by design
 * for public clients) — they expire after roughly an hour and the user
 * re-authorizes, which for a personal dashboard opened occasionally is a
 * reasonable trade-off for not needing any backend at all. */

/** Least-privilege set:
 *  - drive.appdata  → a hidden folder only this app can see. Notably NOT
 *    `drive`/`drive.file`, so signing in gives no visibility of the user's
 *    own Drive contents.
 *  - calendar.readonly → to find flights; never writes to the calendar.
 *  - userinfo.email → so the UI can show which account is signed in. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken(overrideConfig?: { prompt?: string }): void;
}

interface GisAccounts {
  oauth2: {
    initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (response: GisTokenResponse) => void;
      error_callback?: (error: { type: string; message?: string }) => void;
    }): GisTokenClient;
    revoke(accessToken: string, done?: () => void): void;
  };
}

declare global {
  interface Window {
    google?: { accounts: GisAccounts };
  }
}

const TOKEN_STORAGE_KEY = "flight-tracker:google-token";

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

function readStoredToken(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

function writeStoredToken(token: StoredToken): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

/** Returns a still-valid cached access token, or null if the user needs to
 * (re)authorize. A minute of buffer avoids using a token that expires
 * mid-request. */
export function getValidAccessToken(): string | null {
  const stored = readStoredToken();
  if (!stored) return null;
  if (Date.now() > stored.expiresAt - 60_000) return null;
  return stored.accessToken;
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

function waitForGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > 10_000) {
        clearInterval(interval);
        reject(new Error("Google Identity Services script failed to load"));
      }
    }, 100);
  });
}

/** Opens the Google consent/account picker (via GIS) and resolves with a
 * fresh access token, storing it in sessionStorage for reuse by the rest
 * of the current tab session. */
export async function signInWithGoogle(clientId: string): Promise<string> {
  await waitForGis();

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description ?? response.error));
            return;
          }
          const expiresAt = Date.now() + response.expires_in * 1000;
          writeStoredToken({ accessToken: response.access_token, expiresAt });
          resolve(response.access_token);
        },
        error_callback: (error) => {
          reject(new Error(error.message ?? error.type));
        },
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/** Re-authorizes without showing the account chooser. Works once the user has
 * already granted consent, so a returning visitor gets a usable token without
 * clicking anything; rejects (rather than prompting) when consent is needed. */
export async function trySilentSignIn(clientId: string): Promise<string | null> {
  const cached = getValidAccessToken();
  if (cached) return cached;

  await waitForGis();
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
          if (response.error || !response.access_token) return done(null);
          writeStoredToken({
            accessToken: response.access_token,
            expiresAt: Date.now() + response.expires_in * 1000,
          });
          done(response.access_token);
        },
        error_callback: () => done(null),
      });
      client.requestAccessToken({ prompt: "" });
      // GIS silently no-ops if consent is required; don't hang forever.
      setTimeout(() => done(null), 4000);
    } catch {
      done(null);
    }
  });
}

/** The signed-in account's email, for display only. */
export async function getUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export function signOutGoogle(): void {
  const stored = readStoredToken();
  clearStoredToken();
  if (stored && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(stored.accessToken);
  }
}
