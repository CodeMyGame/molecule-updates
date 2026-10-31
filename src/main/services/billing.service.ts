import * as orderRepo from '../db/repositories/order.repo';

import * as tableRepo from '../db/repositories/table.repo';

import * as inventoryService from './inventory.service';

import { format } from 'date-fns';

import { getDb } from '../db/connection';

import { logger } from '../utils/logger';

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

    logger.error('Inventory deduction failed for order:', err, { orderId: order.id });

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



    const itemSummary = itemsToSplit.map((i) => `${i.name} x${i.quantity}`).join(', ');



    // Update notes to track transfer with table name & item details

    const destTableName = targetTableNameSnapshot || (newTableId ? `Table #${newTableId}` : newOrderNumber);

    const splitNote = itemSummary ? `Split into ${destTableName}: ${itemSummary}` : `Split into ${destTableName}`;

    db.prepare(`

      UPDATE orders

      SET notes = CASE

        WHEN notes IS NULL OR notes = '' THEN ?

        ELSE notes || ' | ' || ?

      END,

      updated_at = datetime('now')

      WHERE id = ?

    `).run(splitNote, splitNote, originalOrder.id);



    // Also record on destination order

    const inboundNote = itemSummary ? `Split from ${sourceTableName}: ${itemSummary}` : `Split from ${sourceTableName}`;

    db.prepare("UPDATE orders SET notes = ? WHERE id = ?").run(inboundNote, newOrderId);



    // Mark target table as occupied

    if (newTableId && newTableId !== (originalOrder.tableId ?? null)) {

      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(newTableId);

    }



    // Check source order remaining items
    const remainingCount = (db.prepare('SELECT COUNT(*) as c FROM order_items WHERE order_id = ?').get(orderId) as any).c;
    if (remainingCount === 0) {
      const transferNote = `Transferred into ${destTableName}`;
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
            notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(OrderStatus.MERGED, newOrderId, transferNote, transferNote, originalOrder.id);

      if (originalOrder.tableId) {
        const activeOnSource = (db.prepare(
          "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status IN (?, ?) AND id != ?"
        ).get(originalOrder.tableId, OrderStatus.ACTIVE, OrderStatus.HOLD, originalOrder.id) as any).count;
        if (activeOnSource === 0) {
          db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(originalOrder.tableId);
        }
      }
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

    // Also record inbound merge note on target order
    const inboundNote = `Merged from ${sourceTableName} (${source.orderNumber})`;
    db.prepare(`
      UPDATE orders
      SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(inboundNote, inboundNote, targetOrderId);



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



export interface SplitOrTransferItemInput {

  orderItemId: number;

  quantity: number;

}



function moveOrSplitOrderItem(

  db: any,

  itemRow: any,

  requestedQty: number,

  targetOrderId: number,

  sourceTableName: string

) {

  if (requestedQty >= itemRow.quantity) {

    // Move full row

    db.prepare(`

      UPDATE order_items

      SET order_id = ?,

          source_table_name = COALESCE(source_table_name, ?)

      WHERE id = ?

    `).run(targetOrderId, sourceTableName, itemRow.id);

  } else {

    // Split row: update source row with remaining quantity

    const remQty = itemRow.quantity - requestedQty;

    const remTotal = itemRow.unit_price * remQty;

    const remTax = Math.round((remTotal * itemRow.tax_rate) / 100);

    db.prepare(`

      UPDATE order_items

      SET quantity = ?, total = ?, tax_amount = ?

      WHERE id = ?

    `).run(remQty, remTotal, remTax, itemRow.id);



    // Insert new row for target order

    const splitTotal = itemRow.unit_price * requestedQty;

    const splitTax = Math.round((splitTotal * itemRow.tax_rate) / 100);

    const insertResult = db.prepare(`

      INSERT INTO order_items (

        order_id, menu_item_id, combo_id, variation_id, name,

        quantity, unit_price, tax_rate, tax_amount, total,

        notes, kot_status, kot_number, station, source_table_name

      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

    `).run(

      targetOrderId,

      itemRow.menu_item_id,

      itemRow.combo_id,

      itemRow.variation_id,

      itemRow.name,

      requestedQty,

      itemRow.unit_price,

      itemRow.tax_rate,

      splitTax,

      splitTotal,

      itemRow.notes,

      itemRow.kot_status,

      itemRow.kot_number,

      itemRow.station,

      itemRow.source_table_name || sourceTableName

    );

    const newOrderItemId = insertResult.lastInsertRowid as number;



    // Copy addons to new order item if any

    const addons = db.prepare('SELECT addon_id, name, price FROM order_item_addons WHERE order_item_id = ?').all(itemRow.id) as any[];

    if (addons.length > 0) {

      const insertAddon = db.prepare('INSERT INTO order_item_addons (order_item_id, addon_id, name, price) VALUES (?, ?, ?, ?)');

      for (const add of addons) {

        insertAddon.run(newOrderItemId, add.addon_id, add.name, add.price);

      }

    }

  }

}



function mergeBillsPartialInTx(

  db: any,

  sourceOrder: Order & { items: OrderItem[] },

  targetOrderId: number,

  items: SplitOrTransferItemInput[]

): number {

  const targetOrder = orderRepo.getById(targetOrderId);

  if (!targetOrder) throw new Error('Target order not found');



  const sourceTableName = sourceOrder.tableName || (sourceOrder.tableId ? `Table #${sourceOrder.tableId}` : sourceOrder.orderNumber);

  const targetTableName = targetOrder.tableName || (targetOrder.tableId ? `Table #${targetOrder.tableId}` : targetOrder.orderNumber);



  // Ensure target existing items have their source_table_name stamped

  db.prepare("UPDATE order_items SET source_table_name = ? WHERE order_id = ? AND (source_table_name IS NULL OR source_table_name = '')")

    .run(targetTableName, targetOrderId);



  // Move or split requested items

  const movedItemSummaries: string[] = [];

  for (const itemInput of items) {

    if (itemInput.quantity <= 0) continue;

    const itemRow = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(itemInput.orderItemId, sourceOrder.id) as any;

    if (!itemRow) continue;

    const moveQty = Math.min(itemInput.quantity, itemRow.quantity);

    if (moveQty <= 0) continue;

    moveOrSplitOrderItem(db, itemRow, moveQty, targetOrderId, sourceTableName);

    movedItemSummaries.push(`${itemRow.name} x${moveQty}`);

  }

  const itemSummary = movedItemSummaries.join(', ');



  // Recalculate target order totals

  orderRepo.recalculateOrderTotals(targetOrderId);



  // Check source order remaining items

  const remainingCount = (db.prepare('SELECT COUNT(*) as c FROM order_items WHERE order_id = ?').get(sourceOrder.id) as any).c;

  if (remainingCount === 0) {

    const mergeNote = `Merged into ${targetOrder.orderNumber}`;

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

          notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,

          updated_at = datetime('now')

      WHERE id = ?

    `).run(OrderStatus.MERGED, targetOrderId, mergeNote, mergeNote, sourceOrder.id);



    if (sourceOrder.tableId) {

      const activeOnSource = (db.prepare(

        "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status IN (?, ?) AND id != ?"

      ).get(sourceOrder.tableId, OrderStatus.ACTIVE, OrderStatus.HOLD, sourceOrder.id) as any).count;

      if (activeOnSource === 0) {

        db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(sourceOrder.tableId);

      }

    }

  } else {

    const partialNote = itemSummary

      ? `Split into ${targetTableName}: ${itemSummary}`

      : `Split into ${targetTableName}`;

    db.prepare(`

      UPDATE orders

      SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,

          updated_at = datetime('now')

      WHERE id = ?

    `).run(partialNote, partialNote, sourceOrder.id);



    const inboundNote = itemSummary

      ? `Split from ${sourceTableName}: ${itemSummary}`

      : `Split from ${sourceTableName}`;

    db.prepare(`

      UPDATE orders

      SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,

          updated_at = datetime('now')

      WHERE id = ?

    `).run(inboundNote, inboundNote, targetOrderId);

    orderRepo.recalculateOrderTotals(sourceOrder.id);

  }



  return targetOrderId;

}



export function mergeBillsPartial(

  sourceOrderId: number,

  targetOrderId: number,

  items: SplitOrTransferItemInput[]

): Order & { items: OrderItem[] } {

  if (!items || items.length === 0) {

    throw new Error('No items selected for merge');

  }



  const db = getDb();

  const mergeInTransaction = db.transaction(() => {

    const sourceOrder = orderRepo.getById(sourceOrderId);

    if (!sourceOrder) throw new Error('Source order not found');

    if (sourceOrderId === targetOrderId) throw new Error('Cannot merge order into itself');

    return mergeBillsPartialInTx(db, sourceOrder, targetOrderId, items);

  });



  const resTargetId = mergeInTransaction();

  return orderRepo.getById(resTargetId)!;

}



export function transferPartial(

  sourceOrderId: number,

  targetTableId: number,

  items: SplitOrTransferItemInput[]

): Order & { items: OrderItem[] } {

  if (!items || items.length === 0) {

    throw new Error('No items selected for transfer');

  }



  const db = getDb();

  const transferInTransaction = db.transaction(() => {

    const sourceOrder = orderRepo.getById(sourceOrderId);

    if (!sourceOrder) throw new Error('Source order not found');



    if (sourceOrder.tableId === targetTableId) {

      throw new Error('Cannot transfer to the same table');

    }



    const targetTable = db.prepare('SELECT id, name, status FROM tables WHERE id = ?').get(targetTableId) as any;

    if (!targetTable) throw new Error('Target table does not exist');



    // Check if target table already has an active order

    const existingTargetOrder = db.prepare(

      "SELECT id FROM orders WHERE table_id = ? AND status = ? LIMIT 1"

    ).get(targetTableId, OrderStatus.ACTIVE) as any;



    if (existingTargetOrder) {

      return mergeBillsPartialInTx(db, sourceOrder, existingTargetOrder.id, items);

    }



    const sourceTableName = sourceOrder.tableName || (sourceOrder.tableId ? `Table #${sourceOrder.tableId}` : sourceOrder.orderNumber);

    const newOrderNumber = generateOrderNumber();



    // Create new order on target table

    const result = db.prepare(`

      INSERT INTO orders (

        order_number, order_type, table_id, table_name_snapshot,

        customer_id, staff_id, status, subtotal, tax_amount,

        grand_total, round_off, notes, split_from_order_id

      ) VALUES (?, 'dine_in', ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?)

    `).run(

      newOrderNumber,

      targetTableId,

      targetTable.name,

      sourceOrder.customerId ?? null,

      sourceOrder.staffId,

      OrderStatus.ACTIVE,

      `Split from ${sourceOrder.orderNumber}`,

      sourceOrder.id

    );



    const targetOrderId = result.lastInsertRowid as number;



    // Process items

    const movedItemSummaries: string[] = [];

    for (const itemInput of items) {

      if (itemInput.quantity <= 0) continue;

      const itemRow = db.prepare('SELECT * FROM order_items WHERE id = ? AND order_id = ?').get(itemInput.orderItemId, sourceOrderId) as any;

      if (!itemRow) continue;

      const moveQty = Math.min(itemInput.quantity, itemRow.quantity);

      if (moveQty <= 0) continue;

      moveOrSplitOrderItem(db, itemRow, moveQty, targetOrderId, sourceTableName);

      movedItemSummaries.push(`${itemRow.name} x${moveQty}`);

    }

    const itemSummary = movedItemSummaries.join(', ');

    if (itemSummary) {

      db.prepare("UPDATE orders SET notes = ? WHERE id = ?").run(`Split from ${sourceTableName}: ${itemSummary}`, targetOrderId);

    }



    // Create KOT for newly created order with transferred items so kitchen ticket can be printed

    try {

      const movedItems = db.prepare('SELECT id, quantity FROM order_items WHERE order_id = ?').all(targetOrderId) as any[];

      if (movedItems.length > 0) {

        kotRepo.create(targetOrderId, movedItems.map((m: any) => ({ orderItemId: m.id, quantity: m.quantity })));

      }

    } catch (e) {

      // Non-fatal if KOT creation fails

    }



    // Mark target table occupied

    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(targetTableId);



    // Recalculate target order totals

    orderRepo.recalculateOrderTotals(targetOrderId);



    // Check source order remaining items

    const remainingCount = (db.prepare('SELECT COUNT(*) as c FROM order_items WHERE order_id = ?').get(sourceOrderId) as any).c;

    if (remainingCount === 0) {

      const transferNote = `Transferred into ${targetTable.name}`;

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

            notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,

            updated_at = datetime('now')

        WHERE id = ?

      `).run(OrderStatus.MERGED, targetOrderId, transferNote, transferNote, sourceOrderId);



      if (sourceOrder.tableId) {

        const activeOnSource = (db.prepare(

          "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status IN (?, ?) AND id != ?"

        ).get(sourceOrder.tableId, OrderStatus.ACTIVE, OrderStatus.HOLD, sourceOrderId) as any).count;

        if (activeOnSource === 0) {

          db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(sourceOrder.tableId);

        }

      }

    } else {

      const partialNote = itemSummary

        ? `Split into ${targetTable.name}: ${itemSummary}`

        : `Split into ${targetTable.name}`;

      db.prepare(`

        UPDATE orders

        SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,

            updated_at = datetime('now')

        WHERE id = ?

      `).run(partialNote, partialNote, sourceOrderId);

      orderRepo.recalculateOrderTotals(sourceOrderId);

    }



    return targetOrderId;

  });



  const targetOrderId = transferInTransaction();

  return orderRepo.getById(targetOrderId)!;

}



export function transferOrder(orderId: number, targetTableId: number): Order & { items: OrderItem[] } {

  const db = getDb();

  // Check if target table has an active order

  const existingTargetOrder = db.prepare(

    "SELECT id FROM orders WHERE table_id = ? AND status = ? AND id != ? LIMIT 1"

  ).get(targetTableId, OrderStatus.ACTIVE, orderId) as any;



  if (existingTargetOrder) {

    return mergeBills(orderId, existingTargetOrder.id);

  } else {

    return moveTable(orderId, targetTableId);

  }

}



export function moveTable(orderId: number, newTableId: number): Order & { items: OrderItem[] } {

  const db = getDb();



  const moveInTransaction = db.transaction(() => {

    const order = orderRepo.getById(orderId);

    if (!order) throw new Error('Order not found');



    // Verify target table exists and is not occupied by another order

    const targetTable = db.prepare('SELECT id, name, status FROM tables WHERE id = ?').get(newTableId) as any;

    if (!targetTable) throw new Error('Target table does not exist');

    if (targetTable.status === TableStatus.OCCUPIED) {

      const activeOnTarget = db.prepare(

        "SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status = ? AND id != ?"

      ).get(newTableId, OrderStatus.ACTIVE, orderId) as any;

      if (activeOnTarget.count > 0) throw new Error('Target table is occupied by another order');

    }



    const oldTableId = order.tableId;
    const oldTableName = order.tableName || (oldTableId ? `Table #${oldTableId}` : order.orderNumber);
    const transferNote = `Split from ${oldTableName}`;

    // Update order table, snapshot, notes
    db.prepare(`
      UPDATE orders
      SET table_id = ?,
          table_name_snapshot = ?,
          notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || ' | ' || ? END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(newTableId, targetTable.name, transferNote, transferNote, orderId);

    // Also stamp source_table_name on items so they reflect where they originated
    db.prepare(`
      UPDATE order_items
      SET source_table_name = COALESCE(source_table_name, ?)
      WHERE order_id = ?
    `).run(oldTableName, orderId);



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

