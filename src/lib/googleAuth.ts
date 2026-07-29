/** Client-side Google sign-in using Google Identity Services (GIS) — an
 * OAuth 2.0 token client that runs entirely in the browser with a public
 * client ID (no client secret, so nothing to keep server-side). This is
 * what makes the app deployable as static files on GitHub Pages: the
 * Client Secret a normal server-side OAuth flow needs simply doesn't
 * exist here. Tokens are access-token-only (no refresh token, by design
 * for public clients) — they expire after roughly an hour and the user
 * re-authorizes, which for a personal dashboard opened occasionally is a
 * reasonable trade-off for not needing any backend at all. */

export const GOOGLE_SCOPES =
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/spreadsheets";

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

export function signOutGoogle(): void {
  const stored = readStoredToken();
  clearStoredToken();
  if (stored && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(stored.accessToken);
  }
}
