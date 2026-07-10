import React, { useState, useCallback, useEffect } from 'react';
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
} from 'lucide-react';
import { useBillingStore } from '../../stores/billing.store';
import { formatCurrency } from '../../lib/formatters';
import { ipc } from '../../lib/ipc';
import Button from '../common/Button';
import Tooltip from '../common/Tooltip';
import { useTranslation } from 'react-i18next';
import { useMenuTranslations } from '../../hooks/useMenuTranslations';
import { useTaxTerminology } from '../../hooks/useTaxTerminology';
import { getTaxRegionForLanguage } from '../../lib/taxLocalePresets';

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
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [comboSuggestions, setComboSuggestions] = useState<any[]>([]);
  const [dismissedCombos, setDismissedCombos] = useState<Set<number>>(new Set());

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

  // Group identical cart rows for display so multiple KOT batches of the same
  // item collapse into a single line. Each group keeps the indices of its
  // underlying rows so qty stepper / remove map back to real cart entries.
  type CartGroup = {
    key: string;
    indices: number[];
    representative: typeof cart[number];
    totalQuantity: number;
    totalAmount: number;
    minSyncedQty: number; // sum of synced qtys across all underlying rows
  };
  const groups: CartGroup[] = [];
  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const addonKey = [...item.addons.map((a) => a.id)].sort((a, b) => a - b).join(',');
    const noteKey = (item.notes ?? '').trim();
    const variationKey = item.variation?.id ?? 'none';
    const itemKey = !item.menuItem.id
      ? `temp:${i}:${item.menuItem.name}:${item.unitPrice}`
      : String(item.menuItem.id);
    const key = `${itemKey}|${variationKey}|${addonKey}|${noteKey}`;
    const existing = groups.find((g) => g.key === key);
    const syncedQty = i < syncedItemCount ? (syncedQuantities[i] ?? 0) : 0;
    if (existing) {
      existing.indices.push(i);
      existing.totalQuantity += item.quantity;
      existing.totalAmount += item.total;
      existing.minSyncedQty += syncedQty;
    } else {
      groups.push({
        key,
        indices: [i],
        representative: item,
        totalQuantity: item.quantity,
        totalAmount: item.total,
        minSyncedQty: syncedQty,
      });
    }
  }

  const handleOpenNotes = useCallback((index: number, currentNotes?: string) => {
    setEditingNoteIndex(index);
    setNoteText(currentNotes ?? '');
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (editingNoteIndex !== null) {
      updateItemNotes(editingNoteIndex, noteText);
      setEditingNoteIndex(null);
      setNoteText('');
    }
  }, [editingNoteIndex, noteText, updateItemNotes]);

  const clearCart = useBillingStore((s) => s.clearCart);

  // Remove item: if it's already saved to the DB order, delete it there too
  const handleRemove = useCallback(async (index: number) => {
    const item = cart[index];
    if (currentOrderId && index < syncedItemCount && item.orderItemId) {
      try {
        await ipc(window.electronAPI.orders.removeItem(currentOrderId, item.orderItemId));
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

  if (cart.length === 0) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-gray-200">
          <h2 className="text-xs font-semibold text-gray-900">
            {t('cart.currentOrder')}
            {currentOrderId && (
              <span className="ml-1.5 text-[10px] font-normal text-gray-500">
                #{String(currentOrderId).padStart(3, '0')}
              </span>
            )}
          </h2>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <ShoppingCart size={24} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-medium text-gray-500">{t('cart.empty')}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 text-center">{t('cart.emptyDesc')}</p>
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
          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {t('cart.itemCount', { count: cart.length })}
          </span>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {groups.map((group) => {
            const item = group.representative;
            const lastIndex = group.indices[group.indices.length - 1];
            const totalQty = group.totalQuantity;
            const totalAmt = group.totalAmount;
            const isMerged = group.indices.length > 1;
            return (
            <div key={group.key} className="px-3 py-1.5 group">
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

                  {item.notes && (
                    <p className="text-[10px] text-amber-600 italic">{t('cart.notePrefix', { value: item.notes })}</p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex items-center border border-gray-200 rounded">
                      <button
                        onClick={() => {
                          // Decrement: peel from the most recent underlying row.
                          // If that row's qty would drop below its synced (already-KOT'd) qty,
                          // block — same protection as before, just per-row.
                          const targetIdx = lastIndex;
                          const targetItem = cart[targetIdx];
                          const newQty = targetItem.quantity - 1;
                          const minQty = targetIdx < syncedItemCount ? (syncedQuantities[targetIdx] ?? 1) : 1;
                          if (newQty < minQty) {
                            if (minQty > 1) {
                              alert(t('cart.itemSentToKitchen'));
                            } else {
                              handleRemove(targetIdx);
                            }
                            return;
                          }
                          incrementQuantity(targetIdx, -1);
                        }}
                        className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50
                          rounded-l transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="px-2 text-[11px] font-medium text-gray-900 min-w-[22px] text-center">
                        {totalQty}
                      </span>
                      <button
                        onClick={() => {
                          // Increment: add to the most recent underlying row.
                          const targetIdx = lastIndex;
                          incrementQuantity(targetIdx, 1);
                        }}
                        className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50
                          rounded-r transition-colors"
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
                      <Tooltip text={t('cart.addNote')} position="top" delay={false}>
                        <button
                          onClick={() => handleOpenNotes(lastIndex, item.notes)}
                          className="p-0.5 text-gray-400 hover:text-amber-600 rounded transition-colors
                            opacity-0 group-hover:opacity-100"
                        >
                          <StickyNote size={11} />
                        </button>
                      </Tooltip>
                      <Tooltip text={t('cart.removeItem')} position="top" delay={false}>
                        <button
                          onClick={async () => {
                            // Remove the merged group: walk the underlying rows in
                            // reverse so indices stay valid as rows shift up.
                            for (const idx of [...group.indices].sort((a, b) => b - a)) {
                              await handleRemove(idx);
                            }
                          }}
                          className="p-0.5 text-gray-400 hover:text-red-600 rounded transition-colors
                            opacity-0 group-hover:opacity-100"
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

      {editingNoteIndex !== null && (
        <div className="px-3 py-1.5 border-t border-gray-200 bg-amber-50 flex-shrink-0">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t('cart.notePlaceholder')}
              className="flex-1 text-[11px] px-2 py-1 border border-amber-300 rounded
                focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNotes();
                if (e.key === 'Escape') setEditingNoteIndex(null);
              }}
            />
            <Button size="sm" variant="primary" onClick={handleSaveNotes}>
              {t('cart.saveNote')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingNoteIndex(null)}>
              {t('cart.cancelNote')}
            </Button>
          </div>
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
            className="flex justify-between text-[11px] w-full hover:bg-gray-50 -mx-0.5 px-0.5 py-0 rounded transition-colors"
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
            className="px-2"
          >
            <span className="sr-only sm:not-sr-only">{t('cart.cancel')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CartPanel;
