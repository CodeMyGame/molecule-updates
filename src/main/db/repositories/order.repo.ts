import { getDb } from '../connection';
import { format } from 'date-fns';
import type { Order, OrderItem, OrderItemAddon, CreateOrderDTO, CartItem } from '../../../shared/types/order.types';
import { OrderStatus, KOTStatus } from '../../../shared/enums';

export function create(data: CreateOrderDTO): Order {
  const db = getDb();

  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, order_type, table_id, table_name_snapshot, customer_id, staff_id, status, subtotal, tax_amount, grand_total, round_off, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const getTableName = db.prepare('SELECT name FROM tables WHERE id = ?');

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, combo_id, variation_id, name, quantity, unit_price, tax_rate, tax_amount, total, notes, kot_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItemAddon = db.prepare(`
    INSERT INTO order_item_addons (order_item_id, addon_id, name, price)
    VALUES (?, ?, ?, ?)
  `);

  const getAddon = db.prepare('SELECT id, name, price FROM addons WHERE id = ?');
  const getVariationName = db.prepare('SELECT name FROM item_variations WHERE id = ?');
  const getAddonVarPrice = db.prepare(
    'SELECT price FROM addon_variation_prices WHERE addon_id = ? AND variation_name = ?'
  );

  const createInTransaction = db.transaction(() => {
    // Generate inside the transaction to prevent race conditions (SQLite serializes writes)
    const orderNumber = generateOrderNumber();
    let subtotal = 0;
    let taxAmount = 0;

    // Calculate totals
    for (const item of data.items) {
      const itemTotal = item.unitPrice * item.quantity;
      const itemTax = Math.round(itemTotal * item.taxRate / 100);
      subtotal += itemTotal;
      taxAmount += itemTax;
    }

    const grandTotal = subtotal + taxAmount;
    const roundOff = Math.round(grandTotal / 100) * 100 - grandTotal;

    const tableNameSnapshot = data.tableId
      ? ((getTableName.get(data.tableId) as { name?: string } | undefined)?.name ?? null)
      : null;
    const result = insertOrder.run(
      orderNumber,
      data.orderType,
      data.tableId ?? null,
      tableNameSnapshot,
      data.customerId ?? null,
      data.staffId,
      OrderStatus.ACTIVE,
      subtotal,
      taxAmount,
      grandTotal + roundOff,
      roundOff,
      data.notes ?? null,
    );

    const orderId = result.lastInsertRowid as number;

    for (const item of data.items) {
      const itemTotal = item.unitPrice * item.quantity;
      const itemTax = Math.round(itemTotal * item.taxRate / 100);

      const itemResult = insertOrderItem.run(
        orderId,
        item.menuItemId ?? null,
        item.comboId ?? null,
        item.variationId ?? null,
        item.name,
        item.quantity,
        item.unitPrice,
        item.taxRate,
        itemTax,
        itemTotal + itemTax,
        item.notes ?? null,
        KOTStatus.PENDING,
      );

      const orderItemId = itemResult.lastInsertRowid as number;

      if (item.addonIds && item.addonIds.length > 0) {
        // Resolve variation name for variation-aware addon pricing
        const varName = item.variationId
          ? (getVariationName.get(item.variationId) as { name: string } | undefined)?.name
          : undefined;

        for (const addonId of item.addonIds) {
          const addon = getAddon.get(addonId) as any;
          if (addon) {
            let addonPrice = addon.price;
            if (varName) {
              const override = getAddonVarPrice.get(addonId, varName) as { price: number } | undefined;
              if (override) addonPrice = override.price;
            }
            insertOrderItemAddon.run(orderItemId, addon.id, addon.name, addonPrice);
          }
        }
      }
    }

    // Update table status if dine-in
    if (data.tableId) {
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(data.tableId);
    }

    return orderId;
  });

  const orderId = createInTransaction();
  return getById(orderId)!;
}

export function getById(id: number): (Order & { items: OrderItem[] }) | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!row) return undefined;

  const order = mapOrder(row);
  const items = getOrderItems(id);

  return { ...order, items };
}

