import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  CreditCard,
  Banknote,
  FileText,
  Users,
  Package,
  Download,
  Printer,
  Calendar,
  Loader2,
  AlertCircle,
  ShoppingCart,
  ArrowUpRight,
  ClipboardList,
  Trash2,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Smartphone,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import DataTable from '../components/common/DataTable';
import { formatCurrency, formatDate, formatDateTime } from '../lib/formatters';
import { ipc } from '../lib/ipc';
import { useReports, type DatePreset } from '../hooks/useReports';
import { useTaxTerminology } from '../hooks/useTaxTerminology';
import { useLocaleCurrencyIcon } from '../hooks/useLocaleCurrencyIcon';
import { currencySymbolForLanguage } from '../lib/currencyLocale';

const DailySalesChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.DailySalesChart })));
const TopItemsBarChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.TopItemsBarChart })));
const CategoryPieChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.CategoryPieChart })));
const PaymentModesPieChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.PaymentModesPieChart })));
const StaffPerformanceBarChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.StaffPerformanceBarChart })));
const InventoryConsumptionBarChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.InventoryConsumptionBarChart })));
const KitchenPrepTimeBarChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.KitchenPrepTimeBarChart })));
const TableWiseBarCharts = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.TableWiseBarCharts })));
const BusyHoursBarChart = React.lazy(() => import('../components/reports/ReportCharts').then((m) => ({ default: m.BusyHoursBarChart })));

const ChartFallback: React.FC<{ height?: number }> = ({ height = 300 }) => (
  <div style={{ height }} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-center">
    <div className="shimmer h-full w-full rounded-lg" />
  </div>
);

type ReportTab =
  | 'order_history'
  | 'daily_sales'
  | 'item_sales'
  | 'category_sales'
  | 'payment_summary'
  | 'cash_flow'
  | 'gst'
  | 'staff_performance'
  | 'inventory'
  | 'kitchen_prep'
  | 'table_wise'
  | 'busy_hours'
  | 'void_audit';

const TABS: { key: ReportTab; icon: React.ReactNode }[] = [
  { key: 'order_history', icon: <ClipboardList size={16} /> },
  { key: 'daily_sales', icon: <TrendingUp size={16} /> },
  { key: 'item_sales', icon: <BarChart3 size={16} /> },
  { key: 'category_sales', icon: <PieChartIcon size={16} /> },
  { key: 'payment_summary', icon: <CreditCard size={16} /> },
  { key: 'cash_flow', icon: <Banknote size={16} /> },
  { key: 'gst', icon: <FileText size={16} /> },
  { key: 'staff_performance', icon: <Users size={16} /> },
  { key: 'inventory', icon: <Package size={16} /> },
  { key: 'kitchen_prep', icon: <ShoppingCart size={16} /> },
  { key: 'table_wise', icon: <LayoutGrid size={16} /> },
  { key: 'busy_hours', icon: <Clock size={16} /> },
  { key: 'void_audit', icon: <Trash2 size={16} /> },
];

