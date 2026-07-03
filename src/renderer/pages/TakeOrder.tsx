import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Plus, Minus, Trash2, ShoppingCart, Check, Loader2 } from 'lucide-react';
import {
  waiterApi,
  type MenuCategory,
  type MenuItem,
  type Variation,
  type AddonGroup,
  type Table,
} from '../lib/waiterApi';
import { OrderType } from '../../shared/enums';
import { formatCurrency } from '../lib/formatters';

interface CartLine {
  uid: string; // unique per cart line so duplicates with diff variations/addons coexist
  menuItemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  variationId?: number;
  variationName?: string;
  addonIds: number[];
  addonNames: string[];
  notes?: string;
}

const TakeOrder: React.FC = () => {
  const { t } = useTranslation();
  // Setup phase
  const [phase, setPhase] = useState<'setup' | 'menu'>('setup');
  const [tables, setTables] = useState<Table[]>([]);
  const [tableId, setTableId] = useState<number | null>(null);

  // If picked table already has an active order, we add items to it instead of creating a new one.
  const [existingOrderId, setExistingOrderId] = useState<number | null>(null);
  const [existingOrderItems, setExistingOrderItems] = useState<any[]>([]);

  // Pseudo-category keys for Favorites + Top Selling tabs at the start of the bar.
  const FAV = 'favorites' as const;
  const TOP = 'top' as const;

  // Menu data
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [topSellingIds, setTopSellingIds] = useState<number[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | string | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Item picker (variations + addons)
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null);
  const [pickerVariations, setPickerVariations] = useState<Variation[]>([]);
  const [pickerAddons, setPickerAddons] = useState<AddonGroup[]>([]);
  const [pickerVariationId, setPickerVariationId] = useState<number | null>(null);
  const [pickerSelectedAddonIds, setPickerSelectedAddonIds] = useState<Set<number>>(new Set());
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerNotes, setPickerNotes] = useState('');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load menu when entering menu phase + poll every 10s so changes from the
  // billing PC (new items, availability toggles) reflect on the tablet.
  useEffect(() => {
    if (phase !== 'menu') return;
    let cancelled = false;
    const fetchMenu = async (showSpinner: boolean) => {
      if (showSpinner) setLoadingMenu(true);
      try {
        const [cats, allItems, favs, top] = await Promise.all([
          waiterApi.getCategories(),
          waiterApi.getItems(),
          waiterApi.getFavorites().catch(() => []),
          waiterApi.getTopSelling(10).catch(() => []),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setItems(allItems);
        setFavoriteIds(favs);
        setTopSellingIds(top);
        setActiveCategoryId((current) => {
          if (current !== null) return current;
          if (favs.length > 0) return FAV;
          if (cats.length > 0) return cats[0].id;
          return null;
        });
      } catch (err: any) {
        if (showSpinner) toast.error(err?.message ?? t('waiter.failedToLoadMenu'));
      } finally {
        if (!cancelled && showSpinner) setLoadingMenu(false);
      }
    };
    fetchMenu(true);
    const interval = setInterval(() => fetchMenu(false), 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [phase, t]);

  // Load tables on mount + refresh every 5s so occupied/free state stays current.
  const [tablesError, setTablesError] = useState<string | null>(null);
  useEffect(() => {
    let firstFetch = true;
    const refresh = () =>
      waiterApi.getTables().then(
        (rows) => {
          setTables(rows);
          setTablesError(null);
        },
        (err) => {
          // Surface the error on first load so the user can diagnose; suppress
          // background poll failures so transient network blips don't spam toasts.
          const msg = err?.message ?? t('waiter.failedToLoadTables');
          if (firstFetch) {
            setTablesError(msg);
            toast.error(msg);
          }
        },
      ).finally(() => { firstFetch = false; });
    refresh();
    // Poll faster than the 5s order/menu cadence so the lock state from
    // other waiters propagates near real-time during the table-pick step.
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const itemsById = useMemo(() => {
    const m = new Map<number, MenuItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeCategoryId === FAV) {
      return favoriteIds.map((id) => itemsById.get(id)).filter(Boolean) as MenuItem[];
    }
    if (activeCategoryId === TOP) {
      return topSellingIds.map((id) => itemsById.get(id)).filter(Boolean) as MenuItem[];
    }
    if (typeof activeCategoryId === 'number') {
      return items.filter((i) => i.categoryId === activeCategoryId);
    }
    return items;
  }, [items, itemsById, activeCategoryId, favoriteIds, topSellingIds]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [cart],
  );
  const cartCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  const openPicker = async (item: MenuItem) => {
    setPickerItem(item);
    setPickerVariationId(null);
    setPickerSelectedAddonIds(new Set());
    setPickerNotes('');
    setPickerLoading(true);
    try {
      const [vars, addonGroups] = await Promise.all([
        waiterApi.getVariations(item.id),
        waiterApi.getAddonGroups(item.id),
      ]);
      setPickerVariations(vars);
      setPickerAddons(addonGroups);
      const def = vars.find((v) => v.isDefault) ?? vars[0];
      if (def) setPickerVariationId(def.id);

      // Fast path: no variations and no addons → add directly with quantity 1
      if (vars.length === 0 && addonGroups.length === 0) {
        addToCart(item, null, [], '');
        setPickerItem(null);
      }
    } catch (err: any) {
      toast.error(err?.message ?? t('waiter.failedToLoadOptions'));
      setPickerItem(null);
    } finally {
      setPickerLoading(false);
    }
  };

  const addToCart = (
    item: MenuItem,
    variation: Variation | null,
    addonIds: number[],
    notes: string,
  ) => {
    const allAddons = pickerAddons.flatMap((g) => g.addons);
    const chosenAddons = allAddons.filter((a) => addonIds.includes(a.id));
    const addonNames = chosenAddons.map((a) => a.name);
    const addonExtra = chosenAddons.reduce((sum, a) => {
      if (variation && a.variationPrices && a.variationPrices[variation.name] !== undefined) {
        return sum + (a.variationPrices[variation.name] ?? 0);
      }
      return sum + a.price;
    }, 0);

    const unitPrice = item.basePrice + (variation?.priceDelta ?? 0) + addonExtra;
    const sortedAddonIds = [...addonIds].sort((a, b) => a - b);
    const noteKey = (notes || '').trim();

    setCart((prev) => {
      // Stack identical lines (same item + variation + addons + notes) instead
      // of creating a new line each time the waiter taps the same item.
      const existingIdx = prev.findIndex((l) => {
        if (l.menuItemId !== item.id) return false;
        if ((l.variationId ?? null) !== (variation?.id ?? null)) return false;
        if ((l.notes ?? '').trim() !== noteKey) return false;
        const sortedLineAddons = [...l.addonIds].sort((a, b) => a - b);
        if (sortedLineAddons.length !== sortedAddonIds.length) return false;
        for (let i = 0; i < sortedLineAddons.length; i++) {
          if (sortedLineAddons[i] !== sortedAddonIds[i]) return false;
        }
        return true;
      });

      if (existingIdx !== -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
        return next;
      }

      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const line: CartLine = {
        uid,
        menuItemId: item.id,
        name: variation ? `${item.name} (${variation.name})` : item.name,
        quantity: 1,
        unitPrice,
        taxRate: item.taxRate,
        variationId: variation?.id,
        variationName: variation?.name,
        addonIds,
        addonNames,
        notes: notes || undefined,
      };
      return [...prev, line];
    });

    toast.success(t('waiter.addedToast', { name: item.name }), { duration: 1500 });
  };

  const confirmPicker = () => {
    if (!pickerItem) return;
    const variation = pickerVariations.find((v) => v.id === pickerVariationId) ?? null;

    // Validate required addon groups
    for (const group of pickerAddons) {
      const selectedInGroup = group.addons.filter((a) => pickerSelectedAddonIds.has(a.id)).length;
      if (group.isRequired && selectedInGroup < group.minSelect) {
        toast.error(t('waiter.atLeastFromGroup', { count: group.minSelect, name: group.name }));
        return;
      }
      if (selectedInGroup > group.maxSelect) {
        toast.error(t('waiter.atMostFromGroup', { count: group.maxSelect, name: group.name }));
        return;
      }
    }

    addToCart(pickerItem, variation, [...pickerSelectedAddonIds], pickerNotes);
    setPickerItem(null);
  };

  const updateLineQty = (uid: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.uid !== uid) return [l];
        const next = l.quantity + delta;
        if (next <= 0) return [];
        return [{ ...l, quantity: next }];
      }),
    );
  };

  const removeLine = (uid: string) => {
    setCart((prev) => prev.filter((l) => l.uid !== uid));
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error(t('waiter.cartEmpty'));
      return;
    }
    if (!tableId) {
      toast.error(t('waiter.pickTableFirst'));
      return;
    }
    setSubmitting(true);
    try {
      const orderTypeEnum = OrderType.DINE_IN;

      const apiItems = cart.map((l) => ({
        menuItemId: l.menuItemId,
        variationId: l.variationId,
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        notes: l.notes,
        addonIds: l.addonIds.length > 0 ? l.addonIds : undefined,
      }));

      if (existingOrderId) {
        // Append to the open order so we don't replace what the cashier/other waiters
        // already added. Server creates a KOT for just the new items.
        await waiterApi.addItemsToOrder(existingOrderId, apiItems);
        toast.success(t('waiter.itemsAdded'), { duration: 3000, icon: '✅' });
      } else {
        await waiterApi.createOrder({
          orderType: orderTypeEnum,
          tableId,
          staffId: 1, // tablet has no logged-in user; use a default staff id
          items: apiItems,
        });
        toast.success(t('waiter.orderSent'), { duration: 3000, icon: '✅' });
      }

      // Reset for the next order
      setCart([]);
      setShowCart(false);
      setPhase('setup');
      setTableId(null);
      setExistingOrderId(null);
      setExistingOrderItems([]);
    } catch (err: any) {
      toast.error(err?.message ?? t('waiter.failedToSendOrder'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Setup phase ─────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const groupedTables = new Map<string, Table[]>();
    for (const tbl of tables) {
      const key = tbl.floorName ?? t('waiter.allFloors');
      if (!groupedTables.has(key)) groupedTables.set(key, []);
      groupedTables.get(key)!.push(tbl);
    }

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('waiter.takeOrder')}</h1>
          <p className="text-sm text-gray-500 mb-6">{t('waiter.pickTableHint')}</p>

          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">{t('waiter.table')}</p>
              {tablesError ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="font-medium">{t('waiter.couldntLoadTables')}</p>
                  <p className="text-xs mt-1">{tablesError}</p>
                  <p className="text-xs mt-2 text-red-600">{t('waiter.checkSettingsHint')}</p>
                </div>
              ) : tables.length === 0 ? (
                <p className="text-sm text-gray-400">{t('waiter.noTablesConfigured')}</p>
              ) : (
                Array.from(groupedTables.entries()).map(([floor, tbls]) => (
                  <div key={floor} className="mb-3 last:mb-0">
                    <p className="text-xs uppercase text-gray-400 font-medium mb-1">{floor}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {tbls.map((tbl) => {
                        const isOccupied = tbl.status === 'occupied';
                        const isSelected = tableId === tbl.id;
                        const isLocked = !!tbl.lockedToOther;
                        const isMine = !!tbl.ownedByMe;
                        return (
                          <button
                            key={tbl.id}
                            disabled={isLocked}
                            onClick={async () => {
                              if (isLocked) {
                                toast.error(t('waiter.tableLockedByOtherWaiter'));
                                return;
                              }
                              setTableId(tbl.id);
                              setExistingOrderId(null);
                              setExistingOrderItems([]);
                              if (isOccupied) {
                                try {
                                  const order = await waiterApi.getOrderByTable(tbl.id);
                                  if (order) {
                                    setExistingOrderId(order.id);
                                    setExistingOrderItems(order.items ?? []);
                                  }
                                } catch { /* ignore */ }
                              }
                            }}
                            className={`px-2 py-2 rounded-lg border text-sm font-medium ${
                              isLocked
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : isMine
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-1 ring-emerald-300'
                                    : isOccupied
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-white text-gray-700 border-gray-300'
                            }`}
                            title={
                              isLocked
                                ? t('waiter.lockedByOtherWaiter')
                                : isMine
                                  ? t('waiter.yourTableTooltip')
                                  : undefined
                            }
                          >
                            {isLocked ? `🔒 ${tbl.name}` : isMine ? `★ ${tbl.name}` : tbl.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

          <button
            onClick={async () => {
              if (!tableId) {
                toast.error(t('waiter.pickTableFirst'));
                return;
              }
              // Claim the table now so another waiter can't pick the same one
              // while this waiter is browsing the menu.
              try {
                await waiterApi.claimTable(tableId);
              } catch (err: any) {
                toast.error(err?.message ?? t('waiter.couldNotClaim'));
                // Re-fetch tables so the picker reflects the current lock state.
                waiterApi.getTables().then(setTables).catch(() => {});
                setTableId(null);
                return;
              }
              setPhase('menu');
            }}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 active:bg-blue-800"
          >
            {t('waiter.continue')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Menu phase ─────────────────────────────────────────────────────────
  const tableLabel = tables.find((tbl) => tbl.id === tableId)?.name ?? '—';

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setPhase('setup')} className="flex items-center gap-1 text-sm text-gray-600">
          <ChevronLeft size={18} />
          {t('waiter.back')}
        </button>
        <div className="text-sm font-semibold text-gray-900">{tableLabel}</div>
        <button
          onClick={() => setShowCart(true)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          <ShoppingCart size={16} />
          <span>{cartCount}</span>
          {cartCount > 0 && (
            <span className="ml-1 text-[11px] opacity-90">{formatCurrency(cartTotal)}</span>
          )}
        </button>
      </header>

      {/* Append-mode banner */}
      {existingOrderId && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
          {t('waiter.addingToOrder', { orderNumber: String(existingOrderId).padStart(3, '0') })}
          {existingOrderItems.length > 0 && ` · ${t('waiter.alreadyOnTable', { count: existingOrderItems.length })}`}
        </div>
      )}

      {/* Category bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-2 p-2 min-w-max">
          {favoriteIds.length > 0 && (
            <button
              onClick={() => setActiveCategoryId(FAV)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                activeCategoryId === FAV ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              ⭐ {t('waiter.favorites')}
            </button>
          )}
          {topSellingIds.length > 0 && (
            <button
              onClick={() => setActiveCategoryId(TOP)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                activeCategoryId === TOP ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              🔥 {t('waiter.top10')}
            </button>
          )}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                activeCategoryId === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items grid */}
      <main className="flex-1 overflow-y-auto p-3">
        {loadingMenu ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => openPicker(item)}
                disabled={!item.isAvailable}
                className={`text-left bg-white border border-gray-200 rounded-lg p-3 active:bg-blue-50 ${
                  !item.isAvailable ? 'opacity-50' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</p>
                <p className="text-sm text-blue-600 font-semibold mt-1">{formatCurrency(item.basePrice)}</p>
                {!item.isAvailable && (
                  <span className="text-[10px] text-red-600">{t('waiter.unavailable')}</span>
                )}
              </button>
            ))}
            {filteredItems.length === 0 && (
              <p className="col-span-2 text-center text-sm text-gray-400 py-8">{t('waiter.noItemsInCategory')}</p>
            )}
          </div>
        )}
      </main>

      {/* Item picker modal */}
      {pickerItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <p className="font-semibold text-gray-900">{pickerItem.name}</p>
              <button onClick={() => setPickerItem(null)} className="text-gray-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {pickerLoading ? (
                <Loader2 size={28} className="animate-spin text-blue-600 mx-auto" />
              ) : (
                <>
                  {pickerVariations.length > 0 && (
                    <div>
                      <p className="text-xs uppercase text-gray-500 mb-2">{t('waiter.variation')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {pickerVariations.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setPickerVariationId(v.id)}
                            className={`px-3 py-2 rounded-lg border text-sm ${
                              pickerVariationId === v.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                            }`}
                          >
                            <span>{v.name}</span>
                            <span className="ml-1 text-xs opacity-75">{formatCurrency(pickerItem.basePrice + v.priceDelta)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {pickerAddons.map((group) => (
                    <div key={group.id}>
                      <p className="text-xs uppercase text-gray-500 mb-2">
                        {group.name}
                        <span className="ml-2 text-gray-400 normal-case">
                          {group.isRequired ? `${t('waiter.required')} ` : `${t('waiter.optional')} `}
                          {t('waiter.pickRange', { min: group.minSelect, max: group.maxSelect })}
                        </span>
                      </p>
                      <div className="space-y-1">
                        {group.addons.map((a) => {
                          const selected = pickerSelectedAddonIds.has(a.id);
                          const variation = pickerVariations.find((v) => v.id === pickerVariationId);
                          const price = variation && a.variationPrices && a.variationPrices[variation.name] !== undefined
                            ? a.variationPrices[variation.name]
                            : a.price;
                          return (
                            <button
                              key={a.id}
                              onClick={() => {
                                setPickerSelectedAddonIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(a.id)) next.delete(a.id);
                                  else {
                                    // enforce maxSelect
                                    const inGroup = group.addons.filter((x) => next.has(x.id)).length;
                                    if (inGroup >= group.maxSelect) {
                                      // for single-pick groups, replace
                                      if (group.maxSelect === 1) {
                                        for (const x of group.addons) next.delete(x.id);
                                      } else {
                                        toast.error(t('waiter.maxN', { count: group.maxSelect }));
                                        return prev;
                                      }
                                    }
                                    next.add(a.id);
                                  }
                                  return next;
                                });
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                                selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {selected && <Check size={14} className="text-blue-600" />}
                                {a.name}
                              </span>
                              <span className="text-gray-500">+{formatCurrency(price)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div>
                    <p className="text-xs uppercase text-gray-500 mb-2">{t('waiter.notes')}</p>
                    <input
                      type="text"
                      value={pickerNotes}
                      onChange={(e) => setPickerNotes(e.target.value)}
                      placeholder={t('waiter.notesPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setPickerItem(null)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700"
              >
                {t('waiter.cancel')}
              </button>
              <button
                onClick={confirmPicker}
                disabled={pickerLoading}
                className="flex-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {t('waiter.addToOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <p className="font-semibold text-gray-900">{t('waiter.orderSummary')}</p>
              <button onClick={() => setShowCart(false)} className="text-gray-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">{t('waiter.cartEmpty')}</p>
              )}
              {cart.map((line) => (
                <div key={line.uid} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{line.name}</p>
                      {line.addonNames.length > 0 && (
                        <p className="text-xs text-gray-500">+ {line.addonNames.join(', ')}</p>
                      )}
                      {line.notes && <p className="text-xs italic text-gray-500">"{line.notes}"</p>}
                      <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(line.unitPrice)} × {line.quantity}</p>
                    </div>
                    <button onClick={() => removeLine(line.uid)} className="text-gray-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => updateLineQty(line.uid, -1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-medium w-6 text-center">{line.quantity}</span>
                    <button
                      onClick={() => updateLineQty(line.uid, 1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="ml-auto text-sm font-semibold">{formatCurrency(line.unitPrice * line.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{t('waiter.subtotal')}</span>
                <span className="font-semibold text-gray-900">{formatCurrency(cartTotal)}</span>
              </div>
              <p className="text-[11px] text-gray-400">{t('waiter.taxComputedNote')}</p>
              <button
                onClick={submitOrder}
                disabled={cart.length === 0 || submitting}
                className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {existingOrderId ? t('waiter.addToOrderAndSendKot') : t('waiter.sendToKitchen')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeOrder;
