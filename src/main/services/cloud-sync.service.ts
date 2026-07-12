/**
 * Cloud Sync — pushes a small live dashboard snapshot to Firebase Firestore so
 * the owner can watch the business remotely from a phone / another device.
 *
 * Design (see also `firebase-config.ts` and `firestore.rules`):
 *  - The owner signs in with their OWN email/password. That account's uid IS the
 *    restaurant id, so each install can only read/write its own node:
 *        restaurants/{uid}/live/today      ← overwritten every sync (Tier 1 + 2)
 *        restaurants/{uid}/daily/{date}    ← finalized snapshot per day (history)
 *        restaurants/{uid}/meta/status     ← day-session + heartbeat
 *  - We sync AGGREGATES, not raw tables. No customer PII leaves the device.
 *  - Money stays in minor units (paise), same as the local DB. The dashboard
 *    divides by 100. `amountsInMinorUnits: true` documents this on the payload.
 *
 * Credentials are persisted with Electron `safeStorage` (OS keychain / DPAPI),
 * so sync resumes after a restart without re-entering the password. The Firebase
 * JS SDK uses in-memory auth persistence under Node, hence the re-sign-in.
 */
import { app, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// Firebase is loaded lazily (see loadFirebase) rather than via top-level
// imports. This keeps the `require('firebase/*')` calls out of the bundle's
// hoisted top — critical for the Windows 7 / Electron 22 (Node 16) build,
// where the fetch polyfill in src/main/fetch-polyfill.ts must run before
// Firebase evaluates. Loading on first sync also speeds cold startup.
/* eslint-disable @typescript-eslint/no-explicit-any */
let initializeApp: typeof import('firebase/app')['initializeApp'];
let deleteApp: typeof import('firebase/app')['deleteApp'];
let getAuth: typeof import('firebase/auth')['getAuth'];
let signInWithEmailAndPassword: typeof import('firebase/auth')['signInWithEmailAndPassword'];
let createUserWithEmailAndPassword: typeof import('firebase/auth')['createUserWithEmailAndPassword'];
let fbSignOut: typeof import('firebase/auth')['signOut'];
let initializeFirestore: typeof import('firebase/firestore')['initializeFirestore'];
let doc: typeof import('firebase/firestore')['doc'];
let setDoc: typeof import('firebase/firestore')['setDoc'];
let serverTimestamp: typeof import('firebase/firestore')['serverTimestamp'];
/* eslint-enable @typescript-eslint/no-explicit-any */

let firebaseLoaded = false;
function loadFirebase(): void {
  if (firebaseLoaded) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const appMod = require('firebase/app');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const authMod = require('firebase/auth');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsMod = require('firebase/firestore');
  initializeApp = appMod.initializeApp;
  deleteApp = appMod.deleteApp;
  getAuth = authMod.getAuth;
  signInWithEmailAndPassword = authMod.signInWithEmailAndPassword;
  createUserWithEmailAndPassword = authMod.createUserWithEmailAndPassword;
  fbSignOut = authMod.signOut;
  initializeFirestore = fsMod.initializeFirestore;
  doc = fsMod.doc;
  setDoc = fsMod.setDoc;
  serverTimestamp = fsMod.serverTimestamp;
  firebaseLoaded = true;
}
import { FIREBASE_CONFIG, isFirebaseConfigured } from './firebase-config';
import { getDb } from '../db/connection';
import * as reportsService from './reports.service';
import * as inventoryRepo from '../db/repositories/inventory.repo';
import * as settingsRepo from '../db/repositories/settings.repo';
import { logger } from '../utils/logger';
import * as licenseService from '../license/license.service';

const CRED_FILE = 'cloud-credentials.bin';
const AUTO_SYNC_MS = 15 * 60_000; // push at most every 15 minutes on the timer
const DEBOUNCE_MS = 15_000; // coalesce event-driven pushes (payment, day open/close)

let fbApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let currentUser: User | null = null;

let autoTimer: NodeJS.Timeout | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
let lastSyncAt: string | null = null;
let lastError: string | null = null;

// ── Credential persistence (OS-encrypted) ───────────────────────────────────

function credPath(): string {
  return path.join(app.getPath('userData'), CRED_FILE);
}

function saveCredentials(email: string, password: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    logger.warn('Cloud: OS encryption unavailable — credentials will not persist across restarts');
    return;
  }
  const blob = safeStorage.encryptString(JSON.stringify({ email, password }));
  fs.writeFileSync(credPath(), blob);
}

