// @ts-ignore
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as settingsRepo from '../db/repositories/settings.repo';
import * as cloudSync from './cloud-sync.service';
import { logger } from '../utils/logger';

const supabaseUrl = (import.meta as any).env?.MAIN_VITE_SUPABASE_URL || process.env.MAIN_VITE_SUPABASE_URL || '';
const supabaseKey = (import.meta as any).env?.MAIN_VITE_SUPABASE_KEY || process.env.MAIN_VITE_SUPABASE_KEY || '';
const supabaseBucket = (import.meta as any).env?.MAIN_VITE_SUPABASE_BUCKET || process.env.MAIN_VITE_SUPABASE_BUCKET || 'backups';

export async function uploadBackup(filePath: string): Promise<void> {
  if (!supabaseUrl || !supabaseKey) {
    logger.warn('Supabase backup skipped: MAIN_VITE_SUPABASE_URL or MAIN_VITE_SUPABASE_KEY not configured.');
    return;
  }

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found at ${filePath}`);
    }

    const restaurant = settingsRepo.getRestaurant();
    const restaurantName = restaurant?.name;
    const uid = cloudSync.getUid() || 'local-' + (restaurantName ? restaurantName.replace(/[^a-zA-Z0-9]/g, '_') : 'unnamed');
    
    // Generate monthly filename: e.g. backup-2026-07.db
    const dateStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    const fileName = `${uid}/backup-${dateStr}.db`;

    logger.info(`Supabase Backup: Uploading ${filePath} to bucket "${supabaseBucket}" as "${fileName}"...`);

    const fileBuffer = fs.readFileSync(filePath);
    
    // Supabase Storage Upload API (PUT for overwrite/upsert)
    const url = `${supabaseUrl}/storage/v1/object/${supabaseBucket}/${fileName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/x-sqlite3',
        'x-upsert': 'true' // Overwrite the same month's file if run again
      },
      body: fileBuffer
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supabase Storage upload failed (Status ${response.status}): ${errText}`);
    }

    logger.info(`Supabase Backup: Successfully uploaded backup to Supabase Storage.`);
  } catch (err: any) {
    logger.error('Supabase Backup: Upload failed', err);
    throw err;
  }
}
