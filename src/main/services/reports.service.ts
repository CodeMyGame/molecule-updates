import { getDb } from '../db/connection';
import type {
  DateRangeFilter,
  DailySalesReport,
  ItemSalesReport,
  CategorySalesReport,
  PaymentSummaryReport,
  CashFlowReport,
  GSTReport,
  BusyBucket,
  BusyHoursReport,
  CustomerLoyaltyReport,
  CogsReport,
  TableTurnaroundReport,
  LossPreventionReport,
} from '../../shared/types/report.types';
import type { PaymentMode } from '../../shared/enums';

/** Normalize date range so endDate includes the full day (appends 23:59:59) */
function normalizeDateRange(dateRange: DateRangeFilter): { startDate: string; endDate: string } {
  const start = dateRange.startDate?.includes(' ') ? dateRange.startDate : `${dateRange.startDate} 00:00:00`;
  const end = dateRange.endDate?.includes(' ') ? dateRange.endDate : `${dateRange.endDate} 23:59:59`;
  return { startDate: start, endDate: end };
}

/** Query coin redemption/earning totals from loyalty_transactions for a date range.
 *  Redeemed = negative points (converted to paise: abs(points) * 100).
 *  Earned = positive points (raw coin count). */
function getCoinTotals(startDate: string, endDate: string): { coinsRedeemed: number; coinsEarned: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN lt.points < 0 THEN ABS(lt.points) * 100 ELSE 0 END), 0) AS coins_redeemed,
      COALESCE(SUM(CASE WHEN lt.points > 0 THEN lt.points ELSE 0 END), 0) AS coins_earned
    FROM loyalty_transactions lt
    JOIN orders o ON lt.order_id = o.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
  `).get(startDate, endDate) as any;
  return { coinsRedeemed: row?.coins_redeemed ?? 0, coinsEarned: row?.coins_earned ?? 0 };
}

/** Query coin totals for a specific date */
function getCoinTotalsForDate(date: string): { coinsRedeemed: number; coinsEarned: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN lt.points < 0 THEN ABS(lt.points) * 100 ELSE 0 END), 0) AS coins_redeemed,
      COALESCE(SUM(CASE WHEN lt.points > 0 THEN lt.points ELSE 0 END), 0) AS coins_earned
    FROM loyalty_transactions lt
    JOIN orders o ON lt.order_id = o.id
    WHERE DATE(o.created_at) = ? AND o.status NOT IN ('cancelled', 'merged')
  `).get(date) as any;
  return { coinsRedeemed: row?.coins_redeemed ?? 0, coinsEarned: row?.coins_earned ?? 0 };
}

