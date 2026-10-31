import { getDb } from '../db/connection';
import * as inventoryRepo from '../db/repositories/inventory.repo';
import { StockTransactionType } from '../../shared/enums';
import type { InventoryItem } from '../../shared/types/inventory.types';

export function deductForOrder(orderId: number): void {
  const db = getDb();

  // Find order items that have not yet had their recipes deducted
  const orderItems = db.prepare(`
    SELECT oi.id, oi.menu_item_id, oi.combo_id, oi.quantity, oi.name
    FROM order_items oi
    WHERE oi.order_id = ?
      AND oi.id NOT IN (
        SELECT reference_id FROM stock_transactions
        WHERE reference_type = 'order_item' AND transaction_type = 'consumption'
      )
  `).all(orderId) as any[];

  if (orderItems.length === 0) return;

  const deductInTransaction = db.transaction(() => {
    for (const orderItem of orderItems) {
      if (orderItem.menu_item_id) {
        // Standalone menu item recipes
        const recipes = db.prepare(`
          SELECT inventory_item_id, quantity_used
          FROM recipes
          WHERE menu_item_id = ?
        `).all(orderItem.menu_item_id) as any[];

        for (const recipe of recipes) {
          const totalDeduction = recipe.quantity_used * orderItem.quantity;

          // Deduct stock (floor at 0 to prevent negative values)
          db.prepare(`
            UPDATE inventory_items
            SET current_stock = MAX(0, current_stock - ?), updated_at = datetime('now')
            WHERE id = ?
          `).run(totalDeduction, recipe.inventory_item_id);

          // Record stock transaction linked to this specific order item
          db.prepare(`
            INSERT INTO stock_transactions (inventory_item_id, transaction_type, quantity, reference_type, reference_id, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            recipe.inventory_item_id,
            StockTransactionType.CONSUMPTION,
            totalDeduction,
            'order_item',
            orderItem.id,
            `Auto-deducted for order #${orderId}, item #${orderItem.id} (${orderItem.name})`,
          );
        }
      } else if (orderItem.combo_id) {
        // Combo component items
        const comboComponents = db.prepare(`
          SELECT ci.menu_item_id, ci.quantity
          FROM combo_items ci
          WHERE ci.combo_id = ?
        `).all(orderItem.combo_id) as any[];

        for (const comp of comboComponents) {
          const recipes = db.prepare(`
            SELECT inventory_item_id, quantity_used
            FROM recipes
            WHERE menu_item_id = ?
          `).all(comp.menu_item_id) as any[];

          for (const recipe of recipes) {
            const totalDeduction = recipe.quantity_used * comp.quantity * orderItem.quantity;

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
              'order_item',
              orderItem.id,
              `Auto-deducted for combo component on order #${orderId}, item #${orderItem.id} (${orderItem.name})`,
            );
          }
        }
      }
    }
  });

  deductInTransaction();
}

export function checkLowStock(): InventoryItem[] {
  return inventoryRepo.getLowStock();
}
