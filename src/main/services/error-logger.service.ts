import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import * as settingsRepo from '../db/repositories/settings.repo';
import * as cloudSync from './cloud-sync.service';

export interface StructuredError {
  id: string;
  timestamp: string;
  source: 'main' | 'renderer' | 'ipc' | 'process' | 'database';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

interface DailyErrorLogFile {
  date: string;
  totalErrors: number;
  lastUpdated: string;
  syncedCount: number;
  errors: StructuredError[];
}

const MAX_ERRORS_PER_DAY_LOCAL = 500;
const MAX_ERRORS_PER_DAY_FIRESTORE = 100;
const DEBOUNCE_PUSH_MS = 30_000; // 30 seconds debounce for real-time pushing
const PRUNE_DAYS = 14;

let logDir: string;
try {
  logDir = path.join(app.getPath('userData'), 'logs');
} catch {
  logDir = path.join(process.cwd(), 'logs');
}

if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore error
  }
}

// In-memory cache for today's errors
let currentDayCache: DailyErrorLogFile | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let isPushing = false;
let errorCounter = 0;

function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDailyLogFilePath(dateStr: string): string {
  return path.join(logDir, `error-log-${dateStr}.json`);
}

function sanitizeString(str: unknown, maxLength: number): string {
  if (typeof str !== 'string') {
    if (str === null || str === undefined) return '';
    try {
      str = JSON.stringify(str);
    } catch {
      str = String(str);
    }
  }
  const s = str as string;
  return s.length > maxLength ? s.slice(0, maxLength) + '... [truncated]' : s;
}

function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context || typeof context !== 'object') return undefined;
  try {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(context)) {
      if (typeof val === 'string') {
        clean[key] = sanitizeString(val, 500);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        clean[key] = val;
      } else if (val && typeof val === 'object') {
        clean[key] = sanitizeString(JSON.stringify(val), 500);
      }
    }
    return clean;
  } catch {
    return undefined;
  }
}

function loadDayLog(dateStr: string): DailyErrorLogFile {
  const filePath = getDailyLogFilePath(dateStr);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.errors)) {
        return parsed;
      }
    } catch {
      // Corrupt file, recreate
    }
  }
  return {
    date: dateStr,
    totalErrors: 0,
    lastUpdated: new Date().toISOString(),
    syncedCount: 0,
    errors: [],
  };
}

function saveDayLog(log: DailyErrorLogFile): void {
  const filePath = getDailyLogFilePath(log.date);
  try {
    fs.writeFileSync(filePath, JSON.stringify(log, null, 2), 'utf-8');
  } catch {
    // Fail silently to never crash app
  }
}

function getTodayLog(): DailyErrorLogFile {
  const today = localDateStr();
  if (!currentDayCache || currentDayCache.date !== today) {
    currentDayCache = loadDayLog(today);
  }
  return currentDayCache;
}

/**
 * Clean up error log files older than PRUNE_DAYS
 */
export function pruneOldErrorLogs(): void {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PRUNE_DAYS);
    const cutoffStr = localDateStr(cutoff);

    const files = fs.readdirSync(logDir);
    for (const file of files) {
      const match = file.match(/^error-log-(\d{4}-\d{2}-\d{2})\.json$/);
      if (match) {
        const fileDate = match[1];
        if (fileDate < cutoffStr) {
          try {
            fs.unlinkSync(path.join(logDir, file));
          } catch {
            // Ignore deletion error
          }
        }
      }
    }
  } catch {
    // Fail silently
  }
}

/**
 * Record a structured error event.
 * Saves locally to today's JSON file and schedules a debounced push to Firebase.
 */
