import http, { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import * as kotRepo from '../db/repositories/kot.repo';
import * as menuRepo from '../db/repositories/menu.repo';
import * as tableRepo from '../db/repositories/table.repo';
import * as orderRepo from '../db/repositories/order.repo';
import * as settingsRepo from '../db/repositories/settings.repo';
import * as billingService from './billing.service';
import * as inventoryService from './inventory.service';
import { getDb } from '../db/connection';
import { KOTStatus } from '../../shared/enums';
import { logger } from '../utils/logger';

const SETTING_KITCHEN_ENABLED = 'kitchen_network_enabled';
const SETTING_WAITER_ENABLED = 'waiter_network_enabled';
const SETTING_QR_MENU_ENABLED = 'qr_menu_network_enabled';
const SETTING_PORT = 'kitchen_network_port';
const SETTING_KITCHEN_TOKEN = 'kitchen_network_token';
const SETTING_WAITER_TOKEN = 'waiter_network_token';
const SETTING_QR_MENU_TOKEN = 'qr_menu_network_token';
const DEFAULT_PORT = 3030;
const SETTINGS_CATEGORY = 'kitchen_network';

export type Role = 'kitchen' | 'waiter' | 'qr_menu';

let server: http.Server | null = null;

// Table ownership: when a waiter starts working on a table, the IP that
// claimed the table "owns" it until the order is closed. Other waiters see
// the table as locked. Persisted to settings so an Electron restart in the
// middle of service doesn't drop ownership.
const tableOwners = new Map<number, string>();
const SETTING_TABLE_OWNERS = 'kitchen_network_table_owners';
let ownersLoaded = false;

function loadOwners(): void {
  if (ownersLoaded) return;
  ownersLoaded = true;
  const raw = settingsRepo.get(SETTING_TABLE_OWNERS);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as [number, string][];
    for (const [id, ip] of parsed) {
      if (typeof id === 'number' && typeof ip === 'string') tableOwners.set(id, ip);
    }
  } catch {
    // ignore parse errors; treat as empty
  }
}

function saveOwners(): void {
  try {
    const arr = Array.from(tableOwners.entries());
    settingsRepo.set(SETTING_TABLE_OWNERS, JSON.stringify(arr), SETTINGS_CATEGORY);
  } catch {
    // ignore write errors — in-memory state stays correct
  }
}

function setOwner(tableId: number, ip: string): void {
  loadOwners();
  if (tableOwners.get(tableId) === ip) return;
  tableOwners.set(tableId, ip);
  saveOwners();
}

function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress ?? '';
}

// Drop ownership for any table that's no longer occupied (cashier closed/paid
// the order on billing PC). Called on every /api/tables fetch — that's our
// natural sweep, since every connected tablet polls every 2s.
function pruneOwnership(currentTables: any[]): void {
  loadOwners();
  const occupiedIds = new Set<number>();
  for (const t of currentTables) {
    if ((t.status ?? '').toLowerCase() === 'occupied') occupiedIds.add(t.id);
  }
  let changed = false;
  for (const id of [...tableOwners.keys()]) {
    if (!occupiedIds.has(id)) { tableOwners.delete(id); changed = true; }
  }
  if (changed) saveOwners();
}

export function isRunning(): boolean {
  return server !== null && server.listening;
}

