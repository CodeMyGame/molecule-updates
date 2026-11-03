import { getDb } from '../connection';
import { format } from 'date-fns';
import { KOTStatus } from '../../../shared/enums';
import * as settingsRepo from './settings.repo';

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
  const kotIds = rows.map((r) => r.id);
  const itemsMap = batchLoadKotItems(kotIds);
  return rows.map((row) => mapKot(row, itemsMap.get(row.id) ?? []));
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
  const kotIds = rows.map((r) => r.id);
  const itemsMap = batchLoadKotItems(kotIds);
  return rows.map((row) => mapKot(row, itemsMap.get(row.id) ?? []));
}

// -- Helpers --

export function generateKotNumber(): string {
  const db = getDb();
  const today = format(new Date(), 'yyyyMMdd');
  const customPrefix = (settingsRepo.get('kot_prefix') || '').trim();
  const cleanPrefix = customPrefix ? (customPrefix.endsWith('-') ? customPrefix : `${customPrefix}-`) : 'KOT-';
  const prefix = `${cleanPrefix}${today}-`;

  const last = db.prepare(
    "SELECT kot_number FROM kots WHERE kot_number LIKE ? ORDER BY id DESC LIMIT 1"
  ).get(`${prefix}%`) as any;

  let seq = 1;
  if (last && last.kot_number) {
    const match = last.kot_number.slice(prefix.length).match(/^(\d+)/);
    if (match) {
      const lastSeq = parseInt(match[1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }
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

function batchLoadKotItems(kotIds: number[]): Map<number, KOTItem[]> {
  const result = new Map<number, KOTItem[]>();
  if (kotIds.length === 0) return result;

  const db = getDb();
  const placeholders = kotIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT ki.*, oi.name as item_name, oi.notes, oi.quantity as oi_qty
    FROM kot_items ki
    JOIN order_items oi ON ki.order_item_id = oi.id
    JOIN kots k ON ki.kot_id = k.id AND oi.order_id = k.order_id
    WHERE ki.kot_id IN (${placeholders})
    ORDER BY ki.id ASC
  `).all(...kotIds) as any[];

  const orderItemIds = Array.from(new Set(rows.map((r) => r.order_item_id).filter(Boolean)));
  const addonsByOrderItem = new Map<number, string[]>();

  if (orderItemIds.length > 0) {
    const oiPlaceholders = orderItemIds.map(() => '?').join(',');
    const addonRows = db.prepare(
      `SELECT order_item_id, name FROM order_item_addons WHERE order_item_id IN (${oiPlaceholders})`
    ).all(...orderItemIds) as { order_item_id: number; name: string }[];

    for (const a of addonRows) {
      const list = addonsByOrderItem.get(a.order_item_id);
      if (list) list.push(a.name);
      else addonsByOrderItem.set(a.order_item_id, [a.name]);
    }
  }

  for (const row of rows) {
    const addons = row.order_item_id ? addonsByOrderItem.get(row.order_item_id) : undefined;
    const item: KOTItem = {
      id: row.id,
      kotId: row.kot_id,
      orderItemId: row.order_item_id,
      name: row.item_name ?? 'Unknown item',
      quantity: Math.min(row.quantity, row.oi_qty ?? row.quantity),
      notes: row.notes ?? undefined,
      isNew: !!row.is_new,
      isCancelled: !!row.is_cancelled,
      addons: addons && addons.length > 0 ? addons : undefined,
    };
    const list = result.get(row.kot_id);
    if (list) list.push(item);
    else result.set(row.kot_id, [item]);
  }

  return result;
}

function getKotItems(kotId: number): KOTItem[] {
  return batchLoadKotItems([kotId]).get(kotId) ?? [];
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
