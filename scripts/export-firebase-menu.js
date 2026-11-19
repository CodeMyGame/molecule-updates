#!/usr/bin/env node
/**
 * Molecule POS - Firebase Hosting Menu Exporter
 *
 * Exports restaurant menu data into static JSON files for Firebase Hosting deployment:
 *   - out/renderer/menus/<slug>.json  (Served at https://<project>.web.app/m/<slug>)
 *   - out/renderer/menus/default.json (Served at https://<project>.web.app/qr-menu)
 *   - public/menus/...                (Preserved across builds)
 *
 * Usage:
 *   node scripts/export-firebase-menu.js [--slug my-restaurant]
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
let customSlug = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--slug' || args[i] === '-s' || args[i] === '--customer') {
    customSlug = args[i + 1];
    i++;
  }
}

// 1. Try to load database (supports better-sqlite3 or native sqlite3 CLI)
const cp = require('child_process');
let payload = null;
let settingsObj = {};

const possiblePaths = [
  path.join(process.env.HOME || '', 'Library/Application Support/Molecule/molecule.db'),
  path.join(process.env.HOME || '', 'Library/Application Support/molecule/molecule.db'),
  path.join(rootDir, 'molecule.db'),
  path.join(process.env.APPDATA || '', 'Molecule/molecule.db'),
  path.join(process.env.APPDATA || '', 'molecule/molecule.db'),
];

let dbFile = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbFile = p;
    break;
  }
}

if (dbFile) {
  try {
    const runSqlJson = (sql) => {
      try {
        const out = cp.execSync(`sqlite3 "${dbFile}" "${sql.replace(/"/g, '\\"')}"`).toString().trim();
        return out ? JSON.parse(out) : null;
      } catch {
        return null;
      }
    };

    const restRow = runSqlJson("SELECT json_object('name', name, 'address', address, 'phone', phone, 'currency', currency) FROM restaurant LIMIT 1;");
    settingsObj = runSqlJson("SELECT json_group_object(key, value) FROM settings;") || {};
    const categories = runSqlJson("SELECT json_group_array(json_object('id', id, 'name', name, 'sortOrder', sort_order)) FROM menu_categories WHERE is_active = 1 ORDER BY sort_order ASC;") || [];
    const rawItems = runSqlJson("SELECT json_group_array(json_object('id', id, 'name', name, 'categoryId', category_id, 'basePrice', base_price, 'isVeg', is_veg, 'shortCode', short_code)) FROM menu_items WHERE is_available = 1 AND base_price > 0;") || [];
    const variations = runSqlJson("SELECT json_group_array(json_object('id', id, 'menuItemId', menu_item_id, 'name', name, 'priceDelta', price_delta)) FROM item_variations;") || [];
    const tables = runSqlJson("SELECT json_group_array(json_object('id', id, 'name', name, 'capacity', capacity)) FROM tables;") || [];

    const items = rawItems.map((item) => {
      const itemVars = (variations || []).filter((v) => v.menuItemId === item.id);
      return {
        ...item,
        variations: itemVars.map((v) => ({
          id: v.id,
          name: v.name,
          priceDelta: v.priceDelta,
          basePrice: item.basePrice + (v.priceDelta || 0),
        })),
      };
    });

    if (categories.length > 0 && items.length > 0) {
      payload = {
        restaurant: {
          name: restRow?.name || settingsObj.restaurant_name || 'Kapil Cafe',
          address: restRow?.address || settingsObj.restaurant_address || 'Sumerpur',
          phone: restRow?.phone || settingsObj.restaurant_phone || '9690148808',
          currency: '₹',
          currencyCode: restRow?.currency || 'INR',
        },
        settings: {
          subtitle: settingsObj.qr_menu_subtitle || 'Scan to browse our digital menu',
          tableCardTitle: settingsObj.qr_menu_table_card_title || 'Scan for Digital Menu',
          tableCardSubtitle: settingsObj.qr_menu_table_card_subtitle || 'Point phone camera at QR code • Live menu & specials',
          wifiSsid: settingsObj.qr_menu_wifi_ssid || '',
          wifiPassword: settingsObj.qr_menu_wifi_password || '',
          theme: settingsObj.qr_menu_theme || 'noir',
        },
        categories,
        items,
        tables,
      };
    }
  } catch (err) {
    console.warn('Could not read from sqlite3 CLI:', err.message);
  }
}

// 2. Fallback to one_bite_menu.json if payload empty
if (!payload || !payload.items || payload.items.length === 0) {
  const oneBitePath = path.join(rootDir, 'one_bite_menu.json');
  if (fs.existsSync(oneBitePath)) {
    const raw = JSON.parse(fs.readFileSync(oneBitePath, 'utf-8'));
    payload = {
      restaurant: {
        name: 'Kapil Cafe',
        address: 'Sumerpur',
        phone: '9690148808',
        currency: '₹',
        currencyCode: 'INR',
      },
      settings: {
        subtitle: 'Scan to browse our digital menu',
        tableCardTitle: 'Scan for Digital Menu',
        tableCardSubtitle: 'Point phone camera at QR code • Live dishes & specials',
        theme: 'noir',
      },
      tables: [
        { id: 1, name: 'Table 1', capacity: 4 },
        { id: 2, name: 'Table 2', capacity: 4 },
        { id: 3, name: 'Table 3', capacity: 2 },
        { id: 4, name: 'Table 4', capacity: 6 },
        { id: 5, name: 'Table 5', capacity: 4 },
      ],
      categories: raw.categories || [],
      items: raw.items || [],
      addonGroups: raw.addonGroups || [],
    };
  }
}

if (!payload) {
  console.error('Error: No menu data available to export.');
  process.exit(1);
}

let derivedSlug = settingsObj.qr_menu_customer_slug;
if (!derivedSlug) {
  const base = (payload.restaurant.name || 'one-bite')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'one-bite';
  const licenseKey = (settingsObj.license_key || '').trim();
  const cleanLicense = licenseKey ? licenseKey.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toLowerCase() : '';
  if (cleanLicense) {
    derivedSlug = `${base}-${cleanLicense}`;
  } else if (payload.restaurant.phone) {
    const cleanPhone = payload.restaurant.phone.replace(/[^0-9]/g, '').slice(-4);
    derivedSlug = cleanPhone ? `${base}-${cleanPhone}` : base;
  } else {
    derivedSlug = base;
  }
}

const slug = (customSlug || derivedSlug).toLowerCase();
const baseNameSlug = (payload.restaurant.name || 'one-bite')
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'one-bite';

const outDirs = [
  path.join(rootDir, 'out', 'renderer', 'menus'),
  path.join(rootDir, 'public', 'menus'),
  path.join(rootDir, 'src', 'renderer', 'public', 'menus'),
  path.join(rootDir, 'web-dashboard', 'public', 'menus'),
];

outDirs.forEach((d) => {
  fs.mkdirSync(d, { recursive: true });
  // Write slug-specific menu (e.g. kapil-cafe-slxfi.json)
  fs.writeFileSync(path.join(d, `${slug}.json`), JSON.stringify(payload, null, 2), 'utf-8');
  // Write default menu
  fs.writeFileSync(path.join(d, 'default.json'), JSON.stringify(payload, null, 2), 'utf-8');
  // Write base name alias if different
  if (baseNameSlug && baseNameSlug !== slug) {
    fs.writeFileSync(path.join(d, `${baseNameSlug}.json`), JSON.stringify(payload, null, 2), 'utf-8');
  }
  // Always include one-bite sample
  fs.writeFileSync(path.join(d, 'one-bite.json'), JSON.stringify(payload, null, 2), 'utf-8');
});

// Copy standalone menu.html into out/renderer and public
const menuHtmlSrc = path.join(rootDir, 'web-dashboard', 'public', 'menu.html');
if (fs.existsSync(menuHtmlSrc)) {
  [
    path.join(rootDir, 'out', 'renderer', 'menu.html'),
    path.join(rootDir, 'public', 'menu.html'),
  ].forEach((targetPath) => {
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(menuHtmlSrc, targetPath);
    } catch {}
  });
}

const cloudDomain = 'https://molecule-e2e95.web.app';

console.log('========================================================================');
console.log('  MOLECULE POS - FIREBASE HOSTING MENU EXPORT');
console.log('========================================================================');
console.log(`  ✔ Menu exported successfully for Customer Path: /m/${slug}`);
console.log(`  ✔ Target JSON files created:`);
console.log(`     - out/renderer/menus/${slug}.json`);
console.log(`     - out/renderer/menus/default.json`);
console.log(`     - public/menus/${slug}.json`);
console.log(`  ✔ Live Customer URL on Firebase Hosting:`);
console.log(`     ${cloudDomain}/m/${slug}`);
console.log(`  ✔ Sample Table QR URL:`);
console.log(`     ${cloudDomain}/m/${slug}?table=Table%201&tableId=1`);
console.log(`  ✔ Deploy with Firebase CLI:`);
console.log(`     firebase deploy --only hosting`);
console.log('========================================================================\n');
