import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Minus,
  Plus,
  X,
  StickyNote,
  Pause,
  Printer,
  Send,
  CreditCard,
  Trash2,
  ShoppingCart,
  Tag,
  Sparkles,
  Check,
  Pencil,
  Clock,
  Receipt,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBillingStore } from '../../stores/billing.store';
import { formatCurrency } from '../../lib/formatters';
import { ipc } from '../../lib/ipc';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Tooltip from '../common/Tooltip';
import VoidReasonModal from './VoidReasonModal';
import { useTranslation } from 'react-i18next';
import { useMenuTranslations } from '../../hooks/useMenuTranslations';
import { useTaxTerminology } from '../../hooks/useTaxTerminology';
import { getTaxRegionForLanguage } from '../../lib/taxLocalePresets';

// Clean perforated receipt tear divider with dashed line between KOT batches
const KotReceiptSeparator: React.FC<{
  label?: string;
  isPending?: boolean;
}> = ({ label, isPending }) => {
  return (
    <div className="relative my-0.5 select-none px-2">
      <div className="flex items-center gap-1">
        {/* Left ticket notch cutout */}
        <div className="w-2 h-2 rounded-full bg-gray-200 border border-gray-300 -ml-0.5 shrink-0 shadow-inner" />

        {/* Perforated dashed tear line */}
        <div className="flex-1 border-t border-dashed border-gray-300" />

        {/* Center tear label badge */}
        <div className="px-1.5 py-0.2 rounded-full bg-white border border-gray-200 text-[8px] font-mono font-semibold text-gray-500 flex items-center gap-0.5 uppercase tracking-wider shrink-0 shadow-xs">
          <span className="text-[9px] text-gray-400">✂</span>
          <span>{label || (isPending ? 'Next KOT' : 'KOT Slip')}</span>
        </div>

        {/* Perforated dashed tear line */}
        <div className="flex-1 border-t border-dashed border-gray-300" />

        {/* Right ticket notch cutout */}
        <div className="w-2 h-2 rounded-full bg-gray-200 border border-gray-300 -mr-0.5 shrink-0 shadow-inner" />
      </div>
    </div>
  );
};

function formatKotTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString.includes('T') ? isoString : isoString.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) {
      const fallback = new Date(isoString);
      if (isNaN(fallback.getTime())) return '';
      return fallback.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const PRESET_COOKING_INSTRUCTIONS = [
  { id: 'less_spicy', label: '🌶️ Less Spicy', text: 'Less Spicy' },
  { id: 'extra_spicy', label: '🔥 Extra Spicy', text: 'Extra Spicy' },
  { id: 'jain', label: '🧅 Jain (No Onion/Garlic)', text: 'Jain (No Onion/Garlic)' },
  { id: 'no_sugar', label: '🚫 No Sugar', text: 'No Sugar' },
  { id: 'extra_sauce', label: '🥫 Extra Sauce', text: 'Extra Sauce' },
  { id: 'extra_cheese', label: '🧀 Extra Cheese', text: 'Extra Cheese' },
  { id: 'crispy', label: '⚡ Extra Crispy', text: 'Extra Crispy' },
  { id: 'pack_sep', label: '🥡 Pack Separately', text: 'Pack Separately' },
  { id: 'less_salt', label: '🧂 Less Salt', text: 'Less Salt' },
  { id: 'less_oil', label: '🫒 Less Oil', text: 'Less Oil' },
  { id: 'less_ice', label: '🧊 Less Ice', text: 'Less Ice' },
];

interface CartPanelProps {
  onHoldOrder: () => void;
  onKot: () => void;
  onPrintKot: () => void;
  onPay: () => void;
  onCancelOrder: () => void;
  onOpenDiscount: () => void;
  onItemRemoved?: () => void;
}

const CartPanel: React.FC<CartPanelProps> = ({
  onHoldOrder,
  onKot,
  onPrintKot,
  onPay,
  onCancelOrder,
  onOpenDiscount,
  onItemRemoved,
}) => {
  const cart = useBillingStore((s) => s.cart);
  const discount = useBillingStore((s) => s.discount);
  const currentOrderId = useBillingStore((s) => s.currentOrderId);
  const syncedItemCount = useBillingStore((s) => s.syncedItemCount);
  const syncedQuantities = useBillingStore((s) => s.syncedQuantities);
  const kots = useBillingStore((s) => s.kots);
  const addToCart = useBillingStore((s) => s.addToCart);
  const updateQuantity = useBillingStore((s) => s.updateQuantity);
  const incrementQuantity = useBillingStore((s) => s.incrementQuantity);
  const removeFromCart = useBillingStore((s) => s.removeFromCart);
  const updateItemNotes = useBillingStore((s) => s.updateItemNotes);
  const getSubtotal = useBillingStore((s) => s.getSubtotal);
  const getDiscountAmount = useBillingStore((s) => s.getDiscountAmount);
  const getTaxBreakdown = useBillingStore((s) => s.getTaxBreakdown);
  const getRoundOff = useBillingStore((s) => s.getRoundOff);
  const getGrandTotal = useBillingStore((s) => s.getGrandTotal);

  const { t, i18n } = useTranslation();
  const taxTerms = useTaxTerminology();
  const taxRegion = getTaxRegionForLanguage(i18n.language);
  const showIndiaGstSplit = taxRegion === 'in';
  const { getName } = useMenuTranslations(cart.map((i) => i.menuItem));
  const [editingItemNote, setEditingItemNote] = useState<{
    indices: number[];
    itemName: string;
    variationName?: string;
  } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [comboSuggestions, setComboSuggestions] = useState<any[]>([]);
  const [dismissedCombos, setDismissedCombos] = useState<Set<number>>(new Set());
  const lastClickTimeRef = useRef<number>(0);

  // KOT separation view toggle (default: false / OFF). Persisted via settings & localStorage.
  const [showKotSeparators, setShowKotSeparators] = useState<boolean>(() => {
    try {
      return localStorage.getItem('show_kot_separators') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    ipc<string | null>(window.electronAPI.settings.get('show_kot_separators'))
      .then((val) => {
        if (val !== null && val !== undefined) {
          setShowKotSeparators(val === 'true');
          try {
            localStorage.setItem('show_kot_separators', val);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleKotSeparators = useCallback(async () => {
    const nextVal = !showKotSeparators;
    setShowKotSeparators(nextVal);
    try {
      localStorage.setItem('show_kot_separators', String(nextVal));
      await ipc(window.electronAPI.settings.set('show_kot_separators', String(nextVal), 'billing'));
    } catch { /* ignore */ }
  }, [showKotSeparators]);

  // Fetch combos and suggest matching ones based on cart items
  useEffect(() => {
    if (cart.length === 0) { setComboSuggestions([]); return; }
    const cartItemIds = new Set(cart.map((c) => c.menuItem.id));
    ipc<any[]>(window.electronAPI.menu.getCombos())
      .then((combos) => {
        if (!combos) return;
        const suggestions = combos.filter((combo) => {
          if (dismissedCombos.has(combo.id)) return false;
          // If any item in the combo is in the cart, suggest the combo
          const comboItemIds: number[] = (combo.items ?? combo.menuItemIds ?? []).map((i: any) => i.menuItemId ?? i);
          return comboItemIds.some((id) => cartItemIds.has(id));
        });
        setComboSuggestions(suggestions.slice(0, 2)); // max 2 suggestions
      })
      .catch(() => {});
  }, [cart, dismissedCombos]);

  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const taxBreakdown = getTaxBreakdown();
  const totalTax = taxBreakdown.reduce((sum, t) => sum + t.total, 0);
  const roundOff = getRoundOff();
  const grandTotal = getGrandTotal();

  // Group cart items by KOT batch so that each KOT slip and pending batch
  // remain clearly distinct and separated by the bill-paper zig-zag separator.
  type CartGroup = {
    key: string;
    indices: number[];
    representative: typeof cart[number];
    totalQuantity: number;
    totalAmount: number;
    isSynced: boolean;
  };

  type KotBatch = {
    id: string;
    kotNumber?: string;
    kotIndex?: number;
    isPending: boolean;
    createdAt?: string;
    status?: string;
    station?: string;
    groups: CartGroup[];
    totalQuantity: number;
    totalAmount: number;
  };

  const batches: KotBatch[] = [];
  const batchMap = new Map<string, KotBatch>();
  let sentCounter = 1;
  const kotIndexMap = new Map<string, number>();

  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const isItemSynced = i < syncedItemCount;
    const hasKotNum = !!item.kotNumber;
    const isPending = !hasKotNum && !isItemSynced;

    const batchKey = hasKotNum
      ? `kot:${item.kotNumber}`
      : isItemSynced
      ? 'kot:synced'
      : 'pending';

    let batch = batchMap.get(batchKey);
    if (!batch) {
      const kotMeta = item.kotNumber ? kots.find((k) => k.kotNumber === item.kotNumber) : undefined;
      let kotIdx: number | undefined = undefined;
      if (!isPending) {
        if (item.kotNumber && !kotIndexMap.has(item.kotNumber)) {
          kotIndexMap.set(item.kotNumber, sentCounter++);
        }
        kotIdx = item.kotNumber ? kotIndexMap.get(item.kotNumber) : sentCounter++;
      }

      batch = {
        id: batchKey,
        kotNumber: item.kotNumber,
        kotIndex: kotIdx,
        isPending,
        createdAt: kotMeta?.createdAt || kotMeta?.printedAt || item.createdAt,
        status: kotMeta?.status || item.kotStatus || (isPending ? 'pending' : 'sent'),
        station: kotMeta?.station,
        groups: [],
        totalQuantity: 0,
        totalAmount: 0,
      };
      batchMap.set(batchKey, batch);
      batches.push(batch);
    }

    const addonKey = [...item.addons.map((a) => a.id)].sort((a, b) => a - b).join(',');
    const noteKey = (item.notes ?? '').trim();
    const variationKey = item.variation?.id ?? 'none';
    const itemKey = !item.menuItem.id
      ? `temp:${i}:${item.menuItem.name}:${item.unitPrice}`
      : String(item.menuItem.id);
    const key = `${itemKey}|${variationKey}|${addonKey}|${noteKey}`;

    const existingGroup = batch.groups.find((g) => g.key === key);
    if (existingGroup) {
      existingGroup.indices.push(i);
      existingGroup.totalQuantity += item.quantity;
      existingGroup.totalAmount += item.total;
    } else {
      batch.groups.push({
        key,
        indices: [i],
        representative: item,
        totalQuantity: item.quantity,
        totalAmount: item.total,
        isSynced: isItemSynced || hasKotNum,
      });
    }

    batch.totalQuantity += item.quantity;
    batch.totalAmount += item.total;
  }

  // Sort batches so that the 'New Items (Pending KOT)' section is always displayed at the top
  const sortedBatches = [...batches].sort((a, b) => {
    if (a.isPending && !b.isPending) return -1;
    if (!a.isPending && b.isPending) return 1;
    return 0;
  });

  // Collapsed groups used when showKotSeparators is false (OFF)
  type CollapsedGroup = {
    key: string;
    indices: number[];
    representative: typeof cart[number];
    totalQuantity: number;
    totalAmount: number;
    minSyncedQty: number;
  };
  const collapsedGroups: CollapsedGroup[] = [];
  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const addonKey = [...item.addons.map((a) => a.id)].sort((a, b) => a - b).join(',');
    const noteKey = (item.notes ?? '').trim();
    const variationKey = item.variation?.id ?? 'none';
    const itemKey = !item.menuItem.id
      ? `temp:${i}:${item.menuItem.name}:${item.unitPrice}`
      : String(item.menuItem.id);
    const key = `${itemKey}|${variationKey}|${addonKey}|${noteKey}`;
    const existing = collapsedGroups.find((g) => g.key === key);
    const syncedQty = i < syncedItemCount ? (syncedQuantities[i] ?? 0) : 0;
    if (existing) {
      existing.indices.push(i);
      existing.totalQuantity += item.quantity;
      existing.totalAmount += item.total;
      existing.minSyncedQty += syncedQty;
    } else {
      collapsedGroups.push({
        key,
        indices: [i],
        representative: item,
        totalQuantity: item.quantity,
        totalAmount: item.total,
        minSyncedQty: syncedQty,
      });
    }
  }

  const handleOpenNotes = useCallback((indices: number[], itemName: string, variationName?: string, currentNotes?: string) => {
    setEditingItemNote({ indices, itemName, variationName });
    setNoteText(currentNotes ?? '');
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (editingItemNote && editingItemNote.indices.length > 0) {
      const trimmed = noteText.trim();
      for (const idx of editingItemNote.indices) {
        updateItemNotes(idx, trimmed);
      }
      setEditingItemNote(null);
      setNoteText('');
    }
  }, [editingItemNote, noteText, updateItemNotes]);

  const togglePreset = useCallback((presetText: string) => {
    setNoteText((prev) => {
      const parts = prev.split(',').map((p) => p.trim()).filter(Boolean);
      const existingIndex = parts.findIndex((p) => p.toLowerCase() === presetText.toLowerCase());
      if (existingIndex >= 0) {
        parts.splice(existingIndex, 1);
      } else {
        parts.push(presetText);
      }
      return parts.join(', ');
    });
  }, []);

  const isPresetActive = useCallback((presetText: string) => {
    const parts = noteText.split(',').map((p) => p.trim().toLowerCase());
    return parts.includes(presetText.toLowerCase());
  }, [noteText]);

  const [pendingVoid, setPendingVoid] = useState<{
    indices: number[];
    name: string;
    quantity: number;
    amount: number;
  } | null>(null);

  const clearCart = useBillingStore((s) => s.clearCart);

  // Remove item: if it's already saved to the DB order, delete it there with reason
  const handleRemove = useCallback(async (index: number, reason?: string) => {
    const item = cart[index];
    if (currentOrderId && index < syncedItemCount && item.orderItemId) {
      try {
        await ipc(window.electronAPI.orders.removeItem(currentOrderId, item.orderItemId, reason));
      } catch {
        // DB removal failed — still remove from local cart to stay consistent
      }
    }

    // Check if this is the last item — if so, delete the entire order
    const isLastItem = cart.length === 1;
    if (isLastItem && currentOrderId) {
      try {
        await ipc(window.electronAPI.orders.delete(currentOrderId));
      } catch { /* ignore */ }
      clearCart();
      onItemRemoved?.();
      return;
    }

    removeFromCart(index);
    onItemRemoved?.();
  }, [cart, currentOrderId, syncedItemCount, removeFromCart, clearCart, onItemRemoved]);

  const handleConfirmVoid = useCallback(async (reason: string) => {
    if (!pendingVoid) return;
    for (const idx of [...pendingVoid.indices].sort((a, b) => b - a)) {
      await handleRemove(idx, reason);
    }
    setPendingVoid(null);
  }, [pendingVoid, handleRemove]);

  const handleGroupDecrement = useCallback((group: CartGroup) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 40) return;
    lastClickTimeRef.current = now;

    if (group.isSynced) {
      // Sent KOT item: prompt void modal with reason
      const targetIdx = group.indices[group.indices.length - 1];
      const targetItem = cart[targetIdx];
      setPendingVoid({
        indices: [targetIdx],
        name: getName(targetItem.menuItem),
        quantity: 1,
        amount: targetItem.unitPrice,
      });
      return;
    }

    // Pending item: decrement or remove
    const targetIdx = group.indices[group.indices.length - 1];
    const targetItem = cart[targetIdx];
    if (targetItem.quantity <= 1) {
      handleRemove(targetIdx);
    } else {
      incrementQuantity(targetIdx, -1);
    }
  }, [cart, getName, handleRemove, incrementQuantity]);

  const handleGroupIncrement = useCallback((group: CartGroup) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 40) return;
    lastClickTimeRef.current = now;

    if (group.isSynced) {
      // Sent KOT item: queue +1 in the new pending batch for the next KOT
      const rep = group.representative;
      addToCart(rep.menuItem, rep.variation, rep.addons);
      toast.success(t('cart.addedToNextKot', 'Added 1 to new items for next KOT'));
      return;
    }

    // Pending item: increment directly
    const targetIdx = group.indices[group.indices.length - 1];
    incrementQuantity(targetIdx, 1);
  }, [addToCart, incrementQuantity, t]);

  const handleGroupRemove = useCallback(async (group: CartGroup) => {
    if (group.isSynced) {
      setPendingVoid({
        indices: group.indices,
        name: getName(group.representative.menuItem),
        quantity: group.totalQuantity,
        amount: group.totalAmount,
      });
      return;
    }

    for (const idx of [...group.indices].sort((a, b) => b - a)) {
      await handleRemove(idx);
    }
  }, [getName, handleRemove]);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-900">
              {t('cart.currentOrder')}
              {currentOrderId && (
                <span className="ml-1.5 text-[10px] font-normal text-gray-500">
                  #{String(currentOrderId).padStart(3, '0')}
                </span>
              )}
            </h2>
            <Tooltip
              text={
                showKotSeparators
                  ? t('cart.disableKotView', 'KOT View: ON (Click to show combined list)')
                  : t('cart.enableKotView', 'KOT View: OFF (Click to separate by KOTs)')
              }
              position="bottom"
              delay={false}
            >
              <button
                type="button"
                onClick={handleToggleKotSeparators}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border cursor-pointer ${
                  showKotSeparators
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <Receipt size={10} className={showKotSeparators ? 'text-blue-600' : 'text-gray-400'} />
                <span>{t('cart.kotViewToggle', 'KOT View')}</span>
                <span
                  className={`inline-flex items-center w-5 h-2.5 rounded-full p-0.5 transition-colors ${
                    showKotSeparators ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full bg-white transition-transform duration-150 ${
                      showKotSeparators ? 'translate-x-2.5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <ShoppingCart size={24} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-medium text-gray-500">{t('cart.empty')}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 text-center">{t('cart.emptyDesc')}</p>

          {currentOrderId && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={13} />}
              onClick={onCancelOrder}
              className="mt-4"
            >
              {t('cart.cancelOrder', 'Cancel Order')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-900">
            {t('cart.currentOrder')}
            {currentOrderId && (
              <span className="ml-1.5 text-[10px] font-normal text-gray-500">
                #{String(currentOrderId).padStart(3, '0')}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            <Tooltip
              text={
                showKotSeparators
                  ? t('cart.disableKotView', 'KOT View: ON (Click to show combined list)')
                  : t('cart.enableKotView', 'KOT View: OFF (Click to separate by KOTs)')
              }
              position="bottom"
              delay={false}
            >
              <button
                type="button"
                onClick={handleToggleKotSeparators}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border cursor-pointer ${
                  showKotSeparators
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-xs'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <Receipt size={10} className={showKotSeparators ? 'text-blue-600' : 'text-gray-400'} />
                <span>{t('cart.kotViewToggle', 'KOT View')}</span>
                <span
                  className={`inline-flex items-center w-5 h-2.5 rounded-full p-0.5 transition-colors ${
                    showKotSeparators ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full bg-white transition-transform duration-150 ${
                      showKotSeparators ? 'translate-x-2.5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </Tooltip>
            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {t('cart.itemCount', { count: cart.length })}
            </span>
          </div>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {showKotSeparators ? (
          <div className="py-0.5">
            {sortedBatches.map((batch, batchIdx) => {
              const formattedTime = formatKotTime(batch.createdAt);
              const isFirstBatch = batchIdx === 0;

              return (
                <React.Fragment key={batch.id}>
                  {/* Perforated dashed bill paper separator between KOT batches */}
                  {!isFirstBatch && (
                    <KotReceiptSeparator
                      label={batch.isPending ? t('cart.newItems', 'New Items') : (batch.kotIndex ? `KOT #${batch.kotIndex}` : undefined)}
                      isPending={batch.isPending}
                    />
                  )}

                  {/* Receipt slip card container for this KOT batch */}
                  <div className={`mx-2 my-0.5 rounded-lg border transition-shadow ${
                    batch.isPending
                      ? 'border-amber-200 bg-amber-50/20 shadow-xs'
                      : 'border-gray-200 bg-white shadow-xs'
                  }`}>
                    {/* KOT Slip Header */}
                    {batch.isPending ? (
                      <div className="px-2.5 py-1.5 bg-gradient-to-r from-amber-50/90 to-orange-50/70 border-b border-amber-200 rounded-t-lg flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px] shrink-0">
                            ⏳
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-amber-950 tracking-tight">
                              {sortedBatches.length > 1
                                ? t('cart.newItemsPending', 'New Items (Pending KOT)')
                                : t('cart.pendingKot', 'Order Items (Pending KOT)')}
                            </span>
                            <p className="text-[9px] text-amber-700/80">
                              {t('cart.notSentToKitchen', 'Not sent to kitchen yet')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                            {t('cart.unsent', 'Unsent')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1.5 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200 rounded-t-lg flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            #{batch.kotIndex ?? 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-gray-900 tracking-tight">
                                {batch.kotNumber ? `KOT #${batch.kotIndex}` : t('cart.kotSlip', 'KOT Slip')}
                              </span>
                              {batch.station && (
                                <span className="text-[9px] font-medium bg-gray-200 text-gray-700 px-1 py-0.2 rounded">
                                  {batch.station}
                                </span>
                              )}
                            </div>
                            {batch.kotNumber && (
                              <p className="text-[9px] font-mono text-gray-400 truncate">
                                {batch.kotNumber}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {formattedTime && (
                            <span className="text-[10px] text-gray-500 font-mono flex items-center gap-0.5">
                              <Clock size={10} className="text-gray-400" />
                              {formattedTime}
                            </span>
                          )}
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${
                            batch.status === 'ready'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : batch.status === 'preparing'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : batch.status === 'served'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            <Check size={9} />
                            {batch.status ? (batch.status.charAt(0).toUpperCase() + batch.status.slice(1)) : 'Sent'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Items in this batch */}
                    <div className="divide-y divide-gray-100">
                      {batch.groups.map((group) => {
                        const item = group.representative;
                        const totalQty = group.totalQuantity;
                        const totalAmt = group.totalAmount;

                        return (
                          <div key={group.key} className="px-2.5 py-1.5 group hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-start gap-1.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate">
                                      {getName(item.menuItem)}
                                    </p>
                                    {item.variation && (
                                      <p className="text-[10px] text-gray-500">{item.variation.name}</p>
                                    )}
                                  </div>
                                  <p className="text-xs font-semibold text-gray-900 flex-shrink-0">
                                    {formatCurrency(totalAmt)}
                                  </p>
                                </div>

                                {item.addons.length > 0 && (
                                  <div className="space-y-0">
                                    {item.addons.map((addon) => (
                                      <p key={addon.id} className="text-[10px] text-gray-400">
                                        + {addon.name} ({formatCurrency(addon.price)})
                                      </p>
                                    ))}
                                  </div>
                                )}

                                {item.notes ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNotes(group.indices, getName(item.menuItem), item.variation?.name, item.notes)}
                                    className="mt-1 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg px-1.5 py-0.5 text-[10px] cursor-pointer transition-colors max-w-full text-left font-medium"
                                  >
                                    <StickyNote size={10} className="text-amber-600 flex-shrink-0" />
                                    <span className="truncate">{item.notes}</span>
                                    <Pencil size={9} className="text-amber-500 flex-shrink-0 opacity-70 ml-0.5" />
                                  </button>
                                ) : null}

                                <div className="flex items-center gap-1.5 mt-1">
                                  <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                                    <Tooltip
                                      text={group.isSynced ? t('cart.voidItemTooltip', 'Void item (requires reason)') : t('cart.decreaseQty', 'Decrease quantity')}
                                      position="top"
                                      delay={false}
                                    >
                                      <button
                                        onClick={() => handleGroupDecrement(group)}
                                        className={`p-0.5 rounded-l-lg transition-colors ${
                                          group.isSynced
                                            ? 'text-red-500 hover:bg-red-50'
                                            : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                                        }`}
                                      >
                                        <Minus size={11} />
                                      </button>
                                    </Tooltip>
                                    <span className="px-2 text-[11px] font-medium text-gray-900 min-w-[22px] text-center">
                                      {totalQty}
                                    </span>
                                    <Tooltip
                                      text={group.isSynced ? t('cart.addToNextKotTooltip', 'Add 1 more to new items (for next KOT)') : t('cart.increaseQty', 'Increase quantity')}
                                      position="top"
                                      delay={false}
                                    >
                                      <button
                                        onClick={() => handleGroupIncrement(group)}
                                        className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-r-lg transition-colors"
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </Tooltip>
                                  </div>

                                  <span className="text-[10px] text-gray-400">
                                    @ {formatCurrency(item.unitPrice)}
                                  </span>

                                  <div className="ml-auto flex items-center gap-0.5">
                                    <Tooltip text={item.notes ? t('cart.editNote', 'Edit cooking note') : t('cart.addNote', 'Add cooking note')} position="top" delay={false}>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenNotes(group.indices, getName(item.menuItem), item.variation?.name, item.notes)}
                                        className={`p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                                          item.notes
                                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                            : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                        }`}
                                      >
                                        <StickyNote size={12} />
                                      </button>
                                    </Tooltip>
                                    <Tooltip text={group.isSynced ? t('cart.voidItem', 'Void item') : t('cart.removeItem', 'Remove item')} position="top" delay={false}>
                                      <button
                                        onClick={() => handleGroupRemove(group)}
                                        className="p-0.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <X size={11} />
                                      </button>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Batch subtotal footer */}
                    <div className="px-2.5 py-1 bg-gray-50/70 border-t border-gray-100 rounded-b-lg flex items-center justify-between text-[10px] text-gray-500">
                      <span>{t('cart.slipItems', '{{count}} items', { count: batch.totalQuantity })}</span>
                      <span className="font-semibold text-gray-700">
                        {formatCurrency(batch.totalAmount)}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {collapsedGroups.map((group) => {
              const item = group.representative;
              const lastIndex = group.indices[group.indices.length - 1];
              const totalQty = group.totalQuantity;
              const totalAmt = group.totalAmount;
              const isMerged = group.indices.length > 1;

              return (
                <div key={group.key} className="px-3 py-1.5 group hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {getName(item.menuItem)}
                          </p>
                          {item.variation && (
                            <p className="text-[10px] text-gray-500">{item.variation.name}</p>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-gray-900 flex-shrink-0">
                          {formatCurrency(totalAmt)}
                        </p>
                      </div>

                      {item.addons.length > 0 && (
                        <div className="space-y-0">
                          {item.addons.map((addon) => (
                            <p key={addon.id} className="text-[10px] text-gray-400">
                              + {addon.name} ({formatCurrency(addon.price)})
                            </p>
                          ))}
                        </div>
                      )}

                      {item.notes ? (
                        <button
                          type="button"
                          onClick={() => handleOpenNotes(group.indices, getName(item.menuItem), item.variation?.name, item.notes)}
                          className="mt-1 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg px-1.5 py-0.5 text-[10px] cursor-pointer transition-colors max-w-full text-left font-medium"
                        >
                          <StickyNote size={10} className="text-amber-600 flex-shrink-0" />
                          <span className="truncate">{item.notes}</span>
                          <Pencil size={9} className="text-amber-500 flex-shrink-0 opacity-70 ml-0.5" />
                        </button>
                      ) : null}

                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                          <button
                            onClick={() => {
                              const now = Date.now();
                              if (now - lastClickTimeRef.current < 40) return;
                              lastClickTimeRef.current = now;

                              const targetIdx = lastIndex;
                              const targetItem = cart[targetIdx];
                              const newQty = targetItem.quantity - 1;
                              const minQty = targetIdx < syncedItemCount ? (syncedQuantities[targetIdx] ?? 1) : 1;
                              if (newQty < minQty) {
                                const isSyncedRow = currentOrderId && targetIdx < syncedItemCount && targetItem?.orderItemId;
                                if (isSyncedRow) {
                                  setPendingVoid({
                                    indices: [targetIdx],
                                    name: getName(targetItem.menuItem),
                                    quantity: 1,
                                    amount: targetItem.unitPrice,
                                  });
                                } else {
                                  handleRemove(targetIdx);
                                }
                                return;
                              }
                              incrementQuantity(targetIdx, -1);
                            }}
                            className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-l-lg transition-colors"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="px-2 text-[11px] font-medium text-gray-900 min-w-[22px] text-center">
                            {totalQty}
                          </span>
                          <button
                            onClick={() => {
                              const now = Date.now();
                              if (now - lastClickTimeRef.current < 40) return;
                              lastClickTimeRef.current = now;

                              const targetIdx = lastIndex;
                              incrementQuantity(targetIdx, 1);
                            }}
                            className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-r-lg transition-colors"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <span className="text-[10px] text-gray-400">
                          @ {formatCurrency(item.unitPrice)}
                        </span>
                        {isMerged && (
                          <span className="text-[9px] text-gray-400 italic">
                            {t('cart.kotCount', { count: group.indices.length })}
                          </span>
                        )}

                        <div className="ml-auto flex items-center gap-0.5">
                          <Tooltip text={item.notes ? t('cart.editNote', 'Edit cooking note') : t('cart.addNote', 'Add cooking note')} position="top" delay={false}>
                            <button
                              type="button"
                              onClick={() => handleOpenNotes(group.indices, getName(item.menuItem), item.variation?.name, item.notes)}
                              className={`p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                                item.notes
                                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                  : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                              }`}
                            >
                              <StickyNote size={12} />
                            </button>
                          </Tooltip>
                          <Tooltip text={t('cart.removeItem')} position="top" delay={false}>
                            <button
                              onClick={async () => {
                                const hasSyncedItem = currentOrderId && group.indices.some((idx) => idx < syncedItemCount && cart[idx]?.orderItemId);
                                if (hasSyncedItem) {
                                  setPendingVoid({
                                    indices: group.indices,
                                    name: getName(item.menuItem),
                                    quantity: group.totalQuantity,
                                    amount: group.totalAmount,
                                  });
                                } else {
                                  for (const idx of [...group.indices].sort((a, b) => b - a)) {
                                    await handleRemove(idx);
                                  }
                                }
                              }}
                              className="p-0.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X size={11} />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {comboSuggestions.length > 0 && (
        <div className="px-3 py-1 border-t border-gray-100 bg-amber-50 flex-shrink-0">
          {comboSuggestions.map((combo) => (
            <div key={combo.id} className="flex items-center gap-1.5 py-1">
              <Sparkles size={11} className="text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-amber-800 truncate">
                  {combo.name}
                  {combo.price ? ` — ${formatCurrency(combo.price)}` : ''}
                </p>
              </div>
              <button
                onClick={() => setDismissedCombos((prev) => new Set([...prev, combo.id]))}
                className="p-0.5 text-amber-400 hover:text-amber-600 flex-shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Totals section */}
      <div className="border-t border-gray-200 flex-shrink-0">
        <div className="px-3 py-1.5 space-y-0.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-600">{t('cart.subtotal')}</span>
            <span className="text-gray-900 font-medium">{formatCurrency(subtotal)}</span>
          </div>

          <button
            onClick={onOpenDiscount}
            className="flex justify-between text-[11px] w-full hover:bg-gray-50 -mx-0.5 px-0.5 py-0 rounded-lg transition-colors"
          >
            <span className="text-gray-600 flex items-center gap-0.5 flex-wrap">
              <Tag size={10} />
              {t('cart.discount')}
              {discount?.reason?.startsWith('Auto:') ? (
                <span className="text-[9px] font-semibold bg-green-100 text-green-700 px-1 py-0 rounded-full">
                  🎉 {discount.reason.replace('Auto: ', '')}
                </span>
              ) : discount ? (
                <span className="text-[10px] text-green-600">
                  ({discount.type === 'percent' ? `${discount.value}%` : t('cart.flat')})
                </span>
              ) : null}
            </span>
            <span className={discountAmount > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
              {discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0)}
            </span>
          </button>

          {taxBreakdown.filter((tax) => tax.total > 0).map((tax) => (
            <div key={tax.rate} className="flex justify-between text-[10px] text-gray-500">
              <span>
                {showIndiaGstSplit ? (
                  <>
                    {taxTerms.scheme} {tax.rate}% ({taxTerms.componentA} {formatCurrency(tax.cgst)} +{' '}
                    {taxTerms.componentB} {formatCurrency(tax.sgst)})
                  </>
                ) : (
                  t('cart.taxSlabSimple', { scheme: taxTerms.scheme, rate: tax.rate })
                )}
              </span>
              <span>{formatCurrency(tax.total)}</span>
            </div>
          ))}

          {roundOff !== 0 && (
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{t('cart.roundOff')}</span>
              <span>{roundOff > 0 ? '+' : ''}{formatCurrency(roundOff)}</span>
            </div>
          )}

          <div className="flex justify-between pt-1 border-t border-gray-200">
            <span className="text-xs font-bold text-gray-900">{t('cart.grandTotal')}</span>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 py-1.5 border-t border-gray-200 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<Pause size={13} />}
            onClick={onHoldOrder}
            fullWidth
          >
            {t('cart.hold')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Send size={13} />}
            onClick={onKot}
            fullWidth
          >
            {t('cart.kot')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer size={13} />}
            onClick={onPrintKot}
            fullWidth
          >
            {t('cart.printKot')}
          </Button>
        </div>
        <div className="grid grid-cols-[1fr,auto] gap-1.5">
          <Button
            variant="success"
            size="sm"
            icon={<CreditCard size={14} />}
            onClick={onPay}
            fullWidth
          >
            {t('cart.pay')} {formatCurrency(grandTotal)}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={13} />}
            onClick={onCancelOrder}
            className="px-3.5"
          >
            <span className="sr-only sm:not-sr-only">{t('cart.cancel')}</span>
          </Button>
        </div>
      </div>

      {/* Cooking Instructions & Preparation Notes Modal */}
      {editingItemNote && (
        <Modal
          isOpen={true}
          onClose={() => setEditingItemNote(null)}
          title={t('cart.cookingInstructions', 'Cooking Instructions & Notes')}
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setNoteText('')}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors font-medium"
              >
                {t('common.clear', 'Clear Note')}
              </button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingItemNote(null)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveNotes}>
                  {t('common.save', 'Save Instructions')}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3.5">
            {/* Target Item Header */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                <StickyNote size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {editingItemNote.itemName}
                </p>
                {editingItemNote.variationName && (
                  <p className="text-[10px] text-gray-500">{editingItemNote.variationName}</p>
                )}
              </div>
            </div>

            {/* Quick Presets Section */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                {t('cart.quickPresets', 'Quick Presets (Click to Add / Remove)')}:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COOKING_INSTRUCTIONS.map((preset) => {
                  const active = isPresetActive(preset.text);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => togglePreset(preset.text)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all select-none border flex items-center gap-1 ${
                        active
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {active && <Check size={11} />}
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Instruction Input */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                {t('cart.customInstructions', 'Custom Preparation Note')}:
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t('cart.notePlaceholder', 'e.g., Less spicy, no onion/garlic, extra crispy...')}
                rows={3}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none"
                autoFocus
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {t('cart.kotNoteHint', 'These notes will be printed on the KOT and displayed on the Kitchen Display System (KDS).')}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Void Reason Picker Modal */}
      <VoidReasonModal
        isOpen={!!pendingVoid}
        onClose={() => setPendingVoid(null)}
        onConfirm={handleConfirmVoid}
        itemInfo={
          pendingVoid
            ? {
                name: pendingVoid.name,
                quantity: pendingVoid.quantity,
                amount: pendingVoid.amount,
              }
            : undefined
        }
      />
    </div>
  );
};

export default CartPanel;
