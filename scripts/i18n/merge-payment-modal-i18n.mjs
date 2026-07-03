#!/usr/bin/env node
/**
 * Merges translated paymentModal from data/payment-modal-i18n.json into
 * src/renderer/locales/<lang>.json (full namespace on top of en defaults).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../../src/renderer/locales');
const dataPath = path.join(__dirname, 'data/payment-modal-i18n.json');

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const basePm = en.paymentModal;
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

for (const [lang, pack] of Object.entries(data)) {
  if (lang === 'en') continue;
  const locPath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(locPath)) continue;
  const loc = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  if (pack.paymentModal) {
    loc.paymentModal = { ...basePm, ...pack.paymentModal };
  }
  fs.writeFileSync(locPath, JSON.stringify(loc, null, 2) + '\n', 'utf8');
  console.log('merged payment modal →', `${lang}.json`);
}
