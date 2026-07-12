import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  MENU,
  ORDERS,
  TABLES,
  INVENTORY,
  RECIPES,
  SUPPLIERS,
  PURCHASE_ORDERS,
  STAFF,
  CUSTOMERS,
  PAYMENTS,
  KOT,
  BILL,
  REPORTS,
  SETTINGS,
  DAY_SESSION,
  BACKUP,
  WHATSAPP,
  CLOUD,
  FAVORITES,
  KITCHEN_NETWORK,
  WAITER_NETWORK,
} from '../../shared/ipc-channels';
import { registerLicenseHandlers } from '../license/license.ipc';

import * as menuRepo from '../db/repositories/menu.repo';
import * as orderRepo from '../db/repositories/order.repo';
import * as tableRepo from '../db/repositories/table.repo';
import * as inventoryRepo from '../db/repositories/inventory.repo';
import * as staffRepo from '../db/repositories/staff.repo';
import * as customerRepo from '../db/repositories/customer.repo';
import * as paymentRepo from '../db/repositories/payment.repo';
import * as settingsRepo from '../db/repositories/settings.repo';
import * as kotRepo from '../db/repositories/kot.repo';
import * as offersRepo from '../db/repositories/offers.repo';

import { getDb, getDbPath, closeDb } from '../db/connection';
import { OrderStatus } from '../../shared/enums';
import { WHATSAPP_FEATURE_ENABLED } from '../../shared/featureFlags';
import { mergeLayout, BILL_FIELD_DEFS, isFieldVisible } from '../../shared/receipt-layout';
import { renderBillText, buildSampleBillModel, DEFAULT_BILL_LABELS, ReceiptItemStyle } from '../../shared/receipt-render';
import * as billingService from '../services/billing.service';
import * as reportsService from '../services/reports.service';
import * as kotPrintService from '../services/kot-print.service';
import { createPrinter, sendRawToPrinter, VIRTUAL_PRINTER_NAME } from '../services/escpos-print.service';
import * as whatsappService from '../services/whatsapp.service';
import * as cloudSync from '../services/cloud-sync.service';
import * as kitchenServer from '../services/kitchen-server.service';
import { logger } from '../utils/logger';

type IpcResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---- PIN brute-force protection ----
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30_000; // 30 seconds
const pinFailures = new Map<string, { count: number; lockedUntil: number }>();

function checkPinRateLimit(): void {
  const now = Date.now();
  const entry = pinFailures.get('global') ?? { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil > now) {
    const secsLeft = Math.ceil((entry.lockedUntil - now) / 1000);
    throw new Error(`LOCKOUT:${secsLeft}`);
  }
}

function recordPinFailure(): void {
  const now = Date.now();
  const entry = pinFailures.get('global') ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= PIN_MAX_ATTEMPTS) {
    entry.lockedUntil = now + PIN_LOCKOUT_MS;
    entry.count = 0;
  }
  pinFailures.set('global', entry);
}

function clearPinFailures(): void {
  pinFailures.delete('global');
}

function handle<T>(channel: string, handler: (...args: any[]) => T): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<T>> => {
    try {
      const data = await handler(...args);
      return { success: true, data };
    } catch (err: any) {
      console.error(`IPC error [${channel}]:`, err);
      return { success: false, error: err.message || 'Unknown error' };
    }
  });
}

