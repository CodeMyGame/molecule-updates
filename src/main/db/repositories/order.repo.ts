import { getDb } from '../connection';
import { format } from 'date-fns';
import { logger } from '../../utils/logger';
import * as settingsRepo from './settings.repo';
import type { Order, OrderItem, OrderItemAddon, CreateOrderDTO, CartItem, OrderKotSummary } from '../../../shared/types/order.types';
import { OrderStatus, KOTStatus, StockTransactionType } from '../../../shared/enums';

function resolveItemTaxRate(itemRate?: number | null): number {
  const raw = settingsRepo.get('default_tax_rate');
  const parsed = raw !== undefined && raw !== null ? parseFloat(String(raw).trim()) : NaN;
  const configuredDefault = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  const rate = typeof itemRate === 'number' && Number.isFinite(itemRate) ? itemRate : 0.0;

  if (configuredDefault !== null) {
    if (configuredDefault === 0 || Math.abs(rate - 0.0) < 1e-6 || Math.abs(rate - 5.0) < 1e-6) {
      return configuredDefault;
    }
  }
  return rate;
}

export function create(data: CreateOrderDTO): Order {
  const db = getDb();

  const insertOrder = db.prepare(`
    INSERT INTO orders (order_number, order_type, table_id, table_name_snapshot, customer_id, staff_id, status, subtotal, discount_amount, discount_type, discount_value, discount_reason, tax_amount, grand_total, round_off, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const getTableName = db.prepare('SELECT name FROM tables WHERE id = ?');

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, combo_id, variation_id, name, quantity, unit_price, tax_rate, tax_amount, total, notes, source_table_name, kot_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      item.taxRate = resolveItemTaxRate(item.taxRate);
      subtotal += item.unitPrice * item.quantity;
    }

    let discountAmount = 0;
    const discount = data.discount;
    const discType = discount ? (discount.type === 'percent' ? 'percentage' : discount.type) : null;
    if (discount) {
      if (discType === 'percentage') {
        discountAmount = Math.round((subtotal * discount.value) / 100);
      } else if (discType === 'flat') {
        discountAmount = Math.min(discount.value, subtotal);
      }
    }

    // Tax is calculated on post-discount amounts (proportional reduction per item)
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
    for (const item of data.items) {
      const itemTotal = item.unitPrice * item.quantity;
      const discountedItemTotal = Math.round(itemTotal * (1 - discountRatio));
      taxAmount += Math.round((discountedItemTotal * item.taxRate) / 100);
    }

    const grandTotal = subtotal - discountAmount + taxAmount;
    const roundOff = Math.round(grandTotal / 100) * 100 - grandTotal;

    const isDineIn = data.orderType === 'dine_in';
    let effectiveTableId: number | null = null;
    let tableNameSnapshot: string | null = null;
    if (isDineIn && data.tableId && Number(data.tableId) > 0) {
      const tbl = getTableName.get(data.tableId) as { name?: string } | undefined;
      if (tbl) {
        effectiveTableId = Number(data.tableId);
        tableNameSnapshot = tbl.name ?? null;
      }
    }

    let effectiveCustomerId: number | null = null;
    if (data.customerId && Number(data.customerId) > 0) {
      const cust = db.prepare('SELECT id FROM customers WHERE id = ?').get(data.customerId) as any;
      if (cust) effectiveCustomerId = Number(data.customerId);
    }

    let effectiveStaffId = data.staffId;
    const staffRow = db.prepare('SELECT id FROM staff WHERE id = ?').get(effectiveStaffId);
    if (!staffRow) {
      const fallbackStaff = db.prepare('SELECT id FROM staff ORDER BY id ASC LIMIT 1').get() as any;
      if (fallbackStaff) effectiveStaffId = fallbackStaff.id;
    }

    const result = insertOrder.run(
      orderNumber,
      data.orderType,
      effectiveTableId,
      tableNameSnapshot,
      effectiveCustomerId,
      effectiveStaffId,
      OrderStatus.ACTIVE,
      subtotal,
      discountAmount,
      discType ?? null,
      discount?.value ?? 0,
      discount?.reason ?? null,
      taxAmount,
      grandTotal + roundOff,
      roundOff,
      data.notes ?? null,
    );

    const orderId = result.lastInsertRowid as number;

    for (const item of data.items) {
      const itemTotal = item.unitPrice * item.quantity;
      const discountedItemTotal = Math.round(itemTotal * (1 - discountRatio));
      const itemTax = Math.round((discountedItemTotal * item.taxRate) / 100);

      let effectiveMenuItemId: number | null = null;
      if (item.menuItemId && Number(item.menuItemId) > 0) {
        const mRow = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(item.menuItemId);
        if (mRow) effectiveMenuItemId = Number(item.menuItemId);
      }

      let effectiveComboId: number | null = null;
      if (item.comboId && Number(item.comboId) > 0) {
        const cRow = db.prepare('SELECT id FROM combos WHERE id = ?').get(item.comboId);
        if (cRow) effectiveComboId = Number(item.comboId);
      }

      let effectiveVariationId: number | null = null;
      if (item.variationId && Number(item.variationId) > 0) {
        const vRow = db.prepare('SELECT id FROM item_variations WHERE id = ?').get(item.variationId);
        if (vRow) effectiveVariationId = Number(item.variationId);
      }

      const itemResult = insertOrderItem.run(
        orderId,
        effectiveMenuItemId,
        effectiveComboId,
        effectiveVariationId,
        item.name,
        item.quantity,
        item.unitPrice,
        item.taxRate,
        itemTax,
        itemTotal + itemTax,
        item.notes ?? null,
        item.sourceTableName ?? tableNameSnapshot ?? null,
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
    if (isDineIn && effectiveTableId) {
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(effectiveTableId);
    }

    return orderId;
  });

  const orderId = createInTransaction();
  return getById(orderId)!;
}

export function getOutboundTransfersForOrder(
  orderId: number,
  tableNameSnapshot?: string | null,
  tableId?: number | null,
  notes?: string | null
): { targetTableName: string; items: { name: string; quantity: number }[] }[] {
  const db = getDb();
  let currentTableName = tableNameSnapshot;
  if (!currentTableName && tableId) {
    const tRow = db.prepare('SELECT name FROM tables WHERE id = ?').get(tableId) as any;
    if (tRow) currentTableName = tRow.name;
  }

  // Check if THIS specific order actually transferred anything:
  // 1) Either its notes record an outbound transfer (e.g. "Transferred to T2", "Split into...")
  // 2) Or another active order has split_from_order_id = this orderId
  const hasOutboundInNotes = Boolean(
    notes &&
    notes.split('|').some((n) => {
      const trimmed = n.trim();
      return !/\bfrom\b/i.test(trimmed) &&
        /(?:transferred(?:\s+partial\s+items)?\s+(?:to|into)|merged(?:\s+partial\s+items)?\s+(?:to|into)|split into)/i.test(trimmed);
    })
  );

  let splitChildCount = 0;
  try {
    const row = db.prepare(
      "SELECT COUNT(*) as count FROM orders WHERE split_from_order_id = ? AND status IN ('active', 'hold')"
    ).get(orderId) as any;
    splitChildCount = row?.count ?? 0;
  } catch {
    // ignore
  }

  // If this order has no outbound notes and no split child orders, it has no outbound transfers!
  if (!hasOutboundInNotes && splitChildCount === 0) {
    return [];
  }

  const outboundMap = new Map<string, { targetTableName: string; items: { name: string; quantity: number }[] }>();

  const addItemToMap = (dest: string, itemName: string, qty: number) => {
    const cleanTbl = dest.trim();
    const cleanItem = itemName.trim();
    if (!cleanTbl || !cleanItem || qty <= 0) return;
    if (currentTableName && cleanTbl.toLowerCase() === currentTableName.toLowerCase()) return;

    if (!outboundMap.has(cleanTbl)) {
      outboundMap.set(cleanTbl, { targetTableName: cleanTbl, items: [] });
    }
    const entry = outboundMap.get(cleanTbl)!;
    const existing = entry.items.find(
      (it) => it.name.trim().toLowerCase() === cleanItem.toLowerCase()
    );
    if (existing) {
      existing.quantity = Math.max(existing.quantity, qty);
    } else {
      entry.items.push({ name: cleanItem, quantity: qty });
    }
  };

  // 1. Look up items on active/hold orders that were split from THIS specific order
  if (splitChildCount > 0) {
    try {
      const q = `
        SELECT oi.name, oi.quantity, COALESCE(t.name, o.table_name_snapshot, o.order_number) AS dest_table
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE o.split_from_order_id = ? AND o.status IN ('active', 'hold')
      `;
      const rows = db.prepare(q).all(orderId) as any[];
      for (const row of rows) {
        let dest = row.dest_table || 'Other';
        if (dest.startsWith('ORD-')) {
          const tRow = db.prepare('SELECT t.name FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.order_number = ?').get(dest) as any;
          if (tRow && tRow.name) dest = tRow.name;
        }
        addItemToMap(dest, row.name, row.quantity);
      }
    } catch {
      // Non-fatal
    }
  }

  // 2. Also inspect notes on this specific order
  if (notes) {
    for (const n of notes.split('|')) {
      const trimmed = n.trim();
      if (/\bfrom\b/i.test(trimmed)) continue;
      const m = trimmed.match(/(?:transferred(?:\s+partial\s+items)?\s+(?:to|into)|merged(?:\s+partial\s+items)?\s+(?:to|into)|split into)\s+([^:,|]+)(?::\s*([^|]+))?/i);
      if (m && m[1]) {
        let dest = m[1].trim();
        if (dest.startsWith('ORD-')) {
          try {
            const tRow = db.prepare('SELECT t.name FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.order_number = ?').get(dest) as any;
            if (tRow && tRow.name) dest = tRow.name;
          } catch { /* ignore */ }
        }
        if (dest && (!currentTableName || dest.toLowerCase() !== currentTableName.toLowerCase())) {
          if (m[2]) {
            for (const part of m[2].split(',')) {
              const p = part.trim();
              if (p) {
                const qm = p.match(/(.+?)\s*[xX×]\s*(\d+)/) || p.match(/(\d+)\s*[xX×]\s*(.+)/);
                if (qm) {
                  const qty = /^\d+$/.test(qm[1]) ? parseInt(qm[1], 10) : parseInt(qm[2], 10);
                  const name = /^\d+$/.test(qm[1]) ? qm[2].trim() : qm[1].trim();
                  addItemToMap(dest, name, qty);
                } else {
                  addItemToMap(dest, p, 1);
                }
              }
            }
          } else {
            // Table recorded without items
            if (!outboundMap.has(dest)) {
              outboundMap.set(dest, { targetTableName: dest, items: [] });
            }
          }
        }
      }
    }
  }

  return Array.from(outboundMap.values());
}

export function getById(id: number): (Order & { items: OrderItem[]; kots: OrderKotSummary[] }) | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT o.*,
      mo.order_number AS merged_into_order_number,
      sfo.order_number AS split_from_order_number
    FROM orders o
    LEFT JOIN orders mo ON o.merged_into_order_id = mo.id
    LEFT JOIN orders sfo ON o.split_from_order_id = sfo.id
    WHERE o.id = ?
  `).get(id) as any;
  if (!row) return undefined;

  const order = mapOrder(row);
  const items = getOrderItems(id);
  const kots = getOrderKots(id);
  const outboundTransfers = getOutboundTransfersForOrder(order.id, order.tableName || row.table_name_snapshot, order.tableId, order.notes);

  return { ...order, items, kots, outboundTransfers };
}

