#!/usr/bin/env node
/**
 * Merges scripts/i18n/lang-packs/<lang>.json into src/renderer/locales/<lang>.json.
 * - language.description ← languageDescription
 * - settingsPage ← { ...en.settingsPage, ...pack.settingsPage }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../../src/renderer/locales');
const packsDir = path.join(__dirname, 'lang-packs');

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const baseSp = en.settingsPage;

for (const file of fs.readdirSync(packsDir)) {
  if (!file.endsWith('.json')) continue;
  const lang = file.replace('.json', '');
  if (lang === 'en') continue;
  const locPath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(locPath)) {
    console.warn('skip (no locale file):', lang);
    continue;
  }
  const pack = JSON.parse(fs.readFileSync(path.join(packsDir, file), 'utf8'));
  const loc = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  if (pack.languageDescription != null) {
    loc.language = loc.language ?? {};
    loc.language.description = pack.languageDescription;
  }
  if (pack.settingsPage && typeof pack.settingsPage === 'object') {
    loc.settingsPage = { ...baseSp, ...pack.settingsPage };
  }
  fs.writeFileSync(locPath, JSON.stringify(loc, null, 2) + '\n', 'utf8');
  console.log('updated locale →', `${lang}.json`);
}