export function dailySales(dateRange: DateRangeFilter): DailySalesReport[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const rows = db.prepare(`
    SELECT
      DATE(created_at) AS date,
      COUNT(CASE WHEN status NOT IN ('cancelled', 'merged') THEN 1 END) AS total_orders,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'merged') THEN grand_total ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'merged') THEN discount_amount ELSE 0 END), 0) AS total_discount,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'merged') THEN tax_amount ELSE 0 END), 0) AS total_tax,
      COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'merged') THEN (subtotal - discount_amount) ELSE 0 END), 0) AS net_revenue,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_orders,
      COALESCE(SUM(CASE WHEN status = 'cancelled' THEN grand_total ELSE 0 END), 0) AS cancelled_revenue
    FROM orders
    WHERE created_at >= ? AND created_at <= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(startDate, endDate) as any[];

  return rows.map((row) => {
    const ordersByType = db.prepare(`
      SELECT
        order_type AS type,
        COUNT(*) AS count,
        COALESCE(SUM(grand_total), 0) AS revenue
      FROM orders
      WHERE DATE(created_at) = ? AND status NOT IN ('cancelled', 'merged')
      GROUP BY order_type
    `).all(row.date) as any[];

    const coins = getCoinTotalsForDate(row.date);

    return {
      date: row.date,
      totalOrders: row.total_orders,
      totalRevenue: row.total_revenue,
      totalDiscount: row.total_discount,
      totalTax: row.total_tax,
      netRevenue: row.net_revenue,
      averageOrderValue: row.total_orders > 0
        ? Math.round(row.total_revenue / row.total_orders)
        : 0,
      ordersByType: ordersByType.map((r: any) => ({
        type: r.type,
        count: r.count,
        revenue: r.revenue,
      })),
      coinsRedeemed: coins.coinsRedeemed,
      coinsEarned: coins.coinsEarned,
      cancelledOrders: row.cancelled_orders,
      cancelledRevenue: row.cancelled_revenue,
    };
  });
}

export function itemWiseSales(dateRange: DateRangeFilter): ItemSalesReport[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);
  const rows = db.prepare(`
    SELECT
      oi.menu_item_id,
      oi.name,
      COALESCE(mc.name, 'Unknown') AS category_name,
      SUM(oi.quantity) AS quantity_sold,
      SUM(oi.total) AS total_revenue,
      SUM(oi.tax_amount) AS total_tax
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
    GROUP BY oi.menu_item_id, oi.name
    ORDER BY total_revenue DESC
  `).all(startDate, endDate) as any[];

  return rows.map((row) => ({
    menuItemId: row.menu_item_id,
    name: row.name,
    categoryName: row.category_name,
    quantitySold: row.quantity_sold,
    totalRevenue: row.total_revenue,
    totalTax: row.total_tax,
  }));
}

export function categoryWiseSales(dateRange: DateRangeFilter): CategorySalesReport[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);
  const rows = db.prepare(`
    SELECT
      mc.id AS category_id,
      mc.name AS category_name,
      COUNT(DISTINCT oi.menu_item_id) AS item_count,
      SUM(oi.quantity) AS quantity_sold,
      SUM(oi.total) AS total_revenue,
      SUM(oi.tax_amount) AS total_tax
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
    GROUP BY mc.id, mc.name
    ORDER BY total_revenue DESC
  `).all(startDate, endDate) as any[];

  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    itemCount: row.item_count,
    quantitySold: row.quantity_sold,
    totalRevenue: row.total_revenue,
    totalTax: row.total_tax,
  }));
}

export function paymentSummary(dateRange: DateRangeFilter): PaymentSummaryReport[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);
  const rows = db.prepare(`
    SELECT
      p.payment_mode,
      COUNT(*) AS transaction_count,
      SUM(p.amount) AS total_amount,
      SUM(p.tip_amount) AS tip_amount
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
    GROUP BY p.payment_mode
    ORDER BY total_amount DESC
  `).all(startDate, endDate) as any[];

  return rows.map((row) => ({
    paymentMode: row.payment_mode as PaymentMode,
    transactionCount: row.transaction_count,
    totalAmount: row.total_amount,
    tipAmount: row.tip_amount,
  }));
}

export function cashFlow(dateRange: DateRangeFilter): CashFlowReport {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  // Get day session info
  const session = db.prepare(`
    SELECT opening_cash, closing_cash, expected_cash
    FROM day_sessions
    WHERE opened_at >= ? AND (closed_at <= ? OR closed_at IS NULL)
    ORDER BY opened_at DESC LIMIT 1
  `).get(startDate, endDate) as any;

  const cashSales = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE p.payment_mode = 'cash'
      AND o.created_at >= ? AND o.created_at <= ?
      AND o.status NOT IN ('cancelled', 'merged')
  `).get(startDate, endDate) as any;

  const coins = getCoinTotals(startDate, endDate);

  const openingCash = session?.opening_cash ?? 0;
  const cashSalesAmount = cashSales?.total ?? 0;
  const closingCash = session?.closing_cash ?? 0;
  const expectedCash = openingCash + cashSalesAmount;

  return {
    openingCash,
    cashSales: cashSalesAmount,
    cashExpenses: 0, // Can be extended with expense tracking
    closingCash,
    expectedCash,
    difference: closingCash - expectedCash,
    coinsRedeemed: coins.coinsRedeemed,
  };
}

