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
  Check,
  X,
  Printer,
  CreditCard,
  UtensilsCrossed,
  Pin,
} from 'lucide-react';
import { TableStatus } from '../../shared/enums';
import type { Table, CreateTableDTO, UpdateTableDTO } from '../../shared/types/table.types';
import type { Floor } from '../../shared/types/table.types';
import { useTables } from '../hooks/useTables';
import { useSettings } from '../hooks/useSettings';
import { resolveOrderItemTaxRateFallback } from '../lib/taxLocalePresets';
import { useBillingStore } from '../stores/billing.store';
import { ipc } from '../lib/ipc';
import { formatCurrency } from '../lib/formatters';
import { useLocaleCurrencyIcon } from '../hooks/useLocaleCurrencyIcon';
import TableLayout from '../components/tables/TableLayout';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';

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
  const billingStore = useBillingStore();

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

  // Right-click context menus
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; table: Table } | null>(null);
  const [floorContextMenu, setFloorContextMenu] = useState<{ x: number; y: number; floor: Floor } | null>(null);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const handleTableContextMenu = useCallback((e: React.MouseEvent, table: Table) => {
    setTableContextMenu({ x: e.clientX, y: e.clientY, table });
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
  const [tableOrdersMap, setTableOrdersMap] = useState<Map<number, { grandTotal: number; itemCount: number; createdAt: string }>>(new Map());

  // Fetch order summaries for all occupied tables
  useEffect(() => {
    const occupiedTables = tables.filter((t) => t.status === TableStatus.OCCUPIED);
    if (occupiedTables.length === 0) {
      setTableOrdersMap(new Map());
      return;
    }
    const fetchAll = async () => {
      const map = new Map<number, { grandTotal: number; itemCount: number; createdAt: string }>();
      await Promise.all(
        occupiedTables.map(async (t) => {
          try {
            const order = await ipc<any>(window.electronAPI.orders.getByTable(t.id));
            if (order) {
              map.set(t.id, {
                grandTotal: order.grandTotal ?? 0,
                itemCount: (order.items ?? []).length,
                createdAt: order.createdAt ?? '',
              });
            }
          } catch { /* ignore */ }
        })
      );
      setTableOrdersMap(map);
    };
    fetchAll();
  }, [tables]);

  // Poll the table list every 5s so orders placed from waiter tablets show up
  // here in near real-time (occupations, KOT statuses).
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

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
        if (order && order.items && order.items.length > 0) {
          const cartItems = order.items.map((oi: any) => ({
            menuItem: {
              id: oi.menuItemId ?? oi.menu_item_id,
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
              id: a.addonId ?? a.addon_id ?? a.id,
              name: a.name,
              price: a.price,
            })),
            quantity: oi.quantity,
            unitPrice: oi.unitPrice ?? oi.unit_price,
            total: (oi.unitPrice ?? oi.unit_price) * oi.quantity,
            notes: oi.notes,
          }));
          billingStore.loadOrderIntoCart(order.id, tableId, cartItems, cartItems.length);
          navigate('/billing');
          return;
        }
      } catch {
        // fall through to simple navigation
      }
    }
    billingStore.resetForNewTable(tableId);
    navigate('/billing');
  }, [billingStore, navigate, settings.default_tax_rate, i18n.language]);

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
      if (order && order.items && order.items.length > 0) {
        const cartItems = order.items.map((oi: any) => ({
          menuItem: {
            id: oi.menuItemId ?? oi.menu_item_id,
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
            id: a.addonId ?? a.addon_id ?? a.id,
            name: a.name,
            price: a.price,
          })),
          quantity: oi.quantity,
          unitPrice: oi.unitPrice ?? oi.unit_price,
          total: (oi.unitPrice ?? oi.unit_price) * oi.quantity,
          notes: oi.notes,
        }));
        billingStore.loadOrderIntoCart(order.id, tableId, cartItems, cartItems.length);
      }
    } catch {
      billingStore.setOrderType('dine_in');
      billingStore.setTable(tableId);
      billingStore.setCurrentOrderId(orderId);
    }
    navigate('/billing?action=pay');
  }, [billingStore, navigate, settings.default_tax_rate, i18n.language]);

  // Resolve active floor
  const currentFloorId = activeFloorId ?? floors[0]?.id ?? null;
  const currentTables = useMemo(
    () => (currentFloorId !== null ? tablesByFloor(currentFloorId) : []),
    [currentFloorId, tablesByFloor]
  );

  // --- Handlers ---

  const handleTableClick = (table: Table) => {
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
  };

  const openAddTableModal = () => {
    setEditingTable(null);
    setTableForm(defaultTableForm);
    setShowTableModal(true);
  };

  const openEditTableModal = (table: Table) => {
    setEditingTable(table);
    setTableForm({
      name: table.name,
      capacity: table.capacity,
      shape: table.shape,
      posX: table.posX,
      posY: table.posY,
    });
    setShowTableModal(true);
  };

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
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <LayoutGrid size={22} className="text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">{t('tables.title')}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} />}
            onClick={refetch}
          >
            {t('common.refresh')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => setShowFloorModal(true)}
          >
            {t('tables.addFloor')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={openAddTableModal}
            disabled={!currentFloorId}
          >
            {t('tables.addTable')}
          </Button>
        </div>
      </div>

      {/* Floor tabs */}
      {floors.length > 0 && (
        <div className="flex items-center gap-1 px-6 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => setActiveFloorId(floor.id)}
              onContextMenu={(e) => handleFloorContextMenu(e, floor)}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-colors select-none tap-target
                ${
                  currentFloorId === floor.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }
              `}
            >
              <Layers size={14} />
              {floor.name}
              <span className="ml-1 text-xs opacity-75">
                ({tablesByFloor(floor.id).length})
              </span>
              {isEditMode && floors.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFloor(floor.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-white/20"
                >
                  <X size={12} />
                </button>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
          <Layers size={48} />
          <p className="text-sm">{t('tables.emptyFloors')}</p>
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={() => setShowFloorModal(true)}
          >
            {t('tables.addFloor')}
          </Button>
        </div>
      )}

      {/* === Add / Edit Table Modal === */}
      <Modal
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
        title={editingTable ? t('tables.editTableTitle') : t('tables.addTableTitle')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowTableModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={handleSaveTable}
              disabled={!tableForm.name.trim()}
            >
              {editingTable ? t('tables.saveChanges') : t('tables.addTableButton')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('tables.tableNameLabel')}</label>
            <input
              type="text"
              value={tableForm.name}
              onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('tables.tableNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('tables.capacityLabel')}</label>
            <input
              type="number"
              min={1}
              max={20}
              value={tableForm.capacity}
              onChange={(e) =>
                setTableForm((f) => ({ ...f, capacity: parseInt(e.target.value) || 1 }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
            <Button variant="secondary" onClick={() => { setShowFloorModal(false); setEditingFloor(null); setFloorName(''); }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('tables.floorNameLabel')}</label>
          <input
            type="text"
            value={floorName}
            onChange={(e) => setFloorName(e.target.value)}
            placeholder={t('tables.floorNamePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
          />
        </div>
      </Modal>

      {/* === Table Status / Actions Modal === */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedTable(null);
        }}
        title={selectedTable?.name ?? t('tables.tableFallback')}
        size="sm"
      >
        {selectedTable && (
          <div className="space-y-4">
            {/* Current status */}
            <div className="text-sm text-gray-500">
              {t('tables.statusLabel')}{' '}
              <span className="font-medium text-gray-800 capitalize">
                {selectedTable.status}
              </span>
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
                  <div className="flex items-center justify-center py-6">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : tableOrder ? (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                    {/* Order header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
                      <span className="text-sm font-semibold text-gray-800">
                        #{tableOrder.orderNumber}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(tableOrder.grandTotal)}
                      </span>
                    </div>
                    {/* Order items */}
                    <div className="px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
                      {tableOrder.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">
                            <span className="font-medium text-gray-500 mr-1.5">{item.quantity}x</span>
                            {item.name}
                          </span>
                          <span className="text-gray-600 text-xs">{formatCurrency(item.total)}</span>
                        </div>
                      ))}
                      {tableOrder.items.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-1">{t('tables.noItems')}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">{t('tables.noActiveOrder')}</p>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    fullWidth
                    size="md"
                    icon={<Printer size={16} />}
                    onClick={handlePrintKotFromTable}
                    disabled={!tableOrder}
                  >
                    {t('tables.printKot')}
                  </Button>
                  <Button
                    variant="success"
                    fullWidth
                    size="md"
                    icon={<CurrencyIcon size={16} />}
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
                <Button
                  variant="primary"
                  fullWidth
                  size="md"
                  icon={<ChevronRight size={18} />}
                  onClick={() => {
                    setShowStatusModal(false);
                    handleGoToBilling(selectedTable.id, tableOrder?.id);
                  }}
                >
                  {t('tables.viewEditOrder')}
                </Button>
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
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
            style={{ left: tableContextMenu.x, top: tableContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              {tableContextMenu.table.name}
            </div>
            <button
              onClick={() => {
                const tbl = tableContextMenu.table;
                setTableContextMenu(null);
                openEditTableModal(tbl);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
              onClick={async () => {
                const tbl = tableContextMenu.table;
                setTableContextMenu(null);
                if (window.confirm(t('tables.confirmDeleteTable', { name: tbl.name }))) {
                  try { await deleteTable(tbl.id); } catch { /* handled */ }
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              {t('tables.deleteTable')}
            </button>
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
    </div>
  );
};

export default Tables;
