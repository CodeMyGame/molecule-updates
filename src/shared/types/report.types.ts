import { PaymentMode } from '../enums';

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface DailySalesReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  totalDiscount: number;
  totalTax: number;
  netRevenue: number;
  averageOrderValue: number;
  ordersByType: { type: string; count: number; revenue: number }[];
  coinsRedeemed: number;   // paise value of coins redeemed
  coinsEarned: number;     // number of coins earned
}

export interface ItemSalesReport {
  menuItemId: number;
  name: string;
  categoryName: string;
  quantitySold: number;
  totalRevenue: number;
  totalTax: number;
}

export interface CategorySalesReport {
  categoryId: number;
  categoryName: string;
  itemCount: number;
  quantitySold: number;
  totalRevenue: number;
  totalTax: number;
}

export interface PaymentSummaryReport {
  paymentMode: PaymentMode;
  transactionCount: number;
  totalAmount: number;
  tipAmount: number;
}

export interface CashFlowReport {
  openingCash: number;
  cashSales: number;
  cashExpenses: number;
  closingCash: number;
  expectedCash: number;
  difference: number;
  coinsRedeemed: number;   // paise value of coins redeemed in the period
}

export interface GSTReport {
  taxRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  invoiceCount: number;
}

/** A single time bucket in the busy-hours report (hour, weekday, month, or year). */
export interface BusyBucket {
  bucket: number;   // hour 0-23 | weekday 0-6 (0=Sun) | month 1-12 | year e.g. 2026
  orders: number;
  revenue: number;
}

/** Busy-hours breakdown across multiple time granularities for the selected range. */
export interface BusyHoursReport {
  byHour: BusyBucket[];     // hour of day, 0-23 ("Day" view)
  byWeekday: BusyBucket[];  // day of week, 0-6 ("Week" view)
  byMonth: BusyBucket[];    // month of year, 1-12 ("Month" view)
  byYear: BusyBucket[];     // calendar year ("Year" view)
}