export function inventoryConsumption(dateRange: DateRangeFilter): {
  inventoryItemId: number;
  name: string;
  unit: string;
  totalConsumed: number;
  totalPurchased: number;
}[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);
  const rows = db.prepare(`
    SELECT
      ii.id AS inventory_item_id,
      ii.name,
      ii.unit,
      COALESCE(SUM(CASE WHEN st.transaction_type = 'consumption' THEN st.quantity ELSE 0 END), 0) AS total_consumed,
      COALESCE(SUM(CASE WHEN st.transaction_type = 'purchase' THEN st.quantity ELSE 0 END), 0) AS total_purchased
    FROM inventory_items ii
    LEFT JOIN stock_transactions st ON ii.id = st.inventory_item_id
      AND st.created_at >= ? AND st.created_at <= ?
    GROUP BY ii.id, ii.name, ii.unit
    HAVING total_consumed > 0 OR total_purchased > 0
    ORDER BY total_consumed DESC
  `).all(startDate, endDate) as any[];

  return rows.map((row) => ({
    ingredientId: row.inventory_item_id,
    ingredientName: row.name,
    unit: row.unit,
    totalConsumed: row.total_consumed,
    totalWasted: 0,
    totalCost: row.total_purchased,
  }));
}

export function gstReport(dateRange: DateRangeFilter): GSTReport[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);
  const rows = db.prepare(`
    SELECT
      oi.tax_rate,
      SUM(oi.unit_price * oi.quantity) AS taxable_amount,
      SUM(oi.tax_amount) AS total_tax,
      COUNT(DISTINCT o.id) AS invoice_count
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= ? AND o.created_at <= ?
      AND o.status = 'completed'
    GROUP BY oi.tax_rate
    ORDER BY oi.tax_rate
  `).all(startDate, endDate) as any[];

  return rows.map((row) => {
    const halfTax = Math.round(row.total_tax / 2);
    return {
      taxRate: row.tax_rate,
      taxableAmount: row.taxable_amount,
      cgst: halfTax,
      sgst: row.total_tax - halfTax,
      totalTax: row.total_tax,
      invoiceCount: row.invoice_count,
    };
  });
}

