import './fetch-polyfill';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join, dirname } from 'path';
import fs from 'fs';
import { is } from '@electron-toolkit/utils';
import { getDb, closeDb, getDbPath } from './db/connection';
import { runMigrations } from './db/migrations/runner';
import { initialMigration } from './db/migrations/001_initial';
import { addStationToMenuItems } from './db/migrations/002_add_station_to_menu_items';
import { addCreatedAtToKots } from './db/migrations/003_add_created_at_to_kots';
import { uniqueKotNumber } from './db/migrations/004_unique_kot_number';
import { addOffersTable } from './db/migrations/005_offers';
import { dropTranslationTables } from './db/migrations/008_drop_translation_tables';
import { moveItemsToAddons } from './db/migrations/009_move_items_to_addons';
import { addonVariationPrices } from './db/migrations/010_addon_variation_prices';
import { addFavoritesTable } from './db/migrations/011_favorites';
import { syncVariationBasePrices } from './db/migrations/012_sync_variation_base_prices';
import { addPerfIndexes } from './db/migrations/013_add_perf_indexes';
import { addTableNameSnapshot } from './db/migrations/014_table_name_snapshot';
import { addPinToItemsAndTables } from './db/migrations/015_pin_items_and_tables';
import { seedDatabase } from './db/seed';
import { registerAllHandlers } from './ipc/index';
import { logger } from './utils/logger';
import * as settingsRepo from './db/repositories/settings.repo';
import * as whatsappService from './services/whatsapp.service';
import * as supabaseBackupService from './services/supabase-backup.service';
import * as cloudSync from './services/cloud-sync.service';
import * as kitchenServer from './services/kitchen-server.service';
import { WHATSAPP_FEATURE_ENABLED } from '../shared/featureFlags';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url) shell.openExternal(details.url).catch(() => {});
    return { action: 'deny' };
  });

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function initializeDatabase(): void {
  logger.info('Initializing database...');
  const db = getDb();

  // Run migrations
  runMigrations(db, [
    initialMigration,
    addStationToMenuItems,
    addCreatedAtToKots,
    uniqueKotNumber,
    addOffersTable,
    dropTranslationTables,
    moveItemsToAddons,
    addonVariationPrices,
    addFavoritesTable,
    syncVariationBasePrices,
    addPerfIndexes,
    addTableNameSnapshot,
    addPinToItemsAndTables,
  ]);

  // Seed default data
  seedDatabase(db);

  logger.info('Database initialized successfully');
}

// ── Auto-backup ───────────────────────────────────────────────────────────────
// Single rolling file: `auto-backup-latest.db` is overwritten each run.
// Avoids unbounded disk growth from daily snapshots and keeps the GDrive copy
// to a single file that gets replaced in place.
async function runAutoBackupIfDue(): Promise<void> {
  try {
    const enabled = settingsRepo.get('auto_backup');
    if (enabled !== 'true') return;

    const lastBackup = settingsRepo.get('last_backup');
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (lastBackup) {
      const elapsed = now - new Date(lastBackup).getTime();
      if (elapsed < oneDayMs) return; // backed up within the last 24 h
    }

    const backupDir = join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const backupPath = join(backupDir, 'auto-backup-latest.db');
    // Write to a temp path first so a crash mid-write doesn't corrupt the
    // existing backup file.
    const tmpPath = `${backupPath}.tmp`;
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }

    const db = getDb();
    await db.backup(tmpPath);
    fs.renameSync(tmpPath, backupPath);
    settingsRepo.set('last_backup', new Date().toISOString(), 'general');

    // Clean up any legacy dated auto-backup-YYYY-MM-DD.db files left over
    // from the previous rolling-7 strategy.
    try {
      const files = fs.readdirSync(backupDir).filter(
        (f) => /^auto-backup-\d{4}-\d{2}-\d{2}\.db$/.test(f),
      );
      for (const old of files) {
        fs.unlinkSync(join(backupDir, old));
      }
    } catch { /* ignore cleanup errors */ }

    logger.info(`Auto-backup saved to ${backupPath}`);

    // Upload to Supabase Storage monthly
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const lastSupabaseBackup = settingsRepo.get('last_supabase_backup');
      if (lastSupabaseBackup !== currentMonth) {
        await supabaseBackupService.uploadBackup(backupPath);
        settingsRepo.set('last_supabase_backup', currentMonth, 'general');
        logger.info('Auto-backup uploaded to Supabase Storage');
      }
    } catch (sErr) {
      logger.error('Supabase monthly auto-upload failed (local backup is fine):', sErr);
    }
  } catch (err) {
    logger.error('Auto-backup failed:', err);
  }
}

// ── Periodic VACUUM ──────────────────────────────────────────────────────────
// Reclaims pages freed by deletes/updates. SQLite never shrinks the file on
// its own. Run at most once every 30 days, only when at least a day has passed
// since opening — so we don't block startup of a quickly-restarted app.
async function runVacuumIfDue(): Promise<void> {
  try {
    const last = settingsRepo.get('last_vacuum');
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < thirtyDaysMs) return;
    }
    const db = getDb();
    db.exec('VACUUM;');
    settingsRepo.set('last_vacuum', new Date().toISOString(), 'general');
    logger.info('Periodic VACUUM completed');
  } catch (err) {
    logger.error('VACUUM failed (will retry next month):', err);
  }
}

function setupAutoUpdater(): void {
  ipcMain.handle('updater:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('updater:check-for-updates', async () => {
    if (is.dev) {
      return { success: true, data: { isDev: true, version: app.getVersion() } };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        success: true,
        data: result ? { updateInfo: result.updateInfo } : null
      };
    } catch (err: any) {
      logger.error('Manual update check failed:', err);
      return { success: false, error: err.message };
    }
  });

  if (is.dev) return; // skip in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('updater:update-not-available', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:download-progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:update-downloaded', info);
  });

  autoUpdater.on('error', (err) => {
    logger.error('Auto-updater error:', err);
    mainWindow?.webContents.send('updater:error', err.message);
  });

  ipcMain.on('updater:install-now', () => {
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(async () => {
  // Initialize database before creating the window
  initializeDatabase();

  // Register all IPC handlers
  registerAllHandlers();

  // Run auto-backup if due (non-blocking)
  runAutoBackupIfDue();

  // Run VACUUM if it's been > 30 days (non-blocking; deferred so it doesn't
  // race startup window creation).
  setTimeout(() => { runVacuumIfDue().catch(() => {}); }, 60_000);

  // Auto-start kitchen network server if enabled in settings (non-blocking)
  kitchenServer.autoStartIfEnabled().catch((err) => {
    logger.error('Kitchen network auto-start failed:', err);
  });

  // Restore cloud-sync session from stored credentials (non-blocking).
  // No-op when Firebase isn't configured or no owner has connected yet.
  cloudSync.restoreSession().catch((err) => {
    logger.error('Cloud sync restore failed:', err);
  });

  // Initialize WhatsApp if feature is on and setting enabled (non-blocking)
  if (WHATSAPP_FEATURE_ENABLED) {
    const whatsappEnabled = settingsRepo.get('whatsapp_enabled');
    if (whatsappEnabled === 'true') {
      whatsappService.initialize().catch((err) => {
        logger.error('WhatsApp initialization failed:', err);
      });
    }
  }

  // Create the main window
  createWindow();

  // Setup auto-updater after window exists
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (WHATSAPP_FEATURE_ENABLED) {
    whatsappService.destroy().catch(() => {});
  }
  kitchenServer.stop().catch(() => {});
  cloudSync.stopAutoSync();
  closeDb();
});
