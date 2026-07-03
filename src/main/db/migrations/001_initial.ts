import { Migration } from './runner';

export const initialMigration: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db) => {
    db.exec(`
      -- Restaurant & Settings
      CREATE TABLE restaurant (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name TEXT NOT NULL,
        address TEXT,
        phone TEXT,
        gstin TEXT,
        fssai TEXT,
        logo_path TEXT,
        currency TEXT DEFAULT 'INR',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT NOT NULL
      );

      -- Staff & Roles
      CREATE TABLE roles (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        permissions TEXT NOT NULL
      );

      CREATE TABLE staff (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        pin_hash TEXT NOT NULL,
        role_id INTEGER NOT NULL REFERENCES roles(id),
        is_active INTEGER DEFAULT 1,
        hourly_rate INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE attendance (
        id INTEGER PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES staff(id),
        clock_in TEXT NOT NULL,
        clock_out TEXT,
        date TEXT NOT NULL,
        UNIQUE(staff_id, date)
      );

      -- Menu
      CREATE TABLE menu_categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        parent_id INTEGER REFERENCES menu_categories(id)
      );

      CREATE TABLE menu_items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        short_code TEXT,
        category_id INTEGER NOT NULL REFERENCES menu_categories(id),
        base_price INTEGER NOT NULL,
        tax_rate REAL DEFAULT 5.0,
        is_veg INTEGER DEFAULT 1,
        is_available INTEGER DEFAULT 1,
        image_path TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE item_variations (
        id INTEGER PRIMARY KEY,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price_delta INTEGER NOT NULL,
        is_default INTEGER DEFAULT 0
      );

      CREATE TABLE addon_groups (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        min_select INTEGER DEFAULT 0,
        max_select INTEGER DEFAULT 5,
        is_required INTEGER DEFAULT 0
      );

      CREATE TABLE addons (
        id INTEGER PRIMARY KEY,
        addon_group_id INTEGER NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price INTEGER NOT NULL
      );

      CREATE TABLE menu_item_addon_groups (
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        addon_group_id INTEGER NOT NULL REFERENCES addon_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (menu_item_id, addon_group_id)
      );

      CREATE TABLE combos (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        tax_rate REAL DEFAULT 5.0,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE combo_items (
        id INTEGER PRIMARY KEY,
        combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
        quantity INTEGER DEFAULT 1
      );

      -- Floors & Tables
      CREATE TABLE floors (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE tables (
        id INTEGER PRIMARY KEY,
        floor_id INTEGER NOT NULL REFERENCES floors(id),
        name TEXT NOT NULL,
        capacity INTEGER DEFAULT 4,
        pos_x REAL DEFAULT 0,
        pos_y REAL DEFAULT 0,
        shape TEXT DEFAULT 'rect',
        status TEXT DEFAULT 'free'
      );

      -- Orders
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        order_number TEXT NOT NULL UNIQUE,
        order_type TEXT NOT NULL,
        table_id INTEGER REFERENCES tables(id),
        customer_id INTEGER REFERENCES customers(id),
        staff_id INTEGER NOT NULL REFERENCES staff(id),
        status TEXT DEFAULT 'active',
        subtotal INTEGER NOT NULL DEFAULT 0,
        discount_amount INTEGER DEFAULT 0,
        discount_type TEXT,
        discount_value REAL DEFAULT 0,
        discount_reason TEXT,
        tax_amount INTEGER DEFAULT 0,
        round_off INTEGER DEFAULT 0,
        grand_total INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        merged_into_order_id INTEGER REFERENCES orders(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id),
        combo_id INTEGER REFERENCES combos(id),
        variation_id INTEGER REFERENCES item_variations(id),
        name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price INTEGER NOT NULL,
        tax_rate REAL NOT NULL,
        tax_amount INTEGER NOT NULL,
        total INTEGER NOT NULL,
        notes TEXT,
        kot_status TEXT DEFAULT 'pending',
        kot_number TEXT,
        station TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE order_item_addons (
        id INTEGER PRIMARY KEY,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        addon_id INTEGER NOT NULL REFERENCES addons(id),
        name TEXT NOT NULL,
        price INTEGER NOT NULL
      );

      -- KOTs
      CREATE TABLE kots (
        id INTEGER PRIMARY KEY,
        kot_number TEXT NOT NULL,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        station TEXT,
        status TEXT DEFAULT 'pending',
        printed_at TEXT DEFAULT (datetime('now')),
        accepted_at TEXT,
        ready_at TEXT
      );

      CREATE TABLE kot_items (
        id INTEGER PRIMARY KEY,
        kot_id INTEGER NOT NULL REFERENCES kots(id) ON DELETE CASCADE,
        order_item_id INTEGER NOT NULL REFERENCES order_items(id),
        quantity INTEGER NOT NULL,
        is_new INTEGER DEFAULT 1,
        is_cancelled INTEGER DEFAULT 0
      );

      -- Payments
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        payment_mode TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reference_no TEXT,
        tip_amount INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Inventory
      CREATE TABLE inventory_items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        unit TEXT NOT NULL,
        current_stock REAL NOT NULL DEFAULT 0,
        min_stock REAL NOT NULL DEFAULT 0,
        cost_per_unit INTEGER DEFAULT 0,
        category TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE recipes (
        id INTEGER PRIMARY KEY,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
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
        status TEXT DEFAULT 'draft',
        total_amount INTEGER DEFAULT 0,
        notes TEXT,
        ordered_at TEXT,
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

      -- Customers & Loyalty
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT UNIQUE,
        email TEXT,
        address TEXT,
        loyalty_points INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        total_visits INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE loyalty_transactions (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        order_id INTEGER REFERENCES orders(id),
        points INTEGER NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Day Sessions
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

      -- Indexes
      CREATE INDEX idx_orders_status ON orders(status);
      CREATE INDEX idx_orders_created ON orders(created_at);
      CREATE INDEX idx_orders_table ON orders(table_id);
      CREATE INDEX idx_order_items_order ON order_items(order_id);
      CREATE INDEX idx_order_items_kot_status ON order_items(kot_status);
      CREATE INDEX idx_payments_order ON payments(order_id);
      CREATE INDEX idx_stock_txn_item ON stock_transactions(inventory_item_id);
      CREATE INDEX idx_customers_phone ON customers(phone);
      CREATE INDEX idx_menu_items_category ON menu_items(category_id);
      CREATE INDEX idx_kots_order ON kots(order_id);
      CREATE INDEX idx_kots_status ON kots(status);
      CREATE INDEX idx_attendance_staff ON attendance(staff_id);
      CREATE INDEX idx_loyalty_customer ON loyalty_transactions(customer_id);
    `);
  },
};