export function dayEndSummary(dateRange: DateRangeFilter): {
  totalRevenue: number;
  totalOrders: number;
  totalCovers: number;
  averageOrderValue: number;
  totalDiscount: number;
  totalTax: number;
  paymentBreakdown: { mode: string; total: number; count: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  ordersByType: { type: string; count: number; revenue: number }[];
  cashInHand: number;
  expectedCash: number;
  coinsRedeemed: number;
  coinsEarned: number;
} {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(grand_total), 0) AS total_revenue,
      COUNT(*) AS total_orders,
      COALESCE(SUM(discount_amount), 0) AS total_discount,
      COALESCE(SUM(tax_amount), 0) AS total_tax
    FROM orders
    WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
  `).get(startDate, endDate) as any;

  const covers = db.prepare(`
    SELECT COALESCE(SUM(oi.quantity), 0) AS total_covers
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status = 'completed'
  `).get(startDate, endDate) as any;

  const paymentRows = db.prepare(`
    SELECT p.payment_mode AS mode, COALESCE(SUM(p.amount), 0) AS total, COUNT(*) AS count
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status = 'completed'
    GROUP BY p.payment_mode
  `).all(startDate, endDate) as any[];

  const topItems = db.prepare(`
    SELECT oi.name, SUM(oi.quantity) AS quantity, SUM(oi.total) AS revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status = 'completed'
    GROUP BY oi.name
    ORDER BY quantity DESC
    LIMIT 5
  `).all(startDate, endDate) as any[];

  const ordersByType = db.prepare(`
    SELECT order_type AS type, COUNT(*) AS count, COALESCE(SUM(grand_total), 0) AS revenue
    FROM orders
    WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
    GROUP BY order_type
  `).all(startDate, endDate) as any[];

  const cashPayments = db.prepare(`
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE p.payment_mode = 'cash' AND o.created_at >= ? AND o.created_at <= ? AND o.status = 'completed'
  `).get(startDate, endDate) as any;

  const session = db.prepare(`
    SELECT opening_cash FROM day_sessions
    WHERE opened_at >= ? AND (closed_at <= ? OR closed_at IS NULL)
    ORDER BY opened_at DESC LIMIT 1
  `).get(startDate, endDate) as any;

  const openingCash = session?.opening_cash ?? 0;
  const expectedCash = openingCash + (cashPayments?.total ?? 0);

  const coins = getCoinTotals(startDate, endDate);

  return {
    totalRevenue: summary.total_revenue,
    totalOrders: summary.total_orders,
    totalCovers: covers.total_covers,
    averageOrderValue: summary.total_orders > 0 ? Math.round(summary.total_revenue / summary.total_orders) : 0,
    totalDiscount: summary.total_discount,
    totalTax: summary.total_tax,
    paymentBreakdown: paymentRows.map((r: any) => ({ mode: r.mode, total: r.total, count: r.count })),
    topItems: topItems.map((r: any) => ({ name: r.name, quantity: r.quantity, revenue: r.revenue })),
    ordersByType: ordersByType.map((r: any) => ({ type: r.type, count: r.count, revenue: r.revenue })),
    cashInHand: expectedCash,
    expectedCash,
    coinsRedeemed: coins.coinsRedeemed,
    coinsEarned: coins.coinsEarned,
  };
}

export function kitchenPrepTime(dateRange: DateRangeFilter): {
  itemName: string;
  avgPrepMinutes: number;
  orderCount: number;
}[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const rows = db.prepare(`
    SELECT
      oi.name AS item_name,
      AVG(
        (julianday(k.ready_at) - julianday(k.printed_at)) * 24 * 60
      ) AS avg_prep_minutes,
      COUNT(*) AS order_count
    FROM kot_items ki
    JOIN kots k ON ki.kot_id = k.id
    JOIN order_items oi ON ki.order_item_id = oi.id
    JOIN orders o ON k.order_id = o.id
    WHERE k.ready_at IS NOT NULL
      AND o.created_at >= ? AND o.created_at <= ?
    GROUP BY oi.name
    ORDER BY avg_prep_minutes DESC
  `).all(startDate, endDate) as any[];

  return rows.map((r: any) => ({
    itemName: r.item_name,
    avgPrepMinutes: Math.round(r.avg_prep_minutes * 10) / 10,
    orderCount: r.order_count,
  }));
}

export function shiftHandover(staffId: number, dateRange: DateRangeFilter): {
  staffName: string;
  totalOrders: number;
  totalRevenue: number;
  cashCollected: number;
  cardCollected: number;
  upiCollected: number;
  ordersByType: { type: string; count: number }[];
} {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const staff = db.prepare('SELECT name FROM staff WHERE id = ?').get(staffId) as any;

  const orders = db.prepare(`
    SELECT COUNT(*) AS total_orders, COALESCE(SUM(grand_total), 0) AS total_revenue
    FROM orders
    WHERE staff_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'
  `).get(staffId, startDate, endDate) as any;

  const payments = db.prepare(`
    SELECT p.payment_mode, COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    WHERE o.staff_id = ? AND o.created_at >= ? AND o.created_at <= ? AND o.status = 'completed'
    GROUP BY p.payment_mode
  `).all(staffId, startDate, endDate) as any[];

  const paymentMap = new Map(payments.map((p: any) => [p.payment_mode, p.total]));

  const ordersByType = db.prepare(`
    SELECT order_type AS type, COUNT(*) AS count
    FROM orders
    WHERE staff_id = ? AND created_at >= ? AND created_at <= ? AND status = 'completed'
    GROUP BY order_type
  `).all(staffId, startDate, endDate) as any[];

  return {
    staffName: staff?.name ?? 'Unknown',
    totalOrders: orders.total_orders,
    totalRevenue: orders.total_revenue,
    cashCollected: paymentMap.get('cash') ?? 0,
    cardCollected: paymentMap.get('card') ?? 0,
    upiCollected: paymentMap.get('upi') ?? 0,
    ordersByType: ordersByType.map((r: any) => ({ type: r.type, count: r.count })),
  };
}

/** Fill missing buckets with zero rows so charts show a continuous axis. */
function fillBuckets(rows: BusyBucket[], expected: number[]): BusyBucket[] {
  const map = new Map(rows.map((r) => [r.bucket, r]));
  return expected.map((b) => map.get(b) ?? { bucket: b, orders: 0, revenue: 0 });
}

/**
 * Busy-hours report: order/revenue distribution across hour-of-day, day-of-week,
 * month, and year for the selected date range. Buckets are extracted in local
 * time so they match the restaurant's wall clock (created_at is stored in UTC).
 */
export function busyHours(dateRange: DateRangeFilter): BusyHoursReport {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  // The strftime format is a fixed literal per call (no user input), so there is
  // no SQL-injection surface here.
  const aggregate = (format: '%H' | '%w' | '%m' | '%Y'): BusyBucket[] => {
    const sql = `
      SELECT
        CAST(strftime('${format}', created_at, 'localtime') AS INTEGER) AS bucket,
        COUNT(*) AS orders,
        COALESCE(SUM(grand_total), 0) AS revenue
      FROM orders
      WHERE created_at >= ? AND created_at <= ? AND status NOT IN ('cancelled', 'merged')
      GROUP BY bucket
      ORDER BY bucket
    `;
    return db.prepare(sql).all(startDate, endDate) as BusyBucket[];
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);          // 0-23
  const weekdays = Array.from({ length: 7 }, (_, i) => i);        // 0-6 (0=Sun)
  const months = Array.from({ length: 12 }, (_, i) => i + 1);     // 1-12

  return {
    byHour: fillBuckets(aggregate('%H'), hours),
    byWeekday: fillBuckets(aggregate('%w'), weekdays),
    byMonth: fillBuckets(aggregate('%m'), months),
    byYear: aggregate('%Y'), // years left as-is (only those present in range)
  };
}

export function staffPerformance(dateRange: DateRangeFilter): {
  staffId: number;
  staffName: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalHoursWorked: number;
  revenuePerHour: number;
}[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);
  const rows = db.prepare(`
    SELECT
      s.id AS staff_id,
      s.name AS staff_name,
      COUNT(DISTINCT o.id) AS total_orders,
      COALESCE(SUM(o.grand_total), 0) AS total_revenue,
      COALESCE(SUM(
        (julianday(COALESCE(a.clock_out, datetime('now'))) - julianday(a.clock_in)) * 24
      ), 0) AS total_hours
    FROM staff s
    LEFT JOIN orders o ON s.id = o.staff_id
      AND o.created_at >= ? AND o.created_at <= ?
      AND o.status NOT IN ('cancelled', 'merged')
    LEFT JOIN attendance a ON s.id = a.staff_id
      AND a.clock_in >= ? AND a.clock_in <= ?
    WHERE s.is_active = 1
    GROUP BY s.id, s.name
    ORDER BY total_revenue DESC
  `).all(startDate, endDate, startDate, endDate) as any[];

  return rows.map((row) => {
    const totalHours = Math.round(row.total_hours * 10) / 10;
    return {
      staffId: row.staff_id,
      staffName: row.staff_name,
      totalOrders: row.total_orders,
      totalRevenue: row.total_revenue,
      averageOrderValue: row.total_orders > 0
        ? Math.round(row.total_revenue / row.total_orders)
        : 0,
      totalHoursWorked: totalHours,
      revenuePerHour: totalHours > 0 ? Math.round(row.total_revenue / totalHours) : 0,
    };
  });
}

export function customerLoyalty(dateRange: DateRangeFilter): CustomerLoyaltyReport {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const topCustomers = db.prepare(`
    SELECT 
      c.id, c.name, c.phone,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.grand_total), 0) as total_spend,
      COALESCE(AVG(o.grand_total), 0) as avg_order_value
    FROM customers c
    JOIN orders o ON o.customer_id = c.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
    GROUP BY c.id
    ORDER BY total_spend DESC
    LIMIT 20
  `).all(startDate, endDate) as any[];

  const customerMix = db.prepare(`
    SELECT 
      COUNT(CASE WHEN o.customer_id IS NULL THEN 1 END) as walk_in_orders,
      COUNT(CASE WHEN o.customer_id IS NOT NULL THEN 1 END) as registered_orders
    FROM orders o
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
  `).get(startDate, endDate) as any;

  const loyaltySummary = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) as points_earned,
      COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0) as points_redeemed
    FROM loyalty_transactions
    WHERE created_at >= ? AND created_at <= ?
  `).get(startDate, endDate) as any;

  return {
    topCustomers: topCustomers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalOrders: c.total_orders,
      totalSpend: c.total_spend,
      avgOrderValue: Math.round(c.avg_order_value)
    })),
    walkInOrders: customerMix?.walk_in_orders ?? 0,
    registeredOrders: customerMix?.registered_orders ?? 0,
    pointsEarned: loyaltySummary?.points_earned ?? 0,
    pointsRedeemed: loyaltySummary?.points_redeemed ?? 0
  };
}

