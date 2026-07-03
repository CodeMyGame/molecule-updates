import { useState, useCallback } from 'react';
import { ipc } from '../lib/ipc';
import type {
  DailySalesReport,
  ItemSalesReport,
  CategorySalesReport,
  PaymentSummaryReport,
  CashFlowReport,
  GSTReport,
  BusyHoursReport,
  DateRangeFilter,
} from '../../shared/types/report.types';

export interface StaffPerformanceReport {
  staffId: number;
  staffName: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface InventoryConsumptionReport {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  totalConsumed: number;
  totalWasted: number;
  totalCost: number;
}

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

function getDateRange(preset: DatePreset): DateRangeFilter {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { startDate: fmt(today), endDate: fmt(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { startDate: fmt(y), endDate: fmt(y) };
    }
    case 'this_week': {
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    default:
      return { startDate: fmt(today), endDate: fmt(today) };
  }
}

interface UseReportsReturn {
  datePreset: DatePreset;
  dateRange: DateRangeFilter;
  setDatePreset: (preset: DatePreset) => void;
  setDateRange: (range: DateRangeFilter) => void;
  loading: boolean;
  error: string | null;
  // Report data
  dailySales: DailySalesReport[];
  itemSales: ItemSalesReport[];
  categorySales: CategorySalesReport[];
  paymentSummary: PaymentSummaryReport[];
  cashFlow: CashFlowReport | null;
  gstReport: GSTReport[];
  staffPerformance: StaffPerformanceReport[];
  inventoryConsumption: InventoryConsumptionReport[];
  busyHours: BusyHoursReport | null;
  // Fetch functions
  fetchDailySales: () => Promise<void>;
  fetchItemSales: () => Promise<void>;
  fetchCategorySales: () => Promise<void>;
  fetchPaymentSummary: () => Promise<void>;
  fetchCashFlow: () => Promise<void>;
  fetchGSTReport: () => Promise<void>;
  fetchStaffPerformance: () => Promise<void>;
  fetchInventoryConsumption: () => Promise<void>;
  fetchBusyHours: () => Promise<void>;
}

export function useReports(): UseReportsReturn {
  const [datePreset, setDatePresetState] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<DateRangeFilter>(getDateRange('today'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dailySales, setDailySales] = useState<DailySalesReport[]>([]);
  const [itemSales, setItemSales] = useState<ItemSalesReport[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySalesReport[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummaryReport[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [gstReport, setGstReport] = useState<GSTReport[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformanceReport[]>([]);
  const [inventoryConsumption, setInventoryConsumption] = useState<InventoryConsumptionReport[]>([]);
  const [busyHours, setBusyHours] = useState<BusyHoursReport | null>(null);

  const setDatePreset = useCallback((preset: DatePreset) => {
    setDatePresetState(preset);
    if (preset !== 'custom') {
      setDateRange(getDateRange(preset));
    }
  }, []);

  const fetchDailySales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<DailySalesReport[]>(
        window.electronAPI.reports.dailySales(dateRange)
      );
      setDailySales(Array.isArray(data) ? data : data ? [data] : []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch daily sales');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchItemSales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<ItemSalesReport[]>(
        window.electronAPI.reports.itemWiseSales(dateRange)
      );
      setItemSales(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch item sales');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchCategorySales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<CategorySalesReport[]>(
        window.electronAPI.reports.categoryWiseSales(dateRange)
      );
      setCategorySales(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch category sales');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchPaymentSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<PaymentSummaryReport[]>(
        window.electronAPI.reports.paymentSummary(dateRange)
      );
      setPaymentSummary(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch payment summary');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchCashFlow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<CashFlowReport>(
        window.electronAPI.reports.cashFlow(dateRange)
      );
      setCashFlow(data ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch cash flow');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchGSTReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<GSTReport[]>(
        window.electronAPI.reports.gstReport(dateRange)
      );
      setGstReport(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch GST report');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchStaffPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<StaffPerformanceReport[]>(
        window.electronAPI.reports.staffPerformance(dateRange)
      );
      setStaffPerformance(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch staff performance');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchInventoryConsumption = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<InventoryConsumptionReport[]>(
        window.electronAPI.reports.inventoryConsumption(dateRange)
      );
      setInventoryConsumption(data ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch inventory consumption');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchBusyHours = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ipc<BusyHoursReport>(
        window.electronAPI.reports.busyHours(dateRange)
      );
      setBusyHours(data ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch busy hours');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  return {
    datePreset,
    dateRange,
    setDatePreset,
    setDateRange,
    loading,
    error,
    dailySales,
    itemSales,
    categorySales,
    paymentSummary,
    cashFlow,
    gstReport,
    staffPerformance,
    inventoryConsumption,
    busyHours,
    fetchDailySales,
    fetchItemSales,
    fetchCategorySales,
    fetchPaymentSummary,
    fetchCashFlow,
    fetchGSTReport,
    fetchStaffPerformance,
    fetchInventoryConsumption,
    fetchBusyHours,
  };
}