export function getActive(): (Order & { items: OrderItem[] })[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM orders WHERE status IN (?, ?) ORDER BY created_at DESC").all(OrderStatus.ACTIVE, OrderStatus.HOLD) as any[];
  return rows.map((row) => {
    const order = mapOrder(row);
    const items = getOrderItems(order.id);
    return { ...order, items };
  });
}

export function getByTable(tableId: number): (Order & { items: OrderItem[] }) | undefined {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM orders WHERE table_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1"
  ).get(tableId, OrderStatus.ACTIVE) as any;
  if (!row) return undefined;
  const order = mapOrder(row);
  const items = getOrderItems(order.id);
  return { ...order, items };
}

export function getAll(filters?: {
  startDate?: string;
  endDate?: string;
  status?: OrderStatus;
  orderType?: string;
  limit?: number;
  offset?: number;
}): Order[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.startDate) {
    conditions.push('o.created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push('o.created_at <= ?');
    params.push(filters.endDate.includes(' ') ? filters.endDate : `${filters.endDate} 23:59:59`);
  }
  if (filters?.status) {
    conditions.push('o.status = ?');
    params.push(filters.status);
  }
  if (filters?.orderType) {
    conditions.push('o.order_type = ?');
    params.push(filters.orderType);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Default LIMIT prevents UI from loading thousands of rows when an unbounded
  // date range is used. Caller can override.
  const limit = Math.max(1, Math.min(filters?.limit ?? 500, 5000));
  const offset = Math.max(0, filters?.offset ?? 0);

  const rows = db.prepare(`
    SELECT o.*,
      t.name AS table_name,
      s.name AS staff_name,
      c.name AS customer_name,
      c.phone AS customer_phone,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
      (SELECT GROUP_CONCAT(oi2.name, ', ') FROM order_items oi2 WHERE oi2.order_id = o.id LIMIT 5) AS item_names,
      COALESCE((SELECT SUM(ABS(lt.points)) * 100 FROM loyalty_transactions lt WHERE lt.order_id = o.id AND lt.points < 0), 0) AS coins_redeemed
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    LEFT JOIN staff s ON o.staff_id = s.id
    LEFT JOIN customers c ON o.customer_id = c.id
    ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];
  return rows.map((row) => ({
    ...mapOrder(row),
    tableName: row.table_name ?? row.table_name_snapshot ?? undefined,
    staffName: row.staff_name ?? undefined,
    customerName: row.customer_name ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    itemCount: row.item_count ?? 0,
    itemNames: row.item_names ?? undefined,
    coinsRedeemed: row.coins_redeemed ?? 0,
  }));
}

export function updateStatus(id: number, status: OrderStatus): Order | undefined {
  const db = getDb();
  const updates: string[] = ["status = ?", "updated_at = datetime('now')"];
  const params: unknown[] = [status];

  if (status === OrderStatus.COMPLETED) {
    updates.push("completed_at = datetime('now')");
  }

  params.push(id);
  db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Free up table and clear KOTs if order completed or cancelled
  if (status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED) {
    const order = db.prepare('SELECT table_id FROM orders WHERE id = ?').get(id) as any;
    if (order?.table_id) {
      // Only free if no other active orders on the table
      const activeOnTable = db.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status = ? AND id != ?"
      ).get(order.table_id, OrderStatus.ACTIVE, id) as any;
      if (activeOnTable.count === 0) {
        db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(order.table_id);
      }
    }

    // Mark all active KOTs for this order as served
    db.prepare(`
      UPDATE kots SET status = 'served'
      WHERE order_id = ? AND status IN ('pending', 'sent', 'preparing', 'ready')
    `).run(id);

    // Also update order_items kot_status
    db.prepare(`
      UPDATE order_items SET kot_status = 'served'
      WHERE order_id = ? AND kot_status != 'served'
    `).run(id);
  }

  return getById(id);
}

export function addItems(orderId: number, items: CartItem[]): Order | undefined {
  const db = getDb();

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, combo_id, variation_id, name, quantity, unit_price, tax_rate, tax_amount, total, notes, kot_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItemAddon = db.prepare(`
    INSERT INTO order_item_addons (order_item_id, addon_id, name, price)
    VALUES (?, ?, ?, ?)
  `);

  const getAddon = db.prepare('SELECT id, name, price FROM addons WHERE id = ?');
  const getVariationName = db.prepare('SELECT name FROM item_variations WHERE id = ?');
  const getAddonVarPrice = db.prepare(
    'SELECT price FROM addon_variation_prices WHERE addon_id = ? AND variation_name = ?'
  );

  const addInTransaction = db.transaction(() => {
    let additionalSubtotal = 0;
    let additionalTax = 0;

    for (const item of items) {
      const itemTotal = item.unitPrice * item.quantity;
      const itemTax = Math.round(itemTotal * item.taxRate / 100);
      additionalSubtotal += itemTotal;
      additionalTax += itemTax;

      const result = insertOrderItem.run(
        orderId,
        item.menuItemId ?? null,
        item.comboId ?? null,
        item.variationId ?? null,
        item.name,
        item.quantity,
        item.unitPrice,
        item.taxRate,
        itemTax,
        itemTotal + itemTax,
        item.notes ?? null,
        KOTStatus.PENDING,
      );

      const orderItemId = result.lastInsertRowid as number;

      if (item.addonIds && item.addonIds.length > 0) {
        const varName = item.variationId
          ? (getVariationName.get(item.variationId) as { name: string } | undefined)?.name
          : undefined;

        for (const addonId of item.addonIds) {
          const addon = getAddon.get(addonId) as any;
          if (addon) {
            let addonPrice = addon.price;
            if (varName) {
              const override = getAddonVarPrice.get(addonId, varName) as { price: number } | undefined;
              if (override) addonPrice = override.price;
            }
            insertOrderItemAddon.run(orderItemId, addon.id, addon.name, addonPrice);
          }
        }
      }
    }

    // Recalculate order totals
    recalculateOrderTotals(orderId);
  });

  addInTransaction();
  return getById(orderId);
}

export function removeItem(orderItemId: number): void {
  const db = getDb();

  const removeInTransaction = db.transaction(() => {
    const item = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(orderItemId) as any;
    if (!item) return;

    db.prepare('DELETE FROM kot_items WHERE order_item_id = ?').run(orderItemId);
    db.prepare('DELETE FROM order_item_addons WHERE order_item_id = ?').run(orderItemId);
    db.prepare('DELETE FROM order_items WHERE id = ?').run(orderItemId);

    // Delete any KOTs that now have zero items
    db.prepare(`
      DELETE FROM kots WHERE order_id = ? AND id NOT IN (
        SELECT DISTINCT kot_id FROM kot_items WHERE kot_id IN (
          SELECT id FROM kots WHERE order_id = ?
        )
      )
    `).run(item.order_id, item.order_id);

    recalculateOrderTotals(item.order_id);
  });

  removeInTransaction();
}

export function applyDiscount(
  orderId: number,
  type: 'percentage' | 'flat',
  value: number,
  reason?: string,
): Order | undefined {
  const db = getDb();

  const applyInTransaction = db.transaction(() => {
    const order = db.prepare('SELECT subtotal FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return;

    let discountAmount: number;
    if (type === 'percentage') {
      discountAmount = Math.round(order.subtotal * value / 100);
    } else {
      discountAmount = Math.min(value, order.subtotal);
    }

    db.prepare(`
      UPDATE orders SET discount_type = ?, discount_value = ?, discount_amount = ?, discount_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(type, value, discountAmount, reason ?? null, orderId);

    recalculateOrderTotals(orderId);
  });

  applyInTransaction();
  return getById(orderId);
}