export function registerAllHandlers(): void {
  // ---- Menu ----
  handle(MENU.getCategories, () => menuRepo.getCategories());
  handle(MENU.getItems, (categoryId?: number) => menuRepo.getItems(categoryId));
  handle(MENU.createItem, (data) => menuRepo.createItem(data));
  handle(MENU.updateItem, (id: number, data) => menuRepo.updateItem(id, data));
  handle(MENU.deleteItem, (id: number) => menuRepo.deleteItem(id));
  handle(MENU.getVariations, (itemId: number) => menuRepo.getVariations(itemId));
  handle(MENU.getAddons, (itemId: number) => menuRepo.getAddons(itemId));
  handle(MENU.createCategory, (data) => menuRepo.createCategory(data));
  handle(MENU.updateCategory, (id: number, data) => menuRepo.updateCategory(id, data));
  handle(MENU.deleteCategory, (id: number) => menuRepo.deleteCategory(id));
  handle(MENU.forceDeleteCategory, (id: number) => menuRepo.forceDeleteCategory(id));
  handle(MENU.forceDeleteItem, (id: number) => menuRepo.forceDeleteItem(id));
  handle(MENU.toggleAvailability, (id: number) => menuRepo.toggleAvailability(id));
  handle(MENU.togglePin, (id: number) => menuRepo.togglePin(id));
  handle(MENU.getTopSellingIds, (limit: number) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT menu_item_id, SUM(quantity) as total_qty
      FROM order_items
      WHERE menu_item_id IS NOT NULL
      GROUP BY menu_item_id
      ORDER BY total_qty DESC
      LIMIT ?
    `).all(limit) as any[];
    return rows.map((r: any) => r.menu_item_id as number);
  });
  handle(MENU.createVariation, (data) => menuRepo.createVariation(data));
  handle(MENU.updateVariation, (id: number, data) => menuRepo.updateVariation(id, data));
  handle(MENU.deleteVariation, (id: number) => menuRepo.deleteVariation(id));
  handle(MENU.getAddonGroups, () => menuRepo.getAddonGroups());
  handle(MENU.createAddonGroup, (data) => menuRepo.createAddonGroup(data));
  handle(MENU.updateAddonGroup, (id: number, data) => menuRepo.updateAddonGroup(id, data));
  handle(MENU.deleteAddonGroup, (id: number) => menuRepo.deleteAddonGroup(id));
  handle(MENU.getItemAddonGroupIds, (menuItemId: number) => menuRepo.getItemAddonGroupIds(menuItemId));
  handle(MENU.linkAddonGroupToItem, (menuItemId: number, addonGroupId: number) => menuRepo.linkAddonGroupToItem(menuItemId, addonGroupId));
  handle(MENU.unlinkAddonGroupFromItem, (menuItemId: number, addonGroupId: number) => menuRepo.unlinkAddonGroupFromItem(menuItemId, addonGroupId));
  handle(MENU.createAddon, (data) => menuRepo.createAddon(data));
  handle(MENU.updateAddon, (id: number, data) => menuRepo.updateAddon(id, data));
  handle(MENU.deleteAddon, (id: number) => menuRepo.deleteAddon(id));
  handle(MENU.setAddonVariationPrices, (addonId: number, variationPrices: Record<string, number>) => menuRepo.setAddonVariationPrices(addonId, variationPrices));
  handle(MENU.getVariationNamesForAddonGroup, (addonGroupId: number) => menuRepo.getVariationNamesForAddonGroup(addonGroupId));
  handle(MENU.getCombos, () => menuRepo.getCombos());
  handle(MENU.createCombo, (data) => menuRepo.createCombo(data));
  handle(MENU.updateCombo, (id: number, data) => menuRepo.updateCombo(id, data));
  handle(MENU.deleteCombo, (id: number) => menuRepo.deleteCombo(id));

  // ---- Orders ----
  // Order mutations change the live "Active Orders" view on the remote dashboard,
  // so they trigger a debounced cloud sync (the 15s debounce coalesces bursts).
  handle(ORDERS.create, (data) => { const r = billingService.createOrder(data); cloudSync.scheduleSync(); return r; });
  handle(ORDERS.getActive, () => orderRepo.getActive());
  handle(ORDERS.getById, (id: number) => orderRepo.getById(id));
  handle(ORDERS.getByTable, (tableId: number) => orderRepo.getByTable(tableId));
  handle(ORDERS.getAll, (filters) => orderRepo.getAll(filters));
  handle(ORDERS.updateStatus, (id: number, status) => { const r = orderRepo.updateStatus(id, status); cloudSync.scheduleSync(); return r; });
  handle(ORDERS.addItems, (orderId: number, items) => { const r = orderRepo.addItems(orderId, items); cloudSync.scheduleSync(); return r; });
  handle(ORDERS.removeItem, (_orderId: number, orderItemId: number) => { const r = orderRepo.removeItem(orderItemId); cloudSync.scheduleSync(); return r; });
  handle(ORDERS.applyDiscount, (orderId: number, discount: any) => {
    if (discount == null) {
      return orderRepo.clearDiscount(orderId);
    }
    const rawType = discount.type ?? discount.discountType;
    const type: 'percentage' | 'flat' =
      rawType === 'percent' || rawType === 'percentage' ? 'percentage' : 'flat';
    const value = typeof discount.value === 'number' ? discount.value : Number(discount.value);
    const reason = discount.reason ?? discount.discountReason ?? undefined;
    return orderRepo.applyDiscount(orderId, type, value, reason);
  });
  handle(ORDERS.splitBill, (orderId: number, splitItemIds: number[], targetTableId?: number) =>
    billingService.splitBill(orderId, splitItemIds, targetTableId)
  );
  handle(ORDERS.mergeBills, (sourceOrderId: number, targetOrderId: number) =>
    billingService.mergeBills(sourceOrderId, targetOrderId)
  );
  handle(ORDERS.moveTable, (orderId: number, newTableId: number) =>
    billingService.moveTable(orderId, newTableId)
  );
  handle(ORDERS.delete, (orderId: number) => orderRepo.deleteOrder(orderId));
  handle(ORDERS.getByCustomer, (customerId: number, limit: number) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT o.*, GROUP_CONCAT(oi.name, ', ') AS item_names
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = ? AND o.status = 'completed'
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ?
    `).all(customerId, limit) as any[];
    return rows.map((r: any) => ({
      id: r.id,
      orderNumber: r.order_number,
      orderType: r.order_type,
      grandTotal: r.grand_total,
      createdAt: r.created_at,
      itemNames: r.item_names ?? '',
    }));
  });

  handle(ORDERS.updateCustomer, (orderId: number, customerId: number) => {
    const db = getDb();
    db.prepare("UPDATE orders SET customer_id = ?, updated_at = datetime('now') WHERE id = ?").run(customerId, orderId);
    return orderRepo.getById(orderId);
  });

  // ---- Favorites ----
  handle(FAVORITES.getAll, () => {
    const db = getDb();
    return db.prepare('SELECT menu_item_id FROM favorites').all().map((r: any) => r.menu_item_id);
  });
  handle(FAVORITES.add, (menuItemId: number) => {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO favorites (menu_item_id) VALUES (?)').run(menuItemId);
  });
  handle(FAVORITES.remove, (menuItemId: number) => {
    const db = getDb();
    db.prepare('DELETE FROM favorites WHERE menu_item_id = ?').run(menuItemId);
  });

  // ---- Tables ----
  handle(TABLES.getAll, () => tableRepo.getAll());
  handle(TABLES.getByFloor, (floorId: number) => tableRepo.getByFloor(floorId));
  handle(TABLES.create, (data) => tableRepo.create(data));
  handle(TABLES.update, (id: number, data) => tableRepo.update(id, data));
  handle(TABLES.delete, (id: number) => tableRepo.deleteTable(id));
  handle(TABLES.forceDelete, (id: number) => tableRepo.forceDeleteTable(id));
  handle(TABLES.updateStatus, (id: number, status) => tableRepo.updateStatus(id, status));
  handle(TABLES.togglePin, (id: number) => tableRepo.togglePin(id));
  handle(TABLES.getFloors, () => tableRepo.getFloors());
  handle(TABLES.createFloor, (name: string) => tableRepo.createFloor(name));
  handle(TABLES.updateFloor, (id: number, name: string) => tableRepo.updateFloor(id, name));
  handle(TABLES.deleteFloor, (id: number) => tableRepo.deleteFloor(id));
  handle(TABLES.forceDeleteFloor, (id: number) => tableRepo.forceDeleteFloor(id));

  // ---- Inventory ----
  handle(INVENTORY.getAll, () => inventoryRepo.getAll());
  handle(INVENTORY.getItem, (id: number) => inventoryRepo.getById(id));
  handle(INVENTORY.create, (data) => inventoryRepo.create(data));
  handle(INVENTORY.update, (id: number, data) => inventoryRepo.update(id, data));
  handle(INVENTORY.adjustStock, (id: number, quantity, type, refType?, refId?, notes?) =>
    inventoryRepo.adjustStock(id, quantity, type, refType, refId, notes)
  );
  handle(INVENTORY.getLowStock, () => inventoryRepo.getLowStock());
  handle(INVENTORY.getTransactions, (itemId?: number, dateRange?) =>
    inventoryRepo.getTransactions(itemId, dateRange)
  );

  // ---- Staff ----
  handle(STAFF.getAll, () => staffRepo.getAll());
  handle(STAFF.create, (data) => staffRepo.create(data));
  handle(STAFF.update, (id: number, data) => staffRepo.update(id, data));
  handle(STAFF.delete, (id: number) => staffRepo.deleteStaff(id));
  handle(STAFF.login, (pin: string) => {
    checkPinRateLimit();
    const staff = staffRepo.findByPin(pin);
    if (!staff) {
      recordPinFailure();
      throw new Error('INVALID_PIN');
    }
    clearPinFailures();
    return staff;
  });
  handle(STAFF.clockIn, (staffId: number) => staffRepo.clockIn(staffId));
  handle(STAFF.clockOut, (staffId: number) => staffRepo.clockOut(staffId));
  handle(STAFF.getAttendance, (staffId?: number, dateRange?) =>
    staffRepo.getAttendance(staffId, dateRange)
  );

  // ---- Customers ----
  handle(CUSTOMERS.getAll, () => customerRepo.getAll());
  handle(CUSTOMERS.getById, (id: number) => customerRepo.getById(id));
  handle(CUSTOMERS.search, (query: string) => customerRepo.search(query));
  handle(CUSTOMERS.create, (data) => customerRepo.create(data));
  handle(CUSTOMERS.update, (id: number, data) => customerRepo.update(id, data));
  handle(CUSTOMERS.getLoyalty, (customerId: number) => customerRepo.getLoyalty(customerId));
  handle(CUSTOMERS.addLoyalty, (customerId: number, points: number) =>
    customerRepo.addLoyalty(customerId, null, points, 'Manual loyalty points')
  );
  handle(CUSTOMERS.findByPhone, (phone: string) => customerRepo.findByPhone(phone));
  handle(CUSTOMERS.recordVisit, (customerId: number, amountSpent: number) =>
    customerRepo.recordVisit(customerId, amountSpent)
  );

  // ---- Payments ----
  handle(PAYMENTS.create, (data: any) => {
    const db = getDb();
    const orderId = data.order_id ?? data.orderId;
    const payments = (data.payments ?? []).map((p: any) => ({
      mode: p.mode,
      amount: p.amount,
      referenceNo: p.reference ?? p.referenceNo ?? null,
    }));

    // Validate payment total covers order amount
    const order = db.prepare('SELECT grand_total FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('Order not found');
    const paymentTotal = payments.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
    const tip = typeof data.tip === 'number' ? data.tip : 0;
    const coinDiscount = typeof data.coinsToRedeem === 'number' ? data.coinsToRedeem * 100 : 0; // coins to paise
    if (paymentTotal + coinDiscount < order.grand_total + tip) {
      throw new Error(`Payment total (${paymentTotal + coinDiscount}) is less than order total (${order.grand_total + tip})`);
    }

    // Wrap everything in a single transaction: customer linking + payment + order completion + coins
    const createPaymentAtomic = db.transaction(() => {
      // Handle customer: find or create by phone, link to order, record visit
      const customerData = data.customer;
      let customerId: number | undefined;
      let coinsEarned = 0;
      let coinsRedeemed = 0;

      if (customerData && customerData.phone) {
        try {
          const existing = customerRepo.findByPhone(customerData.phone);
          if (existing) {
            customerId = existing.id;
          }

          if (!customerId) {
            const created = customerRepo.create({
              name: customerData.phone,
              phone: customerData.phone,
            });
            customerId = created.id;
          }

          if (customerId) {
            db.prepare("UPDATE orders SET customer_id = ?, updated_at = datetime('now') WHERE id = ?")
              .run(customerId, orderId);
            customerRepo.recordVisit(customerId, order.grand_total);

            // --- Coin redemption ---
            const redeemCoins = typeof data.coinsToRedeem === 'number' ? data.coinsToRedeem : 0;
            if (redeemCoins > 0) {
              const customer = customerRepo.getById(customerId);
              if (customer && customer.loyaltyPoints >= redeemCoins) {
                customerRepo.addLoyalty(customerId, orderId, -redeemCoins, `Redeemed ${redeemCoins} coins on order #${orderId}`);
                coinsRedeemed = redeemCoins;
              }
            }

            // --- Coin awarding based on slabs ---
            const coinsEnabled = settingsRepo.get('coins_enabled');
            if (coinsEnabled === 'true') {
              const slabsJson = settingsRepo.get('coin_slabs');
              let slabs: { minAmount: number; coins: number }[] = [];
              try {
                slabs = slabsJson ? JSON.parse(slabsJson) : [];
              } catch { slabs = []; }

              // grand_total is in paise, slabs are in rupees
              const billRupees = order.grand_total / 100;
              let earned = 0;
              for (const slab of slabs) {
                if (billRupees >= slab.minAmount) earned = slab.coins;
              }
              if (earned > 0) {
                customerRepo.addLoyalty(customerId, orderId, earned, `Earned ${earned} coins on bill of ${billRupees}`);
                coinsEarned = earned;
              }
            }
          }
        } catch (err) {
          console.error('Customer handling failed:', err);
        }
      }

      // Create payment records
      const result = paymentRepo.create(orderId, payments, tip);

      // Atomically mark order as completed + free table + close KOTs
      orderRepo.updateStatus(orderId, OrderStatus.COMPLETED);

      return { payments: result, coinsEarned, coinsRedeemed };
    });

    const result = createPaymentAtomic();
    // A completed payment changes today's revenue/cash — refresh the remote dashboard.
    cloudSync.scheduleSync();
    return result;
  });
  handle(PAYMENTS.getByOrder, (orderId: number) => paymentRepo.getByOrder(orderId));
  handle(PAYMENTS.getReconciliation, (dateRange) => paymentRepo.getReconciliation(dateRange));

  // ---- KOT ----
  handle(KOT.create, (data: any) => {
    const orderId = data.order_id ?? data.orderId;
    const db = getDb();
    // Fetch pending order items joined with menu_item station.
    // For combo items (menu_item_id IS NULL), fall back to the station of the
    // first component menu item in the combo so they still get grouped correctly.
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

    if (orderItems.length === 0) {
      // No pending items — nothing to send, return null instead of throwing
      return null;
    }

    // Group items by station (null station → one group keyed by '__none__')
    const groups = new Map<string, { orderItemId: number; quantity: number }[]>();
    for (const oi of orderItems) {
      const key = oi.station ?? '__none__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ orderItemId: oi.id, quantity: oi.quantity });
    }

    // Create one KOT per station group; return the first (or only) KOT
    const kots: any[] = [];
    for (const [key, items] of groups) {
      const station = key === '__none__' ? undefined : key;
      kots.push(kotRepo.create(orderId, items, station));
    }
    return kots[0];
  });
  handle(KOT.getActive, () => kotRepo.getActive());
  handle(KOT.updateStatus, (id: number, status) => kotRepo.updateStatus(id, status));
  handle(KOT.getByStation, (station: string) => kotRepo.getByStation(station));
  handle(KOT.getLatestByOrder, (orderId: number) => {
    const row = getDb().prepare('SELECT id FROM kots WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(orderId) as any;
    return row ? row.id : null;
  });
  handle(KOT.testPrint, async () => {
    await kotPrintService.printKotReceipt({
      kotNumber: 'TEST-001',
      orderNumber: 'TEST-ORDER',
      tableName: 'Test Table',
      orderType: 'dine_in',
      items: [
        { name: 'Test Item 1', quantity: 2, addons: [{ name: 'Cheese Burst' }] },
        { name: 'Test Item 2', quantity: 1, notes: 'Extra spicy' },
      ],
      printedAt: new Date().toISOString(),
      kotCount: 1,
    });
    return { printed: true };
  });

  ipcMain.handle(KOT.printReceipt, async (_event, kotId: number): Promise<IpcResult<{ printed: boolean }>> => {
    try {
      const db = getDb();
      const kot = db.prepare(`
        SELECT k.*, o.order_number, o.order_type, t.name as table_name
        FROM kots k
        LEFT JOIN orders o ON k.order_id = o.id
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE k.id = ?
      `).get(kotId) as any;
      if (!kot) throw new Error('KOT not found');

      const items = db.prepare(`
        SELECT ki.quantity, ki.order_item_id, oi.name, oi.notes
        FROM kot_items ki
        LEFT JOIN order_items oi ON ki.order_item_id = oi.id
        WHERE ki.kot_id = ?
      `).all(kotId) as any[];

      const getAddons = db.prepare('SELECT name FROM order_item_addons WHERE order_item_id = ?');

      const kotCountMode = settingsRepo.get('kot_count_mode') ?? 'daily';
      let kotCountRow: { n: number } | undefined;
      if (kotCountMode === 'daily') {
        // Count KOTs created on the same calendar day as this KOT (local date).
        kotCountRow = db.prepare(
          "SELECT COUNT(*) AS n FROM kots WHERE date(created_at) = date((SELECT created_at FROM kots WHERE id = ?)) AND id <= ?"
        ).get(kotId, kotId) as { n: number } | undefined;
      } else {
        // Total count: global ordinal position across all KOTs ever created.
        kotCountRow = db.prepare(
          'SELECT COUNT(*) AS n FROM kots WHERE id <= ?'
        ).get(kotId) as { n: number } | undefined;
      }
      const kotCount = kotCountRow?.n ?? undefined;

      await kotPrintService.printKotReceipt({
        kotNumber: kot.kot_number,
        orderNumber: kot.order_number ?? '',
        tableName: kot.table_name ?? undefined,
        orderType: kot.order_type ?? 'dine_in',
        items: items.map((i: any) => {
          const addons = i.order_item_id ? (getAddons.all(i.order_item_id) as { name: string }[]) : [];
          return {
            name: i.name ?? 'Unknown',
            quantity: i.quantity,
            notes: i.notes ?? undefined,
            addons: addons.length > 0 ? addons : undefined,
          };
        }),
        printedAt: kot.printed_at,
        kotCount,
      });
      return { success: true, data: { printed: true } };
    } catch (err: any) {
      return { success: false, error: err.message || 'Print failed' };
    }
  });

  // ---- Bill Print ----

  type BillFontSize = 'small' | 'medium' | 'large';

  function applyBillFont(p: any, size: BillFontSize): void {
    switch (size) {
      case 'small': p.setTextNormal(); break;
      case 'medium': p.setTextDoubleHeight(); break;
      case 'large': p.setTextQuadArea(); break;
      default: p.setTextDoubleHeight(); break;
    }
  }

  function buildBillEscPos(receiptText: string, fontSize: BillFontSize = 'medium'): Buffer {
    const paper = settingsRepo.get('paper_width') ?? '80mm';
    const PAPER_CHAR_WIDTH: Record<string, number> = {
      '58mm': 32, '72mm': 38, '76mm': 40, '80mm': 42, '112mm': 56,
    };
    const PAPER_PRINT_DOTS: Record<string, [number, number]> = {
      '58mm': [0x80, 0x01], '72mm': [0x00, 0x02], '76mm': [0x18, 0x02],
      '80mm': [0x40, 0x02], '112mm': [0x40, 0x03],
    };
    const baseWidth = PAPER_CHAR_WIDTH[paper] ?? 42;
    const p = createPrinter(baseWidth);
    const lines = receiptText.split('\n');
    const W = p.getWidth();

    // Ensure Font A, reset left margin to 0, and maximise print area
    p.setTypeFontA();
    p.add(Buffer.from([0x1d, 0x4c, 0x00, 0x00]));
    const [nL, nH] = PAPER_PRINT_DOTS[paper] ?? [0x40, 0x02];
    p.add(Buffer.from([0x1d, 0x57, nL, nH]));

    // Apply chosen font size throughout
    p.bold(true);
    applyBillFont(p, fontSize);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isSeparator = /^[=\-]{30,}$/.test(line.trim());
      const isGrandTotal = /grand\s*total/i.test(line);

      if (isSeparator) {
        p.setTextNormal();
        p.bold(true);
        p.drawLine(line.trim()[0]);
        applyBillFont(p, fontSize);
        continue;
      }

      if (isGrandTotal) {
        // Double-height only (not double-width) to avoid right-side cutoff
        p.setTextDoubleHeight();
        p.bold(true);
        p.println(line.substring(0, W));
        applyBillFont(p, fontSize);
        p.bold(true);
        continue;
      }

      const trimmed = line.trim();
      const leadingSpaces = line.length - line.trimStart().length;
      const isCentered = leadingSpaces > 4 && trimmed.length < W - 10;

      if (isCentered && i < 10) {
        p.alignCenter();
        p.println(trimmed);
        p.alignLeft();
      } else {
        p.println(line.substring(0, W));
      }
    }

    p.setTextNormal();
    p.cut();
    return p.getBuffer();
  }

  function printBillViaHtml(receiptText: string, printerName: string | null, includeLogo = false): Promise<void> {
    let logoHtml = '';
    const restaurant = settingsRepo.getRestaurant();
    if (includeLogo && restaurant?.logoPath) {
      let logoDataUri = '';
      if (restaurant.logoPath.startsWith('data:')) {
        logoDataUri = restaurant.logoPath;
      } else {
        try {
          const buf = fs.readFileSync(restaurant.logoPath);
          const ext = restaurant.logoPath.split('.').pop()?.toLowerCase() || 'png';
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
          logoDataUri = `data:${mime};base64,${buf.toString('base64')}`;
        } catch { /* skip logo if file not found */ }
      }
      if (logoDataUri) {
        logoHtml = `<div style="text-align:center;margin-bottom:4px;"><img src="${logoDataUri}" style="max-width:150px;max-height:80px;object-fit:contain;" /></div>`;
      }
    }

    const safeReceipt = receiptText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/ /g, '&nbsp;')
      .replace(/\n/g, '<br>');

    const centerPrint = settingsRepo.get('bill_center_print') === 'true';
    const html = `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'" /><style>
      @page{margin:0;}
      body{margin:0px;padding:2px 0 20px;${centerPrint ? 'display:flex;justify-content:center;' : ''}}
      .bill-wrapper{display:inline-block;}
      .receipt{font-family:'Menlo','Consolas','Monaco','Liberation Mono',monospace;font-size:${({ small: '12px', medium: '16px', large: '20px' } as Record<string, string>)[settingsRepo.get('bill_font_size') ?? 'medium'] ?? '16px'};line-height:1.6;font-weight:600;}
    </style></head><body><div class= "bill-wrapper">${logoHtml}<div class="receipt">${safeReceipt}</div></div></body></html>`;

    // Write the HTML to a temp file and load it with loadFile instead of a
    // `data:` URL. Chromium caps `data:` navigation URLs at ~2MB, and an
    // embedded base64 logo (profile logos can be up to 5MB) easily exceeds
    // that limit, causing the page load to fail and the logo to be dropped
    // from the printed bill. loadFile has no such size limit.
    const htmlPath = path.join(app.getPath('temp'), `molecule-bill-${Date.now()}.html`);
    fs.writeFileSync(htmlPath, html, 'utf8');

    return new Promise<void>((resolve, reject) => {
      const win = new BrowserWindow({
        show: false,
        width: 400,
        height: 600,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });
      const cleanup = () => {
        try { fs.unlinkSync(htmlPath); } catch { /* temp file already gone */ }
      };
      win.loadFile(htmlPath);
      win.webContents.on('did-finish-load', async () => {
        // `did-finish-load` fires once the document loads, but fonts/images may
        // still be loading and the page may not have laid out or painted yet.
        // Calling print() here races the renderer and intermittently drops the
        // last line(s) of the receipt (e.g. the "Thank you" footer). Wait until
        // fonts + images are ready and a couple of frames have painted first.
        try {
          await win.webContents.executeJavaScript(`
            (async () => {
              try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
              const imgs = Array.from(document.images || []);
              await Promise.all(imgs.map((img) => img.complete
                ? null
                : new Promise((res) => { img.onload = res; img.onerror = res; })));
              await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
              return true;
            })();
          `);
        } catch { /* fall through and print anyway */ }

        let resolvedPrinterName: string | undefined;
        if (printerName) {
          const printers = await win.webContents.getPrintersAsync();
          const match = printers.find((p) => p.name === printerName || p.displayName === printerName);
          resolvedPrinterName = match?.name;
        }
        const silent = !!resolvedPrinterName;
        if (!silent) win.show();
        win.webContents.print(
          { silent, printBackground: true, ...(resolvedPrinterName ? { deviceName: resolvedPrinterName } : {}) },
          (success, failureReason) => {
            win.destroy();
            cleanup();
            if (success || failureReason === 'cancelled') resolve();
            else reject(new Error(`Print failed: ${failureReason}`));
          }
        );
      });
      win.webContents.on('did-fail-load', () => { win.destroy(); cleanup(); reject(new Error('Failed to load print content')); });
    });
  }

  async function runBillPrint(receiptText: string): Promise<void> {
    const savedPrinterName = settingsRepo.get('printer_bill') || settingsRepo.get('printer_kot');
    const printMode = settingsRepo.get('print_mode') ?? 'thermal';

    // If customer chose HTML mode, skip ESC/POS entirely
    if (printMode === 'html') {
      await printBillViaHtml(receiptText, savedPrinterName || null);
      return;
    }

    if (printMode === 'raster') {
      const billLayout = mergeLayout(settingsRepo.get('bill_layout'), BILL_FIELD_DEFS);
      const showLogo = isFieldVisible(billLayout, 'logo');
      await printBillViaHtml(receiptText, savedPrinterName || null, showLogo);
      return;
    }

    // Thermal mode: try ESC/POS first, fallback to HTML on failure
    if (savedPrinterName) {
      try {
        const billFontSize = (settingsRepo.get('bill_font_size') ?? 'medium') as BillFontSize;
        const escposBuffer = buildBillEscPos(receiptText, billFontSize);
        await sendRawToPrinter(savedPrinterName, escposBuffer);
        return;
      } catch (err) {
        console.warn('ESC/POS bill print failed, falling back to HTML:', err);
      }
    }

    await printBillViaHtml(receiptText, savedPrinterName || null);
  }

  function buildSampleBillText(): string {
    const PAPER_CHAR_WIDTH: Record<string, number> = {
      '58mm': 32, '72mm': 38, '76mm': 40, '80mm': 42, '112mm': 56,
    };
    const paper = settingsRepo.get('paper_width') ?? '80mm';
    const W = PAPER_CHAR_WIDTH[paper] ?? 42;

    // Raster mode honours the user's bill field layout (show/hide, reorder, rename).
    if ((settingsRepo.get('print_mode') ?? 'thermal') === 'raster') {
      const layout = mergeLayout(settingsRepo.get('bill_layout'), BILL_FIELD_DEFS);
      const itemStyle = (settingsRepo.get('bill_item_style') ?? 'name_qty') as ReceiptItemStyle;
      const model = buildSampleBillModel(DEFAULT_BILL_LABELS, itemStyle);
      const restaurant = settingsRepo.getRestaurant();
      if (restaurant?.name) model.name = restaurant.name;
      if (restaurant?.address) model.address = restaurant.address;
      if (restaurant?.phone) model.phone = restaurant.phone;
      if (restaurant?.gstin) model.gstin = restaurant.gstin;
      if (restaurant?.fssai) model.fssai = restaurant.fssai;
      return renderBillText(model, layout, W, false);
    }

    const restaurant = settingsRepo.getRestaurant();

    const center = (s: string): string => {
      if (s.length >= W) return s.substring(0, W);
      return ' '.repeat(Math.floor((W - s.length) / 2)) + s;
    };
    const lr = (l: string, r: string): string => {
      const space = Math.max(1, W - l.length - r.length);
      return l + ' '.repeat(space) + r;
    };

    const lines: string[] = [];
    lines.push(center((restaurant?.name || 'YOUR RESTAURANT').toUpperCase()));
    if (restaurant?.address) lines.push(center(restaurant.address));
    if (restaurant?.phone) lines.push(center(`Tel: ${restaurant.phone}`));
    lines.push('='.repeat(W));
    lines.push(center('TEST BILL'));
    lines.push('='.repeat(W));
    lines.push(lr('Item', 'Amount'));
    lines.push('-'.repeat(W));
    lines.push(lr('Test Item 1 x2', '200.00'));
    lines.push(lr('Test Item 2 x1', '100.00'));
    lines.push('-'.repeat(W));
    lines.push(lr('Subtotal', '300.00'));
    lines.push(lr('Tax', '15.00'));
    lines.push('='.repeat(W));
    lines.push(lr('GRAND TOTAL', '315.00'));
    lines.push('='.repeat(W));
    lines.push(center('This is a test bill print'));
    lines.push(center('Thank you!'));
    return lines.join('\n');
  }

  ipcMain.handle(BILL.printReceipt, async (_event, receiptText: string): Promise<IpcResult<{ printed: boolean }>> => {
    try {
      await runBillPrint(receiptText);
      return { success: true, data: { printed: true } };
    } catch (err: any) {
      return { success: false, error: err.message || 'Print failed' };
    }
  });

  ipcMain.handle(BILL.testPrint, async (): Promise<IpcResult<{ printed: boolean }>> => {
    try {
      await runBillPrint(buildSampleBillText());
      return { success: true, data: { printed: true } };
    } catch (err: any) {
      return { success: false, error: err.message || 'Print failed' };
    }
  });

  // ---- Reports ----
  handle(REPORTS.dailySales, (dateRange) => reportsService.dailySales(dateRange));
  handle(REPORTS.itemWiseSales, (dateRange) => reportsService.itemWiseSales(dateRange));
  handle(REPORTS.categoryWiseSales, (dateRange) => reportsService.categoryWiseSales(dateRange));
  handle(REPORTS.paymentSummary, (dateRange) => reportsService.paymentSummary(dateRange));
  handle(REPORTS.cashFlow, (dateRange) => reportsService.cashFlow(dateRange));
  handle(REPORTS.inventoryConsumption, (dateRange) => reportsService.inventoryConsumption(dateRange));
  handle(REPORTS.gstReport, (dateRange) => reportsService.gstReport(dateRange));
  handle(REPORTS.staffPerformance, (dateRange) => reportsService.staffPerformance(dateRange));
  handle(REPORTS.dayEndSummary, (dateRange) => reportsService.dayEndSummary(dateRange));
  handle(REPORTS.kitchenPrepTime, (dateRange) => reportsService.kitchenPrepTime(dateRange));
  handle(REPORTS.shiftHandover, (staffId: number, dateRange) => reportsService.shiftHandover(staffId, dateRange));
  handle(REPORTS.busyHours, (dateRange) => reportsService.busyHours(dateRange));

  // ---- Settings ----
  handle(SETTINGS.get, (key: string) => settingsRepo.get(key));
  handle(SETTINGS.set, (key: string, value: string, category: string) =>
    settingsRepo.set(key, value, category)
  );
  handle(SETTINGS.getRestaurant, () => settingsRepo.getRestaurant());
  handle(SETTINGS.updateRestaurant, (data) => settingsRepo.updateRestaurant(data));

  handle(SETTINGS.saveLogo, (dataUrl: string) => {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URL');
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    const logoDir = path.join(app.getPath('userData'), 'restaurant');
    if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
    const logoPath = path.join(logoDir, `logo.${ext}`);
    fs.writeFileSync(logoPath, buffer);
    return logoPath;
  });

  handle(SETTINGS.getLogoDataUrl, () => {
    const restaurant = settingsRepo.getRestaurant();
    if (!restaurant?.logoPath) return null;
    if (restaurant.logoPath.startsWith('data:')) return restaurant.logoPath;
    try {
      const buf = fs.readFileSync(restaurant.logoPath);
      const ext = restaurant.logoPath.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return null;
    }
  });
  handle(SETTINGS.getRoles, () => settingsRepo.getRoles());
  handle(SETTINGS.updateRole, (id: number, data: any) => {
    const permissions = Array.isArray(data) ? data : (data?.permissions ?? []);
    return settingsRepo.updateRole(id, permissions);
  });

  handle(SETTINGS.getPrinters, async () => {
    const { BrowserWindow } = await import('electron');
    const win = BrowserWindow.getAllWindows()[0];
    const systemPrinters = win
      ? (await win.webContents.getPrintersAsync()).map((p) => ({
          name: p.name, displayName: p.displayName ?? p.name, isDefault: p.isDefault,
        }))
      : [];
    // Inject virtual thermal printer for testing without hardware
    return [
      { name: VIRTUAL_PRINTER_NAME, displayName: 'Virtual Thermal Printer (Preview)', isDefault: false },
      ...systemPrinters,
    ];
  });

  // ---- Day Session ----

  function mapDaySession(row: any) {
    if (!row) return null;
    return {
      id: row.id,
      openedBy: row.opened_by,
      closedBy: row.closed_by ?? undefined,
      openingCash: row.opening_cash,
      closingCash: row.closing_cash ?? undefined,
      expectedCash: row.expected_cash ?? undefined,
      openedAt: row.opened_at,
      closedAt: row.closed_at ?? undefined,
      notes: row.notes ?? undefined,
    };
  }

  handle(DAY_SESSION.open, (data: any) => {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO day_sessions (opened_by, opening_cash, notes)
      VALUES (?, ?, ?)
    `).run(data.openedBy ?? data.staffId ?? 1, data.openingCash ?? 0, data.notes ?? null);
    const row = db.prepare('SELECT * FROM day_sessions WHERE id = ?').get(result.lastInsertRowid);
    cloudSync.scheduleSync();
    return mapDaySession(row);
  });

  handle(DAY_SESSION.close, (data: any) => {
    const db = getDb();
    // Find the current open session if sessionId not provided
    let sessionId = data.sessionId;
    if (!sessionId) {
      const current = db.prepare('SELECT id FROM day_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1').get() as any;
      sessionId = current?.id;
    }
    if (!sessionId) throw new Error('No open session to close');

    db.prepare(`
      UPDATE day_sessions SET closed_by = ?, closing_cash = ?, expected_cash = ?, closed_at = datetime('now'), notes = ?
      WHERE id = ? AND closed_at IS NULL
    `).run(data.closedBy ?? data.staffId ?? 1, data.closingCash ?? 0, data.expectedCash ?? 0, data.notes ?? null, sessionId);
    const row = db.prepare('SELECT * FROM day_sessions WHERE id = ?').get(sessionId);
    // Day close finalizes cash reconciliation — push live snapshot + archive daily.
    cloudSync.scheduleSync();
    cloudSync.pushDailySnapshot().catch((e) => logger.error('Cloud: daily snapshot failed', e));
    return mapDaySession(row);
  });

  handle(DAY_SESSION.getCurrent, () => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM day_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1').get();
    return mapDaySession(row);
  });

  // ---- Recipes ----
  handle(RECIPES.getByItem, (itemId: number) => {
    const db = getDb();
    return db.prepare(`
      SELECT r.*, ii.name as ingredient_name, ii.unit as ingredient_unit, ii.cost_per_unit
      FROM recipes r
      JOIN inventory_items ii ON r.inventory_item_id = ii.id
      WHERE r.menu_item_id = ?
    `).all(itemId);
  });

  handle(RECIPES.create, (data: any) => {
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used, unit) VALUES (?, ?, ?, ?)'
    ).run(data.menuItemId ?? data.menu_item_id, data.inventoryItemId ?? data.inventory_item_id, data.quantityUsed ?? data.quantity_used, data.unit);
    return db.prepare('SELECT * FROM recipes WHERE id = ?').get(result.lastInsertRowid);
  });

  handle(RECIPES.update, (id: number, data: any) => {
    const db = getDb();
    db.prepare('UPDATE recipes SET quantity_used = ?, unit = ? WHERE id = ?').run(data.quantityUsed ?? data.quantity_used, data.unit, id);
    return db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  });

  handle(RECIPES.delete, (id: number) => {
    const db = getDb();
    db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  });

  // ---- Suppliers ----
  handle(SUPPLIERS.getAll, () => {
    const db = getDb();
    return db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name').all();
  });

  handle(SUPPLIERS.create, (data: any) => {
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO suppliers (name, phone, email, address, gstin) VALUES (?, ?, ?, ?, ?)'
    ).run(data.name, data.phone ?? null, data.email ?? null, data.address ?? null, data.gstin ?? null);
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(result.lastInsertRowid);
  });

  handle(SUPPLIERS.update, (id: number, data: any) => {
    const db = getDb();
    db.prepare(
      'UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, gstin = ? WHERE id = ?'
    ).run(data.name, data.phone ?? null, data.email ?? null, data.address ?? null, data.gstin ?? null, id);
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  });

  // ---- Purchase Orders ----
  handle(PURCHASE_ORDERS.getAll, () => {
    const db = getDb();
    return db.prepare(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
    `).all();
  });

  handle(PURCHASE_ORDERS.create, (data: any) => {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const last = db.prepare("SELECT po_number FROM purchase_orders WHERE po_number LIKE ? ORDER BY id DESC LIMIT 1").get(`PO-${today}-%`) as any;
    let seq = 1;
    if (last) { const parts = last.po_number.split('-'); seq = parseInt(parts[2], 10) + 1; }
    const poNumber = `PO-${today}-${String(seq).padStart(3, '0')}`;

    const result = db.prepare(
      'INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(poNumber, data.supplierId ?? data.supplier_id, 'draft', data.totalAmount ?? data.total_amount ?? 0, data.notes ?? null);
    return db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(result.lastInsertRowid);
  });

  handle(PURCHASE_ORDERS.update, (id: number, data: any) => {
    const db = getDb();
    db.prepare('UPDATE purchase_orders SET status = ?, notes = ? WHERE id = ?').run(data.status, data.notes ?? null, id);
    return db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  });

  handle(PURCHASE_ORDERS.receive, (id: number, data: any) => {
    const db = getDb();
    db.prepare("UPDATE purchase_orders SET status = 'received', received_at = datetime('now') WHERE id = ?").run(id);
    return db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
  });

  // ---- Cloud Sync (remote owner dashboard) ----
  handle(CLOUD.getStatus, () => cloudSync.getStatus());
  handle(CLOUD.connect, (email: string, password: string, opts?: { create?: boolean }) =>
    cloudSync.connect(email, password, opts ?? {})
  );
  handle(CLOUD.disconnect, () => cloudSync.disconnect());
  handle(CLOUD.syncNow, async () => { await cloudSync.pushNow(); return cloudSync.getStatus(); });

  // ---- Kitchen Network ----
  handle(KITCHEN_NETWORK.getInfo, () => kitchenServer.getInfo());
  handle(KITCHEN_NETWORK.start, async () => {
    const result = await kitchenServer.start();
    return { ...result, info: kitchenServer.getInfo() };
  });
  handle(KITCHEN_NETWORK.stop, async () => {
    await kitchenServer.stop();
    return kitchenServer.getInfo();
  });
  handle(KITCHEN_NETWORK.setEnabled, async (enabled: boolean) => {
    await kitchenServer.applyRoleEnabled('kitchen', enabled);
    return kitchenServer.getInfo();
  });
  handle(KITCHEN_NETWORK.setPort, async (port: number) => {
    const wasRunning = kitchenServer.isRunning();
    if (wasRunning) await kitchenServer.stop();
    kitchenServer.setPort(port);
    if (wasRunning) await kitchenServer.start();
    return kitchenServer.getInfo();
  });
  handle(KITCHEN_NETWORK.regenerateToken, () => {
    kitchenServer.regenerateToken('kitchen');
    return kitchenServer.getInfo();
  });

  // ---- Waiter Network ----
  handle(WAITER_NETWORK.getInfo, () => kitchenServer.getInfo());
  handle(WAITER_NETWORK.setEnabled, async (enabled: boolean) => {
    await kitchenServer.applyRoleEnabled('waiter', enabled);
    return kitchenServer.getInfo();
  });
  handle(WAITER_NETWORK.regenerateToken, () => {
    kitchenServer.regenerateToken('waiter');
    return kitchenServer.getInfo();
  });

  // ---- Offers ----
  handle('offers:getAll', () => offersRepo.getAll());
  handle('offers:getActive', () => offersRepo.getActive());
  handle('offers:create', (data) => offersRepo.create(data));
  handle('offers:update', (id: number, data) => offersRepo.update(id, data));
  handle('offers:delete', (id: number) => offersRepo.remove(id));

  // ---- License ----
  registerLicenseHandlers();

  // ---- Backup / Restore ----
  ipcMain.handle(BACKUP.create, async (): Promise<IpcResult<{ savedTo: string }>> => {
    try {
      const dbPath = getDbPath();
      const defaultName = `molecule-backup-${new Date().toISOString().slice(0, 10)}.db`;

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Database Backup',
        defaultPath: path.join(app.getPath('downloads'), defaultName),
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });

      if (canceled || !filePath) {
        return { success: false, error: 'Cancelled' };
      }

      // Use SQLite's built-in backup API for a safe, consistent copy
      const db = getDb();
      await db.backup(filePath);

      // Save last backup timestamp
      settingsRepo.set('last_backup', new Date().toISOString(), 'general');

      return { success: true, data: { savedTo: filePath } };
    } catch (err: any) {
      console.error('IPC error [backup:create]:', err);
      return { success: false, error: err.message || 'Backup failed' };
    }
  });

  ipcMain.handle(BACKUP.restore, async (): Promise<IpcResult<void>> => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Backup File to Restore',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile'],
      });

      if (canceled || !filePaths[0]) {
        return { success: false, error: 'Cancelled' };
      }

      const backupFile = filePaths[0];

      // Confirm before overwriting
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Restore & Restart', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'Confirm Restore',
        message: 'Restore from backup?',
        detail: 'This will replace all current data with the backup and restart the app.',
      });

      if (response !== 0) {
        return { success: false, error: 'Cancelled' };
      }

      const dbPath = getDbPath();
      closeDb();
      fs.copyFileSync(backupFile, dbPath);

      // Restart the app to reinitialise DB with restored data
      app.relaunch();
      app.exit(0);

      return { success: true, data: undefined };
    } catch (err: any) {
      console.error('IPC error [backup:restore]:', err);
      return { success: false, error: err.message || 'Restore failed' };
    }
  });

  ipcMain.handle(BACKUP.archiveOldOrders, async (
    _event,
    olderThanDays: number,
  ): Promise<IpcResult<{ savedTo: string; ordersArchived: number; ordersDeleted: number }>> => {
    try {
      const days = Math.max(1, Math.floor(Number(olderThanDays) || 730));
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const cutoffIso = new Date(cutoffMs).toISOString().slice(0, 19).replace('T', ' ');

      const exportData = orderRepo.exportOrdersOlderThan(cutoffIso);
      const ordersArchived = exportData.orders.length;
      if (ordersArchived === 0) {
        return { success: true, data: { savedTo: '', ordersArchived: 0, ordersDeleted: 0 } };
      }

      const defaultName = `molecule-archive-before-${cutoffIso.slice(0, 10)}.json`;
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Order Archive',
        defaultPath: path.join(app.getPath('downloads'), defaultName),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) {
        return { success: false, error: 'Cancelled' };
      }

      // Write archive first; only delete after the file is safely on disk.
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');

      const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Delete Old Orders', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'Confirm Delete',
        message: `Delete ${ordersArchived} order(s) older than ${days} days?`,
        detail: `An archive has been saved to ${filePath}. Active and held orders will be skipped.`,
      });
      if (response !== 0) {
        return { success: true, data: { savedTo: filePath, ordersArchived, ordersDeleted: 0 } };
      }

      const ordersDeleted = orderRepo.purgeOrdersOlderThan(cutoffIso);
      // Reclaim freed pages now so the user sees the disk shrink.
      try { getDb().exec('VACUUM;'); settingsRepo.set('last_vacuum', new Date().toISOString(), 'general'); } catch { /* ignore */ }

      return { success: true, data: { savedTo: filePath, ordersArchived, ordersDeleted } };
    } catch (err: any) {
      console.error('IPC error [backup:archiveOldOrders]:', err);
      return { success: false, error: err.message || 'Archive failed' };
    }
  });

  ipcMain.handle(BACKUP.reset, async (): Promise<IpcResult<void>> => {
    try {
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Reset & Restart', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'Confirm Database Reset',
        message: 'Reset database to factory defaults?',
        detail: 'This will permanently delete ALL data (orders, menu, staff, settings) and restart the app with a fresh database. This action cannot be undone.',
      });

      if (response !== 0) {
        return { success: false, error: 'Cancelled' };
      }

      const dbPath = getDbPath();
      closeDb();
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      app.relaunch();
      app.exit(0);

      return { success: true, data: undefined };
    } catch (err: any) {
      console.error('IPC error [backup:reset]:', err);
      return { success: false, error: err.message || 'Reset failed' };
    }
  });

  // ---- WhatsApp ----
  ipcMain.handle(WHATSAPP.initialize, async (): Promise<IpcResult<void>> => {
    if (!WHATSAPP_FEATURE_ENABLED) {
      return { success: false, error: 'WhatsApp is disabled' };
    }
    try {
      await whatsappService.initialize();
      return { success: true, data: undefined };
    } catch (err: any) {
      return { success: false, error: err.message || 'WhatsApp initialization failed' };
    }
  });

  ipcMain.handle(WHATSAPP.getStatus, (): IpcResult<string> => {
    if (!WHATSAPP_FEATURE_ENABLED) {
      return { success: true, data: 'disconnected' };
    }
    return { success: true, data: whatsappService.getStatus() };
  });

  ipcMain.handle(WHATSAPP.getLastQr, (): IpcResult<string> => {
    if (!WHATSAPP_FEATURE_ENABLED) {
      return { success: true, data: '' };
    }
    return { success: true, data: whatsappService.getLastQr() };
  });

  ipcMain.handle(WHATSAPP.disconnect, async (): Promise<IpcResult<void>> => {
    if (!WHATSAPP_FEATURE_ENABLED) {
      return { success: true, data: undefined };
    }
    try {
      await whatsappService.destroy();
      return { success: true, data: undefined };
    } catch (err: any) {
      return { success: false, error: err.message || 'WhatsApp disconnect failed' };
    }
  });

  ipcMain.handle(WHATSAPP.sendBill, async (_event, data: { orderId: number; phone: string; labels?: Record<string, string> }): Promise<IpcResult<void>> => {
    if (!WHATSAPP_FEATURE_ENABLED) {
      return { success: false, error: 'WhatsApp bill sending is disabled' };
    }
    try {
      const enabled = settingsRepo.get('whatsapp_enabled');
      if (enabled !== 'true') {
        return { success: false, error: 'WhatsApp is not enabled' };
      }

      const order = orderRepo.getById(data.orderId);
      if (!order) return { success: false, error: 'Order not found' };

      const restaurant = settingsRepo.getRestaurant();
      const restName = (restaurant?.name || 'Restaurant').toUpperCase();
      const W = 36;
      const sep = '-'.repeat(W);
      const dblSep = '='.repeat(W);

      const fmtAmt = (paise: number) => (paise / 100).toFixed(2);
      const padLine = (left: string, right: string) => {
        const space = W - left.length - right.length;
        return left + ' '.repeat(Math.max(1, space)) + right;
      };
      const center = (text: string) => {
        const space = Math.max(0, Math.floor((W - text.length) / 2));
        return ' '.repeat(space) + text;
      };

      const lines: string[] = [];
      lines.push(center(restName));
      if (restaurant?.address) lines.push(center(restaurant.address.substring(0, W)));
      if (restaurant?.phone) lines.push(center(`Tel: ${restaurant.phone}`));
      lines.push(dblSep);
      lines.push(padLine('Order #', String(order.id).padStart(3, '0')));
      lines.push(padLine('Date', new Date(order.createdAt).toLocaleString()));
      lines.push(sep);

      for (const item of order.items) {
        const name = item.name.length > (W - 14) ? item.name.substring(0, W - 14) : item.name;
        const amt = fmtAmt(item.unitPrice * item.quantity);
        const qtyStr = `${item.quantity} x `;
        lines.push(padLine(`${qtyStr}${name}`, amt));
      }

      lines.push(sep);
      lines.push(padLine('Subtotal', fmtAmt(order.subtotal)));

      if (order.discountAmount > 0) {
        lines.push(padLine('Discount', `-${fmtAmt(order.discountAmount)}`));
      }
      if (order.taxAmount > 0) {
        lines.push(padLine('Tax', fmtAmt(order.taxAmount)));
      }

      lines.push(dblSep);
      lines.push(padLine('TOTAL', fmtAmt(order.grandTotal)));
      lines.push(dblSep);
      lines.push('');
      lines.push(center('Thank you! Visit again.'));

      /*
       * WhatsApp bill image generation used node-canvas (native deps — not viable for Win32 ia32).
       * Re-enable together with WHATSAPP_FEATURE_ENABLED + add `"canvas"` to package.json dependencies.
       *
      const { createCanvas } = await import('canvas');
      const fontSize = 14;
      const lineHeight = fontSize + 6;
      const padding = 24;
      const canvasWidth = W * (fontSize * 0.6) + padding * 2;
      const canvasHeight = lines.length * lineHeight + padding * 2;

      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px monospace`;
      ctx.textBaseline = 'top';

      lines.forEach((line, i) => {
        ctx.fillText(line, padding, padding + i * lineHeight);
      });

      const base64Image = canvas.toDataURL('image/png');

      await whatsappService.sendWhatsAppImage(
        data.phone,
        base64Image,
        `Bill from ${restaurant?.name || 'Restaurant'} - Total: ₹${fmtAmt(order.grandTotal)}`
      );
      */
      return {
        success: false,
        error:
          'WhatsApp bill images are unavailable until canvas-based rendering is restored (see ipc WhatsApp handler).',
      };
    } catch (err: any) {
      logger.error('WhatsApp sendBill failed:', err);
      return { success: false, error: err.message || 'Failed to send bill via WhatsApp' };
    }
  });


}
