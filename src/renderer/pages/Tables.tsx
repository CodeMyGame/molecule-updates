import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  LayoutGrid,
  ChevronRight,
  RefreshCw,
  Layers,
  X,
  Printer,
  Pin,
  ArrowRightLeft,
  Split,
  Unlock,
  ShoppingBag,
  Clock,
  Banknote,
  QrCode,
  Search,
  Move,
  Check,
} from 'lucide-react';
import TransferMergeModal from '../components/tables/TransferMergeModal';
import { TableStatus } from '../../shared/enums';
import type { Table, CreateTableDTO, UpdateTableDTO } from '../../shared/types/table.types';
import type { Floor } from '../../shared/types/table.types';
import { useTables } from '../hooks/useTables';
import { useSettings } from '../hooks/useSettings';
import { resolveOrderItemTaxRateFallback } from '../lib/taxLocalePresets';
import { useBillingStore } from '../stores/billing.store';
import { ipc } from '../lib/ipc';
import { formatCurrency, formatElapsedDuration } from '../lib/formatters';
import { useLocaleCurrencyIcon } from '../hooks/useLocaleCurrencyIcon';
import TableLayout from '../components/tables/TableLayout';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import ParcelNameModal from '../components/billing/ParcelNameModal';
import VoidReasonModal from '../components/billing/VoidReasonModal';

type TableFormData = {
  name: string;
  capacity: number;
  shape: string;
  posX: number;
  posY: number;
};

const STATUS_LABEL_KEYS: Record<TableStatus, string> = {
  [TableStatus.FREE]: 'tables.statusFree',
  [TableStatus.OCCUPIED]: 'tables.statusOccupied',
  [TableStatus.RESERVED]: 'tables.statusReserved',
  [TableStatus.DIRTY]: 'tables.statusDirty',
};

const defaultTableForm: TableFormData = {
  name: '',
  capacity: 4,
  shape: 'rectangle',
  posX: 10,
  posY: 10,
};

function getElapsedMinutes(startedAt?: string): number {
  if (!startedAt) return 0;
  const ts = startedAt.endsWith('Z') ? startedAt : startedAt.replace(' ', 'T') + 'Z';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  return Math.max(0, isNaN(mins) ? 0 : mins);
}

function getOrderStatusBadge(order: any, t: (key: string, options?: any) => string) {
  if (order.status === 'hold') {
    return {
      label: t('billing.orderHeldBadge', { defaultValue: 'Held' }),
      bg: 'bg-amber-100 text-amber-800 border-amber-300',
      dot: 'bg-amber-500',
    };
  }
  const items = order.items || [];
  if (items.length === 0) {
    return {
      label: t('tables.statusOccupied', { defaultValue: 'Occupied' }),
      bg: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
      dot: 'bg-rose-500',
    };
  }
  const kotStatuses: string[] = items.map((i: any) => i.kotStatus ?? i.kot_status ?? 'pending');
  const hasPending = kotStatuses.some((s) => s === 'pending');
  const allServed = kotStatuses.length > 0 && kotStatuses.every((s) => s === 'served');
  const allReady = kotStatuses.length > 0 && kotStatuses.every((s) => s === 'ready' || s === 'served');
  const hasReady = kotStatuses.some((s) => s === 'ready');
  const hasPreparing = kotStatuses.some((s) => s === 'preparing');

  if (allReady || hasReady) {
    return {
      label: t('tables.readyForPickup', { defaultValue: 'Ready for Pickup' }),
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-bold animate-pulse',
      dot: 'bg-emerald-500',
    };
  }
  if (hasPreparing) {
    return {
      label: t('tables.preparingInKitchen', { defaultValue: 'Preparing' }),
      bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800 font-semibold',
      dot: 'bg-amber-500',
    };
  }
  if (hasPending) {
    return {
      label: t('tables.kotPending', { defaultValue: 'KOT Pending' }),
      bg: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800 font-semibold',
      dot: 'bg-orange-500',
    };
  }
  if (allServed) {
    return {
      label: t('billing.kotServed', { defaultValue: 'Served' }),
      bg: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      dot: 'bg-gray-400',
    };
  }
  return {
    label: t('billing.kotSent', { defaultValue: 'Sent to Kitchen' }),
    bg: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800',
    dot: 'bg-blue-500',
  };
}
const getParcelStatusBadge = getOrderStatusBadge;

interface TableOrder {
  id: number;
  orderNumber: string;
  status: string;
  grandTotal: number;
  items: { id: number; name: string; quantity: number; total: number }[];
  createdAt: string;
}