export function cogsAnalytics(dateRange: DateRangeFilter): CogsReport {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const items = db.prepare(`
    SELECT 
      mi.id as menu_item_id,
      mi.name as item_name,
      mc.name as category_name,
      SUM(oi.quantity) as quantity_sold,
      SUM(oi.total) as total_revenue,
      COALESCE((
        SELECT SUM(r.quantity * ii.cost_price)
        FROM recipes r
        JOIN inventory_items ii ON r.inventory_item_id = ii.id
        WHERE r.menu_item_id = mi.id
      ), 0) as unit_cost
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    WHERE o.created_at >= ? AND o.created_at <= ? AND o.status NOT IN ('cancelled', 'merged')
    GROUP BY mi.id
    ORDER BY total_revenue DESC
  `).all(startDate, endDate) as any[];

  const wastage = db.prepare(`
    SELECT 
      ii.name as item_name,
      SUM(st.quantity) as quantity,
      SUM(st.quantity * ii.cost_price) as cost
    FROM stock_transactions st
    JOIN inventory_items ii ON st.inventory_item_id = ii.id
    WHERE (st.transaction_type = 'waste' OR st.transaction_type = 'wasted' OR st.notes LIKE '%waste%')
      AND st.created_at >= ? AND st.created_at <= ?
    GROUP BY ii.id
  `).all(startDate, endDate) as any[];

  return {
    items: items.map(i => {
      const totalCost = i.unit_cost * i.quantity_sold;
      const profit = i.total_revenue - totalCost;
      const marginPercent = i.total_revenue > 0 ? Math.round((profit / i.total_revenue) * 100) : 0;
      return {
        menuItemId: i.menu_item_id,
        itemName: i.item_name,
        categoryName: i.category_name,
        quantitySold: i.quantity_sold,
        totalRevenue: i.total_revenue,
        unitCost: i.unit_cost,
        totalCost,
        profit,
        marginPercent
      };
    }),
    wastage: wastage.map(w => ({
      itemName: w.item_name,
      quantity: w.quantity,
      cost: w.cost
    }))
  };
}

