import { createHmac, timingSafeEqual } from 'crypto';
import * as https from 'https';
import * as settingsRepo from '../db/repositories/settings.repo';
import { base32Encode, base32Decode } from './base32';
import type { LicenseStatus } from '../../shared/types/license.types';
import { FIREBASE_CONFIG, isFirebaseConfigured } from '../services/firebase-config';

// ─── IMPORTANT ────────────────────────────────────────────────────────────────
// Keep HMAC_SECRET private. Use the SAME value in scripts/keygen.ts.
// Never commit the real secret to a public repository.
// ──────────────────────────────────────────────────────────────────────────────
export const HMAC_SECRET = 'R3s7aUr4nt-P0S-L1c3ns3-S3cr3t-K3y-2024';

// TEST MODE: Set to true to use minutes instead of days (for testing 5-minute expiry)
const TEST_MODE = false;
const TIME_UNIT_MS = TEST_MODE ? 60_000 : 86_400_000; // 1 minute vs 1 day

const SETTINGS_LICENSE_KEY = 'license_key';
const SETTINGS_MAX_DAY_KEY = 'license_max_day';
const GRACE_DAYS = TEST_MODE ? 1 : 7; // 1 minute grace in test mode
const WARN_DAYS = TEST_MODE ? 2 : 30; // 2 minutes warning in test mode

// ─── Dynamic Firebase Initialization ──────────────────────────────────────────
let firebaseLoaded = false;
let initializeApp: typeof import('firebase/app')['initializeApp'];
let initializeFirestore: typeof import('firebase/firestore')['initializeFirestore'];
let doc: typeof import('firebase/firestore')['doc'];
let getDoc: typeof import('firebase/firestore')['getDoc'];
let setDoc: typeof import('firebase/firestore')['setDoc'];
let updateDoc: typeof import('firebase/firestore')['updateDoc'];

function loadFirebase(): void {
  if (firebaseLoaded) return;
  const appMod = require('firebase/app');
  const fsMod = require('firebase/firestore');
  initializeApp = appMod.initializeApp;
  initializeFirestore = fsMod.initializeFirestore;
  doc = fsMod.doc;
  getDoc = fsMod.getDoc;
  setDoc = fsMod.setDoc;
  updateDoc = fsMod.updateDoc;
  firebaseLoaded = true;
}

let fbApp: any = null;
let firestore: any = null;

function ensureInit(): void {
  if (fbApp) return;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase configuration is missing in firebase-config.ts');
  }
  loadFirebase();
  fbApp = initializeApp(FIREBASE_CONFIG, 'molecule-licensing');
  firestore = initializeFirestore(fbApp, { experimentalForceLongPolling: true });
}

// ─── Central License Verification ──────────────────────────────────────────────
async function syncLicenseWithServer(key: string): Promise<void> {
  try {
    ensureInit();
    const docRef = doc(firestore, 'licenses', key);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      // Lazy migration: if key is valid offline but doesn't exist on server,
      // silently register it as used in Firestore to create the document.
      const parsed = parseAndValidateKey(key);
      if (parsed.valid) {
        const expiryDateStr = new Date(parsed.expiryDayNum * TIME_UNIT_MS).toISOString().split('T')[0];
        await setDoc(docRef, {
          tier: parsed.tier,
          expiryDate: expiryDateStr,
          isUsed: true,
          updatedAt: new Date().toISOString()
        });
      }
      return;
    }

    const data = snap.data();
    if (data.isUsed) {
      throw new Error('This license key has already been used for activation.');
    }

    // Mark key as used on the server
    await updateDoc(docRef, {
      isUsed: true,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[License] Server sync failed:', err?.message || err);
    if (err?.message?.includes('already been used')) {
      throw err;
    }
  }
}

// ─── Internet Time ─────────────────────────────────────────────────────────────
// Fires parallel HEAD requests to reliable servers, resolves with the first
// valid Date header, or null if offline / all requests fail within 3 seconds.
function getInternetDayNumber(): Promise<number | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (val: number | null) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    // Overall 3-second cap
    setTimeout(() => done(null), 3000);

    const endpoints = ['www.google.com', 'www.cloudflare.com', 'www.microsoft.com'];
    for (const host of endpoints) {
      try {
        const req = https.request(
          { hostname: host, path: '/', method: 'HEAD', timeout: 2500 },
          (res) => {
            const dateHeader = res.headers['date'];
            if (dateHeader) {
              const ms = new Date(dateHeader).getTime();
              if (!isNaN(ms)) {
                done(Math.floor(ms / TIME_UNIT_MS));
              }
            }
            // drain the response so the socket closes
            res.resume();
          }
        );
        req.on('error', () => {});
        req.on('timeout', () => req.destroy());
        req.end();
      } catch {
        // ignore — another endpoint may succeed
      }
    }
  });
}