export function getCurrentPort(): number {
  const stored = settingsRepo.get(SETTING_PORT);
  const parsed = stored ? parseInt(stored, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function tokenSettingKey(role: Role): string {
  if (role === 'kitchen') return SETTING_KITCHEN_TOKEN;
  if (role === 'waiter') return SETTING_WAITER_TOKEN;
  return SETTING_QR_MENU_TOKEN;
}

function enabledSettingKey(role: Role): string {
  if (role === 'kitchen') return SETTING_KITCHEN_ENABLED;
  if (role === 'waiter') return SETTING_WAITER_ENABLED;
  return SETTING_QR_MENU_ENABLED;
}

export function isRoleEnabled(role: Role): boolean {
  if (role === 'qr_menu') {
    const val = settingsRepo.get(SETTING_QR_MENU_ENABLED);
    return val !== 'false';
  }
  return settingsRepo.get(enabledSettingKey(role)) === 'true';
}

export function getOrCreateToken(role: Role): string {
  const key = tokenSettingKey(role);
  let token = settingsRepo.get(key);
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    settingsRepo.set(key, token, SETTINGS_CATEGORY);
  }
  return token;
}

export function regenerateToken(role: Role): string {
  const token = crypto.randomBytes(16).toString('hex');
  settingsRepo.set(tokenSettingKey(role), token, SETTINGS_CATEGORY);
  return token;
}

export function setRoleEnabled(role: Role, enabled: boolean): void {
  settingsRepo.set(enabledSettingKey(role), enabled ? 'true' : 'false', SETTINGS_CATEGORY);
}

export function getLanAddress(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

function rendererDir(): string {
  return path.join(__dirname, '..', 'renderer');
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(payload);
}

function sendStatus(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(message);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function extractToken(reqUrl: URL, req: IncomingMessage): string {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1];
  }
  return reqUrl.searchParams.get('token') ?? '';
}

function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

type AuthFail = 'role_disabled';

function authorizeDetailed(
  _reqUrl: URL,
  _req: IncomingMessage,
  role: Role,
): { ok: true } | { ok: false; reason: AuthFail } {
  // Only gate by whether the role is enabled in Settings; no token check.
  if (!isRoleEnabled(role)) return { ok: false, reason: 'role_disabled' };
  return { ok: true };
}

function authorize(reqUrl: URL, req: IncomingMessage, role: Role): boolean {
  return authorizeDetailed(reqUrl, req, role).ok;
}

// Build the KOT-creation logic mirroring the IPC handler in ipc/index.ts.
function autoSendKot(orderId: number): void {
  const db = getDb();
  const orderItems = db.prepare(`
    SELECT oi.id, oi.menu_item_id, oi.quantity,
      COALESCE(
        mi.station,
        (SELECT mi2.station FROM combo_items ci
         JOIN menu_items mi2 ON ci.menu_item_id = mi2.id
         WHERE ci.combo_id = oi.combo_id AND mi2.station IS NOT NULL
         ORDER BY mi2.station LIMIT 1)
      ) AS station
    FROM order_items oi
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ? AND oi.kot_status = 'pending'
  `).all(orderId) as any[];

  if (orderItems.length === 0) return;

  const groups = new Map<string, { orderItemId: number; quantity: number }[]>();
  for (const oi of orderItems) {
    const key = oi.station ?? '__none__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ orderItemId: oi.id, quantity: oi.quantity });
  }
  for (const [key, items] of groups) {
    const station = key === '__none__' ? undefined : key;
    kotRepo.create(orderId, items, station);
  }
}

async function handleKitchenApi(
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  // GET /api/kots/active
  if (req.method === 'GET' && pathname === '/api/kots/active') {
    sendJson(res, 200, kotRepo.getActive());
    return true;
  }

  const stationMatch = pathname.match(/^\/api\/kots\/by-station\/([^/]+)$/);
  if (req.method === 'GET' && stationMatch) {
    sendJson(res, 200, kotRepo.getByStation(decodeURIComponent(stationMatch[1])));
    return true;
  }

  const statusMatch = pathname.match(/^\/api\/kots\/(\d+)\/status$/);
  if (req.method === 'POST' && statusMatch) {
    const id = parseInt(statusMatch[1], 10);
    let body: any;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendStatus(res, 400, 'Invalid JSON');
      return true;
    }
    const status = body?.status as KOTStatus | undefined;
    if (!status || !Object.values(KOTStatus).includes(status)) {
      sendStatus(res, 400, 'Invalid status');
      return true;
    }
    const updated = kotRepo.updateStatus(id, status);
    if (!updated) {
      sendStatus(res, 404, 'KOT not found');
      return true;
    }
    sendJson(res, 200, updated);
    return true;
  }

  return false;
}

function getEffectiveTaxRate(itemTaxRate?: number | null): number {
  const raw = settingsRepo.get('default_tax_rate');
  const parsed = raw !== undefined && raw !== null ? parseFloat(String(raw).trim()) : NaN;
  const configuredDefault = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  const itemRate = typeof itemTaxRate === 'number' && Number.isFinite(itemTaxRate) ? itemTaxRate : 0.0;

  if (configuredDefault !== null) {
    if (configuredDefault === 0 || Math.abs(itemRate - 0.0) < 1e-6 || Math.abs(itemRate - 5.0) < 1e-6) {
      return configuredDefault;
    }
  }
  return itemRate;
}

