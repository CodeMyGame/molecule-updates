import React, { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  LayoutGrid,
  FileText,
  Layers,
  CircleDot,
  Grid3X3,
  List,
  ArrowRightLeft,
  Merge,
  Split,
  X,
  PlusCircle,
  Plus,
  Unlock,
  AlertTriangle,
  Edit2,
  Trash2,
  Pin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBillingStore } from '../stores/billing.store';
import { syncOrderDiscountToServer } from '../lib/syncOrderDiscount';
import { useMenu } from '../hooks/useMenu';
import { useOrders } from '../hooks/useOrders';
import { ipc } from '../lib/ipc';
import { formatCurrency } from '../lib/formatters';
import { ORDER_TYPES } from '../lib/constants';
import { useSettings } from '../hooks/useSettings';
import MenuGrid from '../components/billing/MenuGrid';
import CartPanel from '../components/billing/CartPanel';
import PaymentModal from '../components/billing/PaymentModal';
import DiscountModal from '../components/billing/DiscountModal';
import BillPreview from '../components/billing/BillPreview';
import TableCard from '../components/tables/TableCard';
import Tooltip from '../components/common/Tooltip';
import { useTranslation } from 'react-i18next';
import {
  resolveOrderItemTaxRateFallback,
  resolveTaxRateForCartLine,
} from '../lib/taxLocalePresets';
import { useTaxTerminology } from '../hooks/useTaxTerminology';
import { WHATSAPP_FEATURE_ENABLED } from '../../shared/featureFlags';
import type { Variation, Addon } from '../hooks/useMenu';

interface Table {
  id: number;
  floorId: number;
  name: string;
  floor_name?: string;
  status: string;
  capacity: number;
  posX: number;
  posY: number;
  shape: string;
}

interface Floor {
  id: number;
  name: string;
}

const ORDER_TYPE_KEYS = [
  { key: 'dine_in' as const, tKey: 'billing.dineIn', icon: UtensilsCrossed },
  { key: 'takeaway' as const, tKey: 'billing.takeaway', icon: ShoppingBag },
  { key: 'delivery' as const, tKey: 'billing.delivery', icon: Truck },
];

