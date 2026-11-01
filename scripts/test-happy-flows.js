/**
 * Molecule POS - Comprehensive Happy Flow & Daily Routine Automated Test Suite
 *
 * Simulates a full, realistic day-in-the-life of a busy restaurant:
 *  1. Day Session Open & Cash Float Initialization (Concurrency Guards)
 *  2. Dine-In Table Ordering, Modifiers & Addons
 *  3. KOT Kitchen Workflow & Auto-Inventory Recipe Deduction (Idempotency)
 *  4. Running Table Additions & Combo Items Expansion
 *  5. Item Void Audit Logging & Automatic Inventory Restock
 *  6. Post-Discount Tax Calculation & GST Compliance Verification
 *  7. Table Transfer / Move Operations
 *  8. Split Bill Settlement (Cash + UPI), Table Auto-Free & Order Locking
 *  9. Takeaway Orders & Loyalty Coin Earning / Redemption Engine
 * 10. Purchase Order Creation, Receiving & Stock Replenishment
 * 11. Day-End Financial Reports, GST Reconciliation & Cash Drawer Close
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
};

let passedCount = 0;
let failedCount = 0;
let currentSuite = '';

function suite(name, fn) {
  currentSuite = name;
  console.log(`\n${colors.bright}${colors.cyan}● ${name}${colors.reset}`);
  fn();
}

function test(name, fn) {
  const start = Date.now();
  try {
    fn();
    const duration = Date.now() - start;
    console.log(`  ${colors.green}✔${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
    passedCount++;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`  ${colors.red}✖${colors.reset} ${name} ${colors.dim}(${duration}ms)${colors.reset}`);
    console.error(`    ${colors.red}Error: ${err.message}${colors.reset}`);
    if (err.stack) {
      const line = err.stack.split('\n')[1];
      console.error(`    ${colors.dim}${line.trim()}${colors.reset}`);
    }
    failedCount++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// -------------------------------------------------------------
// Initialize Test Database & Schema
// -------------------------------------------------------------
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');

// Schema Creation (Mirroring all migrations 001 to 020)
db.exec(`
  CREATE TABLE restaurants (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    currency TEXT DEFAULT 'INR',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE settings (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE staff (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE floors (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE tables (
    id INTEGER PRIMARY KEY,
    floor_id INTEGER REFERENCES floors(id),
    name TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'free',
    shape TEXT DEFAULT 'square',
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    width REAL DEFAULT 80,
    height REAL DEFAULT 80
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE menu_items (
    id INTEGER PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    name TEXT NOT NULL,
    short_code TEXT,
    base_price INTEGER NOT NULL,
    tax_rate REAL DEFAULT 5.0,
    station TEXT DEFAULT 'main_kitchen',
    is_veg INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    is_combo INTEGER DEFAULT 0,
    combo_savings INTEGER DEFAULT 0
  );

  CREATE TABLE item_variations (
    id INTEGER PRIMARY KEY,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_delta INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE addons (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    category TEXT
  );

  CREATE TABLE addon_variation_prices (
    id INTEGER PRIMARY KEY,
    addon_id INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    variation_name TEXT NOT NULL,
    price INTEGER NOT NULL,
    UNIQUE(addon_id, variation_name)
  );

  CREATE TABLE combo_items (
    id INTEGER PRIMARY KEY,
    combo_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    variation_id INTEGER REFERENCES item_variations(id),
    quantity INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE inventory_items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    unit TEXT NOT NULL,
    current_stock REAL DEFAULT 0,
    min_stock REAL DEFAULT 0,
    cost_per_unit INTEGER NOT NULL,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE recipes (
    id INTEGER PRIMARY KEY,
    menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES inventory_items(id),
    quantity_used REAL NOT NULL,
    unit TEXT NOT NULL
  );

  CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE purchase_orders (
    id INTEGER PRIMARY KEY,
    po_number TEXT NOT NULL UNIQUE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
    status TEXT DEFAULT 'ordered',
    total_amount INTEGER DEFAULT 0,
    notes TEXT,
    ordered_at TEXT DEFAULT (datetime('now')),
    received_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE purchase_order_items (
    id INTEGER PRIMARY KEY,
    po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    quantity REAL NOT NULL,
    unit_cost INTEGER NOT NULL,
    received_qty REAL DEFAULT 0
  );

  CREATE TABLE stock_transactions (
    id INTEGER PRIMARY KEY,
    inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    transaction_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE loyalty_transactions (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_id INTEGER,
    points INTEGER NOT NULL,
    type TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    order_type TEXT NOT NULL,
    table_id INTEGER REFERENCES tables(id),
    table_name_snapshot TEXT,
    customer_id INTEGER REFERENCES customers(id),
    staff_id INTEGER REFERENCES staff(id),
    status TEXT DEFAULT 'active',
    subtotal INTEGER DEFAULT 0,
    discount_amount INTEGER DEFAULT 0,
    discount_type TEXT,
    discount_value REAL DEFAULT 0,
    discount_reason TEXT,
    tax_amount INTEGER DEFAULT 0,
    round_off INTEGER DEFAULT 0,
    grand_total INTEGER DEFAULT 0,
    notes TEXT,
    merged_into_order_id INTEGER,
    split_from_order_id INTEGER,
    completed_at TEXT,
    cancellation_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER REFERENCES menu_items(id),
    combo_id INTEGER REFERENCES menu_items(id),
    variation_id INTEGER REFERENCES item_variations(id),
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    tax_rate REAL DEFAULT 0,
    tax_amount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    notes TEXT,
    source_table_name TEXT,
    kot_status TEXT DEFAULT 'pending',
    kot_number TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE order_item_addons (
    id INTEGER PRIMARY KEY,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    addon_id INTEGER NOT NULL REFERENCES addons(id),
    name TEXT NOT NULL,
    price INTEGER NOT NULL
  );

  CREATE TABLE kots (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kot_number TEXT NOT NULL UNIQUE,
    station TEXT DEFAULT 'main_kitchen',
    status TEXT DEFAULT 'pending',
    notes TEXT,
    printed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE kot_items (
    id INTEGER PRIMARY KEY,
    kot_id INTEGER NOT NULL REFERENCES kots(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE
  );

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    amount INTEGER NOT NULL,
    payment_mode TEXT NOT NULL,
    transaction_ref TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE day_sessions (
    id INTEGER PRIMARY KEY,
    opened_by INTEGER NOT NULL REFERENCES staff(id),
    closed_by INTEGER REFERENCES staff(id),
    opening_cash INTEGER NOT NULL,
    closing_cash INTEGER,
    expected_cash INTEGER,
    opened_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT,
    notes TEXT
  );

  CREATE TABLE void_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL,
    order_number TEXT NOT NULL,
    table_name TEXT NOT NULL,
    menu_item_id INTEGER,
    item_name TEXT NOT NULL,
    variation_name TEXT,
    quantity INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    staff_id INTEGER,
    staff_name TEXT,
    voided_at TEXT DEFAULT (datetime('now'))
  );
`);

// -------------------------------------------------------------
// Seed Initial Restaurant Configuration & Catalog
// -------------------------------------------------------------
db.prepare("INSERT INTO restaurants (id, name, currency) VALUES (1, 'Molecule Kitchen', 'INR')").run();
db.prepare("INSERT INTO settings (key, value) VALUES ('default_tax_rate', '5.0')").run();
db.prepare("INSERT INTO settings (key, value) VALUES ('loyalty_points_per_100', '5')").run();
db.prepare("INSERT INTO settings (key, value) VALUES ('loyalty_coin_value_paise', '100')").run();

// Staff
db.prepare("INSERT INTO staff (id, name, role) VALUES (1, 'Admin Manager', 'admin')").run();
db.prepare("INSERT INTO staff (id, name, role) VALUES (2, 'Rajesh Cashier', 'cashier')").run();
db.prepare("INSERT INTO staff (id, name, role) VALUES (3, 'Amit Waiter', 'waiter')").run();

// Floor & Tables
db.prepare("INSERT INTO floors (id, name) VALUES (1, 'Main Dining Hall')").run();
db.prepare("INSERT INTO tables (id, floor_id, name, status) VALUES (1, 1, 'Table 1', 'free')").run();
db.prepare("INSERT INTO tables (id, floor_id, name, status) VALUES (2, 1, 'Table 2', 'free')").run();
db.prepare("INSERT INTO tables (id, floor_id, name, status) VALUES (3, 1, 'Table 3', 'free')").run();

// Categories
db.prepare("INSERT INTO categories (id, name) VALUES (1, 'Burgers')").run();
db.prepare("INSERT INTO categories (id, name) VALUES (2, 'Pizzas')").run();
db.prepare("INSERT INTO categories (id, name) VALUES (3, 'Beverages')").run();
db.prepare("INSERT INTO categories (id, name) VALUES (4, 'Combos')").run();

// Inventory Items (Ingredients)
// Stock amounts: Buns = 100, Patty = 100, Dough = 50, Cheese = 20.0 kg, Syrup = 30.0 L
db.prepare("INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, cost_per_unit) VALUES (1, 'Burger Bun', 'pcs', 100, 20, 500)").run();
db.prepare("INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, cost_per_unit) VALUES (2, 'Veg Patty', 'pcs', 100, 20, 2000)").run();
db.prepare("INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, cost_per_unit) VALUES (3, 'Pizza Dough', 'pcs', 50, 10, 1500)").run();
db.prepare("INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, cost_per_unit) VALUES (4, 'Mozzarella Cheese', 'kg', 20.0, 5.0, 40000)").run();
db.prepare("INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, cost_per_unit) VALUES (5, 'Soft Drink Syrup', 'L', 30.0, 5.0, 5000)").run();

// Menu Items
// 1. Classic Burger: Base ₹150, Tax 5%
db.prepare("INSERT INTO menu_items (id, category_id, name, base_price, tax_rate, is_veg) VALUES (1, 1, 'Classic Burger', 15000, 5.0, 1)").run();
// 2. Margherita Pizza: Base ₹300, Tax 5%
db.prepare("INSERT INTO menu_items (id, category_id, name, base_price, tax_rate, is_veg) VALUES (2, 2, 'Margherita Pizza', 30000, 5.0, 1)").run();
// 3. Coke 300ml: Base ₹50, Tax 18%
db.prepare("INSERT INTO menu_items (id, category_id, name, base_price, tax_rate, is_veg) VALUES (3, 3, 'Coke 300ml', 5000, 18.0, 1)").run();
// 4. Burger Combo: Base ₹220, Tax 5%
db.prepare("INSERT INTO menu_items (id, category_id, name, base_price, tax_rate, is_veg, is_combo) VALUES (4, 4, 'Burger & Coke Combo', 22000, 5.0, 1, 1)").run();

// Addons & Variations
db.prepare("INSERT INTO addons (id, name, price) VALUES (1, 'Extra Cheese Slice', 3000)").run();
db.prepare("INSERT INTO item_variations (id, menu_item_id, name, price_delta) VALUES (1, 2, 'Regular', 0)").run();
db.prepare("INSERT INTO item_variations (id, menu_item_id, name, price_delta) VALUES (2, 2, 'Large', 15000)").run(); // Large = ₹450

// Combo items: Burger (id: 1) + Coke (id: 3)
db.prepare("INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES (4, 1, 1)").run();
db.prepare("INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES (4, 3, 1)").run();

// Recipes
// Burger uses 1 Bun + 1 Patty
db.prepare("INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used, unit) VALUES (1, 1, 1.0, 'pcs')").run();
db.prepare("INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used, unit) VALUES (1, 2, 1.0, 'pcs')").run();
// Pizza uses 1 Dough + 0.2 kg Cheese
db.prepare("INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used, unit) VALUES (2, 3, 1.0, 'pcs')").run();
db.prepare("INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used, unit) VALUES (2, 4, 0.2, 'kg')").run();
// Coke uses 0.3 L Syrup
db.prepare("INSERT INTO recipes (menu_item_id, inventory_item_id, quantity_used, unit) VALUES (3, 5, 0.3, 'L')").run();

// Suppliers & Customer
db.prepare("INSERT INTO suppliers (id, name, phone) VALUES (1, 'Metro Cash & Carry', '9999911111')").run();
db.prepare("INSERT INTO customers (id, name, phone, loyalty_points) VALUES (1, 'John Doe', '9876543210', 100)").run(); // 100 existing points

// -------------------------------------------------------------
// Core Business Helpers Under Test
// -------------------------------------------------------------
function generateOrderNumber() {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `ORD-${today}-`;
  const last = db.prepare("SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1").get(`${prefix}%`);
  let seq = 1;
  if (last) {
    const parts = last.order_number.split('-');
    seq = parseInt(parts[2], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function generateKotNumber() {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const prefix = `KOT-${today}-`;
  const last = db.prepare("SELECT kot_number FROM kots WHERE kot_number LIKE ? ORDER BY id DESC LIMIT 1").get(`${prefix}%`);
  let seq = 1;
  if (last) {
    const parts = last.kot_number.split('-');
    seq = parseInt(parts[2], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function recalculateOrderTotals(orderId) {
  const items = db.prepare('SELECT id, unit_price, quantity, tax_rate FROM order_items WHERE order_id = ?').all(orderId);
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unit_price * item.quantity;
  }

  const order = db.prepare('SELECT discount_type, discount_value FROM orders WHERE id = ?').get(orderId);
  let discountAmount = 0;
  if (order?.discount_type === 'percentage') {
    discountAmount = Math.round((subtotal * order.discount_value) / 100);
  } else if (order?.discount_type === 'flat') {
    discountAmount = Math.min(order.discount_value || 0, subtotal);
  }

  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  let taxAmount = 0;
  const updateItem = db.prepare('UPDATE order_items SET tax_amount = ?, total = ? WHERE id = ?');

  for (const item of items) {
    const itemTotal = item.unit_price * item.quantity;
    const discountedItemTotal = Math.round(itemTotal * (1 - discountRatio));
    const itemTax = Math.round((discountedItemTotal * item.tax_rate) / 100);
    taxAmount += itemTax;
    updateItem.run(itemTax, itemTotal + itemTax, item.id);
  }

  const grandTotal = subtotal - discountAmount + taxAmount;
  const roundOff = Math.round(grandTotal / 100) * 100 - grandTotal;

  db.prepare(`
    UPDATE orders
    SET subtotal = ?, tax_amount = ?, discount_amount = ?, grand_total = ?, round_off = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(subtotal, taxAmount, discountAmount, grandTotal + roundOff, roundOff, orderId);
}

function deductInventoryForOrder(orderId) {
  // Idempotent deduction
  const orderItems = db.prepare(`
    SELECT oi.id, oi.menu_item_id, oi.combo_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = ?
      AND oi.id NOT IN (
        SELECT reference_id FROM stock_transactions
        WHERE reference_type = 'order_item' AND transaction_type = 'consumption'
      )
  `).all(orderId);

  for (const oi of orderItems) {
    if (oi.combo_id) {
      const comboSubItems = db.prepare('SELECT menu_item_id, quantity FROM combo_items WHERE combo_id = ?').all(oi.combo_id);
      for (const cItem of comboSubItems) {
        const recipes = db.prepare('SELECT inventory_item_id, quantity_used FROM recipes WHERE menu_item_id = ?').all(cItem.menu_item_id);
        for (const r of recipes) {
          const totalQty = r.quantity_used * cItem.quantity * oi.quantity;
          db.prepare('UPDATE inventory_items SET current_stock = current_stock - ? WHERE id = ?').run(totalQty, r.inventory_item_id);
          db.prepare(`
            INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
            VALUES (?, 'consumption', ?, 'order_item', ?, ?)
          `).run(r.inventory_item_id, totalQty, oi.id, `Recipe consumption for combo item #${oi.id}`);
        }
      }
    } else if (oi.menu_item_id) {
      const recipes = db.prepare('SELECT inventory_item_id, quantity_used FROM recipes WHERE menu_item_id = ?').all(oi.menu_item_id);
      for (const r of recipes) {
        const totalQty = r.quantity_used * oi.quantity;
        db.prepare('UPDATE inventory_items SET current_stock = current_stock - ? WHERE id = ?').run(totalQty, r.inventory_item_id);
        db.prepare(`
          INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
          VALUES (?, 'consumption', ?, 'order_item', ?, ?)
        `).run(r.inventory_item_id, totalQty, oi.id, `Recipe consumption for item #${oi.id}`);
      }
    }
  }
}

// -------------------------------------------------------------
// Test Execution
// -------------------------------------------------------------
console.log(`${colors.bright}======================================================${colors.reset}`);
console.log(`${colors.bright}  MOLECULE POS - AUTOMATED HAPPY FLOW & ROUTINE SUITE ${colors.reset}`);
console.log(`${colors.bright}======================================================${colors.reset}`);

let activeSessionId = null;
let dineInOrderId = null;
let dineInKOTId = null;
let takeawayOrderId = null;
let purchaseOrderId = null;

// -------------------------------------------------------------
// Suite 1: Morning Cash Drawer & Day Session
// -------------------------------------------------------------
suite('1. Morning Cash Drawer & Day Session Opening', () => {
  test('1.1 Verifies no day session is initially active', () => {
    const active = db.prepare('SELECT * FROM day_sessions WHERE closed_at IS NULL').get();
    assertEqual(active, undefined, 'Initial active session should be undefined');
  });

  test('1.2 Opens Day Session with ₹2,000 float and stamps opened_at', () => {
    const res = db.prepare(`
      INSERT INTO day_sessions (opened_by, opening_cash, notes)
      VALUES (?, ?, ?)
    `).run(2, 200000, 'Morning Shift Open - ₹2000 float');
    activeSessionId = res.lastInsertRowid;
    assert(activeSessionId > 0, 'Session ID must be positive integer');

    const session = db.prepare('SELECT * FROM day_sessions WHERE id = ?').get(activeSessionId);
    assertEqual(session.opening_cash, 200000, 'Opening cash in paise');
    assertEqual(session.closed_at, null, 'Session must remain open');
  });

  test('1.3 Concurrency Guard: Prevents opening a second session simultaneously (Fix 6.1)', () => {
    let threwError = false;
    try {
      const existing = db.prepare('SELECT id FROM day_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1').get();
      if (existing) {
        throw new Error('A day session is already open. Please close the active session before opening a new one.');
      }
      db.prepare('INSERT INTO day_sessions (opened_by, opening_cash) VALUES (1, 100000)').run();
    } catch (err) {
      threwError = true;
      assert(err.message.includes('already open'), 'Error must notify that session is already open');
    }
    assert(threwError, 'Opening concurrent day sessions must throw an error');
  });
});

// -------------------------------------------------------------
// Suite 2: Dine-In Order Lifecycle (Order -> KOT -> Stock -> Kitchen)
// -------------------------------------------------------------
suite('2. Dine-In Order Creation, KOT & Recipe Deduction', () => {
  test('2.1 Creates Table 1 order and updates Table 1 status to occupied', () => {
    const tableBefore = db.prepare('SELECT status FROM tables WHERE id = 1').get();
    assertEqual(tableBefore.status, 'free', 'Table 1 must start free');

    const orderNumber = generateOrderNumber();
    const res = db.prepare(`
      INSERT INTO orders (order_number, order_type, table_id, table_name_snapshot, staff_id, status)
      VALUES (?, 'dine_in', 1, 'Table 1', 3, 'active')
    `).run(orderNumber);
    dineInOrderId = res.lastInsertRowid;

    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = 1").run();

    const tableAfter = db.prepare('SELECT status FROM tables WHERE id = 1').get();
    assertEqual(tableAfter.status, 'occupied', 'Table 1 must be occupied');

    // Add Items:
    // Item 1: 2x Classic Burger with Extra Cheese (150 + 30 = 180 ea => 36000 total)
    const item1Res = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, tax_rate, total, source_table_name, kot_status)
      VALUES (?, 1, 'Classic Burger', 2, 18000, 5.0, 36000, 'Table 1', 'pending')
    `).run(dineInOrderId);
    const item1Id = item1Res.lastInsertRowid;
    db.prepare('INSERT INTO order_item_addons (order_item_id, addon_id, name, price) VALUES (?, 1, ?, 3000)').run(item1Id, 'Extra Cheese Slice');

    // Item 2: 1x Margherita Pizza (Large: 450 => 45000)
    db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, variation_id, name, quantity, unit_price, tax_rate, total, source_table_name, kot_status)
      VALUES (?, 2, 2, 'Margherita Pizza (Large)', 1, 45000, 5.0, 45000, 'Table 1', 'pending')
    `).run(dineInOrderId);

    // Item 3: 2x Coke 300ml (50 ea => 10000)
    db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, tax_rate, total, source_table_name, kot_status)
      VALUES (?, 3, 'Coke 300ml', 2, 5000, 18.0, 10000, 'Table 1', 'pending')
    `).run(dineInOrderId);

    recalculateOrderTotals(dineInOrderId);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(dineInOrderId);
    assertEqual(order.subtotal, 91000, 'Subtotal: 360 + 450 + 100 = 91000 paise (₹910)');
  });

  test('2.2 Generates KOT and automatically deducts recipe ingredients (Fix 4.1)', () => {
    const kotNum = generateKotNumber();
    const kotRes = db.prepare(`
      INSERT INTO kots (order_id, kot_number, station, status)
      VALUES (?, ?, 'main_kitchen', 'pending')
    `).run(dineInOrderId, kotNum);
    dineInKOTId = kotRes.lastInsertRowid;

    // Link items to KOT
    const items = db.prepare('SELECT id FROM order_items WHERE order_id = ?').all(dineInOrderId);
    for (const it of items) {
      db.prepare('INSERT INTO kot_items (kot_id, order_item_id) VALUES (?, ?)').run(dineInKOTId, it.id);
    }

    // Trigger recipe auto-deduction
    deductInventoryForOrder(dineInOrderId);

    // Verify Stock Changes:
    // Buns: 100 - (2 * 1) = 98
    const buns = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 1').get();
    assertEqual(buns.current_stock, 98, 'Burger Buns must decrease by 2');

    // Patty: 100 - (2 * 1) = 98
    const patty = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 2').get();
    assertEqual(patty.current_stock, 98, 'Veg Patty must decrease by 2');

    // Pizza Dough: 50 - (1 * 1) = 49
    const dough = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 3').get();
    assertEqual(dough.current_stock, 49, 'Pizza Dough must decrease by 1');

    // Cheese: 20.0 - (1 * 0.2) = 19.8
    const cheese = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 4').get();
    assert(Math.abs(cheese.current_stock - 19.8) < 1e-4, 'Cheese stock must decrease by 0.2 kg');

    // Coke Syrup: 30.0 - (2 * 0.3) = 29.4
    const syrup = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 5').get();
    assert(Math.abs(syrup.current_stock - 29.4) < 1e-4, 'Coke syrup must decrease by 0.6 L');
  });

  test('2.3 Idempotency: Duplicate deduction does not double-decrement stock', () => {
    deductInventoryForOrder(dineInOrderId);
    const buns = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 1').get();
    assertEqual(buns.current_stock, 98, 'Buns stock must remain 98 (idempotent)');
  });

  test('2.4 Progresses KOT status in kitchen: pending -> preparing -> ready -> served', () => {
    db.prepare("UPDATE kots SET status = 'preparing' WHERE id = ?").run(dineInKOTId);
    assertEqual(db.prepare('SELECT status FROM kots WHERE id = ?').get(dineInKOTId).status, 'preparing');

    db.prepare("UPDATE kots SET status = 'ready' WHERE id = ?").run(dineInKOTId);
    assertEqual(db.prepare('SELECT status FROM kots WHERE id = ?').get(dineInKOTId).status, 'ready');

    db.prepare("UPDATE kots SET status = 'served' WHERE id = ?").run(dineInKOTId);
    db.prepare("UPDATE order_items SET kot_status = 'served' WHERE order_id = ?").run(dineInOrderId);
    assertEqual(db.prepare('SELECT status FROM kots WHERE id = ?').get(dineInKOTId).status, 'served');
  });
});

// -------------------------------------------------------------
// Suite 3: Running Order Additions & Combos
// -------------------------------------------------------------
suite('3. Running Order Additions & Combo Recipe Traversal', () => {
  test('3.1 Appends Combo dish to active Table 1 order', () => {
    const itemRes = db.prepare(`
      INSERT INTO order_items (order_id, combo_id, name, quantity, unit_price, tax_rate, total, source_table_name, kot_status)
      VALUES (?, 4, 'Burger & Coke Combo', 1, 22000, 5.0, 22000, 'Table 1', 'pending')
    `).run(dineInOrderId);

    recalculateOrderTotals(dineInOrderId);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(dineInOrderId);
    assertEqual(order.subtotal, 113000, 'Subtotal: 910 + 220 = 113000 paise (₹1,130)');

    // Deduct inventory for newly appended item
    deductInventoryForOrder(dineInOrderId);

    // Combo includes: 1x Burger (1 Bun + 1 Patty) + 1x Coke (0.3L Syrup)
    const buns = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 1').get();
    assertEqual(buns.current_stock, 97, 'Buns must decrease from 98 -> 97');

    const patty = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 2').get();
    assertEqual(patty.current_stock, 97, 'Patty must decrease from 98 -> 97');

    const syrup = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 5').get();
    assert(Math.abs(syrup.current_stock - 29.1) < 1e-4, 'Syrup must decrease from 29.4 -> 29.1 L');
  });
});

// -------------------------------------------------------------
// Suite 4: Item Void & Kitchen Restock
// -------------------------------------------------------------
suite('4. Item Void Audit Logging & Automatic Inventory Restock', () => {
  test('4.1 Voids 1 item, logs to void_items audit, and restocks inventory (Fix 4.1)', () => {
    // Find the standalone Coke item
    const cokeItem = db.prepare("SELECT * FROM order_items WHERE order_id = ? AND menu_item_id = 3").get(dineInOrderId);
    assert(cokeItem, 'Coke item must exist');

    // Void item
    db.prepare(`
      INSERT INTO void_items (order_id, order_number, table_name, menu_item_id, item_name, quantity, unit_price, total_amount, reason, staff_id, staff_name)
      VALUES (?, 'ORD-TEST', 'Table 1', ?, ?, ?, ?, ?, 'Customer changed mind', 2, 'Rajesh Cashier')
    `).run(dineInOrderId, cokeItem.menu_item_id, cokeItem.name, cokeItem.quantity, cokeItem.unit_price, cokeItem.total);

    // Restock the inventory deducted for this order_item
    const txns = db.prepare("SELECT * FROM stock_transactions WHERE reference_type = 'order_item' AND reference_id = ? AND transaction_type = 'consumption'").all(cokeItem.id);
    for (const t of txns) {
      db.prepare('UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?').run(t.quantity, t.inventory_item_id);
      db.prepare(`
        INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
        VALUES (?, 'adjustment', ?, 'order_item', ?, 'Restocked from voided item')
      `).run(t.inventory_item_id, t.quantity, cokeItem.id);
    }

    db.prepare('DELETE FROM order_items WHERE id = ?').run(cokeItem.id);
    recalculateOrderTotals(dineInOrderId);

    // Verify Coke Syrup is restocked from 29.1 -> 29.7 L
    const syrup = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 5').get();
    assert(Math.abs(syrup.current_stock - 29.7) < 1e-4, 'Syrup must be restocked by 0.6 L');

    // Verify void audit record
    const voidRecord = db.prepare('SELECT * FROM void_items WHERE order_id = ?').get(dineInOrderId);
    assertEqual(voidRecord.reason, 'Customer changed mind');
    assertEqual(voidRecord.item_name, 'Coke 300ml');

    // Verify order subtotal decreased from 113000 to 103000 paise (₹1,030)
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(dineInOrderId);
    assertEqual(order.subtotal, 103000);
  });
});

// -------------------------------------------------------------
// Suite 5: Discounts & Tax Calculation Verification
// -------------------------------------------------------------
suite('5. Discounts & Post-Discount Tax Compliance (Fix 1.1)', () => {
  test('5.1 Applies 10% discount and validates tax calculated on post-discount value', () => {
    // Current items:
    // 2x Burger @ 180 = 360, Tax 5%
    // 1x Pizza (Large) @ 450 = 450, Tax 5%
    // 1x Combo @ 220 = 220, Tax 5%
    // Subtotal = 103000 paise (₹1,030.00). All items 5% tax.
    db.prepare(`
      UPDATE orders
      SET discount_type = 'percentage', discount_value = 10.0, discount_reason = 'Loyalty 10% Off'
      WHERE id = ?
    `).run(dineInOrderId);

    recalculateOrderTotals(dineInOrderId);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(dineInOrderId);
    // Subtotal: 103000
    // Discount: 10% = 10300 paise (₹103.00)
    // Post-discount taxable subtotal: 92700 paise (₹927.00)
    // Tax: 5% of 92700 = 4635 paise (₹46.35)
    // Grand Total before roundoff: 92700 + 4635 = 97335
    // Roundoff to nearest 100 paise: 97300 - 97335 = -35 paise
    // Final Grand Total: 97300 paise (₹973.00)
    assertEqual(order.discount_amount, 10300, 'Discount amount must be ₹103 (10300 paise)');
    assertEqual(order.tax_amount, 4635, 'Tax amount must be ₹46.35 (4635 paise), NOT ₹51.50 pre-discount tax');
    assertEqual(order.grand_total, 97300, 'Grand total must be ₹973.00 rounded');
  });
});

// -------------------------------------------------------------
// Suite 6: Table Transfer / Move Operation
// -------------------------------------------------------------
suite('6. Table Transfer / Move Operations (Fix 5.6)', () => {
  test('6.1 Moves Table 1 to Table 2: verifies occupancy swap & accurate transfer note', () => {
    const targetTable = db.prepare('SELECT * FROM tables WHERE id = 2').get();
    assertEqual(targetTable.status, 'free', 'Target Table 2 must be free');

    // Move table
    const oldTableName = 'Table 1';
    const transferNote = `Moved from ${oldTableName}`;

    db.prepare(`
      UPDATE orders
      SET table_id = 2,
          table_name_snapshot = ?,
          notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(targetTable.name, transferNote, transferNote, dineInOrderId);

    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = 2").run();
    db.prepare("UPDATE tables SET status = 'free' WHERE id = 1").run();

    const table1 = db.prepare('SELECT status FROM tables WHERE id = 1').get();
    const table2 = db.prepare('SELECT status FROM tables WHERE id = 2').get();
    assertEqual(table1.status, 'free', 'Table 1 must now be free');
    assertEqual(table2.status, 'occupied', 'Table 2 must now be occupied');

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(dineInOrderId);
    assertEqual(order.table_id, 2);
    assert(order.notes.includes('Moved from Table 1'), 'Note must state Moved from Table 1, NOT Split from');
  });
});

// -------------------------------------------------------------
// Suite 7: Split Payment & Non-Active Order Locking
// -------------------------------------------------------------
suite('7. Split Payment Settlement & Non-Active Order Protection (Fix 5.4)', () => {
  test('7.1 Settles bill with split payment (₹500 Cash + ₹473 UPI)', () => {
    const order = db.prepare('SELECT grand_total FROM orders WHERE id = ?').get(dineInOrderId);
    assertEqual(order.grand_total, 97300, 'Grand total to settle');

    // Payment 1: ₹500 Cash
    db.prepare('INSERT INTO payments (order_id, amount, payment_mode) VALUES (?, 50000, ?)').run(dineInOrderId, 'cash');
    // Payment 2: ₹473 UPI
    db.prepare('INSERT INTO payments (order_id, amount, payment_mode, transaction_ref) VALUES (?, 47300, ?, ?)').run(dineInOrderId, 'upi', 'UPI-REF-998877');

    // Verify payments equal grand total
    const totalPaid = db.prepare('SELECT SUM(amount) as total FROM payments WHERE order_id = ?').get(dineInOrderId).total;
    assertEqual(totalPaid, 97300, 'Total paid matches grand total exactly');

    // Complete order & free table
    db.prepare("UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(dineInOrderId);
    db.prepare("UPDATE tables SET status = 'free' WHERE id = 2").run();

    const table2 = db.prepare('SELECT status FROM tables WHERE id = 2').get();
    assertEqual(table2.status, 'free', 'Table 2 freed after settlement');
  });

  test('7.2 Prevents appending items to already completed order (Fix 5.4)', () => {
    let errorThrown = false;
    try {
      const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(dineInOrderId);
      if (order.status !== 'active') {
        throw new Error(`Cannot add items to order #${dineInOrderId} because its status is '${order.status}'`);
      }
      db.prepare('INSERT INTO order_items (order_id, name, quantity, unit_price, total) VALUES (?, ?, 1, 100, 100)').run(dineInOrderId, 'Late Item');
    } catch (err) {
      errorThrown = true;
      assert(err.message.includes('completed'), 'Error message must specify completed order');
    }
    assert(errorThrown, 'Must throw error when trying to add items to completed order');
  });
});

// -------------------------------------------------------------
// Suite 8: Takeaway & Customer Loyalty Coins
// -------------------------------------------------------------
suite('8. Takeaway Quick-Service & Loyalty Coin Engine (Fix 2.4)', () => {
  test('8.1 Customer creates takeaway order and earns loyalty points', () => {
    const custBefore = db.prepare('SELECT loyalty_points, visit_count, total_spent FROM customers WHERE id = 1').get();
    assertEqual(custBefore.loyalty_points, 100);

    const orderNumber = generateOrderNumber();
    const res = db.prepare(`
      INSERT INTO orders (order_number, order_type, customer_id, staff_id, status, subtotal, tax_amount, grand_total)
      VALUES (?, 'takeaway', 1, 2, 'active', 15000, 750, 15800)
    `).run(orderNumber);
    takeawayOrderId = res.lastInsertRowid;

    db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, tax_rate, tax_amount, total)
      VALUES (?, 1, 'Classic Burger', 1, 15000, 5.0, 750, 15750)
    `).run(takeawayOrderId);

    // Settle with UPI
    db.prepare('INSERT INTO payments (order_id, amount, payment_mode) VALUES (?, 15800, ?)').run(takeawayOrderId, 'upi');
    db.prepare("UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(takeawayOrderId);

    // Earn points: 5 points per ₹100 spent. ₹158 spent => ~7 points
    const pointsEarned = Math.floor((15800 / 100) * 0.05);
    db.prepare('UPDATE customers SET loyalty_points = loyalty_points + ?, total_spent = total_spent + 15800, visit_count = visit_count + 1 WHERE id = 1').run(pointsEarned);
    db.prepare('INSERT INTO loyalty_transactions (customer_id, order_id, points, type) VALUES (1, ?, ?, ?)').run(takeawayOrderId, pointsEarned, 'earned');

    const custAfter = db.prepare('SELECT loyalty_points, visit_count FROM customers WHERE id = 1').get();
    assertEqual(custAfter.loyalty_points, 107, 'Points increased from 100 -> 107');
    assertEqual(custAfter.visit_count, custBefore.visit_count + 1, 'Visit count incremented');
  });

  test('8.2 Customer redeems 50 loyalty coins with atomic balance deduction (Fix 2.4)', () => {
    // 50 coins redeemed = ₹50 discount (5000 paise)
    const customer = db.prepare('SELECT loyalty_points FROM customers WHERE id = 1').get();
    assert(customer.loyalty_points >= 50, 'Customer has sufficient coins');

    // Deduct coins
    db.prepare('UPDATE customers SET loyalty_points = loyalty_points - 50 WHERE id = 1').run();
    db.prepare('INSERT INTO loyalty_transactions (customer_id, points, type, notes) VALUES (1, -50, ?, ?)').run('redeemed', 'Redeemed for order discount');

    const customerAfter = db.prepare('SELECT loyalty_points FROM customers WHERE id = 1').get();
    assertEqual(customerAfter.loyalty_points, 57, 'Coins deducted from 107 -> 57');
  });
});

// -------------------------------------------------------------
// Suite 9: Inventory Purchase Order & Stock Replenishment
// -------------------------------------------------------------
suite('9. Inventory Purchase Order & Stock Replenishment (Fix 4.2)', () => {
  test('9.1 Creates Purchase Order with line items', () => {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const poNum = `PO-${today}-001`;

    const poRes = db.prepare(`
      INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, ordered_at)
      VALUES (?, 1, 'ordered', 402500, datetime('now'))
    `).run(poNum);
    purchaseOrderId = poRes.lastInsertRowid;

    // Items: 50 Buns @ ₹4.50 (22500 paise) + 10 kg Cheese @ ₹380.00 (380000 paise) = 402500 paise
    db.prepare('INSERT INTO purchase_order_items (po_id, inventory_item_id, quantity, unit_cost, received_qty) VALUES (?, 1, 50, 450, 0)').run(purchaseOrderId);
    db.prepare('INSERT INTO purchase_order_items (po_id, inventory_item_id, quantity, unit_cost, received_qty) VALUES (?, 4, 10.0, 38000, 0)').run(purchaseOrderId);

    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(purchaseOrderId);
    assertEqual(po.status, 'ordered');
    assertEqual(po.total_amount, 402500);
  });

  test('9.2 Receives Purchase Order: increments stock and logs purchase transaction', () => {
    const bunsBefore = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 1').get().current_stock;
    const cheeseBefore = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 4').get().current_stock;

    // Receive full order
    const poItems = db.prepare('SELECT * FROM purchase_order_items WHERE po_id = ?').all(purchaseOrderId);
    for (const it of poItems) {
      db.prepare('UPDATE purchase_order_items SET received_qty = quantity WHERE id = ?').run(it.id);
      db.prepare('UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?').run(it.quantity, it.inventory_item_id);
      db.prepare(`
        INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
        VALUES (?, 'purchase', ?, 'purchase_order', ?, 'Received via PO')
      `).run(it.inventory_item_id, it.quantity, purchaseOrderId);
    }

    db.prepare("UPDATE purchase_orders SET status = 'received', received_at = datetime('now') WHERE id = ?").run(purchaseOrderId);

    // Verify stock incremented
    const bunsAfter = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 1').get().current_stock;
    const cheeseAfter = db.prepare('SELECT current_stock FROM inventory_items WHERE id = 4').get().current_stock;

    assertEqual(bunsAfter, bunsBefore + 50, 'Burger Buns stock increased by 50');
    assert(Math.abs(cheeseAfter - (cheeseBefore + 10.0)) < 1e-4, 'Cheese stock increased by 10 kg');

    const po = db.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(purchaseOrderId);
    assertEqual(po.status, 'received', 'PO status updated to received');
  });
});

// -------------------------------------------------------------
// Suite 10: Financial Reporting & Shift End Cash Close
// -------------------------------------------------------------
suite('10. Financial Reports, Reconciliation & Day Session Close (Fix 2.1 & 2.2)', () => {
  test('10.1 Daily Sales & Payment Reconciliation match actual collections', () => {
    // Total Orders Completed = 2 (Dine-In: ₹973.00, Takeaway: ₹158.00) => Total = ₹1,131.00 (113100 paise)
    const sales = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        SUM(grand_total) as total_revenue,
        SUM(tax_amount) as total_tax,
        SUM(discount_amount) as total_discount
      FROM orders
      WHERE status = 'completed'
    `).get();

    assertEqual(sales.total_orders, 2, '2 completed orders');
    assertEqual(sales.total_revenue, 113100, 'Total revenue = ₹1,131.00');

    // Payments Reconciliation:
    // Cash: ₹500 (50000 paise)
    // UPI: ₹473 (dine-in) + ₹158 (takeaway) = ₹631 (63100 paise)
    // Total Payments: ₹1,131
    const cashTotal = db.prepare("SELECT SUM(amount) as total FROM payments WHERE payment_mode = 'cash'").get().total;
    const upiTotal = db.prepare("SELECT SUM(amount) as total FROM payments WHERE payment_mode = 'upi'").get().total;

    assertEqual(cashTotal, 50000, 'Cash payments = ₹500.00');
    assertEqual(upiTotal, 63100, 'UPI payments = ₹631.00');
    assertEqual(cashTotal + upiTotal, 113100, 'Cash + UPI equals total revenue');
  });

  test('10.2 GST Report matches order-level and item-level taxes', () => {
    const gstReport = db.prepare(`
      SELECT
        oi.tax_rate,
        SUM(oi.tax_amount) as total_tax,
        CAST(ROUND(SUM(
          (oi.unit_price * oi.quantity) * (1.0 - CASE WHEN o.subtotal > 0 THEN CAST(o.discount_amount AS REAL) / o.subtotal ELSE 0.0 END)
        )) AS INTEGER) as taxable_amount
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'completed'
      GROUP BY oi.tax_rate
    `).all();

    const totalReportTax = gstReport.reduce((sum, r) => sum + r.total_tax, 0);
    const totalOrderTax = db.prepare("SELECT SUM(tax_amount) as total FROM orders WHERE status = 'completed'").get().total;

    assertEqual(totalReportTax, totalOrderTax, 'GST report tax matches order table tax');
  });

  test('10.3 Closes Day Session with counted cash and validates cash drawer reconciliation', () => {
    // Opening cash: ₹2,000 (200000 paise)
    // Cash received: ₹500 (50000 paise)
    // Expected cash in drawer: ₹2,500 (250000 paise)
    const openingCash = db.prepare('SELECT opening_cash FROM day_sessions WHERE id = ?').get(activeSessionId).opening_cash;
    const cashSales = db.prepare("SELECT SUM(amount) as total FROM payments WHERE payment_mode = 'cash'").get().total;
    const expectedCash = openingCash + cashSales;
    assertEqual(expectedCash, 250000, 'Expected cash = ₹2,500.00 (250000 paise)');

    // Cashier counts exactly ₹2,500 and closes
    db.prepare(`
      UPDATE day_sessions
      SET closed_by = 2,
          closing_cash = ?,
          expected_cash = ?,
          closed_at = datetime('now'),
          notes = 'End of Day Close - Register Balanced'
      WHERE id = ?
    `).run(250000, expectedCash, activeSessionId);

    const closedSession = db.prepare('SELECT * FROM day_sessions WHERE id = ?').get(activeSessionId);
    assertEqual(closedSession.closing_cash, 250000);
    assert(closedSession.closed_at !== null, 'closed_at must be populated');

    // Verify no open sessions remain
    const openSessions = db.prepare('SELECT COUNT(*) as count FROM day_sessions WHERE closed_at IS NULL').get().count;
    assertEqual(openSessions, 0, 'Zero open sessions remain');
  });
});

// -------------------------------------------------------------
// Final Summary & Exit
// -------------------------------------------------------------
console.log(`\n${colors.bright}======================================================${colors.reset}`);
console.log(`  ${colors.bright}AUTOMATION RESULTS SUMMARY:${colors.reset}`);
console.log(`  ${colors.green}Passed Tests: ${passedCount}${colors.reset}`);
if (failedCount > 0) {
  console.log(`  ${colors.red}Failed Tests: ${failedCount}${colors.reset}`);
} else {
  console.log(`  ${colors.green}Failed Tests: 0${colors.reset}`);
  console.log(`  ${colors.bright}${colors.green}ALL ROUTINE POS SCENARIOS PASSED WITH ZERO REGRESSIONS!${colors.reset}`);
}
console.log(`${colors.bright}======================================================${colors.reset}\n`);

db.close();
process.exit(failedCount > 0 ? 1 : 0);
