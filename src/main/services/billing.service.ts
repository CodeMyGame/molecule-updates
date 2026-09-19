import * as orderRepo from '../db/repositories/order.repo';
import * as tableRepo from '../db/repositories/table.repo';
import * as inventoryService from './inventory.service';
import { format } from 'date-fns';
import { getDb } from '../db/connection';
import type { CreateOrderDTO, Order, OrderItem, CartItem } from '../../shared/types/order.types';
import { OrderStatus, TableStatus, KOTStatus } from '../../shared/enums';

export function createOrder(data: CreateOrderDTO): Order & { items: OrderItem[] } {
  // Validate items
  if (!data.items || data.items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  // Require an open day session
  const db = getDb();
  const session = db.prepare(
    'SELECT id FROM day_sessions WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1'
  ).get();
  if (!session) {
    throw new Error('No open day session. Please open a day session before creating orders.');
  }

  // Create order
  let order = orderRepo.create(data);

  // Apply discount if provided
  if ((data as any).discount) {
    const disc = (data as any).discount;
    const discType = disc.type === 'percent' ? 'percentage' : disc.type;
    orderRepo.applyDiscount(order.id, discType, disc.value, disc.reason);
    order = orderRepo.getById(order.id)!;
  }

  // Trigger inventory deduction (non-blocking: log errors but do not fail the order)
  try {
    inventoryService.deductForOrder(order.id);
  } catch (err) {
    console.error('Inventory deduction failed for order', order.id, err);
  }

  return orderRepo.getById(order.id)!;
}

export function calculateTotals(
  items: CartItem[],
  discount?: { type: 'percentage' | 'flat'; value: number },
): {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  roundOff: number;
} {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const itemTotal = item.unitPrice * item.quantity;
    const itemTax = Math.round(itemTotal * item.taxRate / 100);
    subtotal += itemTotal;
    taxAmount += itemTax;
  }

  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = Math.round(subtotal * discount.value / 100);
    } else {
      discountAmount = discount.value;
    }
  }

  const total = subtotal - discountAmount + taxAmount;
  const roundOff = Math.round(total / 100) * 100 - total;
  const grandTotal = total + roundOff;

  return { subtotal, taxAmount, discountAmount, grandTotal, roundOff };
}

export function splitBill(
  orderId: number,
  splitItemIds: number[],
  targetTableId?: number,
): Order & { items: OrderItem[] } {
  const db = getDb();

  const splitInTransaction = db.transaction(() => {
    const originalOrder = orderRepo.getById(orderId);
    if (!originalOrder) throw new Error('Order not found');

    // Get items to split
    const itemsToSplit = originalOrder.items.filter((item) =>
      splitItemIds.includes(item.id)
    );

    if (itemsToSplit.length === 0) throw new Error('No items selected for split');

    const newTableId = originalOrder.orderType === 'dine_in'
      ? (targetTableId ?? originalOrder.tableId ?? null)
      : null;

    const targetTableNameSnapshot = newTableId
      ? ((db.prepare('SELECT name FROM tables WHERE id = ?').get(newTableId) as any)?.name ?? null)
      : null;

    const sourceTableName = originalOrder.tableName || (originalOrder.tableId ? `Table #${originalOrder.tableId}` : originalOrder.orderNumber);

    // Create new order with split items (placeholder totals — recalculated below)
    const newOrderNumber = generateOrderNumber();

    const result = db.prepare(`
      INSERT INTO orders (order_number, order_type, table_id, table_name_snapshot, customer_id, staff_id, status, subtotal, tax_amount, grand_total, round_off, notes, split_from_order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?)
    `).run(
      newOrderNumber,
      originalOrder.orderType,
      newTableId,
      targetTableNameSnapshot,
      originalOrder.customerId ?? null,
      originalOrder.staffId,
      OrderStatus.ACTIVE,
      `Split from ${originalOrder.orderNumber}`,
      originalOrder.id,
    );

    const newOrderId = result.lastInsertRowid as number;

    // Move items to new order and preserve/stamp source table name
    const moveItem = db.prepare('UPDATE order_items SET order_id = ?, source_table_name = COALESCE(source_table_name, ?) WHERE id = ?');

    for (const item of itemsToSplit) {
      moveItem.run(newOrderId, sourceTableName, item.id);
    }

    // Update original order notes to track the split
    const splitNote = `Split into ${newOrderNumber}`;
    db.prepare(`
      UPDATE orders
      SET notes = CASE
        WHEN notes IS NULL OR notes = '' THEN ?
        ELSE notes || ' | ' || ?
      END,
      updated_at = datetime('now')
      WHERE id = ?
    `).run(splitNote, splitNote, originalOrder.id);

    // Mark target table as occupied
    if (newTableId && newTableId !== (originalOrder.tableId ?? null)) {
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(newTableId);
    }

    // Recalculate both orders — handles discount, tax, and round-off correctly
    orderRepo.recalculateOrderTotals(newOrderId);
    orderRepo.recalculateOrderTotals(orderId);

    return newOrderId;
  });

  const newOrderId = splitInTransaction();
  return orderRepo.getById(newOrderId)!;
}