export function getActive(): (Order & { items: OrderItem[]; kots: OrderKotSummary[] })[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM orders WHERE status IN (?, ?) ORDER BY created_at DESC").all(OrderStatus.ACTIVE, OrderStatus.HOLD) as any[];
  if (rows.length === 0) return [];

  const orderIds = rows.map((r) => r.id);
  const orderPlaceholders = orderIds.map(() => '?').join(',');

  // 1. Fetch all items for all active orders in 1 batched query
  const itemRows = db.prepare(
    `SELECT * FROM order_items WHERE order_id IN (${orderPlaceholders}) ORDER BY id ASC`
  ).all(...orderIds) as any[];

  // 2. Fetch all addons for all retrieved order items in 1 batched query
  const addonsByItemId = new Map<number, OrderItemAddon[]>();
  if (itemRows.length > 0) {
    const itemIds = itemRows.map((r) => r.id);
    const itemPlaceholders = itemIds.map(() => '?').join(',');
    const addonRows = db.prepare(
      `SELECT * FROM order_item_addons WHERE order_item_id IN (${itemPlaceholders})`
    ).all(...itemIds) as any[];

    for (const addon of addonRows) {
      const list = addonsByItemId.get(addon.order_item_id);
      const mapped = mapOrderItemAddon(addon);
      if (list) {
        list.push(mapped);
      } else {
        addonsByItemId.set(addon.order_item_id, [mapped]);
      }
    }
  }

  // Group items by order_id
  const itemsByOrderId = new Map<number, OrderItem[]>();
  for (const row of itemRows) {
    const item: OrderItem = {
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
      sourceTableName: row.source_table_name ?? undefined,
      kotStatus: row.kot_status as KOTStatus,
      kotNumber: row.kot_number ?? undefined,
      station: row.station ?? undefined,
      createdAt: row.created_at,
      addons: addonsByItemId.get(row.id) ?? [],
    };
    const list = itemsByOrderId.get(row.order_id);
    if (list) {
      list.push(item);
    } else {
      itemsByOrderId.set(row.order_id, [item]);
    }
  }

  // 3. Fetch all KOT summaries for all active orders in 1 batched query
  const kotRows = db.prepare(`
    SELECT id, kot_number, station, status, printed_at, created_at, order_id
    FROM kots
    WHERE order_id IN (${orderPlaceholders})
    ORDER BY id ASC
  `).all(...orderIds) as any[];

  const kotsByOrderId = new Map<number, OrderKotSummary[]>();
  for (const r of kotRows) {
    const kot: OrderKotSummary = {
      id: r.id,
      kotNumber: r.kot_number,
      station: r.station ?? undefined,
      status: r.status,
      printedAt: r.printed_at,
      createdAt: r.created_at ?? r.printed_at,
    };
    const list = kotsByOrderId.get(r.order_id);
    if (list) {
      list.push(kot);
    } else {
      kotsByOrderId.set(r.order_id, [kot]);
    }
  }

  // 4. Assemble orders
  return rows.map((row) => {
    const order = mapOrder(row);
    const items = itemsByOrderId.get(order.id) ?? [];
    const kots = kotsByOrderId.get(order.id) ?? [];
    return { ...order, items, kots };
  });
}

