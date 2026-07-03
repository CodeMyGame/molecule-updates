#!/usr/bin/env node
/**
 * Deep-merge missing keys from en.json into every other locale file (English fallback).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/renderer/locales');

function deepMergeMissing(target, source) {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return target !== undefined ? target : source;
  }
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (!(key in out)) {
      out[key] = source[key];
    } else if (
      out[key] !== null &&
      typeof out[key] === 'object' &&
      !Array.isArray(out[key]) &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      out[key] = deepMergeMissing(out[key], source[key]);
    }
  }
  return out;
}

const enPath = path.join(localesDir, 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

for (const file of fs.readdirSync(localesDir)) {
  if (!file.endsWith('.json') || file === 'en.json') continue;
  const p = path.join(localesDir, file);
  const loc = JSON.parse(fs.readFileSync(p, 'utf8'));
  const merged = deepMergeMissing(loc, en);
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log('merged →', file);
}
