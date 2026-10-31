import { getDb } from '../connection';
import type { Payment, CreatePaymentDTO } from '../../../shared/types/payment.types';
import type { PaymentMode } from '../../../shared/enums';

export function create(orderId: number, payments: CreatePaymentDTO['payments'], tip = 0): Payment[] {
  const db = getDb();

  const insertPayment = db.prepare(`
    INSERT INTO payments (order_id, payment_mode, amount, reference_no, tip_amount)
    VALUES (?, ?, ?, ?, ?)
  `);

  const createInTransaction = db.transaction(() => {
    const ids: number[] = [];
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      // Assign the full tip to the first payment row; zero for the rest
      const tipAmount = i === 0 ? tip : 0;
      const result = insertPayment.run(
        orderId,
        payment.mode,
        payment.amount,
        payment.referenceNo ?? null,
        tipAmount,
      );
      ids.push(result.lastInsertRowid as number);
    }
    return ids;
  });

  const ids = createInTransaction();
  return ids.map((id) => {
    const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
    return mapPayment(row);
  });
}

export function getByOrder(orderId: number): Payment[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at').all(orderId) as any[];
  return rows.map(mapPayment);
}

export function getReconciliation(dateRange: { startDate: string; endDate: string }): {
  paymentMode: PaymentMode;
  transactionCount: number;
  totalAmount: number;
  tipAmount: number;
}[] {
  const startDate = dateRange.startDate?.includes(' ') ? dateRange.startDate : `${dateRange.startDate} 00:00:00`;
  const endDate = dateRange.endDate?.includes(' ') ? dateRange.endDate : `${dateRange.endDate} 23:59:59`;
  if (startDate > endDate) {
    throw new Error('Start date must not be after end date');
  }
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      p.payment_mode,
      COUNT(*) AS transaction_count,
      SUM(p.amount) AS total_amount,
      SUM(p.tip_amount) AS tip_amount
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE p.created_at >= ? AND p.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
    GROUP BY p.payment_mode
    ORDER BY p.payment_mode
  `).all(startDate, endDate) as any[];

  return rows.map((row) => ({
    paymentMode: row.payment_mode as PaymentMode,
    transactionCount: row.transaction_count,
    totalAmount: row.total_amount,
    tipAmount: row.tip_amount,
  }));
}

function mapPayment(row: any): Payment {
  return {
    id: row.id,
    orderId: row.order_id,
    paymentMode: row.payment_mode,
    amount: row.amount,
    referenceNo: row.reference_no ?? undefined,
    tipAmount: row.tip_amount,
    createdAt: row.created_at,
  };
}