/** Remove discount and recalculate totals (tax, grand_total). */
export function clearDiscount(orderId: number): Order | undefined {
  const db = getDb();
  const clearInTransaction = db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET discount_type = NULL, discount_value = 0, discount_amount = 0, discount_reason = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(orderId);
    recalculateOrderTotals(orderId);
  });
  clearInTransaction();
  return getById(orderId);
}

export function deleteOrder(orderId: number): void {
  const db = getDb();

  const deleteInTransaction = db.transaction(() => {
    const order = db.prepare('SELECT id, table_id, status FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('Order not found');

    // Free up table if order was active
    if (order.table_id && (order.status === OrderStatus.ACTIVE || order.status === OrderStatus.HOLD)) {
      const activeOnTable = db.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status IN (?, ?) AND id != ?"
      ).get(order.table_id, OrderStatus.ACTIVE, OrderStatus.HOLD, orderId) as any;
      if (activeOnTable.count === 0) {
        db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(order.table_id);
      }
    }

    // Delete related records
    db.prepare('DELETE FROM kot_items WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)').run(orderId);
    db.prepare('DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)').run(orderId);
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM kots WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM payments WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  });

  deleteInTransaction();
}

// -- Archive & purge --

/**
 * Returns a JSON-serialisable snapshot of every order older than `cutoffIso`.
 * The snapshot contains the order row and its related items, addons, KOTs,
 * and payments — everything needed to fully reconstitute the order if needed.
 * No DB rows are deleted; callers should chain `purgeOrdersOlderThan`.
 */