const Tables: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { settings, fetchSettings } = useSettings();

  useEffect(() => {
    void fetchSettings(['default_tax_rate']);
  }, [fetchSettings]);
  const CurrencyIcon = useLocaleCurrencyIcon();
  const navigate = useNavigate();
  const loadOrderIntoCart = useBillingStore((s) => s.loadOrderIntoCart);
  const setCustomer = useBillingStore((s) => s.setCustomer);
  const resetForNewTable = useBillingStore((s) => s.resetForNewTable);
  const resetForTakeaway = useBillingStore((s) => s.resetForTakeaway);
  const setOrderType = useBillingStore((s) => s.setOrderType);
  const setTable = useBillingStore((s) => s.setTable);
  const setCurrentOrderId = useBillingStore((s) => s.setCurrentOrderId);

  const {
    floors,
    tables,
    tablesByFloor,
    loading,
    error,
    createTable,
    updateTable,
    deleteTable,
    updateTableStatus,
    createFloor,
    deleteFloor,
    updateFloor,
    refetch,
  } = useTables();

  const [activeFloorId, setActiveFloorId] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Right-click context menus
  const [tableContextMenu, setTableContextMenu] = useState<{
    x: number;
    y: number;
    table: Table;
    orderId: number;
  } | null>(null);
  const [floorContextMenu, setFloorContextMenu] = useState<{ x: number; y: number; floor: Floor } | null>(null);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);

  const [transferMergeModal, setTransferMergeModal] = useState<{
    mode: 'transfer' | 'merge';
    table: Table;
    orderId: number;
  } | null>(null);

  const [splitModal, setSplitModal] = useState<{
    orderId: number;
    sourceTableId: number;
    items: { id: number; name: string; quantity: number; total: number; selected: boolean }[];
    step: 'items' | 'table';
  } | null>(null);

  const handleTableContextMenu = useCallback(async (e: React.MouseEvent, table: Table) => {
    e.preventDefault();
    const order = await ipc<any>(window.electronAPI.orders.getByTable(table.id)).catch(() => null);
    const orderId = order ? order.id : 0;
    setTableContextMenu({ x: e.clientX, y: e.clientY, table, orderId });
  }, []);
  const handleFloorContextMenu = (e: React.MouseEvent, floor: Floor) => {
    e.preventDefault();
    setFloorContextMenu({ x: e.clientX, y: e.clientY, floor });
  };

  // Modals
  const [showTableModal, setShowTableModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [tableForm, setTableForm] = useState<TableFormData>(defaultTableForm);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [floorName, setFloorName] = useState('');
  const [saving, setSaving] = useState(false);

  // Order summaries for all occupied tables (shown on cards)
  const [tableOrdersMap, setTableOrdersMap] = useState<
    Map<
      number,
      {
        grandTotal: number;
        itemCount: number;
        createdAt: string;
        orderStatus?: string;
        orderId?: number;
        kotBadge?: { label: string; bg: string; dot: string };
      }
    >
  >(new Map());

  // Fetch order summaries for all occupied tables
  const fetchAllTableOrders = useCallback(async () => {
    const occupiedTables = tables.filter((t) => t.status === TableStatus.OCCUPIED);
    if (occupiedTables.length === 0) {
      setTableOrdersMap(new Map());
      return;
    }
    const map = new Map<
      number,
      {
        grandTotal: number;
        itemCount: number;
        createdAt: string;
        orderStatus?: string;
        orderId?: number;
        kotBadge?: { label: string; bg: string; dot: string };
      }
    >();
    await Promise.all(
      occupiedTables.map(async (tbl) => {
        try {
          const order = await ipc<any>(window.electronAPI.orders.getByTable(tbl.id));
          if (order) {
            map.set(tbl.id, {
              grandTotal: order.grandTotal ?? 0,
              itemCount: (order.items ?? []).length,
              createdAt: order.createdAt ?? '',
              orderStatus: order.status,
              orderId: order.id,
              kotBadge: getOrderStatusBadge(order, t),
            });
          }
        } catch { /* ignore */ }
      })
    );
    setTableOrdersMap(map);
  }, [tables, t]);

  useEffect(() => {
    fetchAllTableOrders();
  }, [fetchAllTableOrders]);

  const [activeParcels, setActiveParcels] = useState<any[]>([]);

  const fetchActiveParcels = useCallback(async () => {
    try {
      const orders = await ipc<any[]>(window.electronAPI.orders.getActive());
      if (orders) {
        const parcels = orders.filter((o: any) =>
          (o.orderType === 'takeaway' || o.order_type === 'takeaway' || (!o.tableId && !o.table_id)) &&
          (o.status === 'active' || o.status === 'hold')
        );
        setActiveParcels(parcels);
      }
    } catch {
      // ignore
    }
  }, []);

  // Consolidated poll for tables and active parcels so waiter tablet updates show in near real-time.
  // Pauses when hidden to save battery and reduce SQLite IPC traffic.
  useEffect(() => {
    fetchActiveParcels();
    const poll = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refetch();
      fetchActiveParcels();
    };

    const interval = setInterval(poll, 7000);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchActiveParcels, refetch]);

  const handleOpenTransfer = (table: Table, orderId: number) => {
    setTableContextMenu(null);
    setShowStatusModal(false);
    setTransferMergeModal({ mode: 'transfer', table, orderId });
  };



  const handleOpenSplitBill = async (table: Table, orderId: number) => {
    setTableContextMenu(null);
    setShowStatusModal(false);
    try {
      const order = await ipc<any>(window.electronAPI.orders.getById(orderId));
      if (!order?.items?.length) {
        toast.error(t('billingPage.noItemsToSplit'));
        return;
      }
      setSplitModal({
        orderId,
        sourceTableId: table.id,
        items: order.items.map((oi: any) => ({
          id: oi.id,
          name: oi.name,
          quantity: oi.quantity,
          total: (oi.unitPrice ?? oi.unit_price) * oi.quantity,
          selected: false,
        })),
        step: 'items',
      });
    } catch (err: any) {
      toast.error(err?.message ?? t('billingPage.failedToLoadOrder'));
    }
  };

  const [tableToCancel, setTableToCancel] = useState<{ table: Table; orderId: number } | null>(null);

  const handleFreeTable = (table: Table, orderId?: number) => {
    setTableContextMenu(null);
    setShowStatusModal(false);
    if (orderId) {
      setTableToCancel({ table, orderId });
    } else {
      ipc(window.electronAPI.tables.updateStatus(table.id, TableStatus.FREE))
        .then(() => {
          toast.success(t('billingPage.tableFreedAndCancelled'));
          refetch();
          fetchAllTableOrders();
        })
        .catch((err: any) => {
          toast.error(err?.message ?? t('billingPage.failedToFreeTable'));
        });
    }
  };

  const handleConfirmCancelTableOrder = async (reason: string, staffId?: number) => {
    if (!tableToCancel) return;
    try {
      await ipc(window.electronAPI.orders.updateStatus(tableToCancel.orderId, 'cancelled', reason, staffId));
      toast.success(t('billingPage.tableFreedAndCancelled'));
      setTableToCancel(null);
      await refetch();
      await fetchAllTableOrders();
    } catch (err: any) {
      toast.error(err?.message ?? t('billingPage.failedToFreeTable'));
    }
  };

  const handleSplitBillNext = () => {
    if (!splitModal) return;
    const selectedIds = splitModal.items.filter((i) => i.selected).map((i) => i.id);
    if (selectedIds.length === 0) {
      toast.error(t('billingPage.selectItemsToSplit'));
      return;
    }
    if (selectedIds.length === splitModal.items.length) {
      toast.error(t('billingPage.cannotSplitAll'));
      return;
    }
    setSplitModal({ ...splitModal, step: 'table' });
  };

  const handleSplitBillConfirm = async (targetTableId: number) => {
    if (!splitModal) return;
    const selectedIds = splitModal.items.filter((i) => i.selected).map((i) => i.id);
    try {
      await ipc(window.electronAPI.orders.splitBill(splitModal.orderId, selectedIds, targetTableId));
      const targetName = tables.find((t) => t.id === targetTableId)?.name ?? `Table #${targetTableId}`;
      toast.success(t('billingPage.itemsSplitTo', { name: targetName }));
      setSplitModal(null);
      await refetch();
      await fetchAllTableOrders();
    } catch (err: any) {
      toast.error(err?.message ?? t('billingPage.splitFailed'));
    }
  };



  // Order for selected occupied table (modal detail)
  const [tableOrder, setTableOrder] = useState<TableOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const fetchTableOrder = useCallback(async (tableId: number) => {
    setOrderLoading(true);
    try {
      const order = await ipc<any>(window.electronAPI.orders.getByTable(tableId));
      if (order) {
        setTableOrder({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          grandTotal: order.grandTotal,
          items: (order.items ?? []).map((i: any) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            total: i.total,
          })),
          createdAt: order.createdAt,
        });
      } else {
        setTableOrder(null);
      }
    } catch {
      setTableOrder(null);
    } finally {
      setOrderLoading(false);
    }
  }, []);

  const handleGoToBilling = useCallback(async (tableId: number, orderId?: number) => {
    if (orderId) {
      try {
        const order = await ipc<any>(window.electronAPI.orders.getByTable(tableId));
        if (order) {
          const cartItems = (order.items || []).map((oi: any) => {
            const addons = (oi.addons ?? []).map((a: any) => ({
              id: a.addonId ?? a.addon_id ?? a.id,
              name: a.name,
              price: a.price,
            }));
            const addonsTotal = addons.reduce((sum: number, a: any) => sum + (a.price ?? 0), 0);
            const unitPrice = oi.unitPrice ?? oi.unit_price ?? 0;
            const basePrice = Math.max(0, unitPrice - addonsTotal);

            return {
              menuItem: {
                id: oi.menuItemId ?? oi.menu_item_id,
                name: (oi.name ?? '').split(' (')[0],
                basePrice,
                categoryId: 0,
                taxRate: resolveOrderItemTaxRateFallback(
                  oi.taxRate ?? oi.tax_rate,
                  settings.default_tax_rate,
                  i18n.language
                ),
                isVeg: false,
              },
              variation: oi.variationId
                ? { id: oi.variationId, name: (oi.name ?? '').match(/\(([^)]+)\)/)?.[1] ?? '', priceDelta: 0 }
                : undefined,
              addons,
              quantity: oi.quantity,
              unitPrice,
              total: unitPrice * oi.quantity,
              notes: oi.notes,
              sourceTableName: oi.sourceTableName ?? oi.source_table_name ?? undefined,
              orderItemId: oi.id,
              kotNumber: oi.kotNumber ?? oi.kot_number ?? undefined,
              kotStatus: oi.kotStatus ?? oi.kot_status ?? undefined,
              createdAt: oi.createdAt ?? oi.created_at ?? undefined,
            };
          });
          const rawDiscountType = order.discountType ?? order.discount_type;
          const orderDiscount = rawDiscountType
            ? {
                type: ((rawDiscountType === 'percentage' || rawDiscountType === 'percent') ? 'percent' : 'flat') as 'percent' | 'flat',
                value: order.discountValue ?? order.discount_value ?? 0,
                reason: order.discountReason ?? order.discount_reason ?? undefined,
              }
            : null;
          const splitInfo = {
            splitFromOrderId: order.splitFromOrderId ?? (order as any).split_from_order_id ?? null,
            splitFromOrderNumber: order.splitFromOrderNumber ?? (order as any).split_from_order_number ?? null,
          };
          loadOrderIntoCart(order.id, tableId, cartItems, cartItems.length, order.orderType ?? order.order_type, orderDiscount, order.notes, order.kots ?? [], order.outboundTransfers ?? [], splitInfo, order.status, order.customerId ?? (order as any).customer_id ?? null, order.parcelName ?? (order as any).parcel_name ?? null, order.parcelNumber ?? (order as any).parcel_number ?? null);
          setCustomer(order.customerId ?? (order as any).customer_id ?? null);
          navigate('/billing');
          return;
        }
      } catch {
        // fall through to simple navigation
      }
    }
    resetForNewTable(tableId);
    navigate('/billing');
  }, [loadOrderIntoCart, setCustomer, resetForNewTable, navigate, settings.default_tax_rate, i18n.language]);

  const handleOpenParcelOrder = useCallback(
    async (orderId: number) => {
      try {
        const fullOrder = await ipc<any>(window.electronAPI.orders.getById(orderId));
        if (fullOrder && fullOrder.items) {
          const cartItems = fullOrder.items.map((oi: any) => {
            const addons = (oi.addons ?? []).map((a: any) => ({
              id: a.addonId ?? a.addon_id ?? a.id,
              name: a.name,
              price: a.price,
            }));
            const addonsTotal = addons.reduce((sum: number, a: any) => sum + (a.price ?? 0), 0);
            const unitPrice = oi.unitPrice ?? oi.unit_price ?? 0;
            const basePrice = Math.max(0, unitPrice - addonsTotal);

            return {
              menuItem: {
                id: oi.menuItemId ?? oi.menu_item_id ?? 0,
                name: (oi.name ?? '').split(' (')[0],
                basePrice,
                categoryId: 0,
                taxRate: resolveOrderItemTaxRateFallback(
                  oi.taxRate ?? oi.tax_rate,
                  settings.default_tax_rate,
                  i18n.language
                ),
                isVeg: false,
              },
              variation: oi.variationId
                ? { id: oi.variationId, name: (oi.name ?? '').match(/\(([^)]+)\)/)?.[1] ?? '', priceDelta: 0 }
                : undefined,
              addons,
              quantity: oi.quantity,
              unitPrice,
              total: unitPrice * oi.quantity,
              notes: oi.notes,
              sourceTableName: oi.sourceTableName ?? oi.source_table_name ?? undefined,
              orderItemId: oi.id,
              kotNumber: oi.kotNumber ?? oi.kot_number ?? undefined,
              kotStatus: oi.kotStatus ?? oi.kot_status ?? undefined,
              createdAt: oi.createdAt ?? oi.created_at ?? undefined,
            };
          });

          const rawDiscountType = fullOrder.discountType ?? fullOrder.discount_type;
          const orderDiscount = rawDiscountType
            ? {
                type: ((rawDiscountType === 'percentage' || rawDiscountType === 'percent') ? 'percent' : 'flat') as 'percent' | 'flat',
                value: fullOrder.discountValue ?? fullOrder.discount_value ?? 0,
                reason: fullOrder.discountReason ?? fullOrder.discount_reason ?? undefined,
              }
            : null;

          const splitInfo = {
            splitFromOrderId: fullOrder.splitFromOrderId ?? (fullOrder as any).split_from_order_id ?? null,
            splitFromOrderNumber: fullOrder.splitFromOrderNumber ?? (fullOrder as any).split_from_order_number ?? null,
          };

          loadOrderIntoCart(
            fullOrder.id,
            null,
            cartItems,
            cartItems.length,
            fullOrder.orderType ?? fullOrder.order_type ?? 'takeaway',
            orderDiscount,
            fullOrder.notes,
            fullOrder.kots ?? [],
            fullOrder.outboundTransfers ?? [],
            splitInfo,
            fullOrder.status,
            fullOrder.customerId ?? (fullOrder as any).customer_id ?? null,
            fullOrder.parcelName ?? fullOrder.parcel_name ?? null,
            fullOrder.parcelNumber ?? (fullOrder as any).parcel_number ?? null
          );
          setCustomer(fullOrder.customerId ?? (fullOrder as any).customer_id ?? null);
          navigate('/billing');
        }
      } catch (err) {
        console.error('Failed to load parcel order:', err);
        toast.error('Failed to load order');
      }
    },
    [loadOrderIntoCart, setCustomer, navigate, settings.default_tax_rate, i18n.language]
  );

  const handlePayParcelOrder = useCallback(
    async (orderId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      await handleOpenParcelOrder(orderId);
      navigate('/billing?action=pay');
    },
    [handleOpenParcelOrder, navigate]
  );

  const [showParcelModal, setShowParcelModal] = useState(false);

  const handleNewParcel = useCallback(() => {
    setShowParcelModal(true);
  }, []);

  const handleConfirmParcelName = useCallback(
    async (name: string | null) => {
      let nextNum: number | null = null;
      try {
        if (window.electronAPI?.orders?.getNextParcelNumber) {
          nextNum = await ipc<number>(window.electronAPI.orders.getNextParcelNumber());
        }
      } catch {}
      resetForTakeaway(name, nextNum);
      navigate('/billing');
    },
    [resetForTakeaway, navigate]
  );

  const handlePrintKotFromTable = useCallback(async () => {
    if (!tableOrder) return;
    try {
      const kotId = await ipc<number | null>(window.electronAPI.kot.getLatestByOrder(tableOrder.id));
      if (!kotId) {
        toast.error(t('toast.noKotForOrder'));
        return;
      }
      const result = await ipc<{ printed: boolean }>(window.electronAPI.kot.printReceipt(kotId));
      if (result?.printed) toast.success(t('toast.kotPrinted'));
    } catch (err: any) {
      if (err?.isPrintWarning || err?.message?.includes('Print failed') || err?.message?.includes('printer')) {
        toast.error(t('toast.printerNotAvailableShort'));
      } else {
        toast.error(err?.message ?? t('toast.printKotFailed'));
      }
    }
  }, [tableOrder, t]);

  const handlePayFromTable = useCallback(async (tableId: number, orderId: number) => {
    try {
      const order = await ipc<any>(window.electronAPI.orders.getByTable(tableId));
      if (order) {
        const cartItems = (order.items || []).map((oi: any) => {
          const addons = (oi.addons ?? []).map((a: any) => ({
            id: a.addonId ?? a.addon_id ?? a.id,
            name: a.name,
            price: a.price,
          }));
          const addonsTotal = addons.reduce((sum: number, a: any) => sum + (a.price ?? 0), 0);
          const unitPrice = oi.unitPrice ?? oi.unit_price ?? 0;
          const basePrice = Math.max(0, unitPrice - addonsTotal);

          return {
            menuItem: {
              id: oi.menuItemId ?? oi.menu_item_id,
              name: (oi.name ?? '').split(' (')[0],
              basePrice,
              categoryId: 0,
              taxRate: resolveOrderItemTaxRateFallback(
                oi.taxRate ?? oi.tax_rate,
                settings.default_tax_rate,
                i18n.language
              ),
              isVeg: false,
            },
            variation: oi.variationId
              ? { id: oi.variationId, name: (oi.name ?? '').match(/\(([^)]+)\)/)?.[1] ?? '', priceDelta: 0 }
              : undefined,
            addons,
            quantity: oi.quantity,
            unitPrice,
            total: unitPrice * oi.quantity,
            notes: oi.notes,
            sourceTableName: oi.sourceTableName ?? oi.source_table_name ?? undefined,
            orderItemId: oi.id,
            kotNumber: oi.kotNumber ?? oi.kot_number ?? undefined,
            kotStatus: oi.kotStatus ?? oi.kot_status ?? undefined,
            createdAt: oi.createdAt ?? oi.created_at ?? undefined,
          };
        });
        const rawDiscountType = order.discountType ?? order.discount_type;
        const orderDiscount = rawDiscountType
          ? {
              type: ((rawDiscountType === 'percentage' || rawDiscountType === 'percent') ? 'percent' : 'flat') as 'percent' | 'flat',
              value: order.discountValue ?? order.discount_value ?? 0,
              reason: order.discountReason ?? order.discount_reason ?? undefined,
            }
          : null;
        const splitInfo = {
          splitFromOrderId: order.splitFromOrderId ?? (order as any).split_from_order_id ?? null,
          splitFromOrderNumber: order.splitFromOrderNumber ?? (order as any).split_from_order_number ?? null,
        };
        loadOrderIntoCart(order.id, tableId, cartItems, cartItems.length, order.orderType ?? order.order_type, orderDiscount, order.notes, order.kots ?? [], order.outboundTransfers ?? [], splitInfo, order.status, order.customerId ?? (order as any).customer_id ?? null, order.parcelName ?? (order as any).parcel_name ?? null, order.parcelNumber ?? (order as any).parcel_number ?? null);
        setCustomer(order.customerId ?? (order as any).customer_id ?? null);
      }
    } catch {
      setOrderType('dine_in');
      setTable(tableId);
      setCurrentOrderId(orderId);
    }
    navigate('/billing?action=pay');
  }, [loadOrderIntoCart, setCustomer, setOrderType, setTable, setCurrentOrderId, navigate, settings.default_tax_rate, i18n.language]);

  // Resolve active floor
  const currentFloorId = activeFloorId ?? floors[0]?.id ?? null;
  const currentTables = useMemo(() => {
    if (currentFloorId === null) return [];
    let list = tablesByFloor(currentFloorId);
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    return list;
  }, [currentFloorId, tablesByFloor, tableSearch]);

  // --- Handlers ---

  const lastTableClickTimeRef = React.useRef<number>(0);

  const openAddTableModal = useCallback(() => {
    setEditingTable(null);
    setTableForm(defaultTableForm);
    setShowTableModal(true);
  }, []);

  const openEditTableModal = useCallback((table: Table) => {
    setEditingTable(table);
    setTableForm({
      name: table.name,
      capacity: table.capacity,
      shape: table.shape,
      posX: table.posX,
      posY: table.posY,
    });
    setShowTableModal(true);
  }, []);

  const handleTableClick = useCallback((table: Table) => {
    const now = Date.now();
    // Guard against rapid duplicate clicks (e.g. double-click or fast touch taps)
    if (now - lastTableClickTimeRef.current < 300) {
      return;
    }
    lastTableClickTimeRef.current = now;

    if (isEditMode) {
      openEditTableModal(table);
      return;
    }
    setSelectedTable(table);
    setTableOrder(null);
    if (table.status === TableStatus.OCCUPIED) {
      fetchTableOrder(table.id);
    }
    setShowStatusModal(true);
  }, [isEditMode, openEditTableModal, fetchTableOrder]);

  const handleCloseStatusModal = useCallback(() => {
    setShowStatusModal(false);
    setSelectedTable(null);
    setTableOrder(null);
  }, []);

  const handleSaveTable = async () => {
    if (!currentFloorId) return;
    setSaving(true);
    try {
      if (editingTable) {
        await updateTable({
          id: editingTable.id,
          name: tableForm.name,
          capacity: tableForm.capacity,
          shape: tableForm.shape,
          posX: tableForm.posX,
          posY: tableForm.posY,
        });
      } else {
        await createTable({
          floorId: currentFloorId,
          name: tableForm.name,
          capacity: tableForm.capacity,
          shape: tableForm.shape,
          posX: tableForm.posX,
          posY: tableForm.posY,
        });
      }
      setShowTableModal(false);
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTable = async () => {
    if (!selectedTable) return;
    setSaving(true);
    try {
      await deleteTable(selectedTable.id);
      setShowDeleteConfirm(false);
      setShowStatusModal(false);
      setSelectedTable(null);
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: TableStatus) => {
    if (!selectedTable) return;
    try {
      await updateTableStatus(selectedTable.id, status);
      setShowStatusModal(false);
      setSelectedTable(null);
    } catch {
      // error handled by hook
    }
  };

  const handleAddFloor = async () => {
    if (!floorName.trim()) return;
    setSaving(true);
    try {
      if (editingFloor) {
        await updateFloor(editingFloor.id, floorName.trim());
      } else {
        const floor = await createFloor(floorName.trim());
        setActiveFloorId(floor.id);
      }
      setFloorName('');
      setEditingFloor(null);
      setShowFloorModal(false);
    } catch {
      // error handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFloor = async (floorId: number) => {
    const floorTables = tablesByFloor(floorId);
    if (floorTables.length > 0) {
      alert(t('tables.cannotDeleteFloorWithTables'));
      return;
    }
    try {
      await deleteFloor(floorId);
      if (activeFloorId === floorId) {
        setActiveFloorId(null);
      }
    } catch {
      // error handled by hook
    }
  };

  const handleTableDragEnd = async (tableId: number, posX: number, posY: number) => {
    try {
      await updateTable({ id: tableId, posX, posY });
    } catch {
      // error handled by hook
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header shimmer */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-1.5">
            <LayoutGrid size={15} className="text-gray-300 shrink-0" />
            <div className="shimmer h-4 w-24 rounded" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="shimmer h-7 w-20 rounded-full" />
            <div className="shimmer h-7 w-24 rounded-full" />
            <div className="shimmer h-7 w-24 rounded-full" />
          </div>
        </div>

        {/* Floor tabs shimmer */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/80 border-b border-gray-200">
          <div className="shimmer h-7 w-24 rounded-full" />
          <div className="shimmer h-7 w-20 rounded-full" />
          <div className="shimmer h-7 w-28 rounded-full" />
        </div>

        {/* Stats bar shimmer */}
        <div className="flex items-center gap-4 px-3 py-1.5 bg-white border-b border-gray-200 flex-wrap text-xs">
          <div className="shimmer h-4 w-24 rounded" />
          <div className="shimmer h-4 w-24 rounded" />
          <div className="shimmer h-4 w-20 rounded" />
          <div className="ml-auto flex items-center gap-3">
            <div className="shimmer h-3.5 w-14 rounded" />
            <div className="shimmer h-3.5 w-14 rounded" />
            <div className="shimmer h-3.5 w-14 rounded" />
          </div>
        </div>

        {/* Tables grid shimmer */}
        <div className="flex-1 bg-gray-50/50 overflow-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="table-card relative flex flex-col items-center justify-center rounded-lg w-full border border-gray-200 bg-white min-h-[72px] p-1.5 shadow-xs"
              >
                {/* Corner badge shimmer */}
                <div className="shimmer absolute -top-1 -right-1 h-3.5 w-9 rounded-full" />
                {/* Table name shimmer */}
                <div className="shimmer h-3.5 w-14 mb-1" />
                {/* Capacity shimmer */}
                <div className="shimmer h-3 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <LayoutGrid size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <h1 className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">{t('tables.title')}</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {tables.length} {t('tables.tablesLabel', 'Tables')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Table Search */}
          <div className="relative flex items-center">
            <Search size={11} className="absolute left-2.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder={t('tables.searchPlaceholder', 'Find table...')}
              className="pl-7 pr-6 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500 outline-none w-28 sm:w-36 text-gray-800 dark:text-gray-100 placeholder-gray-400 transition-all"
            />
            {tableSearch && (
              <button
                onClick={() => setTableSearch('')}
                className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Arrange Canvas Mode Toggle */}
          <button
            onClick={() => setIsEditMode((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              isEditMode
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-700'
            }`}
            title="Toggle drag-and-drop floor plan canvas arrangement"
          >
            {isEditMode ? <Check size={12} strokeWidth={2.5} /> : <Move size={12} />}
            <span>{isEditMode ? t('tables.doneArranging', 'Done') : t('tables.arrangeFloor', 'Arrange Canvas')}</span>
          </button>

          <button
            onClick={() => navigate('/qr-menu')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
            title="Generate and print physical Table QR stands and menu cards"
          >
            <QrCode size={12} className="text-amber-600 dark:text-amber-400" />
            <span>{t('tables.tableQrs', 'Table QR Stands')}</span>
          </button>
          <button
            onClick={handleNewParcel}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <ShoppingBag size={12} />
            <span>{t('tables.newParcel')}</span>
          </button>
          <button
            onClick={() => {
              refetch();
              fetchActiveParcels();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw size={12} className="text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={() => setShowFloorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Plus size={12} className="text-gray-500 dark:text-gray-400" />
            <span>{t('tables.addFloor')}</span>
          </button>
          <button
            onClick={openAddTableModal}
            disabled={!currentFloorId}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-xs transition-colors"
          >
            <Plus size={12} />
            <span>{t('tables.addTable')}</span>
          </button>
        </div>
      </div>

      {/* Active Parcels / Takeaway Shelf */}
      {activeParcels.length === 0 ? (
        <div className="flex items-center justify-between px-3 py-1 bg-emerald-50/50 dark:bg-slate-900/60 border-b border-emerald-100 dark:border-slate-800 text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-300 text-[11px]">
              <ShoppingBag size={13} className="text-emerald-600 dark:text-emerald-400" />
              {t('tables.parcelShelfTitle')}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium border border-transparent dark:border-emerald-800/40">
              0 {t('tables.active', { defaultValue: 'active' })}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-normal hidden md:inline">
              — {t('tables.noActiveParcelsHint')}
            </span>
          </div>
          <button
            onClick={handleNewParcel}
            className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 hover:underline"
          >
            <Plus size={11} />
            <span>{t('tables.newParcel')}</span>
          </button>
        </div>
      ) : (
        <div className="px-3 py-2 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-emerald-50/80 dark:from-slate-900 dark:via-emerald-950/20 dark:to-slate-900 border-b border-emerald-200 dark:border-emerald-900/40">
          <div className="flex items-center justify-between mb-1.5 select-none">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100 text-xs tracking-tight">
                <ShoppingBag size={14} className="text-emerald-600 dark:text-emerald-400" />
                {t('tables.parcelShelfTitle')}
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-600 text-white font-bold shadow-xs">
                {activeParcels.length} {t('tables.active', { defaultValue: 'active' })}
              </span>
            </div>
            <button
              onClick={handleNewParcel}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <Plus size={11} />
              <span>{t('tables.newParcel')}</span>
            </button>
          </div>

          <div className="flex items-stretch gap-2 overflow-x-auto pb-1 no-scrollbar">
            {activeParcels.map((parcel, index) => {
              const statusBadge = getParcelStatusBadge(parcel, t);
              const elapsedMins = getElapsedMinutes(parcel.createdAt);

              return (
                <div
                  key={parcel.id}
                  onClick={() => handleOpenParcelOrder(parcel.id)}
                  className="flex-shrink-0 w-56 bg-white dark:bg-slate-800 border border-emerald-200/90 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl p-2 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group min-h-[72px] overflow-hidden"
                >
                  {/* Card Top */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1 truncate"
                          title={`Parcel #${parcel.parcelNumber || (parcel as any).parcel_number || (index + 1)} • Order #${parcel.orderNumber || (parcel as any).order_number || parcel.id}`}
                        >
                          <span>🛍️</span>
                          <span>{t('tables.parcelCardTitle', { defaultValue: 'Parcel #{{number}}', number: parcel.parcelNumber || (parcel as any).parcel_number || (index + 1) })}</span>
                        </span>
                      </div>
                      <span className="font-bold text-xs text-gray-900 dark:text-white font-mono">
                        {formatCurrency(parcel.grandTotal)}
                      </span>
                    </div>

                    {/* Customer or Tag & Time */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 gap-1 min-w-0">
                      <span className="font-medium truncate max-w-[125px]" title={parcel.parcelName || (parcel as any).parcel_name || parcel.customerName || parcel.customerPhone}>
                        {(parcel.parcelName || (parcel as any).parcel_name) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100/90 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 text-[10px] shadow-2xs min-w-0">
                            <span>🏷️</span>
                            <span className="truncate max-w-[100px]">{parcel.parcelName || (parcel as any).parcel_name}</span>
                          </span>
                        ) : parcel.customerName ? (
                          <span className="text-gray-700 dark:text-gray-300 font-medium truncate">👤 {parcel.customerName}</span>
                        ) : parcel.customerPhone ? (
                          <span className="text-gray-700 dark:text-gray-300 font-medium">📞 {parcel.customerPhone}</span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 font-medium truncate">{t('tables.walkInGuest', { defaultValue: 'Walk-in Guest' })}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-medium">
                        <Clock size={10} />
                        <span>{formatElapsedDuration(elapsedMins)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom / Badges & Pay button */}
                  <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-100 dark:border-slate-700/80 gap-1.5 min-w-0">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] border leading-tight min-w-0 shrink truncate ${statusBadge.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusBadge.dot}`} />
                      <span className="truncate max-w-[80px]">{statusBadge.label}</span>
                    </span>

                    <button
                      onClick={(e) => handlePayParcelOrder(parcel.id, e)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900 border border-emerald-200 transition-colors shrink-0 cursor-pointer"
                      title="Collect Payment"
                    >
                      <Banknote size={10} />
                      <span>{t('tables.payNow')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floor tabs */}
      {floors.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50/80 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          {floors.map((floor) => {
            const floorTables = tablesByFloor(floor.id);
            const occupiedFloorCount = floorTables.filter((t) => t.status === TableStatus.OCCUPIED).length;
            const isFloorActive = currentFloorId === floor.id;

            return (
              <button
                key={floor.id}
                onClick={() => setActiveFloorId(floor.id)}
                onContextMenu={(e) => handleFloorContextMenu(e, floor)}
                className={`
                  relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                  transition-all select-none
                  ${
                    isFloorActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
                  }
                `}
              >
                <Layers size={13} className={isFloorActive ? 'text-white' : 'text-gray-400'} />
                <span>{floor.name}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                    isFloorActive
                      ? 'bg-white/20 text-white'
                      : occupiedFloorCount > 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {occupiedFloorCount}/{floorTables.length}
                </span>
                {isEditMode && floors.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFloor(floor.id);
                    }}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-white/20"
                    title="Delete Floor"
                  >
                    <X size={10} />
                  </button>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Table layout */}
      {currentFloorId ? (
        <div className="flex-1 overflow-hidden">
          <TableLayout
            tables={currentTables}
            onTableClick={handleTableClick}
            onTableContextMenu={handleTableContextMenu}
            isEditMode={isEditMode}
            onTableDragEnd={handleTableDragEnd}
            tableOrders={tableOrdersMap}
            selectedTableId={selectedTable?.id}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 py-12">
          <Layers size={36} />
          <p className="text-xs">{t('tables.emptyFloors')}</p>
          <button
            onClick={() => setShowFloorModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors mt-1"
          >
            <Plus size={13} />
            <span>{t('tables.addFloor')}</span>
          </button>
        </div>
      )}

      {/* === Add / Edit Table Modal === */}
      <Modal
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        title={editingTable ? t('tables.editTableTitle') : t('tables.addTableTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowTableModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSaveTable}
              disabled={!tableForm.name.trim()}
            >
              {editingTable ? t('tables.saveChanges') : t('tables.addTableButton')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('tables.tableNameLabel')} *</label>
            <input
              type="text"
              value={tableForm.name}
              onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('tables.tableNamePlaceholder')}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
              autoFocus
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('tables.capacityLabel')}</label>
            <input
              type="number"
              min={1}
              max={20}
              value={tableForm.capacity}
              onChange={(e) =>
                setTableForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 1 }))
              }
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* === Add Floor Modal === */}
      <Modal
        isOpen={showFloorModal}
        onClose={() => { setShowFloorModal(false); setEditingFloor(null); setFloorName(''); }}
        title={editingFloor ? t('tables.renameFloorTitle') : t('tables.addFloorTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setShowFloorModal(false); setEditingFloor(null); setFloorName(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleAddFloor}
              disabled={!floorName.trim()}
            >
              {editingFloor ? t('common.save') : t('tables.addFloor')}
            </Button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('tables.floorNameLabel')} *</label>
          <input
            type="text"
            value={floorName}
            onChange={(e) => setFloorName(e.target.value)}
            placeholder={t('tables.floorNamePlaceholder')}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
          />
        </div>
      </Modal>

      {/* === Table Status / Actions Modal === */}
      <Modal
        isOpen={showStatusModal}
        onClose={handleCloseStatusModal}
        title={selectedTable?.name ?? t('tables.tableFallback')}
        size="sm"
      >
        {selectedTable && (
          <div className="space-y-4">
            {/* Current status */}
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <span>{t('tables.statusLabel')}</span>
              <span className="font-medium text-gray-800 capitalize">
                {selectedTable.status}
              </span>
              {tableOrder?.status === 'hold' && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide border border-amber-300">
                  {t('reports.statusHold', 'Hold')}
                </span>
              )}
            </div>

            {/* Quick actions based on status */}
            {selectedTable.status === TableStatus.FREE && (
              <Button
                variant="success"
                fullWidth
                size="lg"
                icon={<ChevronRight size={18} />}
                onClick={() => {
                  setShowStatusModal(false);
                  handleGoToBilling(selectedTable.id);
                }}
              >
                {t('tables.createNewOrder')}
              </Button>
            )}

            {selectedTable.status === TableStatus.OCCUPIED && (
              <div className="space-y-3">
                {/* Order details */}
                {orderLoading ? (
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="shimmer h-4 w-20 rounded" />
                      <div className="shimmer h-4 w-16 rounded" />
                    </div>
                    <div className="space-y-1.5 pt-2">
                      <div className="shimmer h-3.5 w-full rounded" />
                      <div className="shimmer h-3.5 w-3/4 rounded" />
                    </div>
                  </div>
                ) : tableOrder ? (
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-2xs">
                    {/* Order header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-100/80 dark:bg-slate-750 border-b border-gray-200 dark:border-slate-700">
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                          #{tableOrder.orderNumber}
                        </span>
                        {tableOrder.createdAt && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            <Clock size={10} />
                            <span>{formatElapsedDuration(getElapsedMinutes(tableOrder.createdAt))}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                          {formatCurrency(tableOrder.grandTotal)}
                        </span>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {tableOrder.items.length} {t('common.items', 'items')}
                        </div>
                      </div>
                    </div>
                    {/* Order items */}
                    <div className="px-3.5 py-2 space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                      {tableOrder.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-xs">
                          <span className="text-gray-700 dark:text-gray-200 truncate pr-2">
                            <span className="font-semibold text-gray-500 dark:text-gray-400 mr-1.5">{item.quantity}x</span>
                            {item.name}
                          </span>
                          <span className="text-gray-900 dark:text-gray-100 font-mono text-xs font-medium shrink-0">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      ))}
                      {tableOrder.items.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">{t('tables.noItems')}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">{t('tables.noActiveOrder')}</p>
                )}

                {/* Primary Action: View / Edit Order */}
                <Button
                  variant="primary"
                  fullWidth
                  size="md"
                  icon={<ChevronRight size={17} />}
                  onClick={() => {
                    setShowStatusModal(false);
                    handleGoToBilling(selectedTable.id, tableOrder?.id);
                  }}
                >
                  {t('tables.viewEditOrder')}
                </Button>

                {/* Print and Settle Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    fullWidth
                    size="sm"
                    icon={<Printer size={14} />}
                    onClick={handlePrintKotFromTable}
                    disabled={!tableOrder}
                  >
                    {t('tables.printKot')}
                  </Button>
                  <Button
                    variant="success"
                    fullWidth
                    size="sm"
                    icon={<CurrencyIcon size={14} />}
                    onClick={() => {
                      if (tableOrder) {
                        setShowStatusModal(false);
                        handlePayFromTable(selectedTable.id, tableOrder.id);
                      }
                    }}
                    disabled={!tableOrder}
                  >
                    {t('tables.pay')}
                  </Button>
                </div>

                {/* Table order actions: Transfer / Merge / Split / Free Table */}
                {tableOrder && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      icon={<ArrowRightLeft size={13} className="text-blue-600 dark:text-blue-400" />}
                      onClick={() => handleOpenTransfer(selectedTable, tableOrder.id)}
                    >
                      {t('billingPage.transferOrder', 'Transfer')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      icon={<Split size={13} className="text-amber-600 dark:text-amber-400" />}
                      onClick={() => handleOpenSplitBill(selectedTable, tableOrder.id)}
                    >
                      {t('billingPage.splitBill', 'Split')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      icon={<Unlock size={13} className="text-rose-600 dark:text-rose-400" />}
                      onClick={() => handleFreeTable(selectedTable, tableOrder.id)}
                    >
                      {t('billingPage.freeTable', 'Free')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Change status */}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
                {t('tables.changeStatus')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(TableStatus).map((status) => (
                  <button
                    key={status}
                    disabled={selectedTable.status === status}
                    onClick={() => handleStatusChange(status)}
                    className={`py-2.5 rounded-lg text-sm font-medium border transition-colors capitalize tap-target ${
                      selectedTable.status === status
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 active:bg-gray-100'
                    }`}
                  >
                    {t(STATUS_LABEL_KEYS[status])}
                  </button>
                ))}
              </div>
            </div>

            {/* Edit / Delete */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit2 size={14} />}
                onClick={() => {
                  setShowStatusModal(false);
                  openEditTableModal(selectedTable);
                }}
              >
                {t('common.edit')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => setShowDeleteConfirm(true)}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* === Delete Confirmation Modal === */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('tables.deleteTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={saving} onClick={handleDeleteTable}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('tables.deleteMessage', { name: selectedTable?.name })}
        </p>
      </Modal>

      {/* Table right-click context menu */}
      {tableContextMenu && createPortal(
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setTableContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setTableContextMenu(null); }}
        >
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]"
            style={{
              left: Math.min(tableContextMenu.x, window.innerWidth - 220),
              top: Math.min(tableContextMenu.y, window.innerHeight - 280),
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 flex items-center justify-between">
              <span>{tableContextMenu.table.name}</span>
              {tableContextMenu.orderId > 0 && (
                <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                  {t('tables.statusOccupied', 'Occupied')}
                </span>
              )}
            </div>

            {tableContextMenu.orderId > 0 && (
              <>
                <button
                  onClick={() => handleOpenTransfer(tableContextMenu.table, tableContextMenu.orderId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  <ArrowRightLeft size={14} className="text-blue-600" />
                  {t('billingPage.transferOrder')}
                </button>

                <button
                  onClick={() => handleOpenSplitBill(tableContextMenu.table, tableContextMenu.orderId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                >
                  <Split size={14} className="text-orange-600" />
                  {t('billingPage.splitBill')}
                </button>
                <button
                  onClick={() => handleFreeTable(tableContextMenu.table, tableContextMenu.orderId)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Unlock size={14} className="text-red-500" />
                  {t('billingPage.freeTable')}
                </button>
                <div className="border-t border-gray-100 my-1" />
              </>
            )}

            <button
              disabled={tableContextMenu.table.status === 'occupied'}
              title={tableContextMenu.table.status === 'occupied' ? t('billingPage.onlyFreeTablesEditable') : undefined}
              onClick={() => {
                const tbl = tableContextMenu.table;
                if (tbl.status === 'occupied') return;
                setTableContextMenu(null);
                openEditTableModal(tbl);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Edit2 size={14} className="text-gray-500" />
              {t('tables.editTable')}
            </button>
            <button
              onClick={async () => {
                const tbl = tableContextMenu.table;
                setTableContextMenu(null);
                try {
                  await ipc(window.electronAPI.tables.togglePin(tbl.id));
                  await refetch();
                  toast.success(tbl.isPinned ? t('tables.unpinnedToast', { name: tbl.name }) : t('tables.pinnedToast', { name: tbl.name }));
                } catch (err: any) {
                  toast.error(err?.message ?? t('tables.failedToUpdatePin'));
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pin size={14} className={tableContextMenu.table.isPinned ? 'text-blue-500 fill-blue-500' : 'text-gray-500'} />
              {tableContextMenu.table.isPinned ? t('common.unpinFromTop') : t('common.pinToTop')}
            </button>
            <button
              disabled={tableContextMenu.table.status === 'occupied'}
              title={tableContextMenu.table.status === 'occupied' ? t('billingPage.onlyFreeTablesEditable') : undefined}
              onClick={async () => {
                const tbl = tableContextMenu.table;
                if (tbl.status === 'occupied') return;
                setTableContextMenu(null);
                if (window.confirm(t('tables.confirmDeleteTable', { name: tbl.name }))) {
                  try { await deleteTable(tbl.id); } catch { /* handled */ }
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              {t('tables.deleteTable')}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Transfer / Merge Modal */}
      {transferMergeModal && (
        <TransferMergeModal
          isOpen={true}
          mode={transferMergeModal.mode}
          sourceTable={transferMergeModal.table}
          sourceOrderId={transferMergeModal.orderId}
          tables={tables}
          onClose={() => setTransferMergeModal(null)}
          onSuccess={async () => {
            await refetch();
            await fetchAllTableOrders();
            if (selectedTable) {
              await fetchTableOrder(selectedTable.id);
            }
          }}
        />
      )}

      {/* Split Bill modal */}
      {splitModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4" onClick={() => setSplitModal(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {splitModal.step === 'items' ? (
              <>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">{t('billingPage.splitBillSelectItems')}</h3>
                    <p className="text-xs text-gray-400">{t('billingPage.chooseItemsToMove')}</p>
                  </div>
                  <button onClick={() => setSplitModal(null)} className="p-1 hover:bg-gray-100 rounded">
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                  {splitModal.items.map((item, idx) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        item.selected ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => {
                          const updated = [...splitModal.items];
                          updated[idx] = { ...updated[idx], selected: !updated[idx].selected };
                          setSplitModal({ ...splitModal, items: updated });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{t('billingPage.qty', { count: item.quantity })}</p>
                      </div>
                      <span className="text-sm font-medium text-gray-600">{formatCurrency(item.total)}</span>
                    </label>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {t('billingPage.itemsOfTotal', {
                      shown: splitModal.items.filter((i) => i.selected).length,
                      total: splitModal.items.length,
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSplitModal(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleSplitBillNext}
                      disabled={splitModal.items.filter((i) => i.selected).length === 0}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t('billingPage.nextPickTable')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700">{t('billingPage.splitBillChooseTable')}</h3>
                    <p className="text-xs text-gray-400">
                      {t('billingPage.itemsWillMove', { count: splitModal.items.filter((i) => i.selected).length })}
                    </p>
                  </div>
                  <button onClick={() => setSplitModal({ ...splitModal, step: 'items' })} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">
                    {t('common.back')}
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  {tables
                    .filter((t) => t.id !== splitModal.sourceTableId && t.status !== 'occupied')
                    .map((t) => (
                      <button
                        key={t.id}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 border-b border-gray-50 last:border-0 rounded-lg"
                        onClick={() => handleSplitBillConfirm(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  {tables.filter((t) => t.id !== splitModal.sourceTableId && t.status !== 'occupied').length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-400 text-center">{t('billingPage.noFreeTablesAvailable')}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Floor right-click context menu */}
      {floorContextMenu && createPortal(
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setFloorContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setFloorContextMenu(null); }}
        >
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
            style={{ left: floorContextMenu.x, top: floorContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              {floorContextMenu.floor.name}
            </div>
            <button
              onClick={() => {
                const fl = floorContextMenu.floor;
                setFloorContextMenu(null);
                setEditingFloor(fl);
                setFloorName(fl.name);
                setShowFloorModal(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit2 size={14} className="text-gray-500" />
              {t('tables.renameFloor')}
            </button>
            <button
              onClick={() => {
                const fl = floorContextMenu.floor;
                setFloorContextMenu(null);
                handleDeleteFloor(fl.id);
              }}
              disabled={floors.length <= 1}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              {t('tables.deleteFloor')}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Parcel name / partner modal */}
      <ParcelNameModal
        isOpen={showParcelModal}
        onClose={() => setShowParcelModal(false)}
        onConfirm={handleConfirmParcelName}
        currentName={useBillingStore.getState().parcelName}
      />

      {/* Cancel Order Void Reason Modal */}
      <VoidReasonModal
        isOpen={!!tableToCancel}
        onClose={() => setTableToCancel(null)}
        onConfirm={handleConfirmCancelTableOrder}
        title={t('voidModal.cancelOrderTitle', 'Cancel Order — Select Reason')}
      />
    </div>
  );
};

export default Tables;