const Billing: React.FC = () => {
  const location = useLocation();
  const {
    categories,
    filteredItems,
    selectedCategoryId,
    searchQuery,
    loading: menuLoading,
    setSelectedCategoryId,
    setSearchQuery,
    getVariations,
    getAddons,
    refetch: refetchMenu,
    invalidateItemCache,
  } = useMenu();

  const {
    activeOrders,
    fetchActiveOrders,
    loading: ordersLoading,
    createOrder,
    holdOrder,
    cancelOrder,
    printKot,
  } = useOrders();

  const { settings, fetchSettings } = useSettings();
  const { t, i18n } = useTranslation();
  const taxTerms = useTaxTerminology();

  useEffect(() => {
    void fetchSettings(['default_tax_rate', 'show_menu_prices']);
  }, [fetchSettings]);

  const orderType = useBillingStore((s) => s.orderType);
  const setOrderType = useBillingStore((s) => s.setOrderType);
  const selectedTableId = useBillingStore((s) => s.selectedTableId);
  const setTable = useBillingStore((s) => s.setTable);
  const addToCart = useBillingStore((s) => s.addToCart);
  const addTempItemToCart = useBillingStore((s) => s.addTempItemToCart);
  const currentOrderId = useBillingStore((s) => s.currentOrderId);
  const clearCart = useBillingStore((s) => s.clearCart);
  const cart = useBillingStore((s) => s.cart);
  const syncedItemCount = useBillingStore((s) => s.syncedItemCount);
  const [unsavedSwitchTarget, setUnsavedSwitchTarget] = useState<number | null>(null);
  const applyDiscount = useBillingStore((s) => s.applyDiscount);
  const discount = useBillingStore((s) => s.discount);
  const getSubtotal = useBillingStore((s) => s.getSubtotal);
  const loadOrderIntoCart = useBillingStore((s) => s.loadOrderIntoCart);
  const resetForNewTable = useBillingStore((s) => s.resetForNewTable);

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [billPreviewPostPayment, setBillPreviewPostPayment] = useState(false);
  const [billCustomerPhone, setBillCustomerPhone] = useState<string | undefined>();
  const [billCoinInfo, setBillCoinInfo] = useState<{ earned: number; redeemed: number } | undefined>();
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [menuViewMode, setMenuViewMode] = useState<'grid' | 'list'>('grid');
  const [showTempItemModal, setShowTempItemModal] = useState(false);
  const [tempItemName, setTempItemName] = useState('');
  const [tempItemPrice, setTempItemPrice] = useState('');

  // --- Resizable panel state ---
  const [cartWidth, setCartWidth] = useState(310);
  const [menuHeightPercent, setMenuHeightPercent] = useState(75);
  const [floorSidebarWidth, setFloorSidebarWidth] = useState(128);
  const mainRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((onMove: (e: globalThis.MouseEvent) => void) => {
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onCartHandleDown = useCallback(() => {
    startDrag((e) => {
      if (!mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      setCartWidth(Math.max(220, Math.min(500, newWidth)));
    });
  }, [startDrag]);

  const onMenuTableHandleDown = useCallback(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!leftRef.current) return;
      const rect = leftRef.current.getBoundingClientRect();
      const percent = ((e.clientY - rect.top) / rect.height) * 100;
      setMenuHeightPercent(Math.max(30, Math.min(90, percent)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onFloorHandleDown = useCallback(() => {
    startDrag((e) => {
      const target = (e.target as HTMLElement).closest('[data-table-picker]');
      const container = document.querySelector('[data-table-picker]');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      setFloorSidebarWidth(Math.max(80, Math.min(220, newWidth)));
    });
  }, [startDrag]);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById('header-center-slot');
    if (el) setHeaderSlot(el);
    return () => { if (el) el.innerHTML = ''; };
  }, []);

  // Tables
  const [tables, setTables] = useState<Table[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [billingFloorId, setBillingFloorId] = useState<number | null>(null);
  const [tableOrdersMap, setTableOrdersMap] = useState<Map<number, { grandTotal: number; itemCount: number; createdAt: string }>>(new Map());
  const [showAddFloorDialog, setShowAddFloorDialog] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [savingFloor, setSavingFloor] = useState(false);
  const [showAddTableDialog, setShowAddTableDialog] = useState(false);
  const [newTableForm, setNewTableForm] = useState({ name: '', capacity: '4' });
  const [savingTable, setSavingTable] = useState(false);

  const handleQuickAddFloor = async () => {
    if (!newFloorName.trim()) return;
    setSavingFloor(true);
    try {
      const floor = await ipc<Floor>(window.electronAPI.tables.createFloor(newFloorName.trim()));
      const refreshed = await ipc<Floor[]>(window.electronAPI.tables.getFloors());
      setFloors(refreshed ?? []);
      if (floor) setBillingFloorId(floor.id);
      setNewFloorName('');
      setShowAddFloorDialog(false);
    } catch (err) {
      console.error('Failed to create floor', err);
    } finally {
      setSavingFloor(false);
    }
  };

  const handleQuickAddTable = async () => {
    if (!newTableForm.name.trim() || !billingFloorId) return;
    setSavingTable(true);
    try {
      await ipc(window.electronAPI.tables.create({
        floorId: billingFloorId,
        name: newTableForm.name.trim(),
        capacity: parseInt(newTableForm.capacity) || 4,
        shape: 'rectangle',
        posX: 0,
        posY: 0,
      }));
      const refreshed = await ipc<Table[]>(window.electronAPI.tables.getAll());
      setTables(refreshed ?? []);
      setNewTableForm({ name: '', capacity: '4' });
      setShowAddTableDialog(false);
    } catch (err) {
      console.error('Failed to create table', err);
    } finally {
      setSavingTable(false);
    }
  };

  // Offers
  const [activeOffers, setActiveOffers] = useState<any[]>([]);
  const [autoAppliedOfferId, setAutoAppliedOfferId] = useState<number | null>(null);

  useEffect(() => {
    try {
      ipc<any[]>(window.electronAPI.offers.getActive())
        .then((o) => setActiveOffers(o ?? []))
        .catch(() => {});
    } catch { /* offers API not available */ }
  }, []);

  // Auto-apply best offer when subtotal changes
  useEffect(() => {
    if (activeOffers.length === 0 || cart.length === 0) {
      if (autoAppliedOfferId !== null && discount?.reason?.startsWith('Auto:')) {
        applyDiscount(null);
        setAutoAppliedOfferId(null);
      }
      return;
    }
    const subtotal = getSubtotal();
    // Find best (highest discount) applicable offer
    let bestOffer: any = null;
    let bestDiscount = 0;
    for (const offer of activeOffers) {
      if (subtotal < offer.minOrderAmount) continue;
      let discountAmt = offer.type === 'percentage'
        ? Math.round((subtotal * offer.value) / 100)
        : offer.value;
      if (offer.maxDiscount) discountAmt = Math.min(discountAmt, offer.maxDiscount);
      if (discountAmt > bestDiscount) { bestDiscount = discountAmt; bestOffer = offer; }
    }
    if (bestOffer) {
      // Only auto-apply if no manual discount OR previous auto-offer was applied
      if (!discount || discount.reason?.startsWith('Auto:')) {
        applyDiscount({
          type: bestOffer.type === 'percentage' ? 'percent' : 'flat',
          value: bestOffer.type === 'percentage' ? bestOffer.value : bestOffer.value,
          reason: `Auto: ${bestOffer.name}`,
        });
        setAutoAppliedOfferId(bestOffer.id);
      }
    } else if (autoAppliedOfferId !== null && discount?.reason?.startsWith('Auto:')) {
      // Order dropped below threshold — remove auto offer
      applyDiscount(null);
      setAutoAppliedOfferId(null);
    }
  }, [cart, activeOffers]);

  // Keep server order totals in sync when discount changes on an existing order (auto-offers, etc.)
  useEffect(() => {
    if (!currentOrderId) return;
    const timer = setTimeout(() => {
      syncOrderDiscountToServer(currentOrderId, discount).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [discount, currentOrderId]);

  // Fetch tables
  const refreshTables = useCallback(() => {
    ipc<Table[]>(window.electronAPI.tables.getAll())
      .then((t) => setTables(t ?? []))
      .catch(() => {});
  }, []);

  // Derive table-card totals directly from activeOrders so they update on every
  // 5s poll. (Previously this fetched per-table over IPC only when `tables`
  // changed, which left totals stale when the cashier or a waiter tablet
  // appended items to an existing order.)
  useEffect(() => {
    const map = new Map<number, { grandTotal: number; itemCount: number; createdAt: string }>();
    for (const order of activeOrders) {
      const tableId = (order as any).tableId ?? (order as any).table_id;
      if (!tableId) continue;
      map.set(tableId, {
        grandTotal: (order as any).grandTotal ?? 0,
        itemCount: ((order as any).items ?? []).length,
        createdAt: (order as any).createdAt ?? '',
      });
    }
    setTableOrdersMap(map);
  }, [activeOrders]);

  // Fetch floors once
  useEffect(() => {
    ipc<Floor[]>(window.electronAPI.tables.getFloors())
      .then((f) => {
        setFloors(f ?? []);
        if (f && f.length > 0) setBillingFloorId(f[0].id);
      })
      .catch(() => {});
  }, []);

  // Apply default_order_type setting on first load (only when no order is in progress)
  useEffect(() => {
    if (!currentOrderId) {
      const defaultType = settings.default_order_type as typeof orderType | undefined;
      if (defaultType && defaultType !== orderType) {
        setOrderType(defaultType);
      }
    }
  }, [settings.default_order_type]);

  // Fetch tables and auto-select first free table for new orders
  useEffect(() => {
    ipc<Table[]>(window.electronAPI.tables.getAll())
      .then((t) => {
        const allTables = t ?? [];
        setTables(allTables);
        // Read fresh store state to avoid stale closure race with the default order type effect
        const { orderType: freshType, selectedTableId: freshTableId, currentOrderId: freshOrderId } =
          useBillingStore.getState();
        if (freshType === 'dine_in' && !freshTableId && !freshOrderId) {
          const firstFree = allTables.find((tb) => tb.status === 'free');
          if (firstFree) {
            setTable(firstFree.id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch active orders on mount + poll every 5s so kitchen status changes
  // (Accept/Ready/Served from a tablet) reflect in the order pills automatically.
  useEffect(() => {
    fetchActiveOrders();
    const interval = setInterval(() => {
      fetchActiveOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveOrders]);

  // Detect orders transitioning to "Ready" (all items ready/served, none pending)
  // AND newly-created orders coming from waiter tablets, then notify the cashier.
  const prevOrderReadyRef = useRef<Map<number, boolean>>(new Map());
  const seenOrderIdsRef = useRef<Set<number> | null>(null);
  // Baselines must wait until the first fetch actually completes; otherwise
  // the initial empty `activeOrders` becomes the baseline and every existing
  // order shows up as "new" the moment the fetch returns.
  const baselineSetRef = useRef(false);
  const seenLoadingRef = useRef(false);
  const billingAudioCtxRef = useRef<AudioContext | null>(null);

  const playBillingChime = (frequency: number, duration: number) => {
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      const ctx: AudioContext = billingAudioCtxRef.current ?? new Ctor();
      billingAudioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (ctx.state !== 'running') return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration);
    } catch {
      // ignore
    }
  };

  // Unlock audio on first user gesture so chimes actually play.
  useEffect(() => {
    const unlock = () => {
      if (billingAudioCtxRef.current && billingAudioCtxRef.current.state === 'running') return;
      try {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        const ctx: AudioContext = billingAudioCtxRef.current ?? new Ctor();
        billingAudioCtxRef.current = ctx;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch { /* ignore */ }
    };
    const events: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown'];
    events.forEach((e) => document.addEventListener(e, unlock, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, unlock));
  }, []);

  useEffect(() => {
    if (ordersLoading) seenLoadingRef.current = true;

    const next = new Map<number, boolean>();
    const justBecameReady: any[] = [];
    const ids = new Set<number>();
    const justArrived: any[] = [];

    for (const order of activeOrders) {
      ids.add(order.id);
      const items = (order as any).items ?? [];
      const statuses: string[] = items.map((i: any) => i.kotStatus ?? i.kot_status ?? 'pending');
      const isReady =
        statuses.length > 0 &&
        statuses.every((s) => s === 'ready' || s === 'served') &&
        statuses.some((s) => s === 'ready');

      const wasReady = prevOrderReadyRef.current.get(order.id);
      if (isReady && wasReady === false) {
        justBecameReady.push(order);
      }
      next.set(order.id, isReady);
    }
    prevOrderReadyRef.current = next;

    // Wait until the first fetch has actually completed before establishing the
    // baseline. The initial render has activeOrders=[] (loading hasn't started yet),
    // so baselining there would falsely flag every existing order as "new" once
    // the fetch returns.
    if (!baselineSetRef.current) {
      if (seenLoadingRef.current && !ordersLoading) {
        seenOrderIdsRef.current = ids;
        baselineSetRef.current = true;
      }
      return;
    }

    if (seenOrderIdsRef.current) {
      for (const order of activeOrders) {
        if (!seenOrderIdsRef.current.has(order.id)) {
          justArrived.push(order);
        }
      }
    }
    seenOrderIdsRef.current = ids;

    if (justBecameReady.length > 0) {
      for (const order of justBecameReady) {
        toast.success(
          t('billing.kotReadyToast', { orderNumber: String(order.id).padStart(3, '0') }),
          { duration: 6000, icon: '🔔' },
        );
      }
      playBillingChime(1046, 0.6); // C6
    }

    if (justArrived.length > 0) {
      for (const order of justArrived) {
        const tableId = (order as any).tableId ?? (order as any).table_id;
        const tableName = tables.find((t) => t.id === tableId)?.name;
        const orderNumStr = String(order.id).padStart(3, '0');
        toast.success(
          tableName
            ? t('billing.newOrderFromTableToast', { orderNumber: orderNumStr, tableName, defaultValue: 'New order #{{orderNumber}} on {{tableName}}' })
            : t('billing.newOrderToast', { orderNumber: orderNumStr, defaultValue: 'New order #{{orderNumber}} received' }),
          { duration: 6000, icon: '🛎️' },
        );
      }
      playBillingChime(880, 0.5);
      // Refresh table statuses so new occupations show up
      refreshTables();
    }
  }, [activeOrders, ordersLoading, t, tables, refreshTables]);

  // Auto-open payment modal if navigated with ?action=pay
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'pay' && currentOrderId) {
      setShowPayment(true);
    }
  }, [location.search, currentOrderId]);

  // Helper to load a table's existing order into the cart
  const loadTableOrder = useCallback(
    async (tableId: number) => {
      const order = await ipc<any>(window.electronAPI.orders.getByTable(tableId));
      if (order && order.items && order.items.length > 0) {
        const cartItems = order.items.map((oi: any) => ({
          menuItem: {
            id: oi.menuItemId ?? oi.menu_item_id ?? 0,
            name: oi.name?.split(' (')[0] ?? oi.name,
            basePrice: oi.unitPrice ?? oi.unit_price,
            categoryId: 0,
            taxRate: resolveOrderItemTaxRateFallback(
              oi.taxRate ?? oi.tax_rate,
              settings.default_tax_rate,
              i18n.language
            ),
            isVeg: false,
          },
          variation: oi.variationId
            ? { id: oi.variationId, name: oi.name?.match(/\(([^)]+)\)/)?.[1] ?? '', priceDelta: 0 }
            : undefined,
          addons: (oi.addons ?? []).map((a: any) => ({
            id: a.addonId,
            name: a.name,
            price: a.price,
          })),
          quantity: oi.quantity,
          unitPrice: oi.unitPrice ?? oi.unit_price,
          total: (oi.unitPrice ?? oi.unit_price) * oi.quantity,
          notes: oi.notes,
          orderItemId: oi.id,
        }));
        const orderDiscount = order.discountType
          ? { type: order.discountType === 'percentage' ? 'percent' : order.discountType, value: order.discountValue ?? 0, reason: order.discountReason }
          : null;
        loadOrderIntoCart(order.id, tableId, cartItems, cartItems.length, order.orderType ?? order.order_type, orderDiscount, order.notes);
      } else {
        resetForNewTable(tableId);
      }
    },
    [loadOrderIntoCart, resetForNewTable, settings.default_tax_rate, i18n.language]
  );

  // Handle table switch — auto-save unsaved cart, then load existing order or start fresh
  const handleTableSwitch = useCallback(
    async (tableId: number | null) => {
      if (tableId === null) {
        setTable(null);
        return;
      }
      if (tableId === selectedTableId) return;

      // Warn if there are un-KOT'd items in the cart before switching away
      const hasUnsavedItems =
        cart.length > 0 && (!currentOrderId || cart.length > syncedItemCount);
      if (hasUnsavedItems && selectedTableId) {
        setUnsavedSwitchTarget(tableId);
        return;
      }

      try {
        await loadTableOrder(tableId);
      } catch {
        resetForNewTable(tableId);
      }
    },
    [selectedTableId, setTable, loadTableOrder, resetForNewTable, cart, currentOrderId, syncedItemCount]
  );

  // --- Table context menu: transfer, merge, split ---
  const [transferMenu, setTransferMenu] = useState<{
    sourceTableId: number;
    orderId: number;
    x: number;
    y: number;
    mode: 'menu' | 'transfer' | 'merge';
  } | null>(null);

  // Split bill state
  const [splitModal, setSplitModal] = useState<{
    orderId: number;
    sourceTableId: number;
    items: { id: number; name: string; quantity: number; total: number; selected: boolean }[];
    step: 'items' | 'table';
    targetTableId?: number;
  } | null>(null);

  const handleTableContextMenu = useCallback(
    async (e: React.MouseEvent, table: Table) => {
      e.preventDefault();
      const order = await ipc<any>(window.electronAPI.orders.getByTable(table.id)).catch(() => null);
      const orderId = order && order.items && order.items.length > 0 ? order.id : 0;
      setTransferMenu({ sourceTableId: table.id, orderId, x: e.clientX, y: e.clientY, mode: 'menu' });
    },
    []
  );

  // Edit / delete table from context menu
  const [editTableDialog, setEditTableDialog] = useState<Table | null>(null);
  const [editTableForm, setEditTableForm] = useState({ name: '', capacity: '4' });
  const [savingEditTable, setSavingEditTable] = useState(false);
  const handleSaveEditTable = async () => {
    if (!editTableDialog || !editTableForm.name.trim()) return;
    setSavingEditTable(true);
    try {
      await ipc(window.electronAPI.tables.update(editTableDialog.id, {
        name: editTableForm.name.trim(),
        capacity: parseInt(editTableForm.capacity) || 4,
      }));
      const refreshed = await ipc<Table[]>(window.electronAPI.tables.getAll());
      setTables(refreshed ?? []);
      setEditTableDialog(null);
    } catch (err) {
      console.error('Failed to update table', err);
    } finally {
      setSavingEditTable(false);
    }
  };
  const [deleteTableConfirm, setDeleteTableConfirm] = useState<Table | null>(null);
  const [deleteTableError, setDeleteTableError] = useState<string | null>(null);
  const [allowForceDeleteTable, setAllowForceDeleteTable] = useState(false);
  const handleDeleteTable = (table: Table) => {
    setDeleteTableError(null);
    setAllowForceDeleteTable(false);
    setDeleteTableConfirm(table);
  };
  const confirmDeleteTable = async () => {
    if (!deleteTableConfirm) return;
    try {
      await ipc(window.electronAPI.tables.delete(deleteTableConfirm.id));
      const refreshed = await ipc<Table[]>(window.electronAPI.tables.getAll());
      setTables(refreshed ?? []);
      setDeleteTableConfirm(null);
    } catch (err: any) {
      setDeleteTableError(err?.message ?? t('billingPage.failedToDelete'));
      setAllowForceDeleteTable(true);
    }
  };
  const forceDeleteTableAction = async () => {
    if (!deleteTableConfirm) return;
    try {
      await ipc(window.electronAPI.tables.forceDelete(deleteTableConfirm.id));
      const refreshed = await ipc<Table[]>(window.electronAPI.tables.getAll());
      setTables(refreshed ?? []);
      setDeleteTableConfirm(null);
      setAllowForceDeleteTable(false);
    } catch (err: any) {
      setDeleteTableError(err?.message ?? t('billingPage.failedToForceDelete'));
    }
  };

  // Floor context menu
  const [floorContextMenu, setFloorContextMenu] = useState<{ x: number; y: number; floor: Floor } | null>(null);
  const [editFloorDialog, setEditFloorDialog] = useState<Floor | null>(null);
  const [editFloorName, setEditFloorName] = useState('');
  const handleSaveEditFloor = async () => {
    if (!editFloorDialog || !editFloorName.trim()) return;
    try {
      await ipc(window.electronAPI.tables.updateFloor(editFloorDialog.id, editFloorName.trim()));
      const refreshed = await ipc<Floor[]>(window.electronAPI.tables.getFloors());
      setFloors(refreshed ?? []);
      setEditFloorDialog(null);
    } catch (err: any) {
      toast.error(err?.message ?? t('billingPage.failedToRename'));
    }
  };
  const [deleteFloorConfirm, setDeleteFloorConfirm] = useState<Floor | null>(null);
  const [deleteFloorError, setDeleteFloorError] = useState<string | null>(null);
  const [allowForceDeleteFloor, setAllowForceDeleteFloor] = useState(false);
  const handleDeleteFloor = (floor: Floor) => {
    const hasTables = tables.some((t) => t.floorId === floor.id);
    setDeleteFloorError(hasTables ? t('billingPage.floorStillHasTables') : null);
    setAllowForceDeleteFloor(hasTables);
    setDeleteFloorConfirm(floor);
  };
  const refreshFloorsAndTables = async (deletedFloorId: number) => {
    const [fl, tb] = await Promise.all([
      ipc<Floor[]>(window.electronAPI.tables.getFloors()),
      ipc<Table[]>(window.electronAPI.tables.getAll()),
    ]);
    setFloors(fl ?? []);
    setTables(tb ?? []);
    if (billingFloorId === deletedFloorId) setBillingFloorId(fl && fl[0] ? fl[0].id : null);
  };
  const confirmDeleteFloor = async () => {
    if (!deleteFloorConfirm) return;
    try {
      await ipc(window.electronAPI.tables.deleteFloor(deleteFloorConfirm.id));
      await refreshFloorsAndTables(deleteFloorConfirm.id);
      setDeleteFloorConfirm(null);
    } catch (err: any) {
      setDeleteFloorError(err?.message ?? t('billingPage.failedToDelete'));
      setAllowForceDeleteFloor(true);
    }
  };
  const forceDeleteFloorAction = async () => {
    if (!deleteFloorConfirm) return;
    try {
      await ipc(window.electronAPI.tables.forceDeleteFloor(deleteFloorConfirm.id));
      await refreshFloorsAndTables(deleteFloorConfirm.id);
      setDeleteFloorConfirm(null);
      setAllowForceDeleteFloor(false);
    } catch (err: any) {
      setDeleteFloorError(err?.message ?? t('billingPage.failedToForceDelete'));
    }
  };

  const handleTransferOrder = useCallback(
    async (targetTableId: number) => {
      if (!transferMenu) return;
      try {
        await ipc(window.electronAPI.orders.moveTable(transferMenu.orderId, targetTableId));
        const targetName = tables.find((t) => t.id === targetTableId)?.name ?? `Table ${targetTableId}`;
        toast.success(t('billingPage.orderTransferredTo', { name: targetName }));
        if (selectedTableId === transferMenu.sourceTableId) {
          await loadTableOrder(targetTableId);
        }
        refreshTables();
      } catch (err: any) {
        toast.error(err?.message ?? t('billingPage.transferFailed'));
      } finally {
        setTransferMenu(null);
      }
    },
    [transferMenu, tables, selectedTableId, loadTableOrder, refreshTables]
  );

  const handleMergeOrders = useCallback(
    async (targetTableId: number) => {
      if (!transferMenu) return;
      try {
        const targetOrder = await ipc<any>(window.electronAPI.orders.getByTable(targetTableId));
        if (!targetOrder) { toast.error(t('billingPage.noOrderOnTargetTable')); return; }
        // Merge source order INTO target order
        await ipc(window.electronAPI.orders.mergeBills(transferMenu.orderId, targetOrder.id));
        const targetName = tables.find((t) => t.id === targetTableId)?.name ?? `Table ${targetTableId}`;
        toast.success(t('billingPage.ordersMergedInto', { name: targetName }));
        // If viewing source table, switch to target
        if (selectedTableId === transferMenu.sourceTableId) {
          await loadTableOrder(targetTableId);
        } else if (selectedTableId === targetTableId) {
          await loadTableOrder(targetTableId);
        }
        refreshTables();
      } catch (err: any) {
        toast.error(err?.message ?? t('billingPage.mergeFailed'));
      } finally {
        setTransferMenu(null);
      }
    },
    [transferMenu, tables, selectedTableId, loadTableOrder, refreshTables]
  );

  const handleOpenSplitBill = useCallback(
    async () => {
      if (!transferMenu) return;
      try {
        const order = await ipc<any>(window.electronAPI.orders.getById(transferMenu.orderId));
        if (!order?.items?.length) { toast.error(t('billingPage.noItemsToSplit')); return; }
        setSplitModal({
          orderId: transferMenu.orderId,
          sourceTableId: transferMenu.sourceTableId,
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
      setTransferMenu(null);
    },
    [transferMenu]
  );

  const handleFreeTable = useCallback(async () => {
    if (!transferMenu) return;
    try {
      await ipc(window.electronAPI.orders.updateStatus(transferMenu.orderId, 'cancelled'));
      if (selectedTableId === transferMenu.sourceTableId) {
        resetForNewTable(transferMenu.sourceTableId);
      }
      toast.success(t('billingPage.tableFreedAndCancelled'));
      refreshTables();
    } catch (err: any) {
      toast.error(err?.message ?? t('billingPage.failedToFreeTable'));
    } finally {
      setTransferMenu(null);
    }
  }, [transferMenu, selectedTableId, resetForNewTable, refreshTables]);

  const handleSplitBillNext = useCallback(() => {
    if (!splitModal) return;
    const selectedIds = splitModal.items.filter((i) => i.selected).map((i) => i.id);
    if (selectedIds.length === 0) { toast.error(t('billingPage.selectItemsToSplit')); return; }
    if (selectedIds.length === splitModal.items.length) { toast.error(t('billingPage.cannotSplitAll')); return; }
    setSplitModal({ ...splitModal, step: 'table' });
  }, [splitModal]);

  const handleSplitBillConfirm = useCallback(
    async (targetTableId: number) => {
      if (!splitModal) return;
      const selectedIds = splitModal.items.filter((i) => i.selected).map((i) => i.id);
      try {
        await ipc(window.electronAPI.orders.splitBill(splitModal.orderId, selectedIds, targetTableId));
        const targetName = tables.find((t) => t.id === targetTableId)?.name ?? `Table ${targetTableId}`;
        toast.success(t('billingPage.itemsSplitTo', { name: targetName }));
        if (selectedTableId === splitModal.sourceTableId) {
          await loadTableOrder(splitModal.sourceTableId);
        }
        refreshTables();
      } catch (err: any) {
        toast.error(err?.message ?? t('billingPage.splitFailed'));
      } finally {
        setSplitModal(null);
      }
    },
    [splitModal, tables, selectedTableId, loadTableOrder, refreshTables]
  );

  // Close context menu on click outside
  useEffect(() => {
    if (!transferMenu) return;
    const close = () => setTransferMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [transferMenu]);

  // Load any order by ID into cart
  const loadOrderById = useCallback(async (orderId: number) => {
    try {
      const fullOrder = await ipc<any>(window.electronAPI.orders.getById(orderId));
      if (fullOrder && fullOrder.items) {
        const cartItems = fullOrder.items.map((oi: any) => ({
          menuItem: {
            id: oi.menuItemId ?? oi.menu_item_id ?? 0,
            name: (oi.name ?? '').split(' (')[0],
            basePrice: oi.unitPrice ?? oi.unit_price,
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
          addons: (oi.addons ?? []).map((a: any) => ({
            id: a.addonId,
            name: a.name,
            price: a.price,
          })),
          quantity: oi.quantity,
          unitPrice: oi.unitPrice ?? oi.unit_price,
          total: (oi.unitPrice ?? oi.unit_price) * oi.quantity,
          notes: oi.notes,
        }));
        const tableId = fullOrder.tableId ?? fullOrder.table_id ?? null;
        // Restore discount and notes from the loaded order
        const orderDiscount = fullOrder.discountType
          ? { type: fullOrder.discountType === 'percentage' ? 'percent' : fullOrder.discountType, value: fullOrder.discountValue ?? 0, reason: fullOrder.discountReason }
          : null;
        loadOrderIntoCart(orderId, tableId, cartItems, cartItems.length, fullOrder.orderType ?? fullOrder.order_type, orderDiscount, fullOrder.notes);
      }
    } catch {
      toast.error(t('toast.loadOrderFailed'));
    }
  }, [loadOrderIntoCart, setOrderType, t, settings.default_tax_rate, i18n.language]);

  const handleAddToCart = useCallback(
    (item: any, variation?: Variation, addons?: Addon[]) => {
      const menuRate = Number(item?.taxRate);
      const baseRate = Number.isFinite(menuRate) ? menuRate : 0;
      const taxRate = resolveTaxRateForCartLine(baseRate, settings.default_tax_rate, i18n.language);
      addToCart({ ...item, taxRate }, variation, addons);
    },
    [addToCart, settings.default_tax_rate, i18n.language]
  );

  const handleHoldOrder = useCallback(async () => {
    try {
      await holdOrder();
      toast.success(t('toast.orderHeld'));
      refreshTables();
    } catch {
      toast.error(t('toast.holdOrderFailed'));
    }
  }, [holdOrder, refreshTables, t]);

  const handleKot = useCallback(async () => {
    try {
      await printKot(undefined, false);
      toast.success(t('toast.kotSent'));
      await fetchActiveOrders();
      refreshTables();
    } catch (err: any) {
      toast.error(err?.message ?? t('toast.kotSendFailed'));
    }
  }, [printKot, fetchActiveOrders, refreshTables, t]);

  const handlePrintKot = useCallback(async () => {
    try {
      await printKot(undefined, true);
      toast.success(t('toast.kotPrintedAndSent'));
      await fetchActiveOrders();
      refreshTables();
    } catch (err: any) {
      if ((err as any).isPrintWarning) {
        toast(t('toast.kotSentPrinterWarn'), { icon: '⚠️' });
        await fetchActiveOrders();
        refreshTables();
      } else {
        toast.error(err?.message ?? t('toast.kotSendFailed'));
      }
    }
  }, [printKot, fetchActiveOrders, refreshTables, t]);

  // Keyboard shortcuts (placed after handler declarations to avoid TDZ errors)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1-F12 for categories
      if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const fNum = parseInt(e.key.slice(1));
        if (fNum >= 1 && fNum <= 12) {
          e.preventDefault();
          if (fNum === 1) {
            setSelectedCategoryId(null); // F1 = All
          } else if (fNum - 2 < categories.length) {
            setSelectedCategoryId(categories[fNum - 2].id);
          }
        }
      }

      // Ctrl+P = Pay
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        if (cart.length > 0) setShowPayment(true);
      }

      // Ctrl+H = Hold
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        if (cart.length > 0) handleHoldOrder();
      }

      // Ctrl+K = KOT (digital only)
      if (e.ctrlKey && !e.shiftKey && e.key === 'k') {
        e.preventDefault();
        if (cart.length > 0) handleKot();
      }

      // Ctrl+Shift+K = Print KOT (digital + thermal)
      if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        if (cart.length > 0) handlePrintKot();
      }

      // Ctrl+D = Discount
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (cart.length > 0) setShowDiscount(true);
      }

      // Ctrl+B = Bill preview
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        if (cart.length > 0) setShowBillPreview(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categories, cart.length, setSelectedCategoryId, handleHoldOrder, handleKot, handlePrintKot]);

  const handlePay = useCallback(() => {
    setShowPayment(true);
  }, []);

  const handleCancelOrder = useCallback(async () => {
    if (currentOrderId) {
      try {
        await cancelOrder(currentOrderId);
        toast.success(t('toast.orderCancelled'));
        refreshTables();
      } catch {
        toast.error(t('toast.cancelOrderFailed'));
      }
    } else {
      clearCart();
      toast.success(t('toast.cartCleared'));
    }
  }, [currentOrderId, cancelOrder, clearCart, refreshTables, t]);

  const handlePaymentComplete = useCallback(
    async (
      payments: { mode: string; amount: number; reference?: string }[],
      tip: number,
      printBill: boolean,
      customer?: { phone: string },
      sendWhatsApp?: boolean,
      coinsToRedeem?: number
    ) => {
      try {
        let orderId = currentOrderId;
        if (!orderId) {
          const order = await createOrder();
          orderId = order.id;
        } else {
          await syncOrderDiscountToServer(orderId, useBillingStore.getState().discount);
        }

        const paymentResult = await ipc<any>(window.electronAPI.payments.create({
          order_id: orderId!,
          payments: payments.map((p) => ({
            mode: p.mode,
            amount: p.amount,
            reference: p.reference,
          })),
          tip: tip > 0 ? tip : undefined,
          customer: customer ? { phone: customer.phone } : undefined,
          coinsToRedeem: coinsToRedeem && coinsToRedeem > 0 ? coinsToRedeem : undefined,
        }));
        await fetchActiveOrders();

        setShowPayment(false);
        toast.success(t('toast.paymentCompleted'));
        refreshTables();

        // Store coin info for bill preview
        const earned = paymentResult?.coinsEarned ?? 0;
        const redeemed = paymentResult?.coinsRedeemed ?? 0;
        setBillCoinInfo((earned > 0 || redeemed > 0) ? { earned, redeemed } : undefined);

        if (WHATSAPP_FEATURE_ENABLED && sendWhatsApp && customer?.phone) {
          const billLabels = {
            componentA: taxTerms.componentA,
            componentB: taxTerms.componentB,
            businessTaxId: taxTerms.businessTaxId,
            foodLicense: taxTerms.foodLicense,
            tel: t('bill.tel'),
            orderNo: t('bill.orderNo'),
            type: t('bill.type'),
            customer: t('bill.customer'),
            item: t('bill.item'),
            qty: t('bill.qty'),
            rate: t('bill.rate'),
            amt: t('bill.amt'),
            note: t('bill.note'),
            subtotal: t('bill.subtotal'),
            discount: t('bill.discount'),
            roundOff: t('bill.roundOff'),
            grandTotal: t('bill.grandTotal'),
            payment: t('paymentModal.title'),
            tip: t('paymentModal.tip'),
            thankYou: t('bill.thankYou'),
          };
          ipc(window.electronAPI.whatsapp.sendBill({ orderId: orderId!, phone: customer.phone, labels: billLabels }))
            .then(() => toast.success(t('toast.whatsappBillSent')))
            .catch(() => toast.error(t('toast.whatsappBillFailed')));
        }

        setBillCustomerPhone(customer?.phone);

        if (printBill) {
          setBillPreviewPostPayment(true);
          setShowBillPreview(true);
          // cart cleared when bill preview closes
        } else {
          clearCart();
        }
      } catch {
        toast.error(t('toast.paymentFailed'));
      }
    },
    [currentOrderId, createOrder, fetchActiveOrders, clearCart, refreshTables, t, settings.whatsapp_enabled, taxTerms]
  );

  const selectedTable = tables.find((tb) => tb.id === selectedTableId);

  const tableStatusColor: Record<string, string> = {
    free: 'bg-green-500',
    occupied: 'bg-red-500',
    reserved: 'bg-yellow-500',
    dirty: 'bg-gray-400',
  };

  const tableStatusTextColor: Record<string, string> = {
    free: 'text-gray-700',
    occupied: 'text-red-700',
    reserved: 'text-yellow-700',
    dirty: 'text-gray-500',
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center gap-4">
          {/* Order type selector */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
            {ORDER_TYPE_KEYS.map(({ key, tKey, icon: Icon }) => (
              <Tooltip key={key} text={t(tKey)} position="bottom">
                <button
                  onClick={() => setOrderType(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                    transition-colors select-none
                    ${
                      orderType === key
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  <Icon size={16} />
                  {t(tKey)}
                </button>
              </Tooltip>
            ))}
          </div>

          {orderType === 'dine_in' && selectedTable && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium">
              <LayoutGrid size={14} />
              {selectedTable.name}
            </div>
          )}

          {/* Veg / Non-veg filter */}
          <div className="flex items-center gap-1">
            {([
              { key: 'all' as const, label: t('menuGrid.all'), color: 'bg-gray-600' },
              { key: 'veg' as const, label: t('menu.veg'), color: 'bg-green-600' },
              { key: 'nonveg' as const, label: t('menu.nonVeg'), color: 'bg-red-600' },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setVegFilter(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors
                  ${vegFilter === key
                    ? `${color} text-white`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {key === 'veg' && <CircleDot size={9} className={vegFilter === key ? 'text-white' : 'text-green-600'} />}
                {key === 'nonveg' && <CircleDot size={9} className={vegFilter === key ? 'text-white' : 'text-red-600'} />}
                {label}
              </button>
            ))}
          </div>

          {/* Grid / List view toggle */}
          <div className="flex bg-gray-100 rounded p-0.5 gap-0.5">
            <button
              onClick={() => setMenuViewMode('grid')}
              className={`p-1 rounded transition-colors ${menuViewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setMenuViewMode('list')}
              className={`p-1 rounded transition-colors ${menuViewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={14} />
            </button>
          </div>

          {/* Temp item button */}
          <Tooltip text={t('billing.addTempItem')} position="bottom">
            <button
              onClick={() => setShowTempItemModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-orange-600 bg-orange-50
                hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors font-medium"
            >
              <PlusCircle size={15} />
              {t('billing.tempItem')}
            </button>
          </Tooltip>

          <div className="ml-auto" />

          {/* Bill preview button */}
          {cart.length > 0 && (
            <Tooltip text={t('billing.previewBill')} position="bottom">
              <button
                onClick={() => setShowBillPreview(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600
                  hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FileText size={16} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Active orders — portaled into header center slot */}
      {headerSlot && activeOrders.length > 0 && createPortal(
        <>
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">
            {t('billing.ordersBarLabel')}
          </span>
          {activeOrders.map((order) => {
            const isCurrentOrder = currentOrderId === order.id;
            const isHeld = order.status === 'hold';
            const oType = (order as any).orderType ?? order.order_type;
            const TypeIcon = oType === 'dine_in' ? UtensilsCrossed : oType === 'takeaway' ? ShoppingBag : Truck;
            const typeBg = isCurrentOrder
              ? 'bg-blue-600 text-white border-blue-600'
              : isHeld
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100';

            const orderItems = (order as any).items ?? [];
            const kotStatuses: string[] = orderItems.map((i: any) => i.kotStatus ?? i.kot_status ?? 'pending');
            const hasPending = kotStatuses.some((s) => s === 'pending');
            const allServed = kotStatuses.length > 0 && kotStatuses.every((s) => s === 'served');
            const allReady = kotStatuses.length > 0 && kotStatuses.every((s) => s === 'ready' || s === 'served');
            const hasReady = kotStatuses.some((s) => s === 'ready');
            const hasPreparing = kotStatuses.some((s) => s === 'preparing');

            let kotLabel: string | null = null;
            let kotColor = '';
            if (orderItems.length > 0) {
              if (hasPending) {
                kotLabel = t('billing.kotPending');
                kotColor = isCurrentOrder ? 'bg-orange-400 text-white' : 'bg-orange-100 text-orange-700';
              } else if (allServed) {
                kotLabel = t('billing.kotServed');
                kotColor = isCurrentOrder ? 'bg-gray-400 text-white' : 'bg-gray-100 text-gray-600';
              } else if (allReady || hasReady) {
                kotLabel = t('billing.kotReady');
                kotColor = isCurrentOrder ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-700';
              } else if (hasPreparing) {
                kotLabel = t('billing.kotPreparing');
                kotColor = isCurrentOrder ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-700';
              } else {
                kotLabel = t('billing.kotSent');
                kotColor = isCurrentOrder ? 'bg-blue-400 text-white' : 'bg-blue-100 text-blue-700';
              }
            }

            return (
              <button
                key={order.id}
                onClick={async () => {
                  if (isCurrentOrder) return;
                  if (isHeld) {
                    await ipc(window.electronAPI.orders.updateStatus(order.id, 'active'));
                  }
                  await loadOrderById(order.id);
                  fetchActiveOrders();
                }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded text-[11px]
                  font-medium border transition-colors ${typeBg}`}
              >
                <TypeIcon size={12} />
                #{String(order.id).padStart(3, '0')}
                {isHeld && (
                  <span className="px-1 py-0.5 rounded bg-amber-200 text-amber-800 text-[9px] uppercase">
                    {t('billing.orderHeldBadge')}
                  </span>
                )}
                {kotLabel && (
                  <span className={`px-1 py-0.5 rounded text-[9px] uppercase ${kotColor}`}>
                    {kotLabel}
                  </span>
                )}
              </button>
            );
          })}
        </>,
        headerSlot
      )}

      {/* Main content area */}
      <div ref={mainRef} className="flex-1 flex min-h-0">
        {/* Left: Menu grid + table strip */}
        <div ref={leftRef} className="flex-1 min-w-0 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div style={{ flex: `${menuHeightPercent} 0 0%` }} className="min-h-0">
            <MenuGrid
              categories={categories}
              items={filteredItems}
              selectedCategoryId={selectedCategoryId}
              searchQuery={searchQuery}
              onCategorySelect={setSelectedCategoryId}
              onSearchChange={setSearchQuery}
              onAddToCart={handleAddToCart}
              getVariations={getVariations}
              getAddons={getAddons}
              loading={menuLoading}
              onItemAdded={refetchMenu}
              invalidateItemCache={invalidateItemCache}
              compact
              showPrices={(settings.show_menu_prices ?? 'true') !== 'false'}
              vegFilter={vegFilter}
              viewMode={menuViewMode}
            />
          </div>

          {/* Table picker — dine-in only */}
          {orderType === 'dine_in' && (
            <>
            {/* Vertical resize handle (menu ↔ tables) */}
            <div
              className="flex-shrink-0 h-[2px] bg-gray-200 hover:bg-blue-400 cursor-row-resize transition-colors"
              onMouseDown={onMenuTableHandleDown}
            >
            </div>
            <div style={{ flex: `${100 - menuHeightPercent} 0 0%` }} className="min-h-0 bg-white flex flex-row" data-table-picker>
              {/* Floor tabs — vertical sidebar */}
              {floors.length > 0 && (
                <div className="flex flex-col gap-1 px-1.5 py-2 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0 scrollbar-thin" style={{ width: floorSidebarWidth }}>
                  {floors.map((floor) => (
                    <button
                      key={floor.id}
                      onClick={() => setBillingFloorId(floor.id)}
                      onContextMenu={(e) => { e.preventDefault(); setFloorContextMenu({ x: e.clientX, y: e.clientY, floor }); }}
                      className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors select-none text-left
                        ${billingFloorId === floor.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      <Layers size={12} className="flex-shrink-0" />
                      <span className="truncate">{floor.name}</span>
                    </button>
                  ))}
                  {/* Add Floor button */}
                  <button
                    onClick={() => setShowAddFloorDialog(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors mt-1"
                  >
                    <Plus size={12} />
                    {t('common.add')}
                  </button>
                </div>
              )}

              {/* Floor sidebar resize handle */}
              {floors.length > 0 && (
                <div
                  className="flex-shrink-0 w-[2px] bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
                  onMouseDown={onFloorHandleDown}
                >
                    </div>
              )}

              {/* Table grid */}
              <div className="flex-1 overflow-y-auto p-2 min-w-0">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {tables
                    .filter((t) => t.floorId === billingFloorId)
                    .map((table) => (
                      <div
                        key={table.id}
                        className={`rounded-lg transition-all ${selectedTableId === table.id ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                        onContextMenu={(e) => handleTableContextMenu(e, table)}
                      >
                        <TableCard
                          table={table as any}
                          onClick={(t) => handleTableSwitch(t.id)}
                          isEditMode={false}
                          compact
                          orderTotal={tableOrdersMap.get(table.id)?.grandTotal}
                          orderItemCount={tableOrdersMap.get(table.id)?.itemCount}
                          orderStartedAt={tableOrdersMap.get(table.id)?.createdAt}
                        />
                      </div>
                    ))}
                  {/* Add Table card */}
                  {billingFloorId !== null && (
                    <button
                      onClick={() => setShowAddTableDialog(true)}
                      className="group min-h-[68px] flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                    >
                      <Plus size={20} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                      <span className="text-[10px] text-gray-300 group-hover:text-blue-400 transition-colors font-medium mt-0.5">
                        {t('billingPage.addTable')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            </>
          )}
        </div>

        {/* Cart resize handle */}
        <div
          className="flex-shrink-0 w-[2px] bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
          onMouseDown={onCartHandleDown}
        >
          <div className="h-8 w-0.5 bg-gray-400 rounded-full" />
        </div>

        {/* Right: Cart panel */}
        <div className="flex-shrink-0 border-l border-gray-100 shadow-[-2px_0_8px_rgba(0,0,0,0.04)]" style={{ width: cartWidth }}>
          <CartPanel
            onHoldOrder={handleHoldOrder}
            onKot={handleKot}
            onPrintKot={handlePrintKot}
            onPay={handlePay}
            onCancelOrder={handleCancelOrder}
            onOpenDiscount={() => setShowDiscount(true)}
            onItemRemoved={refreshTables}
          />
        </div>
      </div>

      {/* Payment modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        onComplete={handlePaymentComplete}
      />

      {/* Temp item modal */}
      {showTempItemModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setShowTempItemModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">{t('billing.addTempItem')}</h3>
              <button onClick={() => setShowTempItemModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('billing.tempItemName')}</label>
                <input
                  type="text"
                  autoFocus
                  value={tempItemName}
                  onChange={(e) => setTempItemName(e.target.value)}
                  placeholder={t('billing.tempItemName')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).closest('.space-y-3')?.querySelector<HTMLInputElement>('input[type="number"]')?.focus();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('billing.tempItemPrice')}</label>
                <input
                  type="number"
                  value={tempItemPrice}
                  onChange={(e) => setTempItemPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const name = tempItemName.trim();
                      const price = parseFloat(tempItemPrice);
                      if (!name || !price || price <= 0) return;
                      const taxRate = resolveTaxRateForCartLine(0, settings.default_tax_rate, i18n.language);
                      addTempItemToCart(name, Math.round(price * 100), taxRate);
                      setTempItemName('');
                      setTempItemPrice('');
                      setShowTempItemModal(false);
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  const name = tempItemName.trim();
                  const price = parseFloat(tempItemPrice);
                  if (!name || !price || price <= 0) return;
                  const taxRate = resolveTaxRateForCartLine(0, settings.default_tax_rate, i18n.language);
                  addTempItemToCart(name, Math.round(price * 100), taxRate);
                  setTempItemName('');
                  setTempItemPrice('');
                  setShowTempItemModal(false);
                }}
                disabled={!tempItemName.trim() || !parseFloat(tempItemPrice)}
                className="w-full py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600
                  disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {t('billing.addTempItem')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount modal */}
      <DiscountModal isOpen={showDiscount} onClose={() => setShowDiscount(false)} />

      {/* Bill preview modal */}
      <BillPreview
        isOpen={showBillPreview}
        onClose={() => {
          setShowBillPreview(false);
          if (billPreviewPostPayment) {
            setBillPreviewPostPayment(false);
            clearCart();
          }
          setBillCustomerPhone(undefined);
          setBillCoinInfo(undefined);
        }}
        orderId={currentOrderId}
        customerPhone={billCustomerPhone}
        coinInfo={billCoinInfo}
      />

      {/* Table context menu — transfer / merge / split */}
      {transferMenu && transferMenu.mode === 'menu' && createPortal(
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setTransferMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setTransferMenu(null); }}
        >
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
            style={{
              top: Math.min(transferMenu.y, window.innerHeight - 240),
              left: Math.min(transferMenu.x, window.innerWidth - 200),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {transferMenu.orderId > 0 && (
              <>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                  onClick={() => setTransferMenu({ ...transferMenu, mode: 'transfer' })}
                >
                  <ArrowRightLeft size={14} />
                  {t('billingPage.transferOrder')}
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2"
                  onClick={() => setTransferMenu({ ...transferMenu, mode: 'merge' })}
                >
                  <Merge size={14} />
                  {t('billingPage.mergeOrders')}
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2"
                  onClick={() => handleOpenSplitBill()}
                >
                  <Split size={14} />
                  {t('billingPage.splitBill')}
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={() => handleFreeTable()}
                >
                  <Unlock size={14} />
                  {t('billingPage.freeTable')}
                </button>
                <div className="border-t border-gray-100 my-1" />
              </>
            )}
            {(() => {
              const tbl = tables.find((t) => t.id === transferMenu.sourceTableId);
              const isFree = tbl?.status === 'free';
              const title = isFree ? undefined : t('billingPage.onlyFreeTablesEditable');
              return (
                <>
                  <button
                    disabled={!isFree}
                    title={title}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    onClick={() => {
                      if (!tbl || !isFree) return;
                      setTransferMenu(null);
                      setEditTableDialog(tbl);
                      setEditTableForm({ name: tbl.name, capacity: String(tbl.capacity) });
                    }}
                  >
                    <Edit2 size={14} className="text-gray-500" />
                    {t('billingPage.editTable')}
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={async () => {
                      if (!tbl) return;
                      setTransferMenu(null);
                      try {
                        await ipc(window.electronAPI.tables.togglePin(tbl.id));
                        const refreshed = await ipc<Table[]>(window.electronAPI.tables.getAll());
                        setTables(refreshed ?? []);
                        toast.success(tbl.isPinned ? t('billingPage.unpinnedToast', { name: tbl.name }) : t('billingPage.pinnedToast', { name: tbl.name }));
                      } catch (err: any) {
                        toast.error(err?.message ?? t('billingPage.failedToUpdatePin'));
                      }
                    }}
                  >
                    <Pin size={14} className={tbl?.isPinned ? 'text-blue-500 fill-blue-500' : 'text-gray-500'} />
                    {tbl?.isPinned ? t('common.unpinFromTop') : t('common.pinToTop')}
                  </button>
                  <button
                    disabled={!isFree}
                    title={title}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    onClick={() => {
                      if (!tbl || !isFree) return;
                      setTransferMenu(null);
                      handleDeleteTable(tbl);
                    }}
                  >
                    <Trash2 size={14} />
                    {t('billingPage.deleteTable')}
                  </button>
                </>
              );
            })()}
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
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              {floorContextMenu.floor.name}
            </div>
            <button
              onClick={() => {
                const fl = floorContextMenu.floor;
                setFloorContextMenu(null);
                setEditFloorDialog(fl);
                setEditFloorName(fl.name);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Edit2 size={14} className="text-gray-500" />
              {t('billingPage.renameFloor')}
            </button>
            <button
              onClick={() => {
                const fl = floorContextMenu.floor;
                setFloorContextMenu(null);
                handleDeleteFloor(fl);
              }}
              disabled={floors.length <= 1}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              {t('billingPage.deleteFloor')}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Table Confirmation */}
      {deleteTableConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setDeleteTableConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('billingPage.deleteTable')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('billingPage.deleteTable')} <span className="font-medium">"{deleteTableConfirm.name}"</span>?
            </p>
            {deleteTableError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {deleteTableError}
              </div>
            )}
            {allowForceDeleteTable && (
              <p className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                {t('billingPage.forceDeleteTableWarning')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleteTableConfirm(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              {allowForceDeleteTable ? (
                <button onClick={forceDeleteTableAction} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800">{t('common.forceDelete')}</button>
              ) : (
                <button onClick={confirmDeleteTable} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">{t('common.delete')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Floor Confirmation */}
      {deleteFloorConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setDeleteFloorConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('billingPage.deleteFloor')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('billingPage.deleteFloor')} <span className="font-medium">"{deleteFloorConfirm.name}"</span>?
            </p>
            {deleteFloorError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {deleteFloorError}
              </div>
            )}
            {allowForceDeleteFloor && (
              <p className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                {t('billingPage.forceDeleteFloorWarning1')} <em>{t('billingPage.forceDeleteFloorWarningEm')}</em>{t('billingPage.forceDeleteFloorWarning2')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleteFloorConfirm(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              {allowForceDeleteFloor ? (
                <button onClick={forceDeleteFloorAction} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800">{t('common.forceDelete')}</button>
              ) : (
                <button onClick={confirmDeleteFloor} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">{t('common.delete')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Table Dialog */}
      {editTableDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setEditTableDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('tables.editTableTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('tables.tableNameLabel')}</label>
                <input
                  autoFocus
                  type="text"
                  value={editTableForm.name}
                  onChange={(e) => setEditTableForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('tables.capacityLabel')}</label>
                <input
                  type="number"
                  min="1"
                  value={editTableForm.capacity}
                  onChange={(e) => setEditTableForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditTableDialog(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              <button
                onClick={handleSaveEditTable}
                disabled={savingEditTable || !editTableForm.name.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEditTable ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Floor Dialog */}
      {editFloorDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setEditFloorDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('billingPage.renameFloorTitle')}</h3>
            <input
              autoFocus
              type="text"
              value={editFloorName}
              onChange={(e) => setEditFloorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditFloor()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditFloorDialog(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              <button
                onClick={handleSaveEditFloor}
                disabled={!editFloorName.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer target list — free tables */}
      {transferMenu?.mode === 'transfer' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setTransferMenu(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-72 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-200 flex items-center justify-between">
              <span>{t('billingPage.transferTo')}</span>
              <span className="text-xs font-normal text-gray-400">
                {t('billingPage.fromName', { name: tables.find((t) => t.id === transferMenu.sourceTableId)?.name })}
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              {tables
                .filter((t) => t.id !== transferMenu.sourceTableId && t.status !== 'occupied')
                .map((t) => (
                  <button
                    key={t.id}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0"
                    onClick={() => handleTransferOrder(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              {tables.filter((t) => t.id !== transferMenu.sourceTableId && t.status !== 'occupied').length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">{t('billingPage.noFreeTables')}</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Merge target list — occupied tables */}
      {transferMenu?.mode === 'merge' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setTransferMenu(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-72 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 text-sm font-semibold text-gray-700 border-b border-gray-200 flex items-center justify-between">
              <span>{t('billingPage.mergeInto')}</span>
              <span className="text-xs font-normal text-gray-400">
                {t('billingPage.fromName', { name: tables.find((t) => t.id === transferMenu.sourceTableId)?.name })}
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              {tables
                .filter((t) => t.id !== transferMenu.sourceTableId && t.status === 'occupied')
                .map((t) => (
                  <button
                    key={t.id}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 border-b border-gray-50 last:border-0"
                    onClick={() => handleMergeOrders(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              {tables.filter((t) => t.id !== transferMenu.sourceTableId && t.status === 'occupied').length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 text-center">{t('billingPage.noOtherOccupiedTables')}</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Split Bill modal — step 1: select items, step 2: pick target table */}
      {splitModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setSplitModal(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-96 max-h-[80vh] flex flex-col"
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
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
                        ${item.selected ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50 border border-transparent'}`}
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
                    {t('billingPage.itemsOfTotal', { shown: splitModal.items.filter((i) => i.selected).length, total: splitModal.items.length })}
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
                <div className="overflow-y-auto flex-1">
                  {tables
                    .filter((t) => t.id !== splitModal.sourceTableId && t.status !== 'occupied')
                    .map((t) => (
                      <button
                        key={t.id}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 border-b border-gray-50 last:border-0"
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

      {/* Unsaved cart warning modal — shown when switching tables with un-KOT'd items */}
      {unsavedSwitchTarget !== null && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={() => setUnsavedSwitchTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-[340px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gray-50 px-6 pt-5 pb-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{t('billingPage.unsavedItems')}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('billingPage.notSentToKitchen')}</p>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 text-center">
                {t('billingPage.unsavedItemsWarning', { count: cart.length - (currentOrderId ? syncedItemCount : 0) })}
              </p>
            </div>
            <div className="px-6 pb-5 flex flex-col gap-2">
              <button
                onClick={async () => {
                  const target = unsavedSwitchTarget;
                  setUnsavedSwitchTarget(null);
                  try {
                    await handleKot();
                    await loadTableOrder(target);
                  } catch {
                    resetForNewTable(target);
                  }
                }}
                className="w-full py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                {t('billingPage.sendToKotAndSwitch')}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setUnsavedSwitchTarget(null)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={async () => {
                    const target = unsavedSwitchTarget;
                    setUnsavedSwitchTarget(null);
                    try {
                      await loadTableOrder(target);
                    } catch {
                      resetForNewTable(target);
                    }
                  }}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  {t('billingPage.discardAndSwitch')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Add Floor Dialog */}
      {showAddFloorDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setShowAddFloorDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-72 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('tables.addFloorTitle')}</h3>
            <input
              autoFocus
              type="text"
              value={newFloorName}
              onChange={(e) => setNewFloorName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAddFloor()}
              placeholder={t('billingPage.floorNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddFloorDialog(false)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleQuickAddFloor}
                disabled={savingFloor || !newFloorName.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingFloor ? t('common.adding') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Table Dialog */}
      {showAddTableDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setShowAddTableDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('billingPage.addTable')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('tables.tableNameLabel')}</label>
                <input
                  autoFocus
                  type="text"
                  value={newTableForm.name}
                  onChange={(e) => setNewTableForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('billingPage.tableNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('tables.capacityLabel')}</label>
                <input
                  type="number"
                  min="1"
                  value={newTableForm.capacity}
                  onChange={(e) => setNewTableForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAddTableDialog(false)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleQuickAddTable}
                disabled={savingTable || !newTableForm.name.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingTable ? t('common.adding') : t('billingPage.addTable')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