export function exportOrdersOlderThan(cutoffIso: string): {
  exportedAt: string;
  cutoff: string;
  orders: any[];
} {
  const db = getDb();
  const orderRows = db.prepare(`
    SELECT * FROM orders WHERE created_at < ?
  `).all(cutoffIso) as any[];

  const itemsByOrder = new Map<number, any[]>();
  const addonsByOrderItem = new Map<number, any[]>();
  const kotsByOrder = new Map<number, any[]>();
  const kotItemsByKot = new Map<number, any[]>();
  const paymentsByOrder = new Map<number, any[]>();

  if (orderRows.length > 0) {
    const ids = orderRows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');

    const items = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`).all(...ids) as any[];
    for (const it of items) {
      if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
      itemsByOrder.get(it.order_id)!.push(it);
    }

    if (items.length > 0) {
      const itemIds = items.map((i) => i.id);
      const itemPh = itemIds.map(() => '?').join(',');
      const addons = db.prepare(`SELECT * FROM order_item_addons WHERE order_item_id IN (${itemPh})`).all(...itemIds) as any[];
      for (const a of addons) {
        if (!addonsByOrderItem.has(a.order_item_id)) addonsByOrderItem.set(a.order_item_id, []);
        addonsByOrderItem.get(a.order_item_id)!.push(a);
      }
    }

    const kots = db.prepare(`SELECT * FROM kots WHERE order_id IN (${placeholders})`).all(...ids) as any[];
    for (const k of kots) {
      if (!kotsByOrder.has(k.order_id)) kotsByOrder.set(k.order_id, []);
      kotsByOrder.get(k.order_id)!.push(k);
    }
    if (kots.length > 0) {
      const kotIds = kots.map((k) => k.id);
      const kotPh = kotIds.map(() => '?').join(',');
      const kotItems = db.prepare(`SELECT * FROM kot_items WHERE kot_id IN (${kotPh})`).all(...kotIds) as any[];
      for (const ki of kotItems) {
        if (!kotItemsByKot.has(ki.kot_id)) kotItemsByKot.set(ki.kot_id, []);
        kotItemsByKot.get(ki.kot_id)!.push(ki);
      }
    }

    const payments = db.prepare(`SELECT * FROM payments WHERE order_id IN (${placeholders})`).all(...ids) as any[];
    for (const p of payments) {
      if (!paymentsByOrder.has(p.order_id)) paymentsByOrder.set(p.order_id, []);
      paymentsByOrder.get(p.order_id)!.push(p);
    }
  }

  const result = orderRows.map((order) => ({
    order,
    items: (itemsByOrder.get(order.id) ?? []).map((it) => ({
      ...it,
      addons: addonsByOrderItem.get(it.id) ?? [],
    })),
    kots: (kotsByOrder.get(order.id) ?? []).map((k) => ({
      ...k,
      items: kotItemsByKot.get(k.id) ?? [],
    })),
    payments: paymentsByOrder.get(order.id) ?? [],
  }));

  return {
    exportedAt: new Date().toISOString(),
    cutoff: cutoffIso,
    orders: result,
  };
}

/**
 * Permanently deletes orders (plus all their items, addons, KOTs, payments)
 * created before `cutoffIso`. Returns the number of orders deleted.
 * Skips active/held orders for safety — only completed/cancelled rows are
 * eligible.
 */
export function purgeOrdersOlderThan(cutoffIso: string): number {
  const db = getDb();
  const purgeable = db.prepare(`
    SELECT id FROM orders
    WHERE created_at < ? AND status NOT IN ('active', 'hold')
  `).all(cutoffIso) as { id: number }[];

  if (purgeable.length === 0) return 0;

  const ids = purgeable.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM kot_items WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id IN (${placeholders}))`).run(...ids);
    db.prepare(`DELETE FROM order_item_addons WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id IN (${placeholders}))`).run(...ids);
    db.prepare(`DELETE FROM order_items WHERE order_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM kots WHERE order_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM payments WHERE order_id IN (${placeholders})`).run(...ids);
    // loyalty_transactions reference orders too — clear the link, keep the
    // customer-facing point history intact.
    db.prepare(`UPDATE loyalty_transactions SET order_id = NULL WHERE order_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`).run(...ids);
  });
  tx();
  return ids.length;
}