// ─── Effective Day Computation ─────────────────────────────────────────────────
// Effective today = max(internet day, local day, stored ratchet day)
// This means the date can only ever go forward:
//   • Internet time beats local clock if customer is online
//   • Ratchet beats rolled-back local clock if customer is offline
async function getEffectiveDayNumber(): Promise<number> {
  const localDay = Math.floor(Date.now() / TIME_UNIT_MS);
  const internetDay = await getInternetDayNumber();

  // Trust internet time over local clock when available
  const trueDay = internetDay !== null ? Math.max(localDay, internetDay) : localDay;

  // Apply date ratchet
  let storedMax = parseInt(settingsRepo.get(SETTINGS_MAX_DAY_KEY) ?? '0', 10);
  
  // Migration: If stored max is unreasonably high (>100,000 days = year 2243),
  // it was likely stored in test mode (minutes). Reset it and clear the license.
  if (storedMax > 100_000) {
    console.log(`[License] Detected corrupted ratchet (${storedMax}), resetting...`);
    storedMax = 0;
    settingsRepo.set(SETTINGS_MAX_DAY_KEY, '0', 'license');
    settingsRepo.set(SETTINGS_LICENSE_KEY, '', 'license'); // Clear license too
  }
  
  const effectiveDay = Math.max(trueDay, isNaN(storedMax) ? 0 : storedMax);

  // Advance ratchet if needed
  if (effectiveDay > storedMax) {
    settingsRepo.set(SETTINGS_MAX_DAY_KEY, String(effectiveDay), 'license');
  }

  return effectiveDay;
}

// ─── Key Parsing & Validation ──────────────────────────────────────────────────
type ParseResult =
  | { valid: true; tier: number; expiryDayNum: number }
  | { valid: false; reason: string };

export function parseAndValidateKey(rawKey: string): ParseResult {
  // Strip everything except Base32 chars, uppercase
  const normalized = rawKey.toUpperCase().replace(/[^A-Z2-7]/g, '');

  if (normalized.length !== 15) {
    return { valid: false, reason: 'Invalid key format (must be 15 Base32 characters)' };
  }

  let bytes: Buffer;
  try {
    bytes = base32Decode(normalized);
  } catch {
    return { valid: false, reason: 'Invalid key format' };
  }

  if (bytes.length !== 9) {
    return { valid: false, reason: 'Invalid key format' };
  }

  const version = bytes[0];
  if (version !== 0x01) {
    return { valid: false, reason: 'Unrecognized key version' };
  }

  const tier = bytes[1];
  if (![3, 6, 12].includes(tier)) {
    return { valid: false, reason: 'Invalid license tier in key' };
  }

  const expiryDayNum = bytes.readUInt32BE(2);
  const givenSig = bytes.subarray(6, 9);

  // Recompute HMAC over bytes 0–5 and compare first 3 bytes
  const hmac = createHmac('sha256', HMAC_SECRET);
  hmac.update(bytes.subarray(0, 6));
  const expectedSig = hmac.digest().subarray(0, 3);

  if (!timingSafeEqual(givenSig, expectedSig)) {
    return { valid: false, reason: 'Invalid license key' };
  }

  return { valid: true, tier, expiryDayNum };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const storedKey = settingsRepo.get(SETTINGS_LICENSE_KEY);

  if (!storedKey || storedKey.trim() === '') {
    return { state: 'unlicensed' };
  }

  const parsed = parseAndValidateKey(storedKey);
  if (!parsed.valid) {
    return { state: 'invalid', reason: parsed.reason };
  }

  const effectiveDay = await getEffectiveDayNumber();
  const daysRemaining = parsed.expiryDayNum - effectiveDay;
  const expiryDateMs = parsed.expiryDayNum * TIME_UNIT_MS;
  const expiryDate = new Date(expiryDateMs).toISOString().split('T')[0];

  if (daysRemaining < -GRACE_DAYS) {
    return { state: 'expired_hard', tier: parsed.tier, expiryDate, daysRemaining: 0 };
  }

  if (daysRemaining < 0) {
    // In grace period — report remaining grace days (0 to GRACE_DAYS)
    return {
      state: 'expired_grace',
      tier: parsed.tier,
      expiryDate,
      daysRemaining: Math.max(0, daysRemaining + GRACE_DAYS),
    };
  }
  if (daysRemaining <= WARN_DAYS) {
    return { state: 'expiring_soon', tier: parsed.tier, expiryDate, daysRemaining };
  }
  return { state: 'active', tier: parsed.tier, expiryDate, daysRemaining };
}

export async function activateLicense(key: string): Promise<LicenseStatus> {
  const parsed = parseAndValidateKey(key);
  if (!parsed.valid) {
    throw new Error(parsed.reason);
  }

  // Pre-check: reject keys that are already hard-expired
  const effectiveDay = await getEffectiveDayNumber();
  const daysRemaining = parsed.expiryDayNum - effectiveDay;
  if (daysRemaining < -GRACE_DAYS) {
    throw new Error('This license key has already expired');
  }

  // Store the normalized key (uppercase, no dashes)
  const normalized = key.toUpperCase().replace(/[^A-Z2-7]/g, '');

  // Validate & mark key as used on server
  await syncLicenseWithServer(normalized);

  settingsRepo.set(SETTINGS_LICENSE_KEY, normalized, 'license');

  return getLicenseStatus();
}

export function clearLicense(): void {
  settingsRepo.set(SETTINGS_LICENSE_KEY, '', 'license');
  settingsRepo.set(SETTINGS_MAX_DAY_KEY, '0', 'license');
}

// Re-export type for convenience
export type { LicenseStatus };
