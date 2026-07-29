/** Only local, non-secret config this single-user static app needs to
 * remember between visits — nothing here is sensitive (the Google Client
 * ID is public by design, and the spreadsheet ID is just an identifier),
 * so plain localStorage is fine. There's no server to hold this instead. */

const KEYS = {
  googleClientId: "flight-tracker:google-client-id",
  spreadsheetId: "flight-tracker:spreadsheet-id",
} as const;

export function getGoogleClientId(): string | null {
  return localStorage.getItem(KEYS.googleClientId);
}

export function setGoogleClientId(clientId: string): void {
  localStorage.setItem(KEYS.googleClientId, clientId.trim());
}

export function getStoredSpreadsheetId(): string | null {
  return localStorage.getItem(KEYS.spreadsheetId);
}

export function setStoredSpreadsheetId(spreadsheetId: string): void {
  localStorage.setItem(KEYS.spreadsheetId, spreadsheetId);
}

export function clearStoredSpreadsheetId(): void {
  localStorage.removeItem(KEYS.spreadsheetId);
}