async function handleWaiterApi(
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
  reqUrl: URL,
): Promise<boolean> {
  // GET /api/menu/categories
  if (req.method === 'GET' && pathname === '/api/menu/categories') {
    sendJson(res, 200, menuRepo.getCategories());
    return true;
  }

  // GET /api/menu/items?categoryId=
  if (req.method === 'GET' && pathname === '/api/menu/items') {
    const cat = reqUrl.searchParams.get('categoryId');
    const categoryId = cat ? Number(cat) : undefined;
    const items = menuRepo.getItems(categoryId).map((item) => ({
      ...item,
      taxRate: getEffectiveTaxRate(item.taxRate),
    }));
    sendJson(res, 200, items);
    return true;
  }

  // GET /api/menu/favorites — returns favorited menu_item ids
  if (req.method === 'GET' && pathname === '/api/menu/favorites') {
    const db = getDb();
    const rows = db.prepare('SELECT menu_item_id FROM favorites').all() as any[];
    sendJson(res, 200, rows.map((r) => r.menu_item_id as number));
    return true;
  }

  // GET /api/menu/top-selling?limit=10
  if (req.method === 'GET' && pathname === '/api/menu/top-selling') {
    const limit = Number(reqUrl.searchParams.get('limit') ?? 10);
    const db = getDb();
    const rows = db.prepare(`
      SELECT menu_item_id, SUM(quantity) as total_qty
      FROM order_items
      WHERE menu_item_id IS NOT NULL
      GROUP BY menu_item_id
      ORDER BY total_qty DESC
      LIMIT ?
    `).all(limit) as any[];
    sendJson(res, 200, rows.map((r) => r.menu_item_id as number));
    return true;
  }

  // GET /api/menu/items/:id/variations
  const varMatch = pathname.match(/^\/api\/menu\/items\/(\d+)\/variations$/);
  if (req.method === 'GET' && varMatch) {
    sendJson(res, 200, menuRepo.getVariations(Number(varMatch[1])));
    return true;
  }

  // GET /api/menu/items/:id/addon-groups → addon groups linked to this item, with addons
  const addonsMatch = pathname.match(/^\/api\/menu\/items\/(\d+)\/addon-groups$/);
  if (req.method === 'GET' && addonsMatch) {
    const itemId = Number(addonsMatch[1]);
    const groupIds = menuRepo.getItemAddonGroupIds(itemId);
    const allGroups = menuRepo.getAddonGroups();
    const linked = allGroups.filter((g: any) => groupIds.includes(g.id));
    sendJson(res, 200, linked);
    return true;
  }

  // POST /api/tables/:id/claim — waiter claims a table the moment they enter
  // the menu phase. Refuses if another waiter already owns it. Empty tables
  // (status 'free') get claimed implicitly by IP — no order needs to exist yet.
  const claimMatch = pathname.match(/^\/api\/tables\/(\d+)\/claim$/);
  if (req.method === 'POST' && claimMatch) {
    loadOwners();
    const tableId = Number(claimMatch[1]);
    const ip = clientIp(req);
    const owner = tableOwners.get(tableId);
    if (owner && owner !== ip) {
      sendStatus(res, 403, 'This table is being handled by another waiter.');
      return true;
    }
    setOwner(tableId, ip);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/tables — annotates each table with `lockedToOther` so the tablet
  // can disable tables already claimed by another waiter.
  if (req.method === 'GET' && pathname === '/api/tables') {
    const tables = tableRepo.getAll();
    pruneOwnership(tables);
    const ip = clientIp(req);
    const annotated = tables.map((t: any) => {
      const owner = tableOwners.get(t.id);
      return {
        ...t,
        lockedToOther: !!(owner && owner !== ip),
        ownedByMe: !!(owner && owner === ip),
      };
    });
    sendJson(res, 200, annotated);
    return true;
  }

  // GET /api/active-orders — minimal info so waiter can see their own running orders
  if (req.method === 'GET' && pathname === '/api/active-orders') {
    sendJson(res, 200, orderRepo.getActive());
    return true;
  }

  // GET /api/orders/by-table/:tableId — for resuming an existing dine-in order
  const byTableMatch = pathname.match(/^\/api\/orders\/by-table\/(\d+)$/);
  if (req.method === 'GET' && byTableMatch) {
    loadOwners();
    const tableId = Number(byTableMatch[1]);
    const owner = tableOwners.get(tableId);
    const ip = clientIp(req);
    if (owner && owner !== ip) {
      sendStatus(res, 403, 'This table is being handled by another waiter.');
      return true;
    }
    sendJson(res, 200, orderRepo.getByTable(tableId) ?? null);
    return true;
  }

  // POST /api/orders   creates an order and auto-sends KOT
  if (req.method === 'POST' && pathname === '/api/orders') {
    let body: any;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendStatus(res, 400, 'Invalid JSON');
      return true;
    }
    // If targeting a dine-in table, refuse if another waiter already owns it.
    loadOwners();
    const ip = clientIp(req);
    const targetTableId = body?.tableId;
    if (typeof targetTableId === 'number') {
      const owner = tableOwners.get(targetTableId);
      if (owner && owner !== ip) {
        sendStatus(res, 403, 'This table is being handled by another waiter.');
        return true;
      }
    }
    try {
      if (Array.isArray(body?.items)) {
        body.items = body.items.map((it: any) => ({
          ...it,
          taxRate: getEffectiveTaxRate(it.taxRate),
        }));
      }
      const order = billingService.createOrder(body);
      autoSendKot(order.id);
      // Claim ownership of this table for the waiter who just placed the order.
      if (typeof targetTableId === 'number') {
        setOwner(targetTableId, ip);
      }
      sendJson(res, 200, orderRepo.getById(order.id));
    } catch (err: any) {
      sendStatus(res, 400, err?.message ?? 'Failed to create order');
    }
    return true;
  }

  // POST /api/orders/:id/items   adds items to an existing active order and sends a KOT for them
  const addItemsMatch = pathname.match(/^\/api\/orders\/(\d+)\/items$/);
  if (req.method === 'POST' && addItemsMatch) {
    const orderId = Number(addItemsMatch[1]);
    let body: any;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendStatus(res, 400, 'Invalid JSON');
      return true;
    }
    let items = body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      sendStatus(res, 400, 'Items required');
      return true;
    }
    // Ownership check: if the order's table has an owner, only the owning IP
    // may append items.
    loadOwners();
    const order = orderRepo.getById(orderId) as any;
    if (!order) {
      sendStatus(res, 404, 'Order not found');
      return true;
    }
    if (order.status !== 'active') {
      sendStatus(res, 400, `Cannot add items: Order #${orderId} is ${order.status}`);
      return true;
    }
    const orderTableId = order?.tableId ?? order?.table_id;
    if (typeof orderTableId === 'number') {
      const owner = tableOwners.get(orderTableId);
      const ip = clientIp(req);
      if (owner && owner !== ip) {
        sendStatus(res, 403, 'This table is being handled by another waiter.');
        return true;
      }
    }
    try {
      items = items.map((it: any) => ({
        ...it,
        taxRate: getEffectiveTaxRate(it.taxRate),
      }));
      orderRepo.addItems(orderId, items);
      try {
        inventoryService.deductForOrder(orderId);
      } catch (deductErr) {
        logger.error('Inventory deduction failed for kitchen addItems:', deductErr, { orderId });
      }
      autoSendKot(orderId);
      sendJson(res, 200, orderRepo.getById(orderId));
    } catch (err: any) {
      sendStatus(res, 400, err?.message ?? 'Failed to add items');
    }
    return true;
  }

  return false;
}

