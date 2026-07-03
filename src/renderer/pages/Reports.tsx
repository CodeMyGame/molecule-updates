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
  Clock,
  Smartphone,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Button from '../components/common/Button';
import DataTable from '../components/common/DataTable';
import { formatCurrency, formatDate, formatDateTime } from '../lib/formatters';
import { ipc } from '../lib/ipc';
import { useReports, type DatePreset } from '../hooks/useReports';
import { useTaxTerminology } from '../hooks/useTaxTerminology';
import { useLocaleCurrencyIcon } from '../hooks/useLocaleCurrencyIcon';
import { currencySymbolForLanguage } from '../lib/currencyLocale';

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
  | 'busy_hours';

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
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className="p-3 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{title}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {trend && (
          <p className="text-xs text-green-600 flex items-center gap-0.5 mt-1">
            <ArrowUpRight size={12} /> {trend}
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
  const orderHistorySentinelRef = useRef<HTMLDivElement>(null);
  const ORDER_PAGE_SIZE = 100;
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
  const [tableSortKey, setTableSortKey] = useState<string>('revenue');
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('desc');
  const [itemFilterCategory, setItemFilterCategory] = useState('');
  const [busyHoursView, setBusyHoursView] = useState<'day' | 'week' | 'month' | 'year'>('day');

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
      const orders = await ipc<any[]>(window.electronAPI.orders.getAll({
        startDate: reports.dateRange.startDate,
        endDate: reports.dateRange.endDate,
      }));
      // Group by table
      const tableMap = new Map<string, { tableName: string; totalOrders: number; completedOrders: number; cancelledOrders: number; revenue: number; discount: number; tax: number }>();
      for (const o of (orders ?? [])) {
        if (!o.tableId) continue;
        const key = String(o.tableId);
        const existing = tableMap.get(key) ?? { tableName: o.tableName || t('reports.tableFallback', { id: o.tableId }), totalOrders: 0, completedOrders: 0, cancelledOrders: 0, revenue: 0, discount: 0, tax: 0 };
        existing.totalOrders++;
        if (o.status === 'completed') {
          existing.completedOrders++;
          existing.revenue += o.grandTotal ?? 0;
          existing.discount += o.discountAmount ?? 0;
          existing.tax += o.taxAmount ?? 0;
        } else if (o.status === 'cancelled') {
          existing.cancelledOrders++;
        }
        tableMap.set(key, existing);
      }
      setTableWiseData(Array.from(tableMap.values()).sort((a, b) => b.revenue - a.revenue));
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
      await Promise.all(deleteModal.orderIds.map((id) => ipc(window.electronAPI.orders.delete(id))));
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
      fetchOrderHistory(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderFilterStatus, orderFilterType]);

  // IntersectionObserver for infinite scroll on order history
  useEffect(() => {
    if (activeTab !== 'order_history') return;
    if (!orderHistorySentinelRef.current) return;
    if (!orderHistoryHasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !orderHistoryLoading && !orderHistoryLoadingMore && orderHistoryHasMore) {
          fetchOrderHistory(true);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(orderHistorySentinelRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, orderHistoryHasMore, orderHistoryLoading, orderHistoryLoadingMore, orderHistory.length]);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reports.dateRange]);

  const handlePrint = () => {
    window.print();
  };

  const getTabLabel = (key: ReportTab): string => {
    switch (key) {
      case 'order_history': return t('reports.orderHistory', 'Order History');
      case 'daily_sales': return t('reports.dailySales');
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.salesOverTime')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" fontSize={12} tick={{ fill: '#6B7280' }} />
                <YAxis fontSize={12} tick={{ fill: '#6B7280' }} />
                <Tooltip formatter={(value: number) => [`${currencySymbolForLanguage(i18n.language)}${value.toFixed(2)}`, t('reports.revenue')]} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} name={t('reports.revenue')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
          ]}
          data={data}
          keyExtractor={(item) => item.date}
          emptyMessage={t('reports.noSalesData')}
        />

        <Button
          variant="secondary"
          icon={<Download size={16} />}
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.top10ItemsByRevenue')}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top10} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" fontSize={12} tick={{ fill: '#6B7280' }} />
                <YAxis dataKey="name" type="category" fontSize={12} tick={{ fill: '#6B7280' }} width={90} />
                <Tooltip formatter={(value: number) => [`${currencySymbolForLanguage(i18n.language)}${value.toFixed(2)}`, t('reports.revenue')]} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} name={t('reports.revenue')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
          keyExtractor={(item) => item.menuItemId}
          emptyMessage={t('reports.noItemSalesData')}
        />

        <Button
          variant="secondary"
          icon={<Download size={16} />}
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.categoryDistribution')}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={120} innerRadius={60} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${currencySymbolForLanguage(i18n.language)}${value.toFixed(2)}`, t('reports.revenue')]} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
          keyExtractor={(item) => item.categoryId}
          emptyMessage={t('reports.noCategorySalesData')}
        />

        <Button
          variant="secondary"
          icon={<Download size={16} />}
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.paymentModeDistribution')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${currencySymbolForLanguage(i18n.language)}${value.toFixed(2)}`, t('reports.amount')]} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <DataTable
          columns={[
            { header: t('reports.paymentMode'), accessor: 'paymentMode', render: (item) => item.paymentMode.toUpperCase() },
            { header: t('reports.transactions'), accessor: 'transactionCount', align: 'right' },
            { header: t('reports.totalAmount'), accessor: 'totalAmount', align: 'right', render: (item) => formatCurrency(item.totalAmount) },
            { header: t('reports.tips'), accessor: 'tipAmount', align: 'right', render: (item) => formatCurrency(item.tipAmount) },
          ]}
          data={data}
          keyExtractor={(item) => item.paymentMode}
          emptyMessage={t('reports.noPaymentData')}
        />

        <Button
          variant="secondary"
          icon={<Download size={16} />}
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
            keyExtractor={(item) => item.taxRate}
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
          icon={<Download size={16} />}
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.revenueByStaff')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" fontSize={12} tick={{ fill: '#6B7280' }} />
                <YAxis fontSize={12} tick={{ fill: '#6B7280' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Legend />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} name={t('reports.revenue')} />
                <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} name={t('reports.orders')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <DataTable
          columns={[
            { header: t('reports.staffName'), accessor: 'staffName' },
            { header: t('reports.orders'), accessor: 'totalOrders', align: 'right' },
            { header: t('reports.revenue'), accessor: 'totalRevenue', align: 'right', render: (item) => formatCurrency(item.totalRevenue) },
            { header: t('reports.avgOrderValue'), accessor: 'averageOrderValue', align: 'right', render: (item) => formatCurrency(item.averageOrderValue) },
          ]}
          data={data}
          keyExtractor={(item) => item.staffId}
          emptyMessage={t('reports.noStaffData')}
        />

        <Button
          variant="secondary"
          icon={<Download size={16} />}
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.topConsumedIngredients')}</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top10} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" fontSize={12} tick={{ fill: '#6B7280' }} />
                <YAxis dataKey="name" type="category" fontSize={12} tick={{ fill: '#6B7280' }} width={90} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Legend />
                <Bar dataKey="cost" fill="#3B82F6" radius={[0, 4, 4, 0]} name={t('reports.cost')} />
                <Bar dataKey="wasted" fill="#EF4444" radius={[0, 4, 4, 0]} name={t('reports.wasted')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
          keyExtractor={(item) => item.ingredientId}
          emptyMessage={t('reports.noInventoryData')}
        />

        <Button
          variant="secondary"
          icon={<Download size={16} />}
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.avgPrepTimeByItem')}</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" fontSize={12} tick={{ fill: '#6B7280' }} />
                <YAxis dataKey="name" type="category" fontSize={11} tick={{ fill: '#6B7280' }} width={110} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Bar dataKey="avgMinutes" fill="#F59E0B" radius={[0, 4, 4, 0]} name={t('reports.avgMinutes')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <DataTable
          columns={[
            { header: t('reports.item'), accessor: 'itemName' },
            { header: t('reports.avgPrepMinutes'), accessor: 'avgPrepMinutes', align: 'right' },
            { header: t('reports.orderCount'), accessor: 'orderCount', align: 'right' },
          ]}
          data={data}
          keyExtractor={(item) => item.itemName}
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
          const av = a[orderSortKey] ?? '';
          const bv = b[orderSortKey] ?? '';
          const cmp = typeof av === 'string' ? av.localeCompare(bv) : av < bv ? -1 : av > bv ? 1 : 0;
          return orderSortDir === 'asc' ? cmp : -cmp;
        })
      : orderHistory;

    const handleOrderSort = (key: string) => {
      if (orderSortKey === key) setOrderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setOrderSortKey(key); setOrderSortDir('asc'); }
    };

    const SortIcon = ({ col }: { col: string }) => {
      if (orderSortKey !== col) return <ChevronsUpDown size={13} className="inline ml-1 text-gray-400" />;
      return orderSortDir === 'asc'
        ? <ChevronUp size={13} className="inline ml-1 text-blue-600" />
        : <ChevronDown size={13} className="inline ml-1 text-blue-600" />;
    };

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
              icon={<Download size={14} />}
              onClick={() =>
                exportToCSV(
                  [t('reports.orderNumber'), t('reports.date'), t('common.type'), t('reports.table'), t('reports.staffName'), t('reports.customer'), t('reports.phone'), t('common.items'), t('common.status'), t('reports.subtotal'), t('reports.discount'), t('reports.tax'), t('reports.total'), t('reports.coinsRedeemed')],
                  orderHistory.map((o) => [
                    o.orderNumber,
                    formatDate(o.createdAt),
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
                    className="rounded"
                    checked={sorted.length > 0 && sorted.every((o) => selectedOrderIds.has(o.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedOrderIds(new Set(sorted.map((o) => o.id)));
                      else setSelectedOrderIds(new Set());
                    }}
                  />
                </th>
                {([
                  { label: t('reports.orderNumber'), key: 'orderNumber', align: 'left', nowrap: true },
                  { label: t('reports.date'), key: 'createdAt', align: 'left', nowrap: true },
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
              {sorted.map((order) => (
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
                  <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{order.orderNumber}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
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
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(order.status)}`}>
                      {order.status}
                    </span>
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
                      {expandedOrderLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Loader2 size={14} className="animate-spin" /> {t('reports.loadingItems')}
                        </div>
                      ) : expandedOrderItems.length === 0 ? (
                        <p className="text-sm text-gray-400">{t('reports.noItems')}</p>
                      ) : (
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
                            {expandedOrderItems.map((item: any, idx: number) => (
                              <tr key={item.id} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 text-gray-400">{idx + 1}</td>
                                <td className="py-1.5 text-gray-800 font-medium">
                                  {item.name}
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
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state when filters yield nothing */}
        {orderHistory.length === 0 && !orderHistoryLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ClipboardList size={36} strokeWidth={1.5} />
            <p className="mt-2 text-sm">{t('reports.noOrdersMatch')}</p>
          </div>
        )}

        {/* Infinite scroll sentinel + loading-more indicator */}
        {orderHistoryHasMore && (
          <div ref={orderHistorySentinelRef} className="flex items-center justify-center py-6">
            {orderHistoryLoadingMore ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> {t('reports.loadingMoreOrders')}
              </div>
            ) : (
              <span className="text-xs text-gray-300">{t('reports.scrollForMore')}</span>
            )}
          </div>
        )}
        {!orderHistoryHasMore && orderHistory.length > 0 && (
          <div className="text-center py-4 text-xs text-gray-300">{t('reports.endOfResults')}</div>
        )}
      </div>
    );
  };

  const renderTableWise = () => {
    if (tableWiseLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-blue-600" />
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

    const tableSorted = [...tableWiseData].sort((a, b) => {
      const av = a[tableSortKey] ?? 0;
      const bv = b[tableSortKey] ?? 0;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av < bv ? -1 : av > bv ? 1 : 0;
      return tableSortDir === 'asc' ? cmp : -cmp;
    });
    const handleTableSort = (key: string) => {
      if (tableSortKey === key) setTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setTableSortKey(key); setTableSortDir('asc'); }
    };
    const TableSortIcon = ({ col }: { col: string }) => {
      if (tableSortKey !== col) return <ChevronsUpDown size={13} className="inline ml-1 text-gray-400" />;
      return tableSortDir === 'asc'
        ? <ChevronUp size={13} className="inline ml-1 text-blue-600" />
        : <ChevronDown size={13} className="inline ml-1 text-blue-600" />;
    };

    const totalRevenue = tableWiseData.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = tableWiseData.reduce((s, d) => s + d.totalOrders, 0);

    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard title={t('reports.totalTables')} value={String(tableWiseData.length)} icon={<LayoutGrid size={20} />} />
          <SummaryCard title={t('reports.totalOrders')} value={String(totalOrders)} icon={<ClipboardList size={20} />} />
          <SummaryCard title={t('reports.totalRevenue')} value={formatCurrency(totalRevenue)} icon={<CurrencyIcon size={20} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('reports.revenueByTable')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tableWiseData.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tableName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('reports.ordersByTable')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tableWiseData.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tableName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="completedOrders" name={t('reports.statusCompleted')} fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cancelledOrders" name={t('reports.statusCancelled')} fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <Button
            variant="secondary"
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

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {([
                  { label: t('reports.table'), key: 'tableName', align: 'left' },
                  { label: t('reports.totalOrders'), key: 'totalOrders', align: 'right' },
                  { label: t('reports.statusCompleted'), key: 'completedOrders', align: 'right' },
                  { label: t('reports.statusCancelled'), key: 'cancelledOrders', align: 'right' },
                  { label: t('reports.revenue'), key: 'revenue', align: 'right' },
                  { label: t('reports.discount'), key: 'discount', align: 'right' },
                  { label: taxTerms.scheme, key: 'tax', align: 'right' },
                ] as { label: string; key: string; align: string }[]).map(({ label, key, align }) => (
                  <th
                    key={key}
                    onClick={() => handleTableSort(key)}
                    className={`px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:bg-gray-100 text-${align}`}
                  >
                    {label}<TableSortIcon col={key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableSorted.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.tableName}</td>
                  <td className="px-4 py-2.5 text-right">{row.totalOrders}</td>
                  <td className="px-4 py-2.5 text-right text-green-600">{row.completedOrders}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{row.cancelledOrders}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{row.discount ? `-${formatCurrency(row.discount)}` : '-'}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(row.tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('reports.ordersDistribution', 'Orders Distribution')}</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" fontSize={12} tick={{ fill: '#6B7280' }} interval={0} angle={busyHoursView === 'day' ? -45 : 0} textAnchor={busyHoursView === 'day' ? 'end' : 'middle'} height={busyHoursView === 'day' ? 60 : 30} />
                <YAxis fontSize={12} tick={{ fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Bar dataKey="orders" radius={[4, 4, 0, 0]} name={t('reports.orders')}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.isPeak ? '#EF4444' : '#3B82F6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
          icon={<Download size={16} />}
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
      default: return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.reports')}</h1>
          <Button variant="secondary" icon={<Printer size={16} />} onClick={handlePrint}>
            {t('reports.print')}
          </Button>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={16} className="text-gray-400" />
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => reports.setDatePreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                reports.datePreset === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {getDatePresetLabel(p.key)}
            </button>
          ))}
          {reports.datePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={reports.dateRange.startDate}
                onChange={(e) => reports.setDateRange({ ...reports.dateRange, startDate: e.target.value })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              />
              <span className="text-gray-400 text-sm">{t('reports.to')}</span>
              <input
                type="date"
                value={reports.dateRange.endDate}
                onChange={(e) => reports.setDateRange({ ...reports.dateRange, endDate: e.target.value })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 overflow-x-auto">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {getTabLabel(tab.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {reports.loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-blue-600" />
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
