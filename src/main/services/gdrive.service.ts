import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { google, type drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REDIRECT_URI } from './gdrive-credentials';
import { logger } from '../utils/logger';

const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'email'];
const TOKEN_FILE = 'gdrive-tokens.json';
const MAX_BACKUPS = 7;

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email?: string;
}

function tokenPath(): string {
  return path.join(app.getPath('userData'), TOKEN_FILE);
}

function readTokens(): StoredTokens | null {
  try {
    const raw = fs.readFileSync(tokenPath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens): void {
  fs.writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2), 'utf8');
}

function clearTokens(): void {
  try {
    fs.unlinkSync(tokenPath());
  } catch { /* ignore */ }
}

function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REDIRECT_URI);
}

function getAuthenticatedClient(): OAuth2Client | null {
  const tokens = readTokens();
  if (!tokens?.refresh_token) return null;
  const client = createOAuth2Client();
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });
  return client;
}

function getDrive(auth: OAuth2Client): drive_v3.Drive {
  return google.drive({ version: 'v3', auth });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isSignedIn(): boolean {
  return !!readTokens()?.refresh_token;
}

export function getAccount(): { email: string; connected: boolean } {
  const tokens = readTokens();
  if (!tokens?.refresh_token) return { email: '', connected: false };
  return { email: tokens.email ?? '', connected: true };
}

/**
 * Opens an embedded BrowserWindow for Google OAuth2 consent.
 * Returns the signed-in email on success.
 */
export function signIn(): Promise<{ email: string }> {
  return new Promise((resolve, reject) => {
    const oauth2 = createOAuth2Client();
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    const authWin = new BrowserWindow({
      width: 520,
      height: 700,
      show: true,
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    authWin.loadURL(authUrl);

    // Intercept redirects to the loopback URI to grab the auth code
    const handleRedirect = async (url: string): Promise<boolean> => {
      if (!url.startsWith(GDRIVE_REDIRECT_URI)) return false;

      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      const error = parsed.searchParams.get('error');

      if (error || !code) {
        authWin.close();
        reject(new Error(error || 'No authorization code received'));
        return true;
      }

      try {
        const { tokens } = await oauth2.getToken(code);
        oauth2.setCredentials(tokens);

        // Fetch user email
        const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
        const userInfo = await oauth2Api.userinfo.get();
        const email = userInfo.data.email ?? '';

        writeTokens({
          access_token: tokens.access_token ?? '',
          refresh_token: tokens.refresh_token ?? '',
          expiry_date: tokens.expiry_date ?? 0,
          email,
        });

        authWin.close();
        resolve({ email });
      } catch (err) {
        authWin.close();
        reject(err);
      }
      return true;
    };

    authWin.webContents.on('will-redirect', (_event, url) => {
      handleRedirect(url);
    });

    authWin.webContents.on('will-navigate', (_event, url) => {
      handleRedirect(url);
    });

    authWin.on('closed', () => {
      reject(new Error('Auth window closed by user'));
    });
  });
}

export function signOut(): void {
  clearTokens();
}

/**
 * Upload a local .db file to the app's hidden GDrive folder.
 * If a file with the same name already exists, replace its content.
 */
export async function uploadBackup(localPath: string): Promise<{ fileId: string }> {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not signed in to Google Drive');

  const drive = getDrive(auth);
  const fileName = path.basename(localPath);
  const media = { mimeType: 'application/x-sqlite3', body: fs.createReadStream(localPath) };

  // Check if file with same name already exists
  const existing = await drive.files.list({
    spaces: 'appDataFolder',
    q: `name = '${fileName}'`,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  let fileId: string;

  if (existing.data.files && existing.data.files.length > 0) {
    const existingId = existing.data.files[0].id!;
    await drive.files.update({ fileId: existingId, media });
    fileId = existingId;
  } else {
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: ['appDataFolder'] },
      media,
      fields: 'id',
    });
    fileId = created.data.id!;
  }

  await pruneOldBackups(drive);
  return { fileId };
}

/**
 * List all backup files stored in the app's GDrive folder.
 */
export async function listBackups(): Promise<{ id: string; name: string; createdTime: string; size: string }[]> {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not signed in to Google Drive');

  const drive = getDrive(auth);
  const res = await drive.files.list({
    spaces: 'appDataFolder',
    q: "name contains 'molecule-backup-' or name contains 'auto-backup-'",
    fields: 'files(id, name, createdTime, size)',
    orderBy: 'createdTime desc',
    pageSize: 50,
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? '',
    name: f.name ?? '',
    createdTime: f.createdTime ?? '',
    size: f.size ?? '0',
  }));
}

/**
 * Download a backup file from GDrive to a local destination path.
 */
export async function downloadBackup(fileId: string, destPath: string): Promise<void> {
  const auth = getAuthenticatedClient();
  if (!auth) throw new Error('Not signed in to Google Drive');

  const drive = getDrive(auth);
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    (res.data as NodeJS.ReadableStream)
      .on('error', reject)
      .pipe(dest)
      .on('finish', resolve)
      .on('error', reject);
  });
}

async function pruneOldBackups(drive: drive_v3.Drive): Promise<void> {
  try {
    const res = await drive.files.list({
      spaces: 'appDataFolder',
      q: "name contains 'molecule-backup-' or name contains 'auto-backup-'",
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 100,
    });

    const files = res.data.files ?? [];
    if (files.length <= MAX_BACKUPS) return;

    const toDelete = files.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      if (f.id) {
        await drive.files.delete({ fileId: f.id });
        logger.info(`GDrive: pruned old backup ${f.name}`);
      }
    }
  } catch (err) {
    logger.error('GDrive: prune failed', err);
  }
}