// -- Helpers --

function generateOrderNumber(): string {
  const db = getDb();
  const today = format(new Date(), 'yyyyMMdd');
  const prefix = `ORD-${today}-`;

  const last = db.prepare(
    "SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`) as any;

  let seq = 1;
  if (last) {
    const parts = last.order_number.split('-');
    seq = parseInt(parts[2], 10) + 1;
  }

  return `${prefix}${seq.toString().padStart(3, '0')}`;
}

export function recalculateOrderTotals(orderId: number): void {
  const db = getDb();
  const items = db.prepare('SELECT unit_price, quantity, tax_rate FROM order_items WHERE order_id = ?').all(orderId) as any[];

  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unit_price * item.quantity;
  }

  const order = db.prepare('SELECT discount_type, discount_value FROM orders WHERE id = ?').get(orderId) as any;
  let discountAmount = 0;
  if (order?.discount_type === 'percentage') {
    discountAmount = Math.round(subtotal * order.discount_value / 100);
  } else if (order?.discount_type === 'flat') {
    discountAmount = order.discount_value || 0;
  }

  // Tax is calculated on post-discount amounts (proportional reduction per item)
  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  let taxAmount = 0;
  for (const item of items) {
    const itemTotal = item.unit_price * item.quantity;
    const discountedItemTotal = Math.round(itemTotal * (1 - discountRatio));
    taxAmount += Math.round(discountedItemTotal * item.tax_rate / 100);
  }

  const grandTotal = subtotal - discountAmount + taxAmount;
  const roundOff = Math.round(grandTotal / 100) * 100 - grandTotal;

  db.prepare(`
    UPDATE orders
    SET subtotal = ?, tax_amount = ?, discount_amount = ?, grand_total = ?, round_off = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(subtotal, taxAmount, discountAmount, grandTotal + roundOff, roundOff, orderId);
}

function getOrderItems(orderId: number): OrderItem[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at').all(orderId) as any[];

  return rows.map((row) => {
    const addons = db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(row.id) as any[];
    return {
      id: row.id,
      orderId: row.order_id,
      menuItemId: row.menu_item_id ?? undefined,
      comboId: row.combo_id ?? undefined,
      variationId: row.variation_id ?? undefined,
      name: row.name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      taxRate: row.tax_rate,
      taxAmount: row.tax_amount,
      total: row.total,
      notes: row.notes ?? undefined,
      kotStatus: row.kot_status as KOTStatus,
      kotNumber: row.kot_number ?? undefined,
      station: row.station ?? undefined,
      createdAt: row.created_at,
      addons: addons.map(mapOrderItemAddon),
    };
  });
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    orderType: row.order_type,
    tableId: row.table_id ?? undefined,
    tableName: row.table_name ?? row.table_name_snapshot ?? undefined,
    customerId: row.customer_id ?? undefined,
    staffId: row.staff_id,
    status: row.status as OrderStatus,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    discountType: row.discount_type ?? undefined,
    discountValue: row.discount_value,
    discountReason: row.discount_reason ?? undefined,
    taxAmount: row.tax_amount,
    roundOff: row.round_off,
    grandTotal: row.grand_total,
    notes: row.notes ?? undefined,
    mergedIntoOrderId: row.merged_into_order_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function mapOrderItemAddon(row: any): OrderItemAddon {
  return {
    id: row.id,
    orderItemId: row.order_item_id,
    addonId: row.addon_id,
    name: row.name,
    price: row.price,
  };
}