export function getByTable(tableId: number): (Order & { items: OrderItem[]; kots: OrderKotSummary[] }) | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT o.*,
      mo.order_number AS merged_into_order_number,
      sfo.order_number AS split_from_order_number
    FROM orders o
    LEFT JOIN orders mo ON o.merged_into_order_id = mo.id
    LEFT JOIN orders sfo ON o.split_from_order_id = sfo.id
    WHERE o.table_id = ? AND o.status IN ('active', 'hold')
    ORDER BY CASE WHEN o.status = 'active' THEN 0 ELSE 1 END, o.created_at DESC LIMIT 1
  `).get(tableId) as any;
  if (!row) return undefined;
  const order = mapOrder(row);
  const items = getOrderItems(order.id);
  const kots = getOrderKots(order.id);
  const outboundTransfers = getOutboundTransfersForOrder(order.id, order.tableName || row.table_name_snapshot, order.tableId, order.notes);
  return { ...order, items, kots, outboundTransfers };
}

export function getAll(filters?: {
  startDate?: string;
  endDate?: string;
  status?: OrderStatus;
  orderType?: string;
  limit?: number;
  offset?: number;
  dateField?: 'created_at' | 'updated_at';
}): Order[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  const dateCol = filters?.dateField === 'updated_at' ? 'COALESCE(o.updated_at, o.created_at)' : 'o.created_at';

  if (filters?.startDate) {
    conditions.push(`${dateCol} >= ?`);
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push(`${dateCol} <= ?`);
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
      mo.order_number AS merged_into_order_number,
      sfo.order_number AS split_from_order_number,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
      (SELECT GROUP_CONCAT(oi2.name, ', ') FROM order_items oi2 WHERE oi2.order_id = o.id LIMIT 5) AS item_names,
      COALESCE((SELECT SUM(ABS(lt.points)) * 100 FROM loyalty_transactions lt WHERE lt.order_id = o.id AND lt.points < 0), 0) AS coins_redeemed
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    LEFT JOIN staff s ON o.staff_id = s.id
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN orders mo ON o.merged_into_order_id = mo.id
    LEFT JOIN orders sfo ON o.split_from_order_id = sfo.id
    ${where}
    ORDER BY ${dateCol} DESC
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

export function updateStatus(
  id: number,
  status: OrderStatus,
  reason?: string,
  staffId?: number
): Order | undefined {
  const db = getDb();

  const updateStatusAtomic = db.transaction(() => {
    const updates: string[] = ["status = ?", "updated_at = datetime('now')"];
    const params: unknown[] = [status];

    if (status === OrderStatus.COMPLETED) {
      updates.push("completed_at = datetime('now')");
    }

    if (status === OrderStatus.CANCELLED) {
      if (reason) {
        updates.push("cancellation_reason = ?");
        params.push(reason);
      }
    }

    params.push(id);
    db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // When order is cancelled, log all its items to void_items audit log and rollback stock/loyalty
    if (status === OrderStatus.CANCELLED) {
      try {
        const order = db.prepare(`
          SELECT o.*, t.name as table_name, s.name as staff_name
          FROM orders o
          LEFT JOIN tables t ON t.id = o.table_id
          LEFT JOIN staff s ON s.id = ?
          WHERE o.id = ?
        `).get(staffId ?? null, id) as any;

        if (order) {
          const tableName = order.table_name_snapshot || order.table_name || 'Counter';
          const voidReason = reason || 'Order Cancelled';
          const items = db.prepare(`
            SELECT oi.*, v.name as variation_name
            FROM order_items oi
            LEFT JOIN item_variations v ON v.id = oi.variation_id
            WHERE oi.order_id = ?
          `).all(id) as any[];

          for (const item of items) {
            db.prepare(`
              INSERT INTO void_items (
                order_id, order_number, table_name, menu_item_id, item_name,
                variation_name, quantity, unit_price, total_amount, reason,
                staff_id, staff_name, voided_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).run(
              order.id,
              order.order_number,
              tableName,
              item.menu_item_id,
              item.name,
              item.variation_name ?? null,
              item.quantity,
              item.unit_price,
              item.total,
              voidReason,
              staffId ?? order.staff_id ?? null,
              order.staff_name ?? null
            );

            // Restock inventory for each cancelled item if it was previously deducted
            try {
              const deductedTxns = db.prepare(`
                SELECT inventory_item_id, quantity
                FROM stock_transactions
                WHERE reference_type = 'order_item' AND reference_id = ? AND transaction_type = 'consumption'
              `).all(item.id) as { inventory_item_id: number; quantity: number }[];

              for (const txn of deductedTxns) {
                db.prepare(`
                  UPDATE inventory_items
                  SET current_stock = current_stock + ?, updated_at = datetime('now')
                  WHERE id = ?
                `).run(txn.quantity, txn.inventory_item_id);

                db.prepare(`
                  INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
                  VALUES (?, ?, ?, 'order_item', ?, ?)
                `).run(
                  txn.inventory_item_id,
                  StockTransactionType.ADJUSTMENT,
                  txn.quantity,
                  item.id,
                  `Restocked from cancelled order #${id} (${voidReason})`,
                );
              }
            } catch (restockErr) {
              logger.error('Failed to restock cancelled order item:', restockErr, { orderItemId: item.id });
            }
          }

          // Rollback customer visit and loyalty points if this order was completed/had loyalty transactions
          if (order.customer_id) {
            try {
              const loyaltyTxns = db.prepare(`
                SELECT points FROM loyalty_transactions WHERE order_id = ?
              `).all(id) as { points: number }[];

              let netPoints = 0;
              for (const txn of loyaltyTxns) {
                netPoints += txn.points;
              }

              if (netPoints !== 0) {
                // If net points were deducted (e.g. netPoints = -30 redeemed), restore them (+30).
                // If net points were earned (e.g. netPoints = +15 earned), reverse them (-15).
                db.prepare(`
                  UPDATE customers
                  SET loyalty_points = MAX(0, loyalty_points - ?), updated_at = datetime('now')
                  WHERE id = ?
                `).run(netPoints, order.customer_id);

                db.prepare(`
                  INSERT INTO loyalty_transactions (customer_id, order_id, points, description)
                  VALUES (?, ?, ?, ?)
                `).run(
                  order.customer_id,
                  id,
                  -netPoints,
                  netPoints < 0
                    ? `Restored ${Math.abs(netPoints)} redeemed coins from cancelled order #${id}`
                    : `Reversed ${netPoints} earned coins from cancelled order #${id}`
                );
              }

              // Rollback customer visit & spend if the order was previously completed
              if (order.completed_at) {
                const redeemTxn = loyaltyTxns.find((t) => t.points < 0);
                const coinDiscount = redeemTxn ? Math.abs(redeemTxn.points) * 100 : 0;
                const spendToDeduct = Math.max(0, order.grand_total - coinDiscount);

                db.prepare(`
                  UPDATE customers
                  SET total_spent = MAX(0, total_spent - ?),
                      total_visits = MAX(0, total_visits - 1),
                      updated_at = datetime('now')
                  WHERE id = ?
                `).run(spendToDeduct, order.customer_id);
              }
            } catch (custErr) {
              logger.error('Failed to rollback customer loyalty/visit on cancellation:', custErr, { orderId: id });
            }
          }
        }
      } catch (err) {
        logger.error('Failed to log void items for cancelled order:', err, { orderId: id });
      }
    }

    // Free up table and clear KOTs if order completed or cancelled
    if (status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED) {
      const order = db.prepare('SELECT table_id FROM orders WHERE id = ?').get(id) as any;
      if (order?.table_id) {
        // Only free if no other active orders on the table
        const activeOnTable = db.prepare(
          "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status IN (?, ?) AND id != ?"
        ).get(order.table_id, OrderStatus.ACTIVE, OrderStatus.HOLD, id) as any;
        if (activeOnTable.count === 0) {
          db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(order.table_id);
        }
      }

      const targetKotStatus = status === OrderStatus.CANCELLED ? 'cancelled' : 'served';

      // Mark all active KOTs for this order as cancelled or served
      db.prepare(`
        UPDATE kots SET status = ?
        WHERE order_id = ? AND status IN ('pending', 'sent', 'preparing', 'ready')
      `).run(targetKotStatus, id);

      // Also update order_items kot_status
      db.prepare(`
        UPDATE order_items SET kot_status = ?
        WHERE order_id = ? AND kot_status != 'served'
      `).run(targetKotStatus, id);
    }
  });

  updateStatusAtomic();
  return getById(id);
}