export function getDefaultCustomerSlug(restaurant?: any): string {
  const rest = restaurant || settingsRepo.getRestaurant();
  const raw = rest?.name || 'menu';
  const baseSlug = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'menu';

  // License key suffix (last 5 alphanumeric characters) prevents collision when two restaurants have the same name
  const licenseKey = (settingsRepo.get('license_key') || '').trim();
  const cleanLicense = licenseKey ? licenseKey.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toLowerCase() : '';
  if (cleanLicense) {
    return `${baseSlug}-${cleanLicense}`;
  }

  // Graceful fallback to phone number suffix if license key not present
  const phone = (rest?.phone || '').trim();
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '').slice(-4) : '';
  if (cleanPhone) {
    return `${baseSlug}-${cleanPhone}`;
  }

  return baseSlug;
}

export function getQrMenuData() {
  const restaurant = settingsRepo.getRestaurant();
  let logoDataUrl = '';
  if (restaurant?.logoPath) {
    if (restaurant.logoPath.startsWith('data:')) {
      logoDataUrl = restaurant.logoPath;
    } else {
      try {
        const buf = fs.readFileSync(restaurant.logoPath);
        const ext = restaurant.logoPath.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        logoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      } catch {
        /* skip logo if unreadable */
      }
    }
  }

  const categories = menuRepo.getCategories().filter((c: any) => c.isActive !== false);
  const allItems = menuRepo.getItems();
  let allAddonGroups: any[] = [];
  try {
    allAddonGroups = menuRepo.getAddonGroups();
  } catch {
    allAddonGroups = [];
  }

  const activeItems = allItems.map((item: any) => {
    let variations: any[] = [];
    let addonGroups: any[] = [];
    try {
      variations = menuRepo.getVariations(item.id);
    } catch {}
    try {
      const groupIds = menuRepo.getItemAddonGroupIds(item.id);
      addonGroups = allAddonGroups.filter((g: any) => groupIds.includes(g.id));
    } catch {}

    return {
      ...item,
      taxRate: getEffectiveTaxRate(item.taxRate),
      variations,
      addonGroups,
    };
  });

  const tables = tableRepo.getAll().map((t: any) => ({
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    floorName: (t as any).floor_name || (t as any).floorName || '',
  }));

  const lan = getLanAddress();
  const port = getCurrentPort();
  const customUrl = (settingsRepo.get('qr_menu_custom_url') || '').trim();
  const lanUrl = lan ? `http://${lan}:${port}/qr-menu` : null;

  const defaultSlug = getDefaultCustomerSlug(restaurant);
  const customerSlug = (settingsRepo.get('qr_menu_customer_slug') || defaultSlug).trim().toLowerCase();
  const cloudDomain = (settingsRepo.get('qr_menu_cloud_domain') || 'https://molecule-e2e95.web.app').replace(/\/+$/, '');
  const urlMode = settingsRepo.get('qr_menu_url_mode') || 'cloud';
  const cloudUrl = `${cloudDomain}/m/${customerSlug}`;

  let activeUrl: string | null = cloudUrl;
  if (urlMode === 'lan') {
    activeUrl = lanUrl || cloudUrl;
  } else if (urlMode === 'custom' && customUrl.length > 0) {
    activeUrl = customUrl;
  } else {
    activeUrl = cloudUrl;
  }

  return {
    restaurant: {
      name: restaurant?.name || 'Restaurant',
      address: restaurant?.address || '',
      phone: restaurant?.phone || '',
      email: settingsRepo.get('restaurant_email') || '',
      fssai: restaurant?.fssai || '',
      gstin: restaurant?.gstin || '',
      logo: logoDataUrl,
      currency: settingsRepo.get('currency_symbol') || '₹',
      currencyCode: settingsRepo.get('currency') || 'INR',
    },
    settings: {
      wifiSsid: settingsRepo.get('qr_menu_wifi_ssid') || '',
      wifiPassword: settingsRepo.get('qr_menu_wifi_password') || '',
      subtitle: settingsRepo.get('qr_menu_subtitle') || 'Scan to browse our digital menu',
      notice: settingsRepo.get('qr_menu_notice') || '',
      theme: settingsRepo.get('qr_menu_theme') || 'noir',
      customUrl,
      cloudDomain,
      customerSlug,
      urlMode,
      cloudUrl,
      tableCardTitle: settingsRepo.get('qr_menu_table_card_title') || 'Scan for Digital Menu',
      tableCardSubtitle: settingsRepo.get('qr_menu_table_card_subtitle') || 'Point phone camera at QR code to view live menu & specials',
    },
    server: {
      running: isRunning(),
      lanAddress: lan,
      port,
      lanUrl,
      cloudUrl,
      activeUrl,
    },
    categories,
    items: activeItems,
    tables,
  };
}

