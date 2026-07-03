#!/usr/bin/env ts-node
/**
 * License Key Generator — DEVELOPER TOOL ONLY
 * This script is NOT bundled into the app.
 *
 * Usage:
 *   KEYGEN_SECRET=<your-secret> npx ts-node scripts/keygen.ts --tier 12
 *   KEYGEN_SECRET=<your-secret> npx ts-node scripts/keygen.ts --tier 6
 *   KEYGEN_SECRET=<your-secret> npx ts-node scripts/keygen.ts --tier 3
 *
 * IMPORTANT: KEYGEN_SECRET must match the HMAC_SECRET in
 *            src/main/license/license.service.ts
 *            Keep this secret private — never commit it to a public repo.
 */

import { createHmac } from 'crypto';

// Inline Base32 encode (RFC 4648) — no external deps
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; result += ALPHABET[(value >> bits) & 31]; }
  }
  if (bits > 0) result += ALPHABET[(value << (5 - bits)) & 31];
  return result;
}

// ── Read secret from environment ────────────────────────────────────────────
const SECRET = process.env.KEYGEN_SECRET;
if (!SECRET) {
  console.error('\n  Error: KEYGEN_SECRET environment variable is required.\n');
  console.error('  Example: KEYGEN_SECRET=your-secret npx ts-node scripts/keygen.ts --tier 12\n');
  process.exit(1);
}

// ── Parse --tier and --test arguments ──────────────────────────────────────
const tierIndex = process.argv.indexOf('--tier');
const tierArg = tierIndex !== -1 ? process.argv[tierIndex + 1] : undefined;
const tier = parseInt(tierArg ?? '', 10) as 3 | 6 | 12;

const testMode = process.argv.includes('--test');
const timeUnitMs = testMode ? 60_000 : 86_400_000; // 1 minute vs 1 day

if (![3, 6, 12].includes(tier)) {
  console.error('\n  Error: --tier must be 3, 6, or 12\n');
  console.error('  Example: npx ts-node scripts/keygen.ts --tier 12\n');
  console.error('  For testing: npx ts-node scripts/keygen.ts --tier 3 --test (expires in 3 minutes)\n');
  process.exit(1);
}

// ── Compute expiry ──────────────────────────────────────────────────────────
const issueDate = new Date();
const expiryDate = new Date(issueDate);

if (testMode) {
  // In test mode, tier = minutes
  expiryDate.setMinutes(expiryDate.getMinutes() + tier);
} else {
  // Normal mode, tier = months
  expiryDate.setMonth(expiryDate.getMonth() + tier);
}

const expiryDayNum = Math.floor(expiryDate.getTime() / timeUnitMs);
const expiryDateStr = expiryDate.toISOString().split('T')[0];

// ── Build 9-byte payload ────────────────────────────────────────────────────
// Byte 0    : version = 0x01
// Byte 1    : tier (3, 6, or 12)
// Bytes 2-5 : expiry as uint32 big-endian (Unix day number)
// Bytes 6-8 : first 3 bytes of HMAC-SHA256(secret, bytes 0-5)
const payload = Buffer.alloc(9);
payload.writeUInt8(0x01, 0);
payload.writeUInt8(tier, 1);
payload.writeUInt32BE(expiryDayNum, 2);

const hmac = createHmac('sha256', SECRET);
hmac.update(payload.subarray(0, 6));
const sig = hmac.digest();
payload.set(sig.subarray(0, 3), 6);

// ── Encode to Base32 and format ─────────────────────────────────────────────
const raw = base32Encode(payload);
const licenseKey = `${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}`;

// ── Output ──────────────────────────────────────────────────────────────────
console.log('');
console.log('  License Key : ' + licenseKey);
console.log('  Tier        : ' + tier + (testMode ? ' minutes (TEST MODE)' : ' months'));
console.log('  Issued      : ' + issueDate.toISOString());
console.log('  Expires     : ' + expiryDate.toISOString());
console.log('  Expiry Unit#: ' + expiryDayNum);
if (testMode) {
  console.log('  NOTE: TEST MODE is active in license.service.ts');
}
console.log('');