function readCredentials(): { email: string; password: string } | null {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const blob = fs.readFileSync(credPath());
    return JSON.parse(safeStorage.decryptString(blob));
  } catch {
    return null;
  }
}

function clearCredentials(): void {
  try { fs.unlinkSync(credPath()); } catch { /* already gone */ }
}

// ── Firebase init ────────────────────────────────────────────────────────────

function ensureInit(): void {
  if (fbApp) return;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured (see src/main/services/firebase-config.ts)');
  }
  loadFirebase();
  fbApp = initializeApp(FIREBASE_CONFIG, 'molecule-cloud');
  auth = getAuth(fbApp);
  // Long-polling is the robust transport under Node/Electron main (no WebChannel).
  firestore = initializeFirestore(fbApp, { experimentalForceLongPolling: true });
}

async function teardown(): Promise<void> {
  stopAutoSync();
  if (auth) { try { await fbSignOut(auth); } catch { /* ignore */ } }
  if (fbApp) { try { await deleteApp(fbApp); } catch { /* ignore */ } }
  fbApp = null; auth = null; firestore = null; currentUser = null;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Local calendar date as YYYY-MM-DD (matches how reports bucket "today"). */
function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday of the current week (local), as YYYY-MM-DD. */
function weekStartStr(d = new Date()): string {
  const day = d.getDay();              // 0=Sun … 6=Sat
  const sinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - sinceMonday);
  return localDateStr(monday);
}

/**
 * Full set of period-dependent metrics for a date range, using the same
 * "completed" basis as the today headline (dayEndSummary). The dashboard swaps
 * ALL of these when the owner changes the period tab (revenue, orders, AOV,
 * covers, tax, discounts, cancellations, payments, order types, top items).
 *
 * Cash drawer / active orders / low stock are deliberately NOT here — those are
 * "right now" concepts that only make sense for today, so they stay top-level.
 */
function periodMetrics(startDate: string, endDate: string): Record<string, unknown> {
  const db = getDb();
  const summary = reportsService.dayEndSummary({ startDate, endDate });

  // Cancelled/voided orders in range (a classic leakage signal).
  const cancelled = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(grand_total), 0) AS value
       FROM orders WHERE created_at >= ? AND created_at <= ? AND status = 'cancelled'`,
  ).get(`${startDate} 00:00:00`, `${endDate} 23:59:59`) as { n: number; value: number };

  // Number of discounted orders in range (count alongside totalDiscount).
  const discounted = db.prepare(
    `SELECT COUNT(*) AS n FROM orders
       WHERE created_at >= ? AND created_at <= ? AND status != 'cancelled' AND discount_amount > 0`,
  ).get(`${startDate} 00:00:00`, `${endDate} 23:59:59`) as { n: number };

  // Hourly sales breakdown for the period
  const hourlyRows = db.prepare(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS revenue
     FROM orders
     WHERE created_at >= ? AND created_at <= ? AND status != 'cancelled'
     GROUP BY hour`
  ).all(`${startDate} 00:00:00`, `${endDate} 23:59:59`) as { hour: number; count: number; revenue: number }[];

  return {
    revenue: summary.totalRevenue,
    orders: summary.totalOrders,
    averageOrderValue: summary.averageOrderValue,
    covers: summary.totalCovers,
    discountTotal: summary.totalDiscount,
    discountedOrders: discounted.n,
    taxTotal: summary.totalTax,
    payments: summary.paymentBreakdown,   // [{ mode, total, count }]
    ordersByType: summary.ordersByType,   // [{ type, count, revenue }]
    topItems: summary.topItems,           // [{ name, quantity, revenue }]
    cancelledOrders: { count: cancelled.n, value: cancelled.value },
    hourlySales: hourlyRows,              // [{ hour, count, revenue }]
  };
}

// ── Snapshot builder (reuses reports.service) ────────────────────────────────

