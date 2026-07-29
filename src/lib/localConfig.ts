/** Local config this single-user static app needs to remember between
 * visits. The Google Client ID and spreadsheet ID are non-sensitive (a
 * Client ID is public by design; a spreadsheet ID is just an identifier).
 * The AeroDataBox key is a real credential — there's no backend to hide
 * it behind, so it's stored here as a deliberate, known trade-off (see
 * the Setup screen copy) rather than a mistake. */

const KEYS = {
  googleClientId: "flight-tracker:google-client-id",
  spreadsheetId: "flight-tracker:spreadsheet-id",
  aeroDataBoxKey: "flight-tracker:aerodatabox-key",
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

export function getAeroDataBoxKey(): string | null {
  return localStorage.getItem(KEYS.aeroDataBoxKey);
}

export function setAeroDataBoxKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(KEYS.aeroDataBoxKey, trimmed);
  } else {
    localStorage.removeItem(KEYS.aeroDataBoxKey);
  }
}
