import { getDb } from '../db/connection';
import * as inventoryRepo from '../db/repositories/inventory.repo';
import { StockTransactionType } from '../../shared/enums';
import type { InventoryItem } from '../../shared/types/inventory.types';

export function deductForOrder(orderId: number): void {
  const db = getDb();

  const orderItems = db.prepare(`
    SELECT oi.menu_item_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = ? AND oi.menu_item_id IS NOT NULL
  `).all(orderId) as any[];

  const deductInTransaction = db.transaction(() => {
    for (const orderItem of orderItems) {
      // Find recipes for this menu item
      const recipes = db.prepare(`
        SELECT inventory_item_id, quantity_used
        FROM recipes
        WHERE menu_item_id = ?
      `).all(orderItem.menu_item_id) as any[];

      // Only deduct if recipes exist for the item
      if (recipes.length === 0) continue;

      for (const recipe of recipes) {
        const totalDeduction = recipe.quantity_used * orderItem.quantity;

        // Deduct stock (floor at 0 to prevent negative values)
        db.prepare(`
          UPDATE inventory_items
          SET current_stock = MAX(0, current_stock - ?), updated_at = datetime('now')
          WHERE id = ?
        `).run(totalDeduction, recipe.inventory_item_id);

        // Record stock transaction
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

export function checkLowStock(): InventoryItem[] {
  return inventoryRepo.getLowStock();
}