export function mergeBills(
  sourceOrderId: number,
  targetOrderId: number,
): Order & { items: OrderItem[] } {
  const db = getDb();

  const mergeInTransaction = db.transaction(() => {
    const source = orderRepo.getById(sourceOrderId);
    const target = orderRepo.getById(targetOrderId);
    if (!source || !target) throw new Error('Order not found');

    const sourceTableName = source.tableName || (source.tableId ? `Table #${source.tableId}` : source.orderNumber);
    const targetTableName = target.tableName || (target.tableId ? `Table #${target.tableId}` : target.orderNumber);

    // Ensure existing target items have their table stamped if not already set
    db.prepare("UPDATE order_items SET source_table_name = ? WHERE order_id = ? AND (source_table_name IS NULL OR source_table_name = '')")
      .run(targetTableName, targetOrderId);

    // Move all items from source to target and preserve/stamp source table name
    db.prepare("UPDATE order_items SET order_id = ?, source_table_name = COALESCE(source_table_name, ?) WHERE order_id = ?")
      .run(targetOrderId, sourceTableName, sourceOrderId);

    // Move all KOTs from source to target
    db.prepare('UPDATE kots SET order_id = ? WHERE order_id = ?').run(targetOrderId, sourceOrderId);

    // Mark source as merged and zero out its financial totals
    const mergeNote = `Merged into ${target.orderNumber}`;
    db.prepare(`
      UPDATE orders
      SET status = ?,
          merged_into_order_id = ?,
          subtotal = 0,
          discount_amount = 0,
          discount_value = 0,
          discount_type = NULL,
          tax_amount = 0,
          grand_total = 0,
          round_off = 0,
          notes = CASE
            WHEN notes IS NULL OR notes = '' THEN ?
            ELSE notes || ' | ' || ?
          END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(OrderStatus.MERGED, targetOrderId, mergeNote, mergeNote, sourceOrderId);

    // Free source table if no other active orders on it
    if (source.tableId) {
      const activeOnTable = db.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status IN (?, ?) AND id != ?"
      ).get(source.tableId, OrderStatus.ACTIVE, OrderStatus.HOLD, sourceOrderId) as any;
      if (activeOnTable.count === 0) {
        db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(source.tableId);
      }
    }

    // Recalculate target totals — handles discount, tax, and round-off correctly
    orderRepo.recalculateOrderTotals(targetOrderId);
  });

  mergeInTransaction();
  return orderRepo.getById(targetOrderId)!;
}

export function moveTable(orderId: number, newTableId: number): Order & { items: OrderItem[] } {
  const db = getDb();

  const moveInTransaction = db.transaction(() => {
    const order = orderRepo.getById(orderId);
    if (!order) throw new Error('Order not found');

    // Verify target table exists and is not occupied by another order
    const targetTable = db.prepare('SELECT id, status FROM tables WHERE id = ?').get(newTableId) as any;
    if (!targetTable) throw new Error('Target table does not exist');
    if (targetTable.status === TableStatus.OCCUPIED) {
      const activeOnTarget = db.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status = ? AND id != ?"
      ).get(newTableId, OrderStatus.ACTIVE, orderId) as any;
      if (activeOnTarget.count > 0) throw new Error('Target table is occupied by another order');
    }

    const oldTableId = order.tableId;

    // Update order table
    db.prepare("UPDATE orders SET table_id = ?, updated_at = datetime('now') WHERE id = ?").run(newTableId, orderId);

    // Update table statuses
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(TableStatus.OCCUPIED, newTableId);

    if (oldTableId) {
      // Only free old table if no other active orders
      const activeOnOld = db.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status = ? AND id != ?"
      ).get(oldTableId, OrderStatus.ACTIVE, orderId) as any;
      if (activeOnOld.count === 0) {
        db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(TableStatus.FREE, oldTableId);
      }
    }
  });

  moveInTransaction();
  return orderRepo.getById(orderId)!;
}

export function generateOrderNumber(): string {
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
