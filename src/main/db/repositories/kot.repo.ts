import { getDb } from '../connection';
import { format } from 'date-fns';
import { KOTStatus } from '../../../shared/enums';

export interface KOT {
  id: number;
  kotNumber: string;
  orderId: number;
  orderNumber: string;
  orderType: string;
  tableName?: string;
  station?: string;
  status: KOTStatus;
  printedAt: string;
  acceptedAt?: string;
  readyAt?: string;
  createdAt: string;
  items: KOTItem[];
}

export interface KOTItem {
  id: number;
  kotId: number;
  orderItemId: number;
  name: string;
  quantity: number;
  notes?: string;
  isNew: boolean;
  isCancelled: boolean;
  addons?: string[];
}

export function create(
  orderId: number,
  items: { orderItemId: number; quantity: number }[],
  station?: string,
): KOT {
  const db = getDb();

  const insertKot = db.prepare(`
    INSERT INTO kots (kot_number, order_id, station, status, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  const insertKotItem = db.prepare(`
    INSERT INTO kot_items (kot_id, order_item_id, quantity, is_new, is_cancelled)
    VALUES (?, ?, ?, 1, 0)
  `);

  const updateOrderItem = db.prepare(`
    UPDATE order_items SET kot_status = ?, kot_number = ?, station = ? WHERE id = ?
  `);

  const createInTransaction = db.transaction(() => {
    // Generate inside the transaction to prevent race conditions (SQLite serializes writes)
    const kotNumber = generateKotNumber();
    const result = insertKot.run(kotNumber, orderId, station ?? null, KOTStatus.PENDING);
    const kotId = result.lastInsertRowid as number;

    for (const item of items) {
      insertKotItem.run(kotId, item.orderItemId, item.quantity);
      updateOrderItem.run(KOTStatus.SENT, kotNumber, station ?? null, item.orderItemId);
    }

    return kotId;
  });

  const kotId = createInTransaction();
  return getKotById(kotId)!;
}

export function getActive(): KOT[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT k.*, o.order_number, o.order_type, t.name as table_name
    FROM kots k
    LEFT JOIN orders o ON k.order_id = o.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE o.status = 'active'
    ORDER BY k.printed_at DESC
  `).all() as any[];
  return rows.map((row) => mapKot(row, getKotItems(row.id)));
}

export function updateStatus(id: number, status: KOTStatus): KOT | undefined {
  const db = getDb();
  const updates: string[] = ['status = ?'];
  const params: unknown[] = [status];

  if (status === KOTStatus.PREPARING) {
    updates.push("accepted_at = datetime('now')");
  } else if (status === KOTStatus.READY) {
    updates.push("ready_at = datetime('now')");
  }

  params.push(id);
  db.prepare(`UPDATE kots SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Update associated order items kot_status so the billing page reflects the
  // kitchen's progress (preparing / ready / served).
  if (status === KOTStatus.PREPARING || status === KOTStatus.READY || status === KOTStatus.SERVED) {
    const kotItems = db.prepare('SELECT order_item_id FROM kot_items WHERE kot_id = ?').all(id) as any[];
    const updateOrderItem = db.prepare('UPDATE order_items SET kot_status = ? WHERE id = ?');
    for (const item of kotItems) {
      updateOrderItem.run(status, item.order_item_id);
    }
  }

  return getKotById(id);
}

export function getByStation(station: string): KOT[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT k.*, o.order_number, o.order_type, t.name as table_name
    FROM kots k
    LEFT JOIN orders o ON k.order_id = o.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE k.station = ? AND k.status IN (?, ?, ?, ?)
    ORDER BY k.printed_at ASC
  `).all(station, KOTStatus.PENDING, KOTStatus.SENT, KOTStatus.PREPARING, KOTStatus.READY) as any[];
  return rows.map((row) => mapKot(row, getKotItems(row.id)));
}

// -- Helpers --

function generateKotNumber(): string {
  const db = getDb();
  const today = format(new Date(), 'yyyyMMdd');
  const prefix = `KOT-${today}-`;

  const last = db.prepare(
    "SELECT kot_number FROM kots WHERE kot_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`) as any;

  let seq = 1;
  if (last) {
    const parts = last.kot_number.split('-');
    seq = parseInt(parts[2], 10) + 1;
  }

  return `${prefix}${seq.toString().padStart(3, '0')}`;
}

function getKotById(id: number): KOT | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT k.*, o.order_number, o.order_type, t.name as table_name
    FROM kots k
    LEFT JOIN orders o ON k.order_id = o.id
    LEFT JOIN tables t ON o.table_id = t.id
    WHERE k.id = ?
  `).get(id) as any;
  if (!row) return undefined;
  return mapKot(row, getKotItems(id));
}

function getKotItems(kotId: number): KOTItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ki.*, oi.name as item_name, oi.notes
    FROM kot_items ki
    LEFT JOIN order_items oi ON ki.order_item_id = oi.id
    WHERE ki.kot_id = ?
  `).all(kotId) as any[];
  const getAddons = db.prepare('SELECT name FROM order_item_addons WHERE order_item_id = ?');
  return rows.map((row) => {
    const addons = row.order_item_id
      ? (getAddons.all(row.order_item_id) as { name: string }[]).map((a) => a.name)
      : [];
    return {
      id: row.id,
      kotId: row.kot_id,
      orderItemId: row.order_item_id,
      name: row.item_name ?? 'Unknown item',
      quantity: row.quantity,
      notes: row.notes ?? undefined,
      isNew: !!row.is_new,
      isCancelled: !!row.is_cancelled,
      addons: addons.length > 0 ? addons : undefined,
    };
  });
}

function mapKot(row: any, items: KOTItem[]): KOT {
  return {
    id: row.id,
    kotNumber: row.kot_number,
    orderId: row.order_id,
    orderNumber: row.order_number ?? '',
    orderType: row.order_type ?? '',
    tableName: row.table_name ?? undefined,
    station: row.station ?? undefined,
    status: row.status as KOTStatus,
    printedAt: row.printed_at,
    acceptedAt: row.accepted_at ?? undefined,
    readyAt: row.ready_at ?? undefined,
    createdAt: row.created_at ?? row.printed_at,
    items,
  };
}