const DATE_PRESETS: { key: DatePreset }[] = [
  { key: 'today' },
  { key: 'yesterday' },
  { key: 'this_week' },
  { key: 'this_month' },
  { key: 'custom' },
];

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
];

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  completed: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  active:    { bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  cancelled: { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500' },
  hold:      { bg: 'bg-yellow-100',text: 'text-yellow-700',dot: 'bg-yellow-500' },
  merged:    { bg: 'bg-purple-100',text: 'text-purple-700',dot: 'bg-purple-500' },
};

const TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  dine_in:  { bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
  takeaway: { bg: 'bg-orange-100',text: 'text-orange-700',dot: 'bg-orange-500' },
  delivery: { bg: 'bg-violet-100',text: 'text-violet-700',dot: 'bg-violet-500' },
};

function OptionBadge({ value, label, styleMap }: { value: string; label: string; styleMap: Record<string, { bg: string; text: string; dot: string }> }) {
  const s = styleMap[value];
  if (!s) return <span className="capitalize">{label}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

function CustomFilterSelect({
  value,
  onChange,
  options,
  placeholder,
  styleMap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  styleMap: Record<string, { bg: string; text: string; dot: string }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors min-w-[130px]"
      >
        {selected ? (
          <OptionBadge value={selected.value} label={selected.label} styleMap={styleMap} />
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <ChevronDown size={13} className={`ml-auto text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[160px] bg-white border border-gray-200 rounded-xl shadow-lg py-1 overflow-hidden">
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${!value ? 'font-medium text-gray-900' : 'text-gray-500'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors ${value === opt.value ? 'bg-gray-50' : ''}`}
            >
              <OptionBadge value={opt.value} label={opt.label} styleMap={styleMap} />
              {value === opt.value && <span className="ml-auto text-blue-500 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-start gap-3">
      <div className="p-2 rounded-md bg-blue-50 text-blue-600 flex-shrink-0">{React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 16 }) : icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{title}</p>
        <p className="text-base font-bold text-gray-900 mt-0.5">{value}</p>
        {trend && (
          <p className="text-[11px] text-green-600 flex items-center gap-0.5 mt-0.5">
            <ArrowUpRight size={11} /> {trend}
          </p>
        )}
      </div>
    </div>
  );
}

function exportToCSV(headers: string[], rows: string[][], filename: string) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const Reports: React.FC = () => {
  const { t, i18n } = useTranslation();
  const CurrencyIcon = useLocaleCurrencyIcon();
  const taxTerms = useTaxTerminology();
  const [activeTab, setActiveTab] = useState<ReportTab>('order_history');
  const reports = useReports();
  const [kitchenPrepData, setKitchenPrepData] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const [orderHistoryHasMore, setOrderHistoryHasMore] = useState(false);
  const [orderHistoryLoadingMore, setOrderHistoryLoadingMore] = useState(false);
  const [orderHistoryAvailableTypes, setOrderHistoryAvailableTypes] = useState<string[]>([]);
  const [orderDateBasis, setOrderDateBasis] = useState<'updated_at' | 'created_at'>('updated_at');
  const ORDER_PAGE_SIZE = 100;
  const [orderHistoryPage, setOrderHistoryPage] = useState(1);
  const [orderHistoryPageSize, setOrderHistoryPageSize] = useState(25);
  const [deleteModal, setDeleteModal] = useState<{ orderIds: number[]; label: string } | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [completeOrder, setCompleteOrder] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi'>('cash');
  const [completing, setCompleting] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [expandedOrderItems, setExpandedOrderItems] = useState<any[]>([]);
  const [expandedOrderLoading, setExpandedOrderLoading] = useState(false);
  const [orderFilterStatus, setOrderFilterStatus] = useState('');
  const [orderFilterType, setOrderFilterType] = useState('');
  const [orderSortKey, setOrderSortKey] = useState<string | null>(null);
  const [orderSortDir, setOrderSortDir] = useState<'asc' | 'desc'>('asc');
  const [itemFilterCategory, setItemFilterCategory] = useState('');
  const [busyHoursView, setBusyHoursView] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [voidFilterReason, setVoidFilterReason] = useState('');
  const [voidSearch, setVoidSearch] = useState('');

  const toggleOrderExpand = async (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      setExpandedOrderItems([]);
      return;
    }
    setExpandedOrderId(orderId);
    setExpandedOrderLoading(true);
    try {
      const order = await ipc<any>(window.electronAPI.orders.getById(orderId));
      setExpandedOrderItems(order?.items ?? []);
    } catch {
      setExpandedOrderItems([]);
    } finally {
      setExpandedOrderLoading(false);
    }
  };
  const [tableWiseData, setTableWiseData] = useState<any[]>([]);
  const [tableWiseLoading, setTableWiseLoading] = useState(false);

  const fetchOrderHistory = async (append = false) => {
    const offset = append ? orderHistory.length : 0;
    if (append) setOrderHistoryLoadingMore(true);
    else setOrderHistoryLoading(true);
    try {
      const orders = await ipc<any[]>(window.electronAPI.orders.getAll({
        startDate: reports.dateRange.startDate,
        endDate: reports.dateRange.endDate,
        status: orderFilterStatus || undefined,
        orderType: orderFilterType || undefined,
        dateField: orderDateBasis,
        limit: ORDER_PAGE_SIZE,
        offset,
      }));
      const list = orders ?? [];
      setOrderHistoryHasMore(list.length === ORDER_PAGE_SIZE);
      if (append) {
        setOrderHistory((prev) => [...prev, ...list]);
      } else {
        setOrderHistory(list);
        // Track distinct order types from the first page for the Type filter dropdown
        // (only when no type filter is active, otherwise we'd lose the full set)
        if (!orderFilterType) {
          setOrderHistoryAvailableTypes([...new Set(list.map((o) => o.orderType).filter(Boolean))]);
        }
      }
    } catch {
      if (!append) setOrderHistory([]);
      setOrderHistoryHasMore(false);
    } finally {
      setOrderHistoryLoading(false);
      setOrderHistoryLoadingMore(false);
    }
  };

  const fetchTableWiseReport = async () => {
    setTableWiseLoading(true);
    try {
      const data = await ipc<any[]>(window.electronAPI.reports.getTableWiseSales({
        startDate: reports.dateRange.startDate,
        endDate: reports.dateRange.endDate,
      }));
      setTableWiseData(data ?? []);
    } catch {
      setTableWiseData([]);
    } finally {
      setTableWiseLoading(false);
    }
  };

  const handleDeleteOrder = (orderId: number, orderNumber: string) => {
    setDeletePassword('');
    setDeleteModal({ orderIds: [orderId], label: orderNumber });
  };

  const handleBulkDelete = () => {
    if (selectedOrderIds.size === 0) return;
    setDeletePassword('');
    setDeleteModal({ orderIds: Array.from(selectedOrderIds), label: t('reports.ordersCount', { count: selectedOrderIds.size }) });
  };

  const confirmDeleteOrder = async () => {
    if (!deleteModal) return;
    if (deletePassword !== 'zblack') {
      toast.error(t('reports.incorrectPassword'));
      return;
    }
    try {
      await ipc(window.electronAPI.orders.deleteMany(deleteModal.orderIds));
      toast.success(t('reports.deletedLabel', { label: deleteModal.label }));
      const deletedSet = new Set(deleteModal.orderIds);
      setOrderHistory((prev) => prev.filter((o) => !deletedSet.has(o.id)));
      setSelectedOrderIds(new Set());
    } catch (err: any) {
      toast.error(err?.message ?? t('reports.failedToDeleteOrders'));
    } finally {
      setDeleteModal(null);
      setDeletePassword('');
    }
  };

  const handleOpenCompleteModal = (order: any) => {
    setCompleteOrder(order);
    setPaymentMode('cash');
  };

  const confirmCompleteOrder = async () => {
    if (!completeOrder) return;
    setCompleting(true);
    try {
      await ipc<any>(
        window.electronAPI.payments.create({
          orderId: completeOrder.id,
          payments: [{ mode: paymentMode, amount: completeOrder.grandTotal }],
          tip: 0,
        })
      );
      toast.success(t('reports.orderCompletedSuccess', 'Order completed successfully!'));
      setOrderHistory((prev) =>
        prev.map((o) => (o.id === completeOrder.id ? { ...o, status: 'completed' } : o))
      );
    } catch (err: any) {
      toast.error(err?.message ?? t('reports.failedToCompleteOrder', 'Failed to complete order'));
    } finally {
      setCompleting(false);
      setCompleteOrder(null);
    }
  };

  // Refetch order history when filters change while on order_history tab
  useEffect(() => {
    if (activeTab === 'order_history') {
      setOrderHistoryPage(1);
      fetchOrderHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderFilterStatus, orderFilterType, orderDateBasis]);



  useEffect(() => {
    switch (activeTab) {
      case 'order_history':
        fetchOrderHistory(false);
        break;
      case 'daily_sales':
        reports.fetchDailySales();
        break;
      case 'item_sales':
        reports.fetchItemSales();
        break;
      case 'category_sales':
        reports.fetchCategorySales();
        break;
      case 'payment_summary':
        reports.fetchPaymentSummary();
        break;
      case 'cash_flow':
        reports.fetchCashFlow();
        break;
      case 'gst':
        reports.fetchGSTReport();
        break;
      case 'staff_performance':
        reports.fetchStaffPerformance();
        break;
      case 'inventory':
        reports.fetchInventoryConsumption();
        break;
      case 'kitchen_prep':
        ipc<any[]>(window.electronAPI.reports.kitchenPrepTime(reports.dateRange))
          .then((data) => setKitchenPrepData(data ?? []))
          .catch(() => setKitchenPrepData([]));
        break;
      case 'table_wise':
        fetchTableWiseReport();
        break;
      case 'busy_hours':
        reports.fetchBusyHours();
        break;
      case 'void_audit':
        reports.fetchVoidReport();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reports.dateRange]);

  const handlePrint = () => {
    window.print();
  };

  const getTabLabel = (key: ReportTab): string => {
    switch (key) {
      case 'order_history': return t('reports.orderHistory', 'Order History');
      case 'daily_sales': return t('reports.dailySales', 'Sales Summary');
      case 'item_sales': return t('reports.itemWise');
      case 'category_sales': return t('reports.categoryWise');
      case 'payment_summary': return t('reports.payments');
      case 'cash_flow': return t('reports.cashFlow');
      case 'gst': return t('reports.gstReport');
      case 'staff_performance': return t('reports.staff');
      case 'inventory': return t('reports.inventory');
      case 'kitchen_prep': return t('reports.kitchenPrep');
      case 'table_wise': return t('reports.tableWise', 'Table-wise');
      case 'busy_hours': return t('reports.busyHours', 'Busy Hours');
      case 'void_audit': return t('reports.voidAudit', 'Void / Cancelled Items Audit');
    }
  };

  const getDatePresetLabel = (key: DatePreset): string => {
    switch (key) {
      case 'today': return t('reports.today');
      case 'yesterday': return t('reports.yesterday');
      case 'this_week': return t('reports.thisWeek');
      case 'this_month': return t('reports.thisMonth');
      case 'custom': return t('reports.custom');
    }
  };

  const renderDailySales = () => {
    const data = reports.dailySales;
    const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalOrders = data.reduce((sum, d) => sum + d.totalOrders, 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalTax = data.reduce((sum, d) => sum + d.totalTax, 0);
    const totalCoinsRedeemed = data.reduce((sum, d) => sum + (d.coinsRedeemed ?? 0), 0);

    const totalCancelledCount = data.reduce((sum, d) => sum + (d.cancelledOrders ?? 0), 0);
    const totalCancelledValue = data.reduce((sum, d) => sum + (d.cancelledRevenue ?? 0), 0);

    const chartData = data.map((d) => ({
      date: formatDate(d.date),
      revenue: d.netRevenue / 100,
      orders: d.totalOrders,
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title={t('reports.totalRevenue')} value={formatCurrency(totalRevenue)} icon={<CurrencyIcon size={20} />} />
          <SummaryCard title={t('reports.totalOrders')} value={totalOrders.toString()} icon={<ShoppingCart size={20} />} />
          <SummaryCard title={t('reports.avgOrderValue')} value={formatCurrency(avgOrderValue)} icon={<TrendingUp size={20} />} />
          <SummaryCard title={t('reports.totalTax')} value={formatCurrency(totalTax)} icon={<FileText size={20} />} />
        </div>

        {totalCancelledCount > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-rose-800">{t('reports.cancelledOrders', 'Cancelled Orders')}</p>
              <p className="text-xs text-rose-600">{t('reports.cancelledOrdersDesc', 'Orders that were voided or cancelled by staff')}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-rose-800">
                {t('reports.cancelledCountVal', { defaultValue: `${totalCancelledCount} order(s) — ${formatCurrency(totalCancelledValue)}`, count: totalCancelledCount, amount: formatCurrency(totalCancelledValue), value: formatCurrency(totalCancelledValue) })}
              </p>
              <p className="text-xs text-rose-600 font-medium">{t('reports.cancelledValueOnly', 'Total Cancelled Value')}</p>
            </div>
          </div>
        )}

        {totalCoinsRedeemed > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">{t('reports.coinsRedeemed')}</p>
              <p className="text-xs text-yellow-600">{t('reports.coinsRedeemedDesc')}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-yellow-800">{formatCurrency(totalCoinsRedeemed)}</p>
              <p className="text-xs text-yellow-600">{t('reports.actualReceived', { amount: formatCurrency(totalRevenue - totalCoinsRedeemed) })}</p>
            </div>
          </div>
        )}

        {chartData.length > 0 && (
          <React.Suspense fallback={<ChartFallback height={300} />}>
            <DailySalesChart
              title={t('reports.salesOverTime')}
              data={chartData}
              currencySymbol={currencySymbolForLanguage(i18n.language)}
              revenueLabel={t('reports.revenue')}
            />
          </React.Suspense>
        )}

        <DataTable
          columns={[
            { header: t('reports.date'), accessor: 'date', render: (item) => formatDate(item.date) },
            { header: t('reports.orders'), accessor: 'totalOrders', align: 'right' },
            { header: t('reports.revenue'), accessor: 'totalRevenue', align: 'right', render: (item) => formatCurrency(item.totalRevenue) },
            { header: t('reports.discount'), accessor: 'totalDiscount', align: 'right', render: (item) => formatCurrency(item.totalDiscount) },
            { header: t('reports.tax'), accessor: 'totalTax', align: 'right', render: (item) => formatCurrency(item.totalTax) },
            ...(totalCoinsRedeemed > 0 ? [{ header: t('reports.coinsRedeemed'), accessor: 'coinsRedeemed' as const, align: 'right' as const, render: (item: any) => formatCurrency(item.coinsRedeemed ?? 0) }] : []),
            { header: t('reports.netRevenue'), accessor: 'netRevenue', align: 'right', render: (item) => formatCurrency(item.netRevenue) },
            { header: t('reports.cancelledOrders', 'Cancelled Orders'), accessor: 'cancelledOrders', align: 'right', render: (item) => item.cancelledOrders ?? 0 },
            { header: t('reports.cancelledValue', 'Cancelled Value'), accessor: 'cancelledRevenue', align: 'right', render: (item) => formatCurrency(item.cancelledRevenue ?? 0) },
          ]}
          data={data}
          keyExtractor={(item) => item.date}
          emptyMessage={t('reports.noSalesData')}
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [t('reports.date'), t('reports.orders'), t('reports.revenue'), t('reports.discount'), t('reports.tax'), ...(totalCoinsRedeemed > 0 ? [t('reports.coinsRedeemed')] : []), t('reports.netRevenue')],
              data.map((d) => [d.date, d.totalOrders.toString(), formatCurrency(d.totalRevenue), formatCurrency(d.totalDiscount), formatCurrency(d.totalTax), ...(totalCoinsRedeemed > 0 ? [formatCurrency(d.coinsRedeemed ?? 0)] : []), formatCurrency(d.netRevenue)]),
              'daily-sales-report'
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>
      </div>
    );
  };

  const renderItemSales = () => {
    const allItems = reports.itemSales;
    const categories = [...new Set(allItems.map((d) => d.categoryName).filter(Boolean))].sort();
    const data = itemFilterCategory ? allItems.filter((d) => d.categoryName === itemFilterCategory) : allItems;
    const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0);

    const top10 = [...data]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map((d) => ({ name: d.name, revenue: d.totalRevenue / 100, quantity: d.quantitySold }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title={t('reports.totalItemsSold')} value={data.reduce((sum, d) => sum + d.quantitySold, 0).toString()} icon={<Package size={20} />} />
          <SummaryCard title={t('reports.totalRevenue')} value={formatCurrency(totalRevenue)} icon={<CurrencyIcon size={20} />} />
          <SummaryCard title={t('reports.uniqueItems')} value={data.length.toString()} icon={<BarChart3 size={20} />} />
        </div>

        {top10.length > 0 && (
          <React.Suspense fallback={<ChartFallback height={350} />}>
            <TopItemsBarChart
              title={t('reports.top10ItemsByRevenue')}
              data={top10}
              currencySymbol={currencySymbolForLanguage(i18n.language)}
              revenueLabel={t('reports.revenue')}
            />
          </React.Suspense>
        )}

        <div className="flex items-center gap-3 mb-3">
          <select
            value={itemFilterCategory}
            onChange={(e) => setItemFilterCategory(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          >
            <option value="">{t('reports.allCategories')}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {itemFilterCategory && (
            <p className="text-sm text-gray-500">{t('reports.itemsOfTotal', { shown: data.length, total: allItems.length })}</p>
          )}
        </div>
        <DataTable
          columns={[
            { header: t('reports.item'), accessor: 'name' },
            { header: t('reports.category'), accessor: 'categoryName' },
            { header: t('reports.qtySold'), accessor: 'quantitySold', align: 'right' },
            { header: t('reports.revenue'), accessor: 'totalRevenue', align: 'right', render: (item) => formatCurrency(item.totalRevenue) },
            { header: t('reports.percentOfTotal'), accessor: 'percentage', align: 'right', render: (item) => totalRevenue > 0 ? `${((item.totalRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%' },
          ]}
          data={data}
          keyExtractor={(item, idx) => item.menuItemId ? `${item.menuItemId}-${item.name}` : `item-${item.name || idx}-${idx}`}
          emptyMessage={t('reports.noItemSalesData')}
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [t('reports.item'), t('reports.category'), t('reports.qtySold'), t('reports.revenue'), t('reports.percentOfTotal')],
              data.map((d) => [d.name, d.categoryName, d.quantitySold.toString(), formatCurrency(d.totalRevenue), totalRevenue > 0 ? `${((d.totalRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%']),
              'item-sales-report'
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>
      </div>
    );
  };

  const renderCategorySales = () => {
    const data = reports.categorySales;
    const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0);

    const pieData = data.map((d, i) => ({
      name: d.categoryName,
      value: d.totalRevenue / 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title={t('reports.categories')} value={data.length.toString()} icon={<PieChartIcon size={20} />} />
          <SummaryCard title={t('reports.totalItemsSold')} value={data.reduce((sum, d) => sum + d.quantitySold, 0).toString()} icon={<Package size={20} />} />
          <SummaryCard title={t('reports.totalRevenue')} value={formatCurrency(totalRevenue)} icon={<CurrencyIcon size={20} />} />
        </div>

        {pieData.length > 0 && (
          <React.Suspense fallback={<ChartFallback height={350} />}>
            <CategoryPieChart
              title={t('reports.categoryDistribution')}
              data={pieData}
              currencySymbol={currencySymbolForLanguage(i18n.language)}
              revenueLabel={t('reports.revenue')}
            />
          </React.Suspense>
        )}

        <DataTable
          columns={[
            { header: t('reports.category'), accessor: 'categoryName' },
            { header: t('reports.itemsSold'), accessor: 'quantitySold', align: 'right' },
            { header: t('reports.revenue'), accessor: 'totalRevenue', align: 'right', render: (item) => formatCurrency(item.totalRevenue) },
            { header: t('reports.tax'), accessor: 'totalTax', align: 'right', render: (item) => formatCurrency(item.totalTax) },
            { header: t('reports.percentOfTotal'), accessor: 'share', align: 'right', render: (item) => totalRevenue > 0 ? `${((item.totalRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%' },
          ]}
          data={data}
          keyExtractor={(item, idx) => item.categoryId ?? item.categoryName ?? idx}
          emptyMessage={t('reports.noCategorySalesData')}
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [t('reports.category'), t('reports.itemsSold'), t('reports.revenue'), t('reports.tax'), t('reports.percentOfTotal')],
              data.map((d) => [d.categoryName, d.quantitySold.toString(), formatCurrency(d.totalRevenue), formatCurrency(d.totalTax), totalRevenue > 0 ? `${((d.totalRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%']),
              'category-sales-report'
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>
      </div>
    );
  };

  const renderPaymentSummary = () => {
    const data = reports.paymentSummary;
    const totalAmount = data.reduce((sum, d) => sum + d.totalAmount, 0);
    // Compute coin redemptions from daily sales data (already fetched)
    const coinRedeemed = reports.dailySales.reduce((sum, d) => sum + (d.coinsRedeemed ?? 0), 0);

    const pieData = data.map((d, i) => ({
      name: d.paymentMode.toUpperCase(),
      value: d.totalAmount / 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

    const cashTotal = data.find((d) => d.paymentMode === 'cash')?.totalAmount ?? 0;
    const cardTotal = data.find((d) => d.paymentMode === 'card')?.totalAmount ?? 0;
    const upiTotal = data.find((d) => d.paymentMode === 'upi')?.totalAmount ?? 0;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title={t('reports.cash')} value={formatCurrency(cashTotal)} icon={<Banknote size={20} />} />
          <SummaryCard title={t('reports.card')} value={formatCurrency(cardTotal)} icon={<CreditCard size={20} />} />
          <SummaryCard title={t('reports.upi')} value={formatCurrency(upiTotal)} icon={<CurrencyIcon size={20} />} />
          <SummaryCard title={t('reports.total')} value={formatCurrency(totalAmount)} icon={<TrendingUp size={20} />} />
        </div>
        {coinRedeemed > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-800">{t('reports.coinsRedeemed')}</p>
              <p className="text-xs text-yellow-600">{t('reports.coinsRedeemedBillDesc')}</p>
            </div>
            <p className="text-lg font-bold text-yellow-800">{formatCurrency(coinRedeemed)}</p>
          </div>
        )}

        {pieData.length > 0 && (
          <React.Suspense fallback={<ChartFallback height={300} />}>
            <PaymentModesPieChart
              title={t('reports.paymentModeDistribution')}
              data={pieData}
              currencySymbol={currencySymbolForLanguage(i18n.language)}
              amountLabel={t('reports.amount')}
            />
          </React.Suspense>
        )}

        <DataTable
          columns={[
            { header: t('reports.paymentMode'), accessor: 'paymentMode', render: (item) => item.paymentMode.toUpperCase() },
            { header: t('reports.transactions'), accessor: 'transactionCount', align: 'right' },
            { header: t('reports.totalAmount'), accessor: 'totalAmount', align: 'right', render: (item) => formatCurrency(item.totalAmount) },
            { header: t('reports.tips'), accessor: 'tipAmount', align: 'right', render: (item) => formatCurrency(item.tipAmount) },
          ]}
          data={data}
          keyExtractor={(item, idx) => item.paymentMode || idx}
          emptyMessage={t('reports.noPaymentData')}
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [t('reports.paymentMode'), t('reports.transactions'), t('reports.totalAmount'), t('reports.tips')],
              data.map((d) => [d.paymentMode.toUpperCase(), d.transactionCount.toString(), formatCurrency(d.totalAmount), formatCurrency(d.tipAmount)]),
              'payment-summary-report'
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>
      </div>
    );
  };

  const renderCashFlow = () => {
    const data = reports.cashFlow;
    if (!data) {
      return (
        <div className="text-center py-12 text-gray-400">
          <Banknote size={40} className="mx-auto mb-3" />
          <p>{t('reports.noCashFlowData')}</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SummaryCard title={t('reports.openingCash')} value={formatCurrency(data.openingCash)} icon={<Banknote size={20} />} />
          <SummaryCard title={t('reports.cashSales')} value={formatCurrency(data.cashSales)} icon={<TrendingUp size={20} />} />
          <SummaryCard title={t('reports.cashExpenses')} value={formatCurrency(data.cashExpenses)} icon={<ArrowUpRight size={20} />} />
          <SummaryCard title={t('reports.expectedCash')} value={formatCurrency(data.expectedCash)} icon={<CurrencyIcon size={20} />} />
          <SummaryCard title={t('reports.closingCash')} value={formatCurrency(data.closingCash)} icon={<Banknote size={20} />} />
          <SummaryCard title={t('reports.difference')} value={formatCurrency(data.difference)} icon={<CurrencyIcon size={20} />} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.cashFlowBreakdown')}</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('reports.openingCash')}</span>
              <span className="font-medium">{formatCurrency(data.openingCash)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-green-600">(+) {t('reports.cashSales')}</span>
              <span className="font-medium text-green-600">{formatCurrency(data.cashSales)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-red-600">(-) {t('reports.cashExpenses')}</span>
              <span className="font-medium text-red-600">{formatCurrency(data.cashExpenses)}</span>
            </div>
            {(data.coinsRedeemed ?? 0) > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-yellow-600">{t('reports.coinsRedeemedNotCash')}</span>
                <span className="font-medium text-yellow-600">{formatCurrency(data.coinsRedeemed)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-700 font-semibold">{t('reports.expectedCash')}</span>
              <span className="font-bold">{formatCurrency(data.expectedCash)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">{t('reports.actualClosingCash')}</span>
              <span className="font-medium">{formatCurrency(data.closingCash)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-semibold">{t('reports.difference')}</span>
              <span className={`font-bold ${data.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(data.difference)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGSTReport = () => {
    const data = reports.gstReport;
    const totalTaxable = data.reduce((sum, d) => sum + d.taxableAmount, 0);
    const totalCGST = data.reduce((sum, d) => sum + d.cgst, 0);
    const totalSGST = data.reduce((sum, d) => sum + d.sgst, 0);
    const totalTax = data.reduce((sum, d) => sum + d.totalTax, 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title={t('reports.taxableAmount')} value={formatCurrency(totalTaxable)} icon={<FileText size={20} />} />
          <SummaryCard title={taxTerms.componentA} value={formatCurrency(totalCGST)} icon={<CurrencyIcon size={20} />} />
          <SummaryCard title={taxTerms.componentB} value={formatCurrency(totalSGST)} icon={<CurrencyIcon size={20} />} />
          <SummaryCard title={t('reports.totalTax')} value={formatCurrency(totalTax)} icon={<CurrencyIcon size={20} />} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">{taxTerms.filingSummaryTitle}</h3>
          <p className="text-xs text-gray-400 mb-4">{t('reports.periodRange', { start: reports.dateRange.startDate, end: reports.dateRange.endDate })}</p>

          <DataTable
            columns={[
              { header: t('reports.taxSlab'), accessor: 'taxRate', render: (item) => `${item.taxRate}%` },
              { header: t('reports.invoices'), accessor: 'invoiceCount', align: 'right' },
              { header: t('reports.taxableValue'), accessor: 'taxableAmount', align: 'right', render: (item) => formatCurrency(item.taxableAmount) },
              { header: taxTerms.componentA, accessor: 'cgst', align: 'right', render: (item) => formatCurrency(item.cgst) },
              { header: taxTerms.componentB, accessor: 'sgst', align: 'right', render: (item) => formatCurrency(item.sgst) },
              { header: t('reports.totalTax'), accessor: 'totalTax', align: 'right', render: (item) => formatCurrency(item.totalTax) },
            ]}
            data={data}
            keyExtractor={(item, idx) => item.taxRate != null ? item.taxRate : idx}
            emptyMessage={t('reports.noGSTData')}
          />
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">{taxTerms.totalTaxable}</span>
              <p className="font-bold text-gray-900">{formatCurrency(totalTaxable)}</p>
            </div>
            <div>
              <span className="text-gray-500">{taxTerms.totalComponentA}</span>
              <p className="font-bold text-gray-900">{formatCurrency(totalCGST)}</p>
            </div>
            <div>
              <span className="text-gray-500">{taxTerms.totalComponentB}</span>
              <p className="font-bold text-gray-900">{formatCurrency(totalSGST)}</p>
            </div>
            <div>
              <span className="text-gray-500">{taxTerms.grandTotalTax}</span>
              <p className="font-bold text-blue-600">{formatCurrency(totalTax)}</p>
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [
                t('reports.taxSlab'),
                t('reports.invoices'),
                t('reports.taxableValue'),
                taxTerms.componentA,
                taxTerms.componentB,
                t('reports.totalTax'),
              ],
              [
                ...data.map((d) => [`${d.taxRate}%`, d.invoiceCount.toString(), formatCurrency(d.taxableAmount), formatCurrency(d.cgst), formatCurrency(d.sgst), formatCurrency(d.totalTax)]),
                [t('reports.totalRow'), data.reduce((s, d) => s + d.invoiceCount, 0).toString(), formatCurrency(totalTaxable), formatCurrency(totalCGST), formatCurrency(totalSGST), formatCurrency(totalTax)],
              ],
              'gst-report'
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>
      </div>
    );
  };

  const renderStaffPerformance = () => {
    const data = reports.staffPerformance;

    const chartData = data.map((d) => ({
      name: d.staffName,
      orders: d.totalOrders,
      revenue: d.totalRevenue / 100,
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title={t('reports.totalStaff')} value={data.length.toString()} icon={<Users size={20} />} />
          <SummaryCard title={t('reports.totalOrders')} value={data.reduce((sum, d) => sum + d.totalOrders, 0).toString()} icon={<ShoppingCart size={20} />} />
          <SummaryCard title={t('reports.totalRevenue')} value={formatCurrency(data.reduce((sum, d) => sum + d.totalRevenue, 0))} icon={<CurrencyIcon size={20} />} />
        </div>

        {chartData.length > 0 && (
          <React.Suspense fallback={<ChartFallback height={300} />}>
            <StaffPerformanceBarChart
              title={t('reports.revenueByStaff')}
              data={chartData}
              revenueLabel={t('reports.revenue')}
              ordersLabel={t('reports.orders')}
            />
          </React.Suspense>
        )}

        <DataTable
          columns={[
            { header: t('reports.staffName'), accessor: 'staffName' },
            { header: t('reports.orders'), accessor: 'totalOrders', align: 'right' },
            { header: t('reports.revenue'), accessor: 'totalRevenue', align: 'right', render: (item) => formatCurrency(item.totalRevenue) },
            { header: t('reports.avgOrderValue'), accessor: 'averageOrderValue', align: 'right', render: (item) => formatCurrency(item.averageOrderValue) },
          ]}
          data={data}
          keyExtractor={(item, idx) => item.staffId ?? item.staffName ?? idx}
          emptyMessage={t('reports.noStaffData')}
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [t('reports.staffName'), t('reports.orders'), t('reports.revenue'), t('reports.avgOrderValue')],
              data.map((d) => [d.staffName, d.totalOrders.toString(), formatCurrency(d.totalRevenue), formatCurrency(d.averageOrderValue)]),
              'staff-performance-report'
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>
      </div>
    );
  };

  const renderInventoryConsumption = () => {
    const data = reports.inventoryConsumption;

    const top10 = [...data]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)
      .map((d) => ({ name: d.ingredientName, consumed: d.totalConsumed, wasted: d.totalWasted, cost: d.totalCost / 100 }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title={t('reports.ingredientsTracked')} value={data.length.toString()} icon={<Package size={20} />} />
          <SummaryCard title={t('reports.totalCost')} value={formatCurrency(data.reduce((sum, d) => sum + d.totalCost, 0))} icon={<CurrencyIcon size={20} />} />
          <SummaryCard title={t('reports.wastageItems')} value={data.filter((d) => d.totalWasted > 0).length.toString()} icon={<AlertCircle size={20} />} />
        </div>

        {top10.length > 0 && (
          <React.Suspense fallback={<ChartFallback height={350} />}>
            <InventoryConsumptionBarChart
              title={t('reports.topConsumedIngredients')}
              data={top10}
              costLabel={t('reports.cost')}
              wastedLabel={t('reports.wasted')}
            />
          </React.Suspense>
        )}

        <DataTable
          columns={[
            { header: t('reports.ingredient'), accessor: 'ingredientName' },
            { header: t('common.unit'), accessor: 'unit' },
            { header: t('reports.consumed'), accessor: 'totalConsumed', align: 'right' },
            { header: t('reports.wasted'), accessor: 'totalWasted', align: 'right' },
            { header: t('reports.cost'), accessor: 'totalCost', align: 'right', render: (item) => formatCurrency(item.totalCost) },
          ]}
          data={data}
          keyExtractor={(item, idx) => item.ingredientId ?? item.ingredientName ?? idx}
          emptyMessage={t('reports.noInventoryData')}
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [t('reports.ingredient'), t('common.unit'), t('reports.consumed'), t('reports.wasted'), t('reports.cost')],
              data.map((d) => [d.ingredientName, d.unit, d.totalConsumed.toString(), d.totalWasted.toString(), formatCurrency(d.totalCost)]),
              'inventory-consumption-report'
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>
      </div>
    );
  };

  const renderKitchenPrepTime = () => {
    const data = kitchenPrepData;
    const avgAll = data.length > 0
      ? (data.reduce((sum, d) => sum + d.avgPrepMinutes * d.orderCount, 0) / data.reduce((sum, d) => sum + d.orderCount, 0)).toFixed(1)
      : '0';

    // Sort by prep time descending so data[0] is the slowest item
    const sorted = [...data].sort((a, b) => b.avgPrepMinutes - a.avgPrepMinutes);
    const chartData = sorted.slice(0, 15).map((d) => ({
      name: d.itemName.length > 20 ? d.itemName.slice(0, 20) + '…' : d.itemName,
      avgMinutes: d.avgPrepMinutes,
      orders: d.orderCount,
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard title={t('reports.itemsTracked')} value={data.length.toString()} icon={<ShoppingCart size={20} />} />
          <SummaryCard title={t('reports.avgPrepTime')} value={t('reports.minutesSuffix', { value: avgAll })} icon={<ArrowUpRight size={20} />} />
          <SummaryCard
            title={t('reports.slowestItem')}
            value={sorted.length > 0 ? t('reports.minutesSuffix', { value: sorted[0]?.avgPrepMinutes }) : '-'}
            icon={<AlertCircle size={20} />}
          />
        </div>

        {chartData.length > 0 && (
          <React.Suspense fallback={<ChartFallback height={400} />}>
            <KitchenPrepTimeBarChart
              title={t('reports.avgPrepTimeByItem')}
              data={chartData}
              avgMinutesLabel={t('reports.avgMinutes')}
            />
          </React.Suspense>
        )}

        <DataTable
          columns={[
            { header: t('reports.item'), accessor: 'itemName' },
            { header: t('reports.avgPrepMinutes'), accessor: 'avgPrepMinutes', align: 'right' },
            { header: t('reports.orderCount'), accessor: 'orderCount', align: 'right' },
          ]}
          data={data}
          keyExtractor={(item, idx) => item.itemName || idx}
          emptyMessage={t('reports.noKitchenData')}
        />
      </div>
    );
  };

  const renderOrderHistory = () => {
    if (orderHistoryLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      );
    }

    const sorted = orderSortKey
      ? [...orderHistory].sort((a, b) => {
          let av = a[orderSortKey] ?? '';
          let bv = b[orderSortKey] ?? '';
          if (orderSortKey === 'updatedAt') {
            av = a.updatedAt || a.createdAt || '';
            bv = b.updatedAt || b.createdAt || '';
          }
          const cmp = typeof av === 'string' ? av.localeCompare(bv) : av < bv ? -1 : av > bv ? 1 : 0;
          return orderSortDir === 'asc' ? cmp : -cmp;
        })
      : [...orderHistory].sort((a, b) => {
          if (orderDateBasis === 'updated_at') {
            const av = a.updatedAt || a.createdAt || '';
            const bv = b.updatedAt || b.createdAt || '';
            return bv.localeCompare(av);
          } else {
            const av = a.createdAt || '';
            const bv = b.createdAt || '';
            return bv.localeCompare(av);
          }
        });

    const handleOrderSort = (key: string) => {
      setOrderHistoryPage(1);
      if (orderSortKey === key) setOrderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setOrderSortKey(key); setOrderSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: string }) => {
      if (orderSortKey !== col) return <ChevronsUpDown size={13} className="inline ml-1 text-gray-400" />;
      return orderSortDir === 'asc'
        ? <ChevronUp size={13} className="inline ml-1 text-blue-600" />
        : <ChevronDown size={13} className="inline ml-1 text-blue-600" />;
    };

    const totalLoaded = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalLoaded / orderHistoryPageSize));
    const safePage = Math.min(orderHistoryPage, totalPages);
    const startIndex = (safePage - 1) * orderHistoryPageSize;
    const endIndex = Math.min(startIndex + orderHistoryPageSize, totalLoaded);
    const paginatedOrders = sorted.slice(startIndex, endIndex);

    const orderTypes = orderHistoryAvailableTypes.length > 0
      ? orderHistoryAvailableTypes
      : [...new Set(orderHistory.map((o) => o.orderType).filter(Boolean))];

    const statusColor = (status: string) => {
      switch (status) {
        case 'completed': return 'bg-green-100 text-green-700';
        case 'active': return 'bg-blue-100 text-blue-700';
        case 'cancelled': return 'bg-red-100 text-red-700';
        case 'hold': return 'bg-yellow-100 text-yellow-700';
        case 'merged': return 'bg-purple-100 text-purple-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    };

    return (
      <div>
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <CustomFilterSelect
            value={orderFilterStatus}
            onChange={setOrderFilterStatus}
            placeholder={t('reports.orderStatus')}
            styleMap={STATUS_STYLES}
            options={[
              { value: 'completed', label: t('reports.statusCompleted') },
              { value: 'active',    label: t('reports.statusActive') },
              { value: 'cancelled', label: t('reports.statusCancelled') },
              { value: 'hold',      label: t('reports.statusHold') },
              { value: 'merged',    label: t('reports.statusMerged') },
            ]}
          />
          <CustomFilterSelect
            value={orderFilterType}
            onChange={setOrderFilterType}
            placeholder={t('reports.orderType')}
            styleMap={TYPE_STYLES}
            options={orderTypes.map((ot) => ({ value: ot, label: ot.replace(/_/g, ' ') }))}
          />
          {/* Order date basis toggle: Updated (default) vs Created */}
          <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setOrderDateBasis('updated_at')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                orderDateBasis === 'updated_at'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t('reports.dateByUpdated', 'Last Updated')}
            </button>
            <button
              type="button"
              onClick={() => setOrderDateBasis('created_at')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                orderDateBasis === 'created_at'
                  ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t('reports.dateByCreated', 'Order Placed')}
            </button>
          </div>
          <span className="text-xs text-gray-400 px-1">
            {t('reports.ordersLoaded', { count: orderHistory.length })}{orderHistoryHasMore ? '+' : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {selectedOrderIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 size={14} />
                {t('reports.deleteSelected', { count: selectedOrderIds.size })}
              </button>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() =>
                exportToCSV(
                  [t('reports.orderNumber'), t('reports.date'), t('common.type'), t('reports.table'), t('reports.staffName'), t('reports.customer'), t('reports.phone'), t('common.items'), t('common.status'), t('reports.subtotal'), t('reports.discount'), t('reports.tax'), t('reports.total'), t('reports.coinsRedeemed')],
                  orderHistory.map((o) => [
                    o.orderNumber,
                    formatDate(orderDateBasis === 'updated_at' ? (o.updatedAt || o.createdAt) : o.createdAt),
                    o.orderType,
                    o.tableName ?? '-',
                    o.staffName ?? '-',
                    o.customerName ?? '-',
                    o.customerPhone ?? '-',
                    String(o.itemCount ?? 0),
                    o.status,
                    formatCurrency(o.subtotal),
                    formatCurrency(o.discountAmount ?? 0),
                    formatCurrency(o.taxAmount ?? 0),
                    formatCurrency(o.grandTotal - (o.coinsRedeemed ?? 0)),
                    o.coinsRedeemed > 0 ? formatCurrency(o.coinsRedeemed) : '-',
                  ]),
                  'order-history'
                )
              }
            >
              {t('reports.exportCsv')}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="rounded cursor-pointer"
                    checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedOrderIds.has(o.id))}
                    onChange={(e) => {
                      const next = new Set(selectedOrderIds);
                      if (e.target.checked) paginatedOrders.forEach((o) => next.add(o.id));
                      else paginatedOrders.forEach((o) => next.delete(o.id));
                      setSelectedOrderIds(next);
                    }}
                  />
                </th>
                {([
                  { label: t('reports.orderNumber'), key: 'orderNumber', align: 'left', nowrap: true },
                  { label: orderDateBasis === 'updated_at' ? t('reports.dateUpdated', 'Last Updated') : t('reports.dateCreated', 'Order Placed'), key: orderDateBasis === 'updated_at' ? 'updatedAt' : 'createdAt', align: 'left', nowrap: true },
                  { label: t('common.type'), key: 'orderType', align: 'left' },
                  { label: t('reports.table'), key: 'tableName', align: 'left' },
                  { label: t('reports.staffName'), key: 'staffName', align: 'left' },
                  { label: t('reports.customer'), key: 'customerName', align: 'left' },
                  { label: t('common.items'), key: 'itemCount', align: 'center' },
                  { label: t('common.status'), key: 'status', align: 'left' },
                  { label: t('reports.subtotal'), key: 'subtotal', align: 'right' },
                  { label: t('reports.disc'), key: 'discountAmount', align: 'right' },
                  { label: taxTerms.scheme, key: 'taxAmount', align: 'right' },
                  { label: t('reports.total'), key: 'grandTotal', align: 'right' },
                ] as { label: string; key: string; align: string; nowrap?: boolean }[]).map(({ label, key, align, nowrap }) => (
                  <th
                    key={key}
                    onClick={() => handleOrderSort(key)}
                    className={`px-3 py-3 font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 text-${align}${nowrap ? ' whitespace-nowrap' : ''}`}
                  >
                    {label}<SortIcon col={key} />
                  </th>
                ))}
                <th className="text-center px-3 py-3 font-medium text-gray-600">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orderHistoryLoading && orderHistory.length === 0 ? (
                Array.from({ length: 8 }).map((_, rIdx) => (
                  <tr key={`oh-shimmer-${rIdx}`} className="border-b border-gray-100">
                    <td className="px-3 py-3 w-8"><div className="shimmer h-4 w-4 rounded" /></td>
                    <td className="px-3 py-3"><div className="shimmer h-4 w-28 rounded" /></td>
                    <td className="px-3 py-3"><div className="shimmer h-4 w-20 rounded" /></td>
                    <td className="px-3 py-3"><div className="shimmer h-4 w-16 rounded" /></td>
                    <td className="px-3 py-3"><div className="shimmer h-4 w-20 rounded" /></td>
                    <td className="px-3 py-3"><div className="shimmer h-4 w-14 rounded" /></td>
                    <td className="px-3 py-3"><div className="shimmer h-4 w-24 rounded" /></td>
                    <td className="px-3 py-3 text-center"><div className="shimmer h-5 w-6 rounded-full mx-auto" /></td>
                    <td className="px-3 py-3 text-right"><div className="shimmer h-4 w-16 ml-auto rounded" /></td>
                    <td className="px-3 py-3 text-right"><div className="shimmer h-4 w-16 ml-auto rounded" /></td>
                    <td className="px-3 py-3 text-center"><div className="shimmer h-4 w-16 mx-auto rounded-full" /></td>
                    <td className="px-3 py-3 text-center"><div className="shimmer h-4 w-12 mx-auto rounded" /></td>
                  </tr>
                ))
              ) : (
                paginatedOrders.map((order) => (
                <React.Fragment key={order.id}>
                <tr
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${expandedOrderId === order.id ? 'bg-blue-50' : ''} ${selectedOrderIds.has(order.id) ? 'bg-red-50' : ''}`}
                  onClick={() => toggleOrderExpand(order.id)}
                >
                  <td className="px-3 py-2.5 w-8" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedOrderIds.has(order.id)}
                      onChange={(e) => {
                        const next = new Set(selectedOrderIds);
                        if (e.target.checked) next.add(order.id);
                        else next.delete(order.id);
                        setSelectedOrderIds(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{order.orderNumber}</span>
                      {order.splitFromOrderNumber && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200" title={`Created by splitting from ${order.splitFromOrderNumber}`}>
                          {t('reports.splitFrom', { order: order.splitFromOrderNumber, defaultValue: `Split from ${order.splitFromOrderNumber}` })}
                        </span>
                      )}
                      {!order.splitFromOrderNumber && order.notes?.includes('Split from') && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {order.notes.split('|').find((n: string) => n.trim().startsWith('Split from'))?.trim() || 'Split bill'}
                        </span>
                      )}
                      {order.notes?.includes('Split into') && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                          {order.notes.split('|').find((n: string) => n.trim().startsWith('Split into'))?.trim() || 'Split into'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{formatDateTime(orderDateBasis === 'updated_at' ? (order.updatedAt || order.createdAt) : order.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <span className="capitalize">{order.orderType?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{order.tableName ?? '-'}</td>
                  <td className="px-3 py-2.5 text-gray-600">{order.staffName ?? '-'}</td>
                  <td className="px-3 py-2.5">
                    {order.customerName || order.customerPhone ? (
                      <div>
                        <span className="text-gray-900">
                          {order.customerName && order.customerName !== order.customerPhone
                            ? order.customerName
                            : order.customerPhone}
                        </span>
                        {order.customerName && order.customerName !== order.customerPhone && order.customerPhone && (
                          <span className="block text-[10px] text-gray-400">{order.customerPhone}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-700" title={order.itemNames}>
                      {order.itemCount ?? 0}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize w-fit ${statusColor(order.status)}`}>
                        {order.status === 'merged' && order.mergedIntoOrderNumber
                          ? t('reports.mergedInto', { target: order.mergedIntoOrderNumber, defaultValue: `Merged → ${order.mergedIntoOrderNumber}` })
                          : order.status}
                      </span>
                      {order.cancellation_reason && (
                        <span className="text-[10px] text-red-600 font-medium truncate max-w-[140px]" title={order.cancellation_reason}>
                          {order.cancellation_reason}
                        </span>
                      )}
                      {order.status === 'merged' && !order.mergedIntoOrderNumber && order.notes && (
                        <span className="text-[10px] text-purple-700 font-medium truncate max-w-[140px]" title={order.notes}>
                          {order.notes}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(order.subtotal)}</td>
                  <td className="px-3 py-2.5 text-right text-red-600">{order.discountAmount ? `-${formatCurrency(order.discountAmount)}` : '-'}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(order.taxAmount ?? 0)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-semibold">{formatCurrency(order.grandTotal - (order.coinsRedeemed ?? 0))}</span>
                    {order.coinsRedeemed > 0 && (
                      <span className="block text-[10px] text-yellow-600">{t('reports.coinsNegative', { amount: formatCurrency(order.coinsRedeemed) })}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(order.status === 'active' || order.status === 'hold') && (
                      <button
                        onClick={() => handleOpenCompleteModal(order)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                        title={t('reports.completeOrder', 'Complete Order')}
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title={t('reports.deleteOrder')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>

                {/* Expanded items row */}
                {expandedOrderId === order.id && (
                  <tr className="border-b border-gray-100 bg-blue-50/50">
                    <td colSpan={13} className="px-6 py-3">
                      {order.cancellation_reason && (
                        <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-red-100/70 border border-red-200 text-xs text-red-800 font-medium flex items-center gap-2">
                          <Trash2 size={13} className="text-red-600 shrink-0" />
                          <span><strong>{t('reports.cancellationReason', 'Cancellation Reason')}:</strong> {order.cancellation_reason}</span>
                        </div>
                      )}
                      {order.status === 'merged' && (
                        <div className="mb-2.5 px-3 py-2 rounded-lg bg-purple-100/80 border border-purple-200 text-xs text-purple-900 font-medium flex items-center gap-2">
                          <CheckCircle size={14} className="text-purple-600 shrink-0" />
                          <span>
                            {t('reports.mergedOrderInfo', {
                              target: order.mergedIntoOrderNumber || (order.notes?.includes('Merged into') ? order.notes : 'another order'),
                              defaultValue: 'This order was merged into {{target}}. All items and value were transferred to that order.',
                            })}
                          </span>
                        </div>
                      )}
                      {order.splitFromOrderNumber && (
                        <div className="mb-2.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium flex items-center gap-2">
                          <ClipboardList size={14} className="text-amber-600 shrink-0" />
                          <span>
                            {t('reports.splitFromOrderInfo', {
                              order: order.splitFromOrderNumber,
                              defaultValue: `This order was created by splitting items from ${order.splitFromOrderNumber}.`,
                            })}
                          </span>
                        </div>
                      )}
                      {!order.splitFromOrderNumber && order.notes?.includes('Split from') && (
                        <div className="mb-2.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium flex items-center gap-2">
                          <ClipboardList size={14} className="text-amber-600 shrink-0" />
                          <span>
                            {order.notes.split('|').find((n: string) => n.trim().startsWith('Split from'))?.trim()}
                          </span>
                        </div>
                      )}
                      {order.notes?.includes('Split into') && (
                        <div className="mb-2.5 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 font-medium flex items-center gap-2">
                          <ClipboardList size={14} className="text-sky-600 shrink-0" />
                          <span>
                            {order.notes.split('|').find((n: string) => n.trim().startsWith('Split into'))?.trim()}
                          </span>
                        </div>
                      )}
                      {expandedOrderLoading ? (
                        <div className="space-y-2 py-1">
                          <div className="shimmer h-3.5 w-48 rounded" />
                          <div className="shimmer h-3.5 w-64 rounded" />
                        </div>
                      ) : expandedOrderItems.length === 0 ? (
                        order.status === 'merged' ? (
                          <p className="text-xs text-purple-700 italic">
                            {t('reports.mergedNoItems', 'All items were transferred to the merged target order.')}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">{t('reports.noItems')}</p>
                        )
                      ) : (() => {
                        const defaultTable = order.tableName || (order.tableId ? `Table #${order.tableId}` : null);
                        const distinctTables = Array.from(
                          new Set(
                            expandedOrderItems
                              .map((it: any) => (it.sourceTableName || defaultTable || '').trim())
                              .filter(Boolean)
                          )
                        );
                        const hasMultipleTables = distinctTables.length > 1;

                        const tableGroups: { tableName: string; items: any[] }[] = [];
                        if (hasMultipleTables) {
                          const map: Record<string, any[]> = {};
                          expandedOrderItems.forEach((it: any) => {
                            const tbl = (it.sourceTableName || defaultTable || t('reports.mainOrder', 'Main Order')).trim();
                            if (!map[tbl]) {
                              map[tbl] = [];
                              tableGroups.push({ tableName: tbl, items: map[tbl] });
                            }
                            map[tbl].push(it);
                          });
                        }

                        return (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 border-b border-gray-200">
                                <th className="text-left pb-1.5 font-medium w-8">#</th>
                                <th className="text-left pb-1.5 font-medium">{t('reports.item')}</th>
                                <th className="text-center pb-1.5 font-medium w-16">{t('common.qty')}</th>
                                <th className="text-right pb-1.5 font-medium w-24">{t('reports.unitPrice')}</th>
                                <th className="text-right pb-1.5 font-medium w-24">{t('reports.total')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hasMultipleTables ? (
                                tableGroups.map((grp) => (
                                  <React.Fragment key={grp.tableName}>
                                    <tr className="bg-indigo-50/80 border-y border-indigo-100/80">
                                      <td colSpan={5} className="py-1 px-2.5">
                                        <div className="flex items-center justify-between">
                                          <span className="font-semibold text-indigo-900 flex items-center gap-1.5 text-[11px]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                            {grp.tableName}
                                          </span>
                                          <span className="text-[10px] text-indigo-600 font-medium">
                                            {grp.items.length} {grp.items.length === 1 ? t('common.item', 'item') : t('common.items', 'items')}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                    {grp.items.map((item: any, idx: number) => (
                                      <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                                        <td className="py-1.5 text-gray-400">{idx + 1}</td>
                                        <td className="py-1.5 text-gray-800 font-medium">
                                          <span>{item.name}</span>
                                          {item.addons?.length > 0 && (
                                            <span className="block text-[10px] text-gray-400 font-normal">
                                              + {item.addons.map((a: any) => a.name).join(', ')}
                                            </span>
                                          )}
                                          {item.notes && (
                                            <span className="block text-[10px] text-yellow-600 font-normal">* {item.notes}</span>
                                          )}
                                        </td>
                                        <td className="py-1.5 text-center text-gray-600">{item.quantity}</td>
                                        <td className="py-1.5 text-right text-gray-600">{formatCurrency(item.unitPrice ?? item.unit_price)}</td>
                                        <td className="py-1.5 text-right font-semibold text-gray-800">{formatCurrency((item.unitPrice ?? item.unit_price) * item.quantity)}</td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                ))
                              ) : (
                                expandedOrderItems.map((item: any, idx: number) => (
                                  <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                                    <td className="py-1.5 text-gray-400">{idx + 1}</td>
                                    <td className="py-1.5 text-gray-800 font-medium">
                                      <span>{item.name}</span>
                                      {item.addons?.length > 0 && (
                                        <span className="block text-[10px] text-gray-400 font-normal">
                                          + {item.addons.map((a: any) => a.name).join(', ')}
                                        </span>
                                      )}
                                      {item.notes && (
                                        <span className="block text-[10px] text-yellow-600 font-normal">* {item.notes}</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 text-center text-gray-600">{item.quantity}</td>
                                    <td className="py-1.5 text-right text-gray-600">{formatCurrency(item.unitPrice ?? item.unit_price)}</td>
                                    <td className="py-1.5 text-right font-semibold text-gray-800">{formatCurrency((item.unitPrice ?? item.unit_price) * item.quantity)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        );
                      })()}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              )))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalLoaded > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-t-0 border-gray-200 rounded-b-xl text-xs text-gray-600">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                {t('reports.showing', 'Showing')}{' '}
                <strong className="text-gray-900 font-semibold">{startIndex + 1}–{endIndex}</strong>{' '}
                {t('reports.of', 'of')}{' '}
                <strong className="text-gray-900 font-semibold">{totalLoaded}</strong>{' '}
                {t('reports.loaded', 'orders')}
                {orderHistoryHasMore && (
                  <span className="text-blue-600 font-medium"> ({t('reports.moreInDb', 'more in database')})</span>
                )}
              </span>
              <span className="text-gray-300">|</span>
              <label className="flex items-center gap-1.5 text-gray-500">
                <span>{t('reports.rowsPerPage', 'Rows per page')}:</span>
                <select
                  value={orderHistoryPageSize}
                  onChange={(e) => {
                    setOrderHistoryPageSize(Number(e.target.value));
                    setOrderHistoryPage(1);
                  }}
                  className="border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {orderHistoryHasMore && (
                <button
                  type="button"
                  disabled={orderHistoryLoadingMore}
                  onClick={() => fetchOrderHistory(true)}
                  className="mr-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {orderHistoryLoadingMore ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> {t('reports.loadingMoreOrders', 'Loading...')}
                    </>
                  ) : (
                    <>
                      <Download size={12} /> {t('reports.loadMoreDb', 'Load Next +100 from DB')}
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setOrderHistoryPage(1)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-gray-600"
                title={t('common.firstPage', 'First Page')}
              >
                <ChevronsLeft size={16} />
              </button>

              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setOrderHistoryPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-gray-600"
                title={t('common.prevPage', 'Previous Page')}
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-2 font-medium text-gray-700">
                {t('common.pageOf', { current: safePage, total: totalPages, defaultValue: `Page ${safePage} of ${totalPages}` })}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages && !orderHistoryHasMore}
                onClick={async () => {
                  if (safePage < totalPages) {
                    setOrderHistoryPage((p) => p + 1);
                  } else if (orderHistoryHasMore && !orderHistoryLoadingMore) {
                    await fetchOrderHistory(true);
                    setOrderHistoryPage((p) => p + 1);
                  }
                }}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-gray-600"
                title={t('common.nextPage', 'Next Page')}
              >
                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setOrderHistoryPage(totalPages)}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed text-gray-600"
                title={t('common.lastPage', 'Last Page')}
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Empty state when filters yield nothing */}
        {orderHistory.length === 0 && !orderHistoryLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ClipboardList size={36} strokeWidth={1.5} />
            <p className="mt-2 text-sm">{t('reports.noOrdersMatch')}</p>
          </div>
        )}
      </div>
    );
  };

  const renderTableWise = () => {
    if (tableWiseLoading) {
      return (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
            <div className="shimmer h-7 w-48 rounded" />
            <div className="shimmer h-7 w-28 rounded-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`tw-shimmer-${i}`} className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs space-y-3">
                <div className="flex justify-between">
                  <div className="shimmer h-4 w-20 rounded" />
                  <div className="shimmer h-4 w-12 rounded" />
                </div>
                <div className="shimmer h-6 w-24 rounded" />
                <div className="shimmer h-3 w-32 rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (tableWiseData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <LayoutGrid size={40} strokeWidth={1.5} />
          <p className="mt-2 text-sm">{t('reports.noTableOrders')}</p>
        </div>
      );
    }

    const totalRevenue = tableWiseData.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = tableWiseData.reduce((s, d) => s + d.totalOrders, 0);

    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard title={t('reports.totalTables')} value={String(tableWiseData.length)} icon={<LayoutGrid size={20} />} />
          <SummaryCard title={t('reports.totalOrders')} value={String(totalOrders)} icon={<ClipboardList size={20} />} />
          <SummaryCard title={t('reports.totalRevenue')} value={formatCurrency(totalRevenue)} icon={<CurrencyIcon size={20} />} />
        </div>

        <React.Suspense fallback={<ChartFallback height={300} />}>
          <TableWiseBarCharts
            data={tableWiseData}
            revenueTitle={t('reports.revenueByTable')}
            ordersTitle={t('reports.ordersByTable')}
            completedLabel={t('reports.statusCompleted')}
            cancelledLabel={t('reports.statusCancelled')}
            formatCurrencyFn={formatCurrency}
          />
        </React.Suspense>

        <div className="flex justify-end mb-4">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() =>
              exportToCSV(
                [t('reports.table'), t('reports.totalOrders'), t('reports.statusCompleted'), t('reports.statusCancelled'), t('reports.revenue'), t('reports.discount'), t('reports.tax')],
                tableWiseData.map((d) => [
                  d.tableName,
                  String(d.totalOrders),
                  String(d.completedOrders),
                  String(d.cancelledOrders),
                  formatCurrency(d.revenue),
                  formatCurrency(d.discount),
                  formatCurrency(d.tax),
                ]),
                'table-wise-report'
              )
            }
          >
            {t('reports.exportCsv')}
          </Button>
        </div>

        <DataTable
          columns={[
            { header: t('reports.table'), accessor: 'tableName' },
            { header: t('reports.totalOrders'), accessor: 'totalOrders', align: 'right' },
            { header: t('reports.statusCompleted'), accessor: 'completedOrders', align: 'right', render: (item) => <span className="text-green-600 font-medium">{item.completedOrders}</span> },
            { header: t('reports.statusCancelled'), accessor: 'cancelledOrders', align: 'right', render: (item) => <span className="text-red-600">{item.cancelledOrders}</span> },
            { header: t('reports.revenue'), accessor: 'revenue', align: 'right', render: (item) => <span className="font-semibold">{formatCurrency(item.revenue)}</span> },
            { header: t('reports.discount'), accessor: 'discount', align: 'right', render: (item) => item.discount ? <span className="text-red-600">-{formatCurrency(item.discount)}</span> : '-' },
            { header: taxTerms.scheme, accessor: 'tax', align: 'right', render: (item) => formatCurrency(item.tax) },
          ]}
          data={tableWiseData}
          keyExtractor={(item, idx) => item.tableId ?? item.tableName ?? idx}
          emptyMessage={t('reports.noDataForPeriod', 'No table sales data available for this period')}
        />
      </div>
    );
  };

  const renderBusyHours = () => {
    const report = reports.busyHours;
    if (!report) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Clock size={40} strokeWidth={1.5} />
          <p className="mt-2 text-sm">{t('reports.noBusyHoursData', 'No data for the selected period')}</p>
        </div>
      );
    }

    const VIEWS: { key: 'day' | 'week' | 'month' | 'year'; label: string }[] = [
      { key: 'day', label: t('reports.byHourOfDay', 'By Hour of Day') },
      { key: 'week', label: t('reports.byDayOfWeek', 'By Day of Week') },
      { key: 'month', label: t('reports.byMonth', 'By Month') },
      { key: 'year', label: t('reports.byYear', 'By Year') },
    ];

    const formatHour = (h: number) => {
      const ampm = h < 12 ? 'AM' : 'PM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      return `${hr} ${ampm}`;
    };
    // Jan 1, 2023 was a Sunday, so adding the weekday index yields the right day name.
    const weekdayLabel = (w: number) => new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2023, 0, 1 + w));
    const monthLabel = (m: number) => new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(new Date(2023, m - 1, 1));
    const labelFor = (bucket: number) => {
      switch (busyHoursView) {
        case 'day': return formatHour(bucket);
        case 'week': return weekdayLabel(bucket);
        case 'month': return monthLabel(bucket);
        case 'year': return String(bucket);
      }
    };

    // Overall busiest bucket per dimension (independent of the active view).
    const topBucket = (arr: typeof report.byHour) =>
      arr.reduce<typeof arr[number] | null>((best, b) => (b.orders > (best?.orders ?? 0) ? b : best), null);
    const peakHour = topBucket(report.byHour);
    const peakWeekday = topBucket(report.byWeekday);
    const peakMonth = topBucket(report.byMonth);

    const buckets =
      busyHoursView === 'day' ? report.byHour
      : busyHoursView === 'week' ? report.byWeekday
      : busyHoursView === 'month' ? report.byMonth
      : report.byYear;

    const totalOrders = buckets.reduce((s, b) => s + b.orders, 0);
    const totalRevenue = buckets.reduce((s, b) => s + b.revenue, 0);
    const peak = buckets.reduce<typeof buckets[number] | null>((best, b) => (b.orders > (best?.orders ?? 0) ? b : best), null);

    const chartData = buckets.map((b) => ({
      name: labelFor(b.bucket),
      orders: b.orders,
      revenue: b.revenue / 100,
      isPeak: peak ? b.bucket === peak.bucket && b.orders > 0 : false,
    }));

    const HIGHLIGHTS: { label: string; bucket: typeof peakHour; fmt: (n: number) => string; icon: React.ReactNode }[] = [
      { label: t('reports.busiestHour', 'Busiest Hour'), bucket: peakHour, fmt: formatHour, icon: <Clock size={18} /> },
      { label: t('reports.busiestDay', 'Busiest Day'), bucket: peakWeekday, fmt: weekdayLabel, icon: <Calendar size={18} /> },
      { label: t('reports.busiestMonth', 'Busiest Month'), bucket: peakMonth, fmt: monthLabel, icon: <TrendingUp size={18} /> },
    ];

    return (
      <div className="space-y-6">
        {/* Overall peak highlights (independent of the active view) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-5">
              <div className="flex items-center gap-2 text-blue-600">
                {h.icon}
                <p className="text-sm font-medium text-gray-600">{h.label}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {h.bucket && h.bucket.orders > 0 ? h.fmt(h.bucket.bucket) : '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {h.bucket && h.bucket.orders > 0
                  ? t('reports.ordersAndRevenue', { orders: h.bucket.orders, revenue: formatCurrency(h.bucket.revenue) })
                  : t('reports.noBusyHoursData', 'No data for the selected period')}
              </p>
            </div>
          ))}
        </div>

        {/* Granularity toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setBusyHoursView(v.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                busyHoursView === v.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            title={t('reports.peakPeriod', 'Peak Period')}
            value={peak && peak.orders > 0 ? labelFor(peak.bucket) : '-'}
            icon={<Clock size={20} />}
          />
          <SummaryCard
            title={t('reports.peakOrders', 'Peak Orders')}
            value={peak ? peak.orders.toString() : '0'}
            icon={<ShoppingCart size={20} />}
          />
          <SummaryCard
            title={t('reports.totalOrders')}
            value={totalOrders.toString()}
            icon={<TrendingUp size={20} />}
          />
        </div>

        {totalOrders > 0 ? (
          <React.Suspense fallback={<ChartFallback height={320} />}>
            <BusyHoursBarChart
              title={t('reports.ordersDistribution', 'Orders Distribution')}
              data={chartData}
              ordersLabel={t('reports.orders')}
              busyHoursView={busyHoursView}
            />
          </React.Suspense>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            <Clock size={36} strokeWidth={1.5} />
            <p className="mt-2 text-sm">{t('reports.noBusyHoursData', 'No data for the selected period')}</p>
          </div>
        )}

        <DataTable
          columns={[
            { header: t('reports.period', 'Period'), accessor: 'name' },
            { header: t('reports.orders'), accessor: 'orders', align: 'right' },
            { header: t('reports.revenue'), accessor: 'revenue', align: 'right', render: (item: any) => formatCurrency(item.revenueRaw) },
            { header: t('reports.percentOfTotal'), accessor: 'share', align: 'right', render: (item: any) => totalOrders > 0 ? `${((item.orders / totalOrders) * 100).toFixed(1)}%` : '0%' },
          ]}
          data={buckets.map((b) => ({ name: labelFor(b.bucket), orders: b.orders, revenueRaw: b.revenue, bucket: b.bucket }))}
          keyExtractor={(item: any) => String(item.bucket)}
          emptyMessage={t('reports.noBusyHoursData', 'No data for the selected period')}
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<Download size={14} />}
          onClick={() =>
            exportToCSV(
              [t('reports.period', 'Period'), t('reports.orders'), t('reports.revenue'), t('reports.percentOfTotal')],
              buckets.map((b) => [
                labelFor(b.bucket),
                b.orders.toString(),
                formatCurrency(b.revenue),
                totalOrders > 0 ? `${((b.orders / totalOrders) * 100).toFixed(1)}%` : '0%',
              ]),
              `busy-hours-${busyHoursView}-report`
            )
          }
        >
          {t('reports.exportCsv')}
        </Button>

        {totalRevenue > 0 && (
          <p className="text-xs text-gray-400">{t('reports.busyHoursLocalNote', 'Times shown in your local timezone. Cancelled orders are excluded.')}</p>
        )}
      </div>
    );
  };

  const renderVoidAudit = () => {
    const data = reports.voidReport;
    const items = data?.items ?? [];
    const totalCount = data?.totalVoidCount ?? 0;
    const totalAmount = data?.totalVoidAmount ?? 0;
    const reasonBreakdown = data?.reasonBreakdown ?? [];

    const filteredItems = items.filter((item) => {
      if (voidFilterReason && item.reason !== voidFilterReason) return false;
      if (voidSearch.trim()) {
        const q = voidSearch.toLowerCase();
        const matchName = item.itemName.toLowerCase().includes(q);
        const matchOrder = item.orderNumber.toLowerCase().includes(q);
        const matchTable = item.tableName.toLowerCase().includes(q);
        const matchReason = item.reason.toLowerCase().includes(q);
        const matchStaff = (item.staffName || '').toLowerCase().includes(q);
        if (!matchName && !matchOrder && !matchTable && !matchReason && !matchStaff) return false;
      }
      return true;
    });

    const columns = [
      {
        accessor: 'voidedAt',
        header: t('reports.date', 'Date & Time'),
        sortable: true,
        render: (item: any) => (
          <span className="text-xs text-gray-700 font-medium">
            {formatDateTime(item.voidedAt)}
          </span>
        ),
      },
      {
        accessor: 'orderNumber',
        header: t('reports.orderNo', 'Order #'),
        sortable: true,
        render: (item: any) => (
          <span className="text-xs font-bold text-gray-900">
            {item.orderNumber}
          </span>
        ),
      },
      {
        accessor: 'tableName',
        header: t('reports.tableOrMode', 'Table / Mode'),
        sortable: true,
        render: (item: any) => (
          <span className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded">
            {item.tableName}
          </span>
        ),
      },
      {
        accessor: 'itemName',
        header: t('reports.item', 'Item Name'),
        sortable: true,
        render: (item: any) => (
          <div>
            <p className="text-xs font-semibold text-gray-900">{item.itemName}</p>
            {item.variationName && (
              <p className="text-[10px] text-gray-500">{item.variationName}</p>
            )}
          </div>
        ),
      },
      {
        accessor: 'quantity',
        header: t('reports.qty', 'Qty'),
        sortable: true,
        render: (item: any) => (
          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {item.quantity}
          </span>
        ),
      },
      {
        accessor: 'totalAmount',
        header: t('reports.amount', 'Void Amount'),
        sortable: true,
        render: (item: any) => (
          <span className="text-xs font-bold text-gray-900">
            {formatCurrency(item.totalAmount)}
          </span>
        ),
      },
      {
        accessor: 'reason',
        header: t('reports.cancellationReason', 'Cancellation Reason'),
        sortable: true,
        render: (item: any) => (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
            <Trash2 size={10} className="text-red-500" />
            {item.reason}
          </span>
        ),
      },
      {
        accessor: 'staffName',
        header: t('reports.staff', 'Staff / Cashier'),
        sortable: true,
        render: (item: any) => (
          <span className="text-xs text-gray-600">
            {item.staffName || '—'}
          </span>
        ),
      },
    ];

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard
            title={t('reports.totalVoidItems', 'Total Items Voided')}
            value={String(totalCount)}
            icon={<Trash2 size={24} className="text-red-600" />}
          />
          <SummaryCard
            title={t('reports.totalVoidValue', 'Total Voided Value')}
            value={formatCurrency(totalAmount)}
            icon={<CurrencyIcon size={24} className="text-red-600" />}
          />
          <SummaryCard
            title={t('reports.topVoidReason', 'Top Void Reason')}
            value={reasonBreakdown[0] ? `${reasonBreakdown[0].reason} (${reasonBreakdown[0].count})` : 'None'}
            icon={<AlertCircle size={24} className="text-amber-600" />}
          />
        </div>

        {/* Reason Breakdown Pills */}
        {reasonBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              {t('reports.reasonBreakdown', 'Void Breakdown by Reason')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {reasonBreakdown.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => setVoidFilterReason((prev) => (prev === r.reason ? '' : r.reason))}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-2 ${
                    voidFilterReason === r.reason
                      ? 'bg-red-600 text-white border-red-700 shadow-xs'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  <span className="font-semibold">{r.reason}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${voidFilterReason === r.reason ? 'bg-red-800 text-white' : 'bg-gray-200 text-gray-800'}`}>
                    {r.count} ({formatCurrency(r.totalAmount)})
                  </span>
                </button>
              ))}
              {voidFilterReason && (
                <button
                  onClick={() => setVoidFilterReason('')}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 font-medium underline"
                >
                  {t('common.clearFilter', 'Show All')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <input
              type="text"
              value={voidSearch}
              onChange={(e) => setVoidSearch(e.target.value)}
              placeholder={t('reports.searchVoidAudit', 'Search by item, order #, table, reason, staff...')}
              className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            {voidSearch && (
              <button
                onClick={() => setVoidSearch('')}
                className="text-xs text-gray-400 hover:text-gray-600 px-1"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {t('reports.showingEntries', 'Showing {{count}} void entries', { count: filteredItems.length })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() =>
                exportToCSV(
                  ['Date & Time', 'Order #', 'Table / Mode', 'Item Name', 'Variation', 'Qty', 'Unit Price', 'Total Amount', 'Cancellation Reason', 'Staff'],
                  filteredItems.map((i) => [
                    formatDateTime(i.voidedAt),
                    i.orderNumber,
                    i.tableName,
                    i.itemName,
                    i.variationName || '',
                    String(i.quantity),
                    formatCurrency(i.unitPrice),
                    formatCurrency(i.totalAmount),
                    i.reason,
                    i.staffName || '',
                  ]),
                  `void-audit-report-${reports.dateRange.startDate}-to-${reports.dateRange.endDate}`
                )
              }
              disabled={filteredItems.length === 0}
            >
              {t('reports.exportCsv')}
            </Button>
          </div>
        </div>

        {/* Void Audit Data Table */}
        <DataTable
          columns={columns}
          data={filteredItems}
          keyExtractor={(item, idx) => item.id ?? idx}
          emptyMessage={t('reports.noVoidRecords', 'No voided or cancelled items recorded for this period.')}
        />
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'order_history': return renderOrderHistory();
      case 'daily_sales': return renderDailySales();
      case 'item_sales': return renderItemSales();
      case 'category_sales': return renderCategorySales();
      case 'payment_summary': return renderPaymentSummary();
      case 'cash_flow': return renderCashFlow();
      case 'gst': return renderGSTReport();
      case 'staff_performance': return renderStaffPerformance();
      case 'inventory': return renderInventoryConsumption();
      case 'kitchen_prep': return renderKitchenPrepTime();
      case 'table_wise': return renderTableWise();
      case 'busy_hours': return renderBusyHours();
      case 'void_audit': return renderVoidAudit();
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-sm font-bold text-gray-900">{t('nav.reports')}</h1>
          <Button variant="secondary" size="sm" icon={<Printer size={13} />} onClick={handlePrint}>
            {t('reports.print')}
          </Button>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Calendar size={13} className="text-gray-400" />
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => reports.setDatePreset(p.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                reports.datePreset === p.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getDatePresetLabel(p.key)}
            </button>
          ))}
          {reports.datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={reports.dateRange.startDate}
                onChange={(e) => reports.setDateRange({ ...reports.dateRange, startDate: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              />
              <span className="text-gray-400 text-xs">{t('reports.to')}</span>
              <input
                type="date"
                value={reports.dateRange.endDate}
                onChange={(e) => reports.setDateRange({ ...reports.dateRange, endDate: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {React.isValidElement(tab.icon) ? React.cloneElement(tab.icon as React.ReactElement, { size: 13 }) : tab.icon}
              <span>{getTabLabel(tab.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {reports.loading ? (
          <div className="space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`kpi-shimmer-${i}`} className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="shimmer h-3.5 w-24 rounded" />
                    <div className="shimmer h-7 w-7 rounded-lg" />
                  </div>
                  <div className="shimmer h-7 w-32 rounded mb-2" />
                  <div className="shimmer h-3 w-20 rounded" />
                </div>
              ))}
            </div>

            {/* Charts & Breakdown Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="shimmer h-4 w-36 rounded" />
                  <div className="shimmer h-7 w-24 rounded-full" />
                </div>
                <div className="shimmer h-56 w-full rounded-lg" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
                <div className="shimmer h-4 w-28 rounded mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`list-shimmer-${i}`} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0">
                      <div className="shimmer h-3.5 w-32 rounded" />
                      <div className="shimmer h-3.5 w-16 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Data Table Shimmer */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="shimmer h-4 w-32 rounded" />
                <div className="shimmer h-7 w-28 rounded-md" />
              </div>
              <div className="space-y-3">
                <div className="shimmer h-8 w-full rounded" />
                <div className="shimmer h-7 w-full rounded" />
                <div className="shimmer h-7 w-full rounded" />
                <div className="shimmer h-7 w-full rounded" />
              </div>
            </div>
          </div>
        ) : reports.error ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500">
            <AlertCircle size={32} className="mb-2" />
            <p className="text-sm">{reports.error}</p>
          </div>
        ) : (
          renderActiveTab()
        )}
      </div>

      {/* Delete password modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('reports.deleteLabel', { label: deleteModal.label })}</h3>
            <p className="text-xs text-gray-500 mb-4">{t('reports.deletePasswordPrompt')}</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmDeleteOrder()}
              placeholder={t('reports.password')}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDeleteOrder}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete order modal */}
      {completeOrder && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setCompleteOrder(null)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-96 p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Complete Order
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Select a payment mode to mark Order {completeOrder.orderNumber} as completed.
              </p>
            </div>

            {/* Total Amount Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">Total Amount</span>
              <span className="text-lg font-bold text-blue-900 font-mono">
                {formatCurrency(completeOrder.grandTotal - (completeOrder.coinsRedeemed ?? 0))}
              </span>
            </div>

            {/* Payment Mode Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mode: 'cash' as const, label: 'Cash', icon: <Banknote size={18} /> },
                  { mode: 'card' as const, label: 'Card', icon: <CreditCard size={18} /> },
                  { mode: 'upi' as const, label: 'UPI', icon: <Smartphone size={18} /> },
                ].map((item) => {
                  const isSelected = paymentMode === item.mode;
                  return (
                    <button
                      key={item.mode}
                      onClick={() => setPaymentMode(item.mode)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-sm'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCompleteOrder(null)}
                disabled={completing}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCompleteOrder}
                disabled={completing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-green-600/10"
              >
                {completing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Complete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
