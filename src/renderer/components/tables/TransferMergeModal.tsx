import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowRightLeft,
  X,
  ChevronRight,
  ArrowLeft,
  Plus,
  Minus,
  Loader2,
  UtensilsCrossed,
  Search,
} from 'lucide-react';
import type { Table } from '../../../shared/types/table.types';
import { ipc } from '../../lib/ipc';
import { useBillingStore } from '../../stores/billing.store';
import { formatCurrency, compareTableNames } from '../../lib/formatters';

export interface TransferMergeModalProps {
  isOpen: boolean;
  mode?: 'transfer' | 'merge';
  sourceTable: Table;
  sourceOrderId: number;
  tables: Table[];
  initialSelectedItemId?: number;
  onClose: () => void;
  onSuccess: (targetTableId: number, isPartial: boolean) => void;
}

interface SelectableOrderItem {
  id: number;
  name: string;
  maxQuantity: number;
  selectedQuantity: number;
  unitPrice: number;
  selected: boolean;
}

const TransferMergeModal: React.FC<TransferMergeModalProps> = ({
  isOpen,
  sourceTable,
  sourceOrderId,
  tables,
  initialSelectedItemId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [scope, setScope] = useState<'entire' | 'partial'>('entire');
  const [partialStep, setPartialStep] = useState<'items' | 'target'>('items');
  const [items, setItems] = useState<SelectableOrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'free' | 'occupied'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load items when modal opens or orderId changes
  useEffect(() => {
    if (!isOpen || !sourceOrderId) return;
    setScope(initialSelectedItemId ? 'partial' : 'entire');
    setPartialStep('items');
    setSubmitting(false);
    setFilterType('all');
    setSearchQuery('');

    let mounted = true;
    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const order = await ipc<any>(window.electronAPI.orders.getById(sourceOrderId));
        if (mounted && order?.items) {
          setItems(
            order.items.map((oi: any) => ({
              id: oi.id,
              name: oi.name,
              maxQuantity: oi.quantity,
              selectedQuantity: oi.quantity,
              unitPrice: oi.unitPrice ?? oi.unit_price ?? 0,
              selected: initialSelectedItemId ? oi.id === initialSelectedItemId : true,
            }))
          );
        }
      } catch (err: any) {
        console.error('Failed to load order items for transfer', err);
        toast.error(err?.message ?? t('billingPage.failedToLoadOrder'));
      } finally {
        if (mounted) setLoadingItems(false);
      }
    };

    fetchItems();
    return () => {
      mounted = false;
    };
  }, [isOpen, sourceOrderId, initialSelectedItemId, t]);

  // Target tables excluding current source table
  const availableTargetTables = useMemo(() => {
    return tables.filter((tb) => tb.id !== sourceTable.id).sort(compareTableNames);
  }, [tables, sourceTable.id]);

  const freeCount = useMemo(() => availableTargetTables.filter((tb) => tb.status !== 'occupied').length, [availableTargetTables]);
  const occupiedCount = useMemo(() => availableTargetTables.filter((tb) => tb.status === 'occupied').length, [availableTargetTables]);

  const filteredTables = useMemo(() => {
    return availableTargetTables.filter((tb) => {
      if (filterType === 'free' && tb.status === 'occupied') return false;
      if (filterType === 'occupied' && tb.status !== 'occupied') return false;
      if (searchQuery.trim()) {
        return tb.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [availableTargetTables, filterType, searchQuery]);

  // Selected partial items summary
  const selectedItems = useMemo(() => items.filter((i) => i.selected && i.selectedQuantity > 0), [items]);
  const totalSelectedUnits = useMemo(() => selectedItems.reduce((acc, i) => acc + i.selectedQuantity, 0), [selectedItems]);
  const totalSelectedAmount = useMemo(() => selectedItems.reduce((acc, i) => acc + i.selectedQuantity * i.unitPrice, 0), [selectedItems]);

  const toggleSelectAll = (select: boolean) => {
    setItems((prev) =>
      prev.map((i) => ({
        ...i,
        selected: select,
        selectedQuantity: select ? i.maxQuantity : 0,
      }))
    );
  };

  const updateItemQty = (id: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newQty = Math.max(1, Math.min(item.maxQuantity, item.selectedQuantity + delta));
        return {
          ...item,
          selectedQuantity: newQty,
          selected: true,
        };
      })
    );
  };

  // Handle transfer/merge entire order
  const handleEntireAction = async (targetTable: Table) => {
    setSubmitting(true);
    const isOccupied = targetTable.status === 'occupied';
    try {
      if (isOccupied) {
        const targetOrder = await ipc<any>(window.electronAPI.orders.getByTable(targetTable.id));
        if (targetOrder?.id) {
          await ipc(window.electronAPI.orders.mergeBills(sourceOrderId, targetOrder.id));
        } else {
          await ipc(window.electronAPI.orders.moveTable(sourceOrderId, targetTable.id));
        }
      } else {
        await ipc(window.electronAPI.orders.moveTable(sourceOrderId, targetTable.id));
      }

      if (isOccupied) {
        toast.success(t('billingPage.ordersMergedInto', { name: targetTable.name }));
      } else {
        toast.success(t('billingPage.orderTransferredTo', { name: targetTable.name }));
      }
      onSuccess(targetTable.id, false);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? t('billingPage.transferFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle transfer/merge partial items
  const handlePartialAction = async (targetTable: Table) => {
    if (selectedItems.length === 0) {
      toast.error(t('billingPage.noItemsSelected', 'Please select at least one item'));
      return;
    }

    setSubmitting(true);
    const isOccupied = targetTable.status === 'occupied';
    const payloadItems = selectedItems.map((i) => ({
      orderItemId: i.id,
      quantity: i.selectedQuantity,
    }));

    try {
      try {
        await ipc(window.electronAPI.orders.transferPartial(sourceOrderId, targetTable.id, payloadItems));
      } catch (innerErr: any) {
        if (innerErr?.message?.includes('No handler registered')) {
          const itemIds = payloadItems.map((i) => i.orderItemId);
          if (isOccupied) {
            const newOrder = await ipc<any>(window.electronAPI.orders.splitBill(sourceOrderId, itemIds));
            const targetOrder = await ipc<any>(window.electronAPI.orders.getByTable(targetTable.id));
            if (targetOrder?.id) {
              await ipc(window.electronAPI.orders.mergeBills(newOrder.id, targetOrder.id));
            }
          } else {
            await ipc(window.electronAPI.orders.splitBill(sourceOrderId, itemIds, targetTable.id));
          }
        } else {
          throw innerErr;
        }
      }
      // Update local billing store notes and outboundTransfers immediately so source table (T1) reflects the transfer      // Update local billing store notes and outboundTransfers immediately if currently viewing this source order
      try {
        if (useBillingStore.getState().currentOrderId === sourceOrderId) {
          const transferredItemsList = selectedItems.map((i) => ({
            name: i.name,
            quantity: i.selectedQuantity,
          }));
          useBillingStore.getState().recordOutboundTransfer(sourceOrderId, {
            targetTableName: targetTable.name,
            items: transferredItemsList,
            timestamp: Date.now(),
          });
          const itemsSummaryStr = transferredItemsList.map((i) => `${i.name} x${i.quantity}`).join(', ');
          const transferNote = itemsSummaryStr
            ? `Transferred to ${targetTable.name}: ${itemsSummaryStr}`
            : `Transferred to ${targetTable.name}`;
          const currentNotes = useBillingStore.getState().notes;
          const updatedNotes = currentNotes ? `${currentNotes} | ${transferNote}` : transferNote;
          useBillingStore.getState().setNotes(updatedNotes);
        }
      } catch { /* ignore */ }

      if (isOccupied) {
        toast.success(t('billingPage.partialMergedInto', { name: targetTable.name, defaultValue: 'Merged items into {{name}}' }));
      } else {
        toast.success(t('billingPage.partialTransferredTo', { name: targetTable.name, defaultValue: 'Transferred items to {{name}}' }));
      }
      onSuccess(targetTable.id, true);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? t('billingPage.transferFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-100 text-blue-700">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 leading-tight">
                {t('tables.transferOrderTitle', { name: sourceTable.name, defaultValue: 'Transfer Order — {{name}}' })}
              </h2>
              <p className="text-xs text-gray-500">
                {t('tables.transferSubtitle', 'Move order or items to a free table, or merge with an occupied table')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scope Selector: Entire Order vs Partial Order */}
        <div className="px-5 pt-3 pb-2">
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setScope('entire');
                setPartialStep('items');
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                scope === 'entire'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>{t('tables.entireOrder', 'Entire Order')}</span>
            </button>
            <button
              type="button"
              onClick={() => setScope('partial')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                scope === 'partial'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>{t('tables.partialOrder', 'Partial Order')}</span>
              {selectedItems.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">
                  {selectedItems.length}
                </span>
              )}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-1.5">
            {scope === 'entire'
              ? t('tables.transferWholeDesc', 'Move all items to another table')
              : t('tables.transferPartialDesc', 'Select specific items to transfer')}
          </p>
        </div>

        {/* Content body */}
        <div className="overflow-y-auto flex-1 px-5 py-2">
          {/* Table Picker Filter & Search Controls (Rendered when choosing target table) */}
          {(scope === 'entire' || (scope === 'partial' && partialStep === 'target')) && (
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between gap-2">
                {/* Filter chips */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      filterType === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t('tables.filterAll', 'All')} ({availableTargetTables.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('free')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      filterType === 'free' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t('tables.filterFree', 'Free')} ({freeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('occupied')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      filterType === 'occupied' ? 'bg-white text-purple-700 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {t('tables.filterOccupied', 'Occupied')} ({occupiedCount})
                  </button>
                </div>

                {/* Table search input */}
                <div className="relative flex-1 max-w-[170px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('common.search', 'Search table...')}
                    className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 1. ENTIRE ORDER TABLE PICKER */}
          {scope === 'entire' && (
            <div className="space-y-2">
              {filteredTables.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <UtensilsCrossed size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-medium">
                    {t('billingPage.noOtherOccupiedTables', 'No destination tables found')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredTables.map((tTable) => {
                    const isOccupied = tTable.status === 'occupied';
                    return (
                      <button
                        key={tTable.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => handleEntireAction(tTable)}
                        className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
                          isOccupied
                            ? 'border-purple-200 bg-purple-50/30 hover:bg-purple-50/70 hover:border-purple-300 text-purple-950'
                            : 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/70 hover:border-emerald-300 text-emerald-950'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-sm">{tTable.name}</span>
                          {submitting ? (
                            <Loader2 size={14} className="animate-spin text-blue-600" />
                          ) : (
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                isOccupied
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOccupied ? t('tables.badgeMerge', 'Merge') : t('tables.badgeTransfer', 'Transfer')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] opacity-70 mt-1">
                          {t('tables.capacityLabel')}: {tTable.capacity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. PARTIAL ORDER MODE: ITEM PICKER */}
          {scope === 'partial' && partialStep === 'items' && (
            <div>
              {loadingItems ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <span className="text-xs">{t('common.loading', 'Loading items...')}</span>
                </div>
              ) : items.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <p className="text-sm font-medium">{t('billingPage.noItemsToSplit', 'No items in order')}</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-600">
                      {t('tables.selectItemsToMove', 'Select items & quantity:')}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(true)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {t('tables.selectAll', 'Select All')}
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(false)}
                        className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                      >
                        {t('tables.deselectAll', 'Clear')}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          item.selected && item.selectedQuantity > 0
                            ? 'bg-blue-50/50 border-blue-200'
                            : 'bg-white border-gray-200 opacity-60'
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={item.selected && item.selectedQuantity > 0}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setItems((prev) =>
                                prev.map((i) =>
                                  i.id === item.id
                                    ? {
                                        ...i,
                                        selected: checked,
                                        selectedQuantity: checked ? (i.selectedQuantity || i.maxQuantity) : 0,
                                      }
                                    : i
                                )
                              );
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                            <p className="text-[10px] text-gray-400">
                              {formatCurrency(item.unitPrice)} each
                            </p>
                          </div>
                        </label>

                        {/* Quantity selector */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              disabled={item.selectedQuantity <= 0}
                              onClick={() => updateItemQty(item.id, -1)}
                              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-gray-800">
                              {item.selectedQuantity}
                            </span>
                            <button
                              type="button"
                              disabled={item.selectedQuantity >= item.maxQuantity}
                              onClick={() => updateItemQty(item.id, 1)}
                              className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                          <span className="text-xs font-bold text-gray-700 min-w-[50px] text-right">
                            {formatCurrency(item.unitPrice * (item.selectedQuantity || 0))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. PARTIAL TARGET TABLE PICKER */}
          {scope === 'partial' && partialStep === 'target' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => setPartialStep('items')}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft size={14} />
                  <span>{t('common.back', 'Back to items')}</span>
                </button>
                <span className="text-xs font-bold text-blue-600">
                  {totalSelectedUnits} items ({formatCurrency(totalSelectedAmount)})
                </span>
              </div>

              {filteredTables.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <UtensilsCrossed size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-medium">
                    {t('billingPage.noOtherOccupiedTables', 'No destination tables found')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredTables.map((tTable) => {
                    const isOccupied = tTable.status === 'occupied';
                    return (
                      <button
                        key={tTable.id}
                        type="button"
                        disabled={submitting}
                        onClick={() => handlePartialAction(tTable)}
                        className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
                          isOccupied
                            ? 'border-purple-200 bg-purple-50/30 hover:bg-purple-50/70 hover:border-purple-300 text-purple-950'
                            : 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/70 hover:border-emerald-300 text-emerald-950'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-sm">{tTable.name}</span>
                          {submitting ? (
                            <Loader2 size={14} className="animate-spin text-blue-600" />
                          ) : (
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                isOccupied
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOccupied ? t('tables.badgeMerge', 'Merge') : t('tables.badgeTransfer', 'Transfer')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] opacity-70 mt-1">
                          {t('tables.capacityLabel')}: {tTable.capacity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>



        {/* Footer for partial mode step 1 */}
        {scope === 'partial' && partialStep === 'items' && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-800">
                {selectedItems.length} {t('common.items', 'items')} selected
              </p>
              <p className="text-[11px] text-gray-500">
                {totalSelectedUnits} total units • {formatCurrency(totalSelectedAmount)}
              </p>
            </div>
            <button
              type="button"
              disabled={selectedItems.length === 0}
              onClick={() => setPartialStep('target')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors"
            >
              <span>{t('tables.nextChooseTable', 'Next: Choose Table')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default TransferMergeModal;