/**
 * Build the live dashboard payload for a given date (defaults to today).
 * Tier 1 (performance) + Tier 2 (loss prevention), all from existing reports.
 */
export function buildSnapshot(date = localDateStr()): Record<string, unknown> {
  const cash = reportsService.cashFlow({ startDate: date, endDate: date }); // opening/closing/expected + difference

  const yearStart = `${date.slice(0, 4)}-01-01`;
  const monthStart = `${date.slice(0, 7)}-01`;

  // Full metric blocks per period. `today` doubles as the top-level fields below
  // (backward compatibility with dashboards that predate `periods`).
  const today = periodMetrics(date, date);
  const periods = {
    today,
    week: periodMetrics(weekStartStr(), date),
    month: periodMetrics(monthStart, date),
    year: periodMetrics(yearStart, date),
  };

  // Tier 3 — low stock alerts (lightweight). Not period-scoped ("right now").
  const lowStock = inventoryRepo.getLowStock().map((i) => ({
    name: i.name,
    currentStock: i.currentStock,
    minStock: i.minStock,
    unit: i.unit,
  }));

  return {
    date,
    // Top-level = today. The dashboard overrides these from `periods` when the
    // owner selects a different period tab.
    ...today,
    periods,
    // Cash drawer is inherently a per-day, "right now" reconciliation — today only.
    cash: {
      opening: cash.openingCash,
      sales: cash.cashSales,
      closing: cash.closingCash,
      expected: cash.expectedCash,
      difference: cash.difference,             // nonzero = drawer mismatch
    },
    lowStock,
    amountsInMinorUnits: true,
  };
}

