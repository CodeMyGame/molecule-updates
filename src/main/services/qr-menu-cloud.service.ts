// @ts-ignore
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import * as settingsRepo from '../db/repositories/settings.repo';
import { getQrMenuData, getDefaultCustomerSlug } from './kitchen-server.service';
import { logger } from '../utils/logger';

const DEFAULT_SUPABASE_URL = 'https://bkziskyecxiozsdmmrfs.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJremlza3llY3hpb3pzZG1tcmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzg0ODA2NiwiZXhwIjoyMDk5NDI0MDY2fQ.domv36LXFSXYZrlEWph9ZcKQtwusK4ZbPcr_0pH-e_I';
const DEFAULT_SUPABASE_BUCKET = 'molecule-storage';

const DEFAULT_CLOUD_DOMAIN = 'https://molecule-e2e95.web.app';

export interface QrMenuPublishResult {
  success: boolean;
  slug: string;
  webUrl: string;
  publicJsonUrl: string;
  updatedAt: string;
  itemCount: number;
  categoryCount: number;
}

export function getCustomerSlug(): string {
  const custom = settingsRepo.get('qr_menu_customer_slug');
  if (custom && custom.trim().length > 0) {
    return custom.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  }
  return getDefaultCustomerSlug();
}

/**
 * Publishes the complete customer menu payload to the cloud storage bucket automatically.
 * Zero manual steps or Firebase CLI authentication required by the restaurant owner.
 */
export async function publishQrMenuToCloud(overrideSlug?: string): Promise<QrMenuPublishResult> {
  const slug = (overrideSlug || getCustomerSlug()).toLowerCase();
  const data = getQrMenuData();
  const now = new Date().toISOString();

  const payload = {
    ...data,
    publishedAt: now,
    slug,
  };

  const jsonStr = JSON.stringify(payload, null, 2);

  // 1. Upload to Supabase Storage (publicly accessible CDN bucket)
  const supabaseUrl = process.env.MAIN_VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = process.env.MAIN_VITE_SUPABASE_KEY || DEFAULT_SUPABASE_KEY;
  const bucket = process.env.MAIN_VITE_SUPABASE_BUCKET || DEFAULT_SUPABASE_BUCKET;

  const targetObject = `menus/${slug}.json`;
  const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${targetObject}`;

  let uploadSuccess = false;
  try {
    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: jsonStr,
    });

    if (res.ok) {
      uploadSuccess = true;
      logger.info(`[QR Menu Cloud] Menu successfully uploaded to ${targetObject} (${jsonStr.length} bytes)`);
    } else {
      const errText = await res.text();
      logger.warn(`[QR Menu Cloud] Cloud storage upload failed (${res.status}): ${errText}`);
    }
  } catch (err: any) {
    logger.warn(`[QR Menu Cloud] Network error uploading menu to cloud: ${err?.message}`);
  }

  // 2. Also save to local static directories (for dev server / local offline fallback)
  try {
    const rootDir = process.cwd();
    const rest = settingsRepo.getRestaurant();
    const baseSlug = (rest?.name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    const localDirs = [
      path.join(rootDir, 'out', 'renderer', 'menus'),
      path.join(rootDir, 'public', 'menus'),
      path.join(rootDir, 'web-dashboard', 'public', 'menus'),
    ];

    localDirs.forEach((dir) => {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, `${slug}.json`), jsonStr, 'utf-8');
        fs.writeFileSync(path.join(dir, 'default.json'), jsonStr, 'utf-8');
        if (baseSlug && baseSlug !== slug) {
          fs.writeFileSync(path.join(dir, `${baseSlug}.json`), jsonStr, 'utf-8');
        }
      } catch {
        // ignore local filesystem write errors in packaged bundle
      }
    });
  } catch {
    // ignore
  }

  // 3. Update settings with last publish timestamp
  settingsRepo.set('qr_menu_last_cloud_publish', now, 'qr_menu');

  const cloudDomain = (settingsRepo.get('qr_menu_cloud_domain') || DEFAULT_CLOUD_DOMAIN).replace(/\/+$/, '');
  const webUrl = `${cloudDomain}/m/${slug}`;
  const publicJsonUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/menus/${slug}.json`;

  return {
    success: uploadSuccess,
    slug,
    webUrl,
    publicJsonUrl,
    updatedAt: now,
    itemCount: data.items.length,
    categoryCount: data.categories.length,
  };
}

let autoPublishTimer: NodeJS.Timeout | null = null;

/**
 * Schedules debounced automatic publish to the cloud whenever menu or settings change.
 * Coalesces rapid updates into a single upload after 5 seconds of inactivity.
 */
export function scheduleAutoPublish(overrideSlug?: string): void {
  if (autoPublishTimer) clearTimeout(autoPublishTimer);
  autoPublishTimer = setTimeout(() => {
    publishQrMenuToCloud(overrideSlug).catch((err) => {
      logger.warn('[QR Menu Cloud] Auto-publish failed:', err?.message);
    });
  }, 5000);
}