export function recordError(params: {
  source: 'main' | 'renderer' | 'ipc' | 'process' | 'database';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}): void {
  try {
    const now = new Date();
    const timestamp = now.toISOString();
    const todayLog = getTodayLog();

    const sanitizedMsg = sanitizeString(params.message, 1000);

    // Deduplicate if an identical error arrived within the last 2 seconds
    const lastErr = todayLog.errors[todayLog.errors.length - 1];
    if (
      lastErr &&
      lastErr.message === sanitizedMsg &&
      now.getTime() - new Date(lastErr.timestamp).getTime() < 2000
    ) {
      return;
    }

    errorCounter += 1;
    const errorEntry: StructuredError = {
      id: `err_${Date.now()}_${errorCounter}`,
      timestamp,
      source: params.source,
      message: sanitizedMsg,
      stack: params.stack ? sanitizeString(params.stack, 2000) : undefined,
      context: sanitizeContext(params.context),
    };

    todayLog.totalErrors += 1;
    todayLog.lastUpdated = timestamp;

    // Keep local list bounded to MAX_ERRORS_PER_DAY_LOCAL
    todayLog.errors.push(errorEntry);
    if (todayLog.errors.length > MAX_ERRORS_PER_DAY_LOCAL) {
      todayLog.errors.splice(0, todayLog.errors.length - MAX_ERRORS_PER_DAY_LOCAL);
    }

    saveDayLog(todayLog);

    // Schedule debounced push if cloud sync is available
    scheduleDebouncedPush();
  } catch {
    // Fail silently
  }
}

/**
 * Schedule a debounced push to Firebase Firestore.
 */
function scheduleDebouncedPush(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    pushPendingErrorLogs().catch(() => {});
  }, DEBOUNCE_PUSH_MS);
}

/**
 * Push all pending daily error logs (including un-synced previous days) to Firebase Firestore.
 * Capped per day document to stay comfortably under the 1 MB Firestore document limit.
 */
export async function pushPendingErrorLogs(): Promise<void> {
  if (isPushing) return;

  const fbCtx = cloudSync.getFirebaseContext();
  if (!fbCtx || !fbCtx.uid || !fbCtx.firestore) {
    // Cloud sync not connected or Firebase unconfigured; logs remain stored locally
    return;
  }

  isPushing = true;
  try {
    const restaurant = settingsRepo.getRestaurant();
    const appVersion = app.getVersion ? app.getVersion() : '1.0.0';

    // Find all error-log-*.json files
    let files: string[] = [];
    try {
      files = fs.readdirSync(logDir).filter((f) => /^error-log-\d{4}-\d{2}-\d{2}\.json$/.test(f));
    } catch {
      files = [];
    }

    // Sort ascending by date
    files.sort();

    for (const file of files) {
      const filePath = path.join(logDir, file);
      let dayData: DailyErrorLogFile;
      try {
        dayData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        continue;
      }

      // If nothing new to sync, skip
      if (dayData.syncedCount >= dayData.totalErrors) {
        continue;
      }

      const dateStr = dayData.date;
      const recentErrors = dayData.errors.slice(-MAX_ERRORS_PER_DAY_FIRESTORE);

      const payload = {
        date: dateStr,
        restaurantId: fbCtx.uid,
        restaurantName: restaurant?.name ?? '',
        appVersion,
        platform: process.platform,
        totalErrors: dayData.totalErrors,
        lastErrorAt: dayData.lastUpdated,
        updatedAt: fbCtx.serverTimestamp(),
        errors: recentErrors,
      };

      const docRef = fbCtx.doc(fbCtx.firestore, `restaurants/${fbCtx.uid}/error_logs/${dateStr}`);
      await fbCtx.setDoc(docRef, payload, { merge: true });

      // Update syncedCount and save locally
      dayData.syncedCount = dayData.totalErrors;
      try {
        fs.writeFileSync(filePath, JSON.stringify(dayData, null, 2), 'utf-8');
      } catch {
        // Ignore
      }

      if (currentDayCache && currentDayCache.date === dateStr) {
        currentDayCache.syncedCount = dayData.totalErrors;
      }
    }
  } catch (err) {
    // Use console.warn directly — DO NOT call logger.error to avoid infinite loop
    console.warn('[ErrorLogger] Failed to push error logs to Firebase:', err);
  } finally {
    isPushing = false;
  }
}

/**
 * Get the current day's structured error log (for local troubleshooting/IPC).
 */
export function getTodayErrors(): DailyErrorLogFile {
  return getTodayLog();
}