export function tableTurnaround(dateRange: DateRangeFilter): TableTurnaroundReport[] {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const tables = db.prepare(`
    SELECT 
      t.id, t.name,
      COUNT(o.id) as total_bookings,
      AVG((julianday(o.completed_at) - julianday(o.created_at)) * 24 * 60) as avg_duration_mins
    FROM tables t
    JOIN orders o ON o.table_id = t.id
    WHERE o.order_type = 'dine_in' AND o.status = 'completed'
      AND o.created_at >= ? AND o.created_at <= ?
    GROUP BY t.id
    ORDER BY total_bookings DESC
  `).all(startDate, endDate) as any[];

  return tables.map(t => ({
    id: t.id,
    name: t.name,
    totalBookings: t.total_bookings,
    avgDurationMins: Math.round(t.avg_duration_mins ?? 0)
  }));
}

export function lossPrevention(dateRange: DateRangeFilter): LossPreventionReport {
  const db = getDb();
  const { startDate, endDate } = normalizeDateRange(dateRange);

  const cancellationsByStaff = db.prepare(`
    SELECT 
      s.id, s.name,
      COUNT(o.id) as cancelled_count,
      COALESCE(SUM(o.grand_total), 0) as cancelled_value
    FROM orders o
    JOIN staff s ON o.staff_id = s.id
    WHERE o.status = 'cancelled'
      AND o.created_at >= ? AND o.created_at <= ?
    GROUP BY s.id
    ORDER BY cancelled_value DESC
  `).all(startDate, endDate) as any[];

  const highDiscounts = db.prepare(`
    SELECT 
      o.id, o.order_number, o.grand_total, o.discount_amount,
      s.name as staff_name, c.name as customer_name
    FROM orders o
    JOIN staff s ON o.staff_id = s.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.discount_amount > 0 AND o.status NOT IN ('cancelled', 'merged')
      AND o.created_at >= ? AND o.created_at <= ?
    ORDER BY o.discount_amount DESC
    LIMIT 25
  `).all(startDate, endDate) as any[];

  return {
    cancellationsByStaff: cancellationsByStaff.map(c => ({
      id: c.id,
      name: c.name,
      count: c.cancelled_count,
      value: c.cancelled_value
    })),
    highDiscounts: highDiscounts.map(d => ({
      id: d.id,
      orderNumber: d.order_number,
      grandTotal: d.grand_total,
      discountAmount: d.discount_amount,
      staffName: d.staff_name,
      customerName: d.customer_name ?? 'Walk-in'
    }))
  };
}
