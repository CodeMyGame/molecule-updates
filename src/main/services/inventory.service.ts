import { getDb } from '../db/connection';
import * as inventoryRepo from '../db/repositories/inventory.repo';
import { StockTransactionType } from '../../shared/enums';
import type { InventoryItem } from '../../shared/types/inventory.types';

export function deductForOrder(orderId: number): void {
  const db = getDb();

  const orderItems = db.prepare(`
    SELECT oi.id, oi.menu_item_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = ? AND oi.menu_item_id IS NOT NULL
  `).all(orderId) as any[];

  deductItemsList(orderId, orderItems);
}

export function deductForItems(orderId: number, itemIds: number[]): void {
  if (!itemIds || itemIds.length === 0) return;
  const db = getDb();
  const placeholders = itemIds.map(() => '?').join(',');
  const orderItems = db.prepare(`
    SELECT oi.id, oi.menu_item_id, oi.quantity
    FROM order_items oi
    WHERE oi.id IN (${placeholders}) AND oi.menu_item_id IS NOT NULL
  `).all(...itemIds) as any[];

  deductItemsList(orderId, orderItems);
}

function deductItemsList(orderId: number, orderItems: any[]): void {
  const db = getDb();
  const deductInTransaction = db.transaction(() => {
    for (const orderItem of orderItems) {
      const recipes = db.prepare(`
        SELECT inventory_item_id, quantity_used
        FROM recipes
        WHERE menu_item_id = ?
      `).all(orderItem.menu_item_id) as any[];

      if (recipes.length === 0) continue;

      for (const recipe of recipes) {
        const totalDeduction = recipe.quantity_used * orderItem.quantity;

        db.prepare(`
          UPDATE inventory_items
          SET current_stock = MAX(0, current_stock - ?), updated_at = datetime('now')
          WHERE id = ?
        `).run(totalDeduction, recipe.inventory_item_id);

        db.prepare(`
          INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          recipe.inventory_item_id,
          StockTransactionType.CONSUMPTION,
          totalDeduction,
          'order',
          orderId,
          `Auto-deducted for order #${orderId}`,
        );
      }
    }
  });

  deductInTransaction();
}

export function restoreForOrder(orderId: number): void {
  const db = getDb();
  const restoreInTransaction = db.transaction(() => {
    const transactions = db.prepare(`
      SELECT inventory_item_id, SUM(quantity) as total_qty
      FROM stock_transactions
      WHERE reference_type = 'order' AND reference_id = ? AND transaction_type = ?
      GROUP BY inventory_item_id
    `).all(orderId, StockTransactionType.CONSUMPTION) as any[];

    for (const tx of transactions) {
      db.prepare(`
        UPDATE inventory_items
        SET current_stock = current_stock + ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(tx.total_qty, tx.inventory_item_id);

      db.prepare(`
        INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        tx.inventory_item_id,
        StockTransactionType.ADJUSTMENT,
        tx.total_qty,
        'order_cancellation',
        orderId,
        `Restored stock for cancelled order #${orderId}`,
      );
    }
  });

  restoreInTransaction();
}

export function restoreForRemovedItem(orderItemId: number, menuItemId: number, quantity: number): void {
  const db = getDb();
  const restoreInTransaction = db.transaction(() => {
    const recipes = db.prepare(`
      SELECT inventory_item_id, quantity_used
      FROM recipes
      WHERE menu_item_id = ?
    `).all(menuItemId) as any[];

    for (const recipe of recipes) {
      const totalRestore = recipe.quantity_used * quantity;

      db.prepare(`
        UPDATE inventory_items
        SET current_stock = current_stock + ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(totalRestore, recipe.inventory_item_id);

      db.prepare(`
        INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        recipe.inventory_item_id,
        StockTransactionType.ADJUSTMENT,
        totalRestore,
        'item_removal',
        orderItemId,
        `Restored stock for removed item #${orderItemId}`,
      );
    }
  });

  restoreInTransaction();
}

export function checkLowStock(): InventoryItem[] {
  return inventoryRepo.getLowStock();
}