async function buildMeta(): Promise<Record<string, unknown>> {
  const db = getDb();
  const session = db.prepare(
    'SELECT opened_by, opened_at FROM day_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1',
  ).get() as { opened_by: number; opened_at: string } | undefined;
  const restaurant = settingsRepo.getRestaurant();
  const licenseStatus = await licenseService.getLicenseStatus();

  // Live "what's open right now" — active + held orders, summary only (no items).
  const activeRows = db.prepare(`
    SELECT o.order_number, o.order_type, o.grand_total, o.created_at, o.status,
           COALESCE(t.name, o.table_name_snapshot) AS table_name,
           (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('active', 'hold')
    ORDER BY o.created_at ASC
  `).all() as any[];

  const activeOrders = activeRows.map((r) => ({
    orderNumber: r.order_number ?? '',
    table: r.table_name ?? null,
    type: r.order_type ?? '',
    total: r.grand_total ?? 0,
    itemCount: r.item_count ?? 0,
    onHold: r.status === 'hold',
    openedAt: r.created_at ?? null,
  }));

  return {
    restaurantName: restaurant?.name ?? '',
    currency: restaurant?.currency ?? '',
    dayOpen: !!session,
    dayOpenedAt: session?.opened_at ?? null,
    appVersion: app.getVersion(),
    activeOrders,
    activeOrderCount: activeOrders.length,
    activeOrderValue: activeOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
    licenseExpiryDate: licenseStatus.expiryDate ?? null,
    licenseState: licenseStatus.state ?? null,
    updatedAt: serverTimestamp(),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface CloudStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export function getStatus(): CloudStatus {
  return {
    configured: isFirebaseConfigured(),
    connected: !!currentUser,
    email: currentUser?.email ?? null,
    lastSyncAt,
    lastError,
  };
}

/**
 * Connect with the owner's email/password. Signs in if the account exists,
 * otherwise creates it (first-time setup). Persists credentials and starts sync.
 */
export async function connect(
  email: string,
  password: string,
  { create = false }: { create?: boolean } = {},
): Promise<CloudStatus> {
  ensureInit();
  try {
    const cred = create
      ? await createUserWithEmailAndPassword(auth!, email, password)
      : await signInWithEmailAndPassword(auth!, email, password);
    currentUser = cred.user;
  } catch (err: any) {
    // First-run convenience: if no account exists yet, create one.
    if (!create && err?.code === 'auth/user-not-found') {
      const cred = await createUserWithEmailAndPassword(auth!, email, password);
      currentUser = cred.user;
    } else {
      lastError = err?.message ?? 'Sign-in failed';
      throw new Error(lastError ?? 'Sign-in failed');
    }
  }

  saveCredentials(email, password);
  lastError = null;
  startAutoSync();
  // Fire an immediate push so the dashboard lights up right away.
  pushNow().catch((e) => logger.error('Cloud: initial push failed', e));
  return getStatus();
}

export async function disconnect(): Promise<void> {
  clearCredentials();
  await teardown();
}

/** Build and upload the current snapshot. No-op if not connected. */
export async function pushNow(): Promise<void> {
  if (!currentUser || !firestore) return;
  const uid = currentUser.uid;
  try {
    const today = localDateStr();
    const snapshot = buildSnapshot(today);
    const payload = { ...snapshot, updatedAt: serverTimestamp() };

    const meta = await buildMeta();
    const base = `restaurants/${uid}`;
    await Promise.all([
      setDoc(doc(firestore, `${base}/live/today`), payload),
      setDoc(doc(firestore, `${base}/meta/status`), meta, { merge: true }),
      setDoc(doc(firestore, `${base}/daily/${today}`), payload, { merge: true }),
    ]);

    const now = new Date().toISOString();
    lastSyncAt = now;
    lastError = null;
    settingsRepo.set('last_cloud_sync', now, 'general');

    if (settingsRepo.get('history_synced_to_cloud') !== 'true') {
      settingsRepo.set('history_synced_to_cloud', 'true', 'general');
      syncHistory().catch((e) => logger.error('Cloud: history sync failed', e));
    }
  } catch (err: any) {
    lastError = err?.message ?? 'Sync failed';
    logger.error('Cloud: push failed', err);
    throw err;
  }
}

async function syncHistory(): Promise<void> {
  if (!currentUser || !firestore) return;
  const uid = currentUser.uid;
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT DISTINCT date(created_at) AS order_date FROM orders ORDER BY order_date ASC
    `).all() as { order_date: string }[];

    if (!rows.length) return;

    logger.info(`Cloud: Starting historical sync of daily snapshots for ${rows.length} days...`);

    for (const row of rows) {
      const dateStr = row.order_date;
      if (!dateStr) continue;

      try {
        const snapshot = buildSnapshot(dateStr);
        const payload = { ...snapshot, updatedAt: new Date().toISOString() };
        await setDoc(doc(firestore, `restaurants/${uid}/daily/${dateStr}`), payload, { merge: true });
      } catch (err: any) {
        logger.error(`Cloud: Failed to sync history for date ${dateStr}`, err);
      }
    }

    logger.info('Cloud: Historical daily snapshot sync completed successfully.');
  } catch (err: any) {
    logger.error('Cloud: Historical sync failed', err);
  }
}

/** Finalizes the daily snapshot in Firestore — call only on day close. */
export async function pushDailySnapshot(): Promise<void> {
  if (!currentUser || !firestore) return;
  const uid = currentUser.uid;
  const today = localDateStr();
  const payload = { ...buildSnapshot(today), updatedAt: serverTimestamp() };
  await setDoc(doc(firestore, `restaurants/${uid}/daily/${today}`), payload, { merge: true });
}

/** Debounced push for event-driven triggers (payment completed, day open/close). */
export function scheduleSync(): void {
  if (!currentUser) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pushNow().catch(() => { /* lastError already recorded */ });
  }, DEBOUNCE_MS);
}

export function startAutoSync(): void {
  if (autoTimer) return;
  autoTimer = setInterval(() => {
    pushNow().catch(() => { /* lastError already recorded */ });
  }, AUTO_SYNC_MS);
}

export function stopAutoSync(): void {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
}

/**
 * Restore a previous session on app startup using stored credentials.
 * Called from main bootstrap; safe to call when nothing is configured/saved.
 */
export async function restoreSession(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const creds = readCredentials();
  if (!creds) return;
  try {
    await connect(creds.email, creds.password);
    logger.info('Cloud: session restored, auto-sync started');
  } catch (err) {
    logger.error('Cloud: failed to restore session (will stay offline)', err);
  }
}

export function getUid(): string | null {
  return currentUser?.uid ?? null;
}
