// @ts-ignore
import fetch from 'node-fetch';
import * as fs from 'fs';
import { join } from 'path';
import { app } from 'electron';
import * as settingsRepo from '../db/repositories/settings.repo';
import * as cloudSync from './cloud-sync.service';
import { getDb } from '../db/connection';
import { logger } from '../utils/logger';

const DEFAULT_SUPABASE_URL = 'https://bkziskyecxiozsdmmrfs.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJremlza3llY3hpb3pzZG1tcmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg0ODA2NiwiZXhwIjoyMDk5NDI0MDY2fQ.domv36LXFSXYZrlEWph9ZcKQtwusK4ZbPcr_0pH-e_I';
const DEFAULT_SUPABASE_BUCKET = 'molecule-storage';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.MAIN_VITE_SUPABASE_URL) ||
  process.env.MAIN_VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.MAIN_VITE_SUPABASE_KEY) ||
  process.env.MAIN_VITE_SUPABASE_KEY ||
  DEFAULT_SUPABASE_KEY;

const supabaseBucket =
  (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.MAIN_VITE_SUPABASE_BUCKET) ||
  process.env.MAIN_VITE_SUPABASE_BUCKET ||
  DEFAULT_SUPABASE_BUCKET;

export function getCustomerFolder(): string {
  const restaurant = settingsRepo.getRestaurant();
  const rawName = (restaurant?.name || '').trim();
  const safeName = rawName ? rawName.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const licenseKey = (settingsRepo.get('license_key') || '').trim();
  const cleanLicense = licenseKey ? licenseKey.replace(/[^a-zA-Z0-9]/g, '').slice(-5) : '';
  const uid = cloudSync.getUid();

  if (safeName && cleanLicense) {
    return `${safeName}-${cleanLicense}`;
  }
  if (uid) {
    return safeName ? `${safeName}-${uid.slice(0, 8)}` : uid;
  }
  if (safeName) {
    return `local-${safeName}`;
  }
  if (cleanLicense) {
    return `license-${cleanLicense}`;
  }
  return 'local-unnamed';
}

export async function uploadBackup(filePath: string): Promise<{ fileName: string; size: number }> {
  if (!supabaseUrl || !supabaseKey) {
    const msg = 'Supabase backup failed: Supabase credentials not configured.';
    logger.error(msg);
    throw new Error(msg);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found at ${filePath}`);
  }

  const folder = getCustomerFolder();
  const fileName = `${folder}/backup-latest.db`;

  logger.info(`Supabase Backup: Uploading ${filePath} to bucket "${supabaseBucket}" as "${fileName}"...`);

  const fileBuffer = fs.readFileSync(filePath);

  // Supabase Storage Upload API (POST with x-upsert: true)
  const url = `${supabaseUrl}/storage/v1/object/${supabaseBucket}/${fileName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Content-Type': 'application/x-sqlite3',
      'x-upsert': 'true',
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Supabase Storage upload failed (Status ${response.status}): ${errText}`);
  }

  logger.info(`Supabase Backup: Successfully uploaded backup to Supabase Storage (${fileName}, ${fileBuffer.length} bytes).`);
  return { fileName, size: fileBuffer.length };
}

export async function performDatabaseBackupAndUpload(): Promise<{ fileName: string; size: number; timestamp: string }> {
  const backupDir = join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const tempBackupPath = join(backupDir, `supabase-backup-temp-${Date.now()}.db`);
  try {
    const db = getDb();
    await db.backup(tempBackupPath);
    const result = await uploadBackup(tempBackupPath);
    const nowIso = new Date().toISOString();
    settingsRepo.set('last_supabase_backup', nowIso, 'general');
    return { ...result, timestamp: nowIso };
  } catch (err: any) {
    logger.error('Supabase backup operation failed:', err, {
      folder: getCustomerFolder(),
      bucket: supabaseBucket,
      errorDetail: err?.message || String(err),
    });
    throw err;
  } finally {
    try {
      if (fs.existsSync(tempBackupPath)) {
        fs.unlinkSync(tempBackupPath);
      }
    } catch { /* ignore */ }
  }
}