export function addItems(orderId: number, items: CartItem[]): Order | undefined {
  const db = getDb();

  const existingOrder = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId) as any;
  if (!existingOrder) {
    throw new Error(`Order #${orderId} not found`);
  }
  if (existingOrder.status !== OrderStatus.ACTIVE && existingOrder.status !== OrderStatus.HOLD) {
    throw new Error(`Cannot add items to order #${orderId} because its status is '${existingOrder.status}'`);
  }

  if (!items || items.length === 0) {
    return getById(orderId);
  }

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, combo_id, variation_id, name, quantity, unit_price, tax_rate, tax_amount, total, notes, source_table_name, kot_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  const getOrderTable = db.prepare(`
    SELECT o.status, o.table_name_snapshot, t.name as current_table_name
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.id = ?
  `);

  const addInTransaction = db.transaction(() => {
    let additionalSubtotal = 0;
    let additionalTax = 0;

    const orderInfo = getOrderTable.get(orderId) as any;
    if (!orderInfo || (orderInfo.status !== OrderStatus.ACTIVE && orderInfo.status !== OrderStatus.HOLD)) {
      throw new Error(`Cannot add items to order #${orderId} because its status is '${orderInfo?.status}'`);
    }

    if (orderInfo.status === OrderStatus.HOLD) {
      db.prepare("UPDATE orders SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(orderId);
    }
    const tableSnapshot = orderInfo?.current_table_name || orderInfo?.table_name_snapshot || null;

    for (const item of items) {
      item.taxRate = resolveItemTaxRate(item.taxRate);
      const itemTotal = item.unitPrice * item.quantity;
      const itemTax = Math.round(itemTotal * item.taxRate / 100);
      additionalSubtotal += itemTotal;
      additionalTax += itemTax;

      let effectiveMenuItemId: number | null = null;
      if (item.menuItemId && Number(item.menuItemId) > 0) {
        const mRow = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(item.menuItemId);
        if (mRow) effectiveMenuItemId = Number(item.menuItemId);
      }

      let effectiveComboId: number | null = null;
      if (item.comboId && Number(item.comboId) > 0) {
        const cRow = db.prepare('SELECT id FROM combos WHERE id = ?').get(item.comboId);
        if (cRow) effectiveComboId = Number(item.comboId);
      }

      let effectiveVariationId: number | null = null;
      if (item.variationId && Number(item.variationId) > 0) {
        const vRow = db.prepare('SELECT id FROM item_variations WHERE id = ?').get(item.variationId);
        if (vRow) effectiveVariationId = Number(item.variationId);
      }

      const result = insertOrderItem.run(
        orderId,
        effectiveMenuItemId,
        effectiveComboId,
        effectiveVariationId,
        item.name,
        item.quantity,
        item.unitPrice,
        item.taxRate,
        itemTax,
        itemTotal + itemTax,
        item.notes ?? null,
        item.sourceTableName ?? tableSnapshot,
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

export function removeItem(
  orderItemId: number,
  reason?: string,
  staffId?: number
): void {
  const db = getDb();

  const removeInTransaction = db.transaction(() => {
    const item = db.prepare(`
      SELECT oi.*, o.order_number, o.table_name_snapshot, o.staff_id as order_staff_id, o.status as order_status,
             t.name as table_name, s.name as staff_name, v.name as variation_name
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN tables t ON t.id = o.table_id
      LEFT JOIN staff s ON s.id = ?
      LEFT JOIN item_variations v ON v.id = oi.variation_id
      WHERE oi.id = ?
    `).get(staffId ?? null, orderItemId) as any;

    if (!item) return;

    if (item.order_status !== OrderStatus.ACTIVE && item.order_status !== OrderStatus.HOLD) {
      throw new Error(`Cannot remove item #${orderItemId} from order #${item.order_id} because order is ${item.order_status}`);
    }

    // Log to void_items audit
    try {
      const tableName = item.table_name_snapshot || item.table_name || 'Counter';
      const voidReason = reason || 'Item Removed / Cancelled';
      db.prepare(`
        INSERT INTO void_items (
          order_id, order_number, table_name, menu_item_id, item_name,
          variation_name, quantity, unit_price, total_amount, reason,
          staff_id, staff_name, voided_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        item.order_id,
        item.order_number,
        tableName,
        item.menu_item_id,
        item.name,
        item.variation_name ?? null,
        item.quantity,
        item.unit_price,
        item.total,
        voidReason,
        staffId ?? item.order_staff_id ?? null,
        item.staff_name ?? null
      );
    } catch (err) {
      logger.error('Failed to log void item on removeItem:', err, { orderId: item.order_id, orderItemId });
    }

    // Restock any inventory that was auto-deducted for this item
    try {
      const deductedTxns = db.prepare(`
        SELECT inventory_item_id, quantity
        FROM stock_transactions
        WHERE reference_type = 'order_item' AND reference_id = ? AND transaction_type = 'consumption'
      `).all(orderItemId) as { inventory_item_id: number; quantity: number }[];

      for (const txn of deductedTxns) {
        db.prepare(`
          UPDATE inventory_items
          SET current_stock = current_stock + ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(txn.quantity, txn.inventory_item_id);

        db.prepare(`
          INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
          VALUES (?, ?, ?, 'order_item', ?, ?)
        `).run(
          txn.inventory_item_id,
          StockTransactionType.ADJUSTMENT,
          txn.quantity,
          orderItemId,
          `Restocked from voided item #${orderItemId} (${reason || 'Item Removed'})`,
        );
      }
    } catch (err) {
      logger.error('Failed to restock inventory on removeItem:', err, { orderItemId });
    }

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
    const order = db.prepare('SELECT subtotal, status FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return;
    if (order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.HOLD) {
      logger.warn(`Ignored discount update for order #${orderId} because status is '${order.status}'`);
      return;
    }

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
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return;
    if (order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.HOLD) {
      logger.warn(`Ignored clear discount on order #${orderId} because its status is '${order.status}'`);
      return;
    }
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

    // Unlink any orders referencing this order (splits / merges) to satisfy foreign key constraints
    db.prepare('UPDATE orders SET split_from_order_id = NULL WHERE split_from_order_id = ?').run(orderId);
    db.prepare('UPDATE orders SET merged_into_order_id = NULL WHERE merged_into_order_id = ?').run(orderId);

    // Delete loyalty transactions referencing this order
    db.prepare('DELETE FROM loyalty_transactions WHERE order_id = ?').run(orderId);

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

export function deleteOrders(orderIds: number[]): void {
  if (orderIds.length === 0) return;
  const db = getDb();
  const tx = db.transaction(() => {
    for (const id of orderIds) {
      deleteOrder(id);
    }
  });
  tx();
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

export function generateOrderNumber(): string {
  const db = getDb();
  const today = format(new Date(), 'yyyyMMdd');
  const customPrefix = (settingsRepo.get('order_prefix') || '').trim();
  const cleanPrefix = customPrefix ? (customPrefix.endsWith('-') ? customPrefix : `${customPrefix}-`) : 'ORD-';
  const prefix = `${cleanPrefix}${today}-`;

  const last = db.prepare(
    "SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`) as any;

  let seq = 1;
  if (last && last.order_number) {
    const match = last.order_number.slice(prefix.length).match(/^(\d+)/);
    if (match) {
      const lastSeq = parseInt(match[1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }
  }

  return `${prefix}${seq.toString().padStart(3, '0')}`;
}

export function recalculateOrderTotals(orderId: number): void {
  const db = getDb();
  const items = db.prepare('SELECT id, unit_price, quantity, tax_rate FROM order_items WHERE order_id = ?').all(orderId) as any[];

  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unit_price * item.quantity;
  }

  const order = db.prepare('SELECT discount_type, discount_value FROM orders WHERE id = ?').get(orderId) as any;
  let discountAmount = 0;
  if (order?.discount_type === 'percentage') {
    discountAmount = Math.round((subtotal * order.discount_value) / 100);
  } else if (order?.discount_type === 'flat') {
    discountAmount = Math.min(order.discount_value || 0, subtotal);
  }

  // Tax is calculated on post-discount amounts (proportional reduction per item)
  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  let taxAmount = 0;
  const updateOrderItemTax = db.prepare('UPDATE order_items SET tax_amount = ?, total = ? WHERE id = ?');

  for (const item of items) {
    const itemTotal = item.unit_price * item.quantity;
    const discountedItemTotal = Math.round(itemTotal * (1 - discountRatio));
    const itemTax = Math.round((discountedItemTotal * item.tax_rate) / 100);
    taxAmount += itemTax;
    updateOrderItemTax.run(itemTax, itemTotal + itemTax, item.id);
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
  const rows = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(orderId) as any[];
  if (rows.length === 0) return [];

  const itemIds = rows.map((r) => r.id);
  const placeholders = itemIds.map(() => '?').join(',');
  const addonsRows = db.prepare(`SELECT * FROM order_item_addons WHERE order_item_id IN (${placeholders})`).all(...itemIds) as any[];

  const addonsByItemId = new Map<number, OrderItemAddon[]>();
  for (const addon of addonsRows) {
    const list = addonsByItemId.get(addon.order_item_id);
    const mapped = mapOrderItemAddon(addon);
    if (list) {
      list.push(mapped);
    } else {
      addonsByItemId.set(addon.order_item_id, [mapped]);
    }
  }

  return rows.map((row) => ({
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
    sourceTableName: row.source_table_name ?? undefined,
    kotStatus: row.kot_status as KOTStatus,
    kotNumber: row.kot_number ?? undefined,
    station: row.station ?? undefined,
    createdAt: row.created_at,
    addons: addonsByItemId.get(row.id) ?? [],
  }));
}

function getOrderKots(orderId: number): OrderKotSummary[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, kot_number, station, status, printed_at, created_at
    FROM kots
    WHERE order_id = ?
    ORDER BY id ASC
  `).all(orderId) as any[];

  return rows.map((r) => ({
    id: r.id,
    kotNumber: r.kot_number,
    station: r.station ?? undefined,
    status: r.status,
    printedAt: r.printed_at,
    createdAt: r.created_at ?? r.printed_at,
  }));
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
    mergedIntoOrderNumber: row.merged_into_order_number ?? undefined,
    splitFromOrderId: row.split_from_order_id ?? undefined,
    splitFromOrderNumber: row.split_from_order_number ?? undefined,
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