async function handleQrMenuApi(
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
  reqUrl: URL,
): Promise<boolean> {
  if (req.method === 'GET') {
    if (pathname === '/api/qr-menu' || pathname === '/api/qr-menu/menu' || pathname === '/api/qr-menu/all') {
      sendJson(res, 200, getQrMenuData());
      return true;
    }
    if (pathname === '/api/qr-menu/info') {
      const data = getQrMenuData();
      sendJson(res, 200, {
        restaurant: data.restaurant,
        settings: data.settings,
        server: data.server,
      });
      return true;
    }
    if (pathname === '/api/qr-menu/categories') {
      sendJson(res, 200, getQrMenuData().categories);
      return true;
    }
    if (pathname === '/api/qr-menu/items') {
      const catId = reqUrl.searchParams.get('categoryId');
      let items = getQrMenuData().items;
      if (catId) {
        const id = Number(catId);
        items = items.filter((it: any) => it.categoryId === id);
      }
      sendJson(res, 200, items);
      return true;
    }
    if (pathname === '/api/qr-menu/tables') {
      sendJson(res, 200, getQrMenuData().tables);
      return true;
    }
  }
  return false;
}

async function handleApi(reqUrl: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = reqUrl.pathname;

  const reasonText = (_reason: AuthFail) =>
    'This role is disabled in Settings on the billing PC.';

  // Try kitchen routes first; require kitchen token.
  if (pathname.startsWith('/api/kots')) {
    const auth = authorizeDetailed(reqUrl, req, 'kitchen');
    if (!auth.ok) {
      sendStatus(res, 401, reasonText(auth.reason));
      return;
    }
    if (await handleKitchenApi(pathname, req, res)) return;
    sendStatus(res, 404, 'Not found');
    return;
  }

  // Waiter-scoped routes (menu, tables, orders, active-orders).
  if (
    pathname.startsWith('/api/menu') ||
    pathname === '/api/tables' ||
    pathname.startsWith('/api/tables/') ||
    pathname === '/api/orders' ||
    pathname.startsWith('/api/orders/') ||
    pathname === '/api/active-orders'
  ) {
    const auth = authorizeDetailed(reqUrl, req, 'waiter');
    if (!auth.ok) {
      sendStatus(res, 401, reasonText(auth.reason));
      return;
    }
    if (await handleWaiterApi(pathname, req, res, reqUrl)) return;
    sendStatus(res, 404, 'Not found');
    return;
  }

  // QR Menu routes (publicly accessible on local WiFi / LAN)
  if (pathname.startsWith('/api/qr-menu')) {
    if (await handleQrMenuApi(pathname, req, res, reqUrl)) return;
    sendStatus(res, 404, 'Not found');
    return;
  }

  sendStatus(res, 404, 'Not found');
}

