#!/usr/bin/env node
/**
 * License Key Generator — DEVELOPER TOOL ONLY
 * 
 * Usage:
 *   node scripts/keygen.js --tier 12
 *   node scripts/keygen.js --tier 6
 *   node scripts/keygen.js --tier 3
 *   node scripts/keygen.js --tier 3 --test (3 minutes test)
 */

const { createHmac } = require('crypto');
const fs = require('fs');
const path = require('path');

// Inline Base32 encode (RFC 4648) — no external deps
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
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

// Helper to load key-value pairs from .env / .env.local without external dependencies
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim().replace(/^["'](.*)["']$/, '$1');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch {}
}

loadEnvFile(path.resolve('.env.local'));
loadEnvFile(path.resolve('.env'));

// ── Read secret from environment ────────────────────────────────────────────
const SECRET = process.env.KEYGEN_SECRET || process.env.MAIN_VITE_HMAC_SECRET || process.env.HMAC_SECRET;
if (!SECRET) {
  console.error('\n  Error: KEYGEN_SECRET (or MAIN_VITE_HMAC_SECRET in .env.local) is required.\n');
  console.error('  Example 1: Add MAIN_VITE_HMAC_SECRET=your-secret to .env.local');
  console.error('  Example 2: KEYGEN_SECRET=your-secret node scripts/keygen.js --tier 12\n');
  process.exit(1);
}

// ── Parse --tier and --test arguments ──────────────────────────────────────
const tierIndex = process.argv.indexOf('--tier');
const tierArg = tierIndex !== -1 ? process.argv[tierIndex + 1] : undefined;
const tier = parseInt(tierArg ?? '', 10);

const testMode = process.argv.includes('--test');
const timeUnitMs = testMode ? 60_000 : 86_400_000; // 1 minute vs 1 day

if (![1, 2, 3, 6, 12].includes(tier)) {
  console.error('\n  Error: --tier must be 1, 2, 3, 6, or 12\n');
  console.error('  Example: node scripts/keygen.js --tier 12\n');
  console.error('  For testing: node scripts/keygen.js --tier 3 --test (expires in 3 minutes)\n');
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
