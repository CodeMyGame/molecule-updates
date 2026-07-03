/**
 * Google Cloud OAuth2 credentials for the Desktop app.
 *
 * How to set up:
 *  1. Go to https://console.cloud.google.com/
 *  2. Create a project (or pick an existing one)
 *  3. Enable the "Google Drive API"
 *  4. Go to APIs & Services → Credentials → Create Credentials → OAuth Client ID
 *  5. Application type: "Desktop app"
 *  6. Copy the Client ID and Client Secret below
 *  7. Under OAuth consent screen, add scope: https://www.googleapis.com/auth/drive.appdata
 *
 * The redirect URI for desktop apps is the special loopback value below.
 */

export const GDRIVE_CLIENT_ID = (import.meta as any).env.MAIN_VITE_GDRIVE_CLIENT_ID || '';
export const GDRIVE_CLIENT_SECRET = (import.meta as any).env.MAIN_VITE_GDRIVE_CLIENT_SECRET || '';
export const GDRIVE_REDIRECT_URI = 'http://localhost';