async function handleStatic(reqUrl: URL, res: ServerResponse): Promise<void> {
  const root = rendererDir();
  if (!fs.existsSync(root)) {
    sendStatus(res, 503, 'Renderer build not found. Build the app to enable network mode.');
    return;
  }

  let pathname = reqUrl.pathname;
  if (
    pathname === '/' ||
    pathname === '/kitchen' ||
    pathname === '/take-order' ||
    pathname === '/qr-menu' ||
    pathname.startsWith('/qr-menu')
  ) {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(root, pathname));
  if (!safePath.startsWith(root)) {
    sendStatus(res, 403, 'Forbidden');
    return;
  }

  let filePath = safePath;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(root, 'index.html');
    if (!fs.existsSync(filePath)) {
      sendStatus(res, 404, 'Not found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
  const stat = fs.statSync(filePath);

  let cacheControl = 'public, max-age=86400';
  if (ext === '.html') {
    cacheControl = 'no-cache, no-store, must-revalidate';
  } else if (pathname.startsWith('/assets/') || filePath.replace(/\\/g, '/').includes('/assets/')) {
    cacheControl = 'public, max-age=31536000, immutable';
  }

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': cacheControl,
  });
  fs.createReadStream(filePath).pipe(res);
}

function requestHandler(req: IncomingMessage, res: ServerResponse): void {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    const host = req.headers.host ?? 'localhost';
    const reqUrl = new URL(req.url ?? '/', `http://${host}`);

    if (reqUrl.pathname.startsWith('/api/')) {
      handleApi(reqUrl, req, res).catch((err) => {
        logger.error('Network API error:', err);
        if (!res.headersSent) sendStatus(res, 500, 'Internal Server Error');
      });
      return;
    }

    handleStatic(reqUrl, res).catch((err) => {
      logger.error('Network static error:', err);
      if (!res.headersSent) sendStatus(res, 500, 'Internal Server Error');
    });
  } catch (err) {
    logger.error('Network request handler error:', err);
    if (!res.headersSent) sendStatus(res, 500, 'Internal Server Error');
  }
}

function anyRoleEnabled(): boolean {
  return isRoleEnabled('kitchen') || isRoleEnabled('waiter');
}

export async function start(): Promise<{ port: number; address: string | null }> {
  if (server && server.listening) {
    return { port: getCurrentPort(), address: getLanAddress() };
  }
  const port = getCurrentPort();
  // Ensure tokens exist for any enabled role
  if (isRoleEnabled('kitchen')) getOrCreateToken('kitchen');
  if (isRoleEnabled('waiter')) getOrCreateToken('waiter');

  server = http.createServer(requestHandler);

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      server?.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server?.removeListener('error', onError);
      resolve();
    };
    server!.once('error', onError);
    server!.once('listening', onListening);
    server!.listen(port, '0.0.0.0');
  });

  logger.info(`Network server listening on 0.0.0.0:${port}`);
  return { port, address: getLanAddress() };
}

export async function stop(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => {
    server!.close(() => resolve());
  });
  server = null;
  logger.info('Network server stopped');
}

export async function autoStartIfEnabled(): Promise<void> {
  if (!anyRoleEnabled()) return;
  if (is.dev && !app.isPackaged) {
    logger.info('Network server: skipping auto-start in dev (renderer is served by Vite).');
    return;
  }
  try {
    await start();
  } catch (err: any) {
    logger.error('Network server auto-start failed:', err?.message ?? err);
  }
}

// Apply enable/disable for a role. If a role is enabled, ensure server is running.
// If neither role is enabled, stop the server.
export async function applyRoleEnabled(role: Role, enabled: boolean): Promise<void> {
  setRoleEnabled(role, enabled);
  if (anyRoleEnabled()) {
    if (!isRunning()) {
      try {
        await start();
      } catch (err: any) {
        // If start failed, revert this role's flag so settings reflect reality.
        setRoleEnabled(role, false);
        throw err;
      }
    }
  } else {
    await stop();
  }
}

export function setPort(port: number): void {
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }
  settingsRepo.set(SETTING_PORT, String(port), SETTINGS_CATEGORY);
}

interface RoleInfo {
  enabled: boolean;
  token: string;
  url: string | null;
}

export function getRoleInfo(role: Role): RoleInfo {
  const enabled = isRoleEnabled(role);
  // Token kept in storage for backwards-compat with old URLs but no longer enforced.
  const token = getOrCreateToken(role);
  const lan = getLanAddress();
  const port = getCurrentPort();
  const path = role === 'kitchen' ? '/kitchen' : role === 'waiter' ? '/take-order' : '/qr-menu';

  let url: string | null = null;
  if (role === 'qr_menu') {
    const customUrl = settingsRepo.get('qr_menu_custom_url');
    const cloudDomain = (settingsRepo.get('qr_menu_cloud_domain') || 'https://molecule-e2e95.web.app').replace(/\/+$/, '');
    const rest = settingsRepo.getRestaurant();
    const defaultSlug = getDefaultCustomerSlug(rest);
    const customerSlug = (settingsRepo.get('qr_menu_customer_slug') || defaultSlug).trim().toLowerCase();
    const urlMode = settingsRepo.get('qr_menu_url_mode') || 'cloud';

    if (urlMode === 'cloud') {
      url = `${cloudDomain}/m/${customerSlug}`;
    } else if (urlMode === 'custom' && customUrl && customUrl.trim().length > 0) {
      url = customUrl.trim();
    } else {
      url = lan ? `http://${lan}:${port}/qr-menu` : `${cloudDomain}/m/${customerSlug}`;
    }
  } else {
    url = lan ? `http://${lan}:${port}${path}` : null;
  }

  return { enabled, token, url };
}

export function getInfo(): {
  running: boolean;
  port: number;
  lanAddress: string | null;
  kitchen: RoleInfo;
  waiter: RoleInfo;
  qrMenu: RoleInfo;
} {
  return {
    running: isRunning(),
    port: getCurrentPort(),
    lanAddress: getLanAddress(),
    kitchen: getRoleInfo('kitchen'),
    waiter: getRoleInfo('waiter'),
    qrMenu: getRoleInfo('qr_menu'),
  };
}
