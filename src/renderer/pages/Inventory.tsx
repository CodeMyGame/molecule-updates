import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Package,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  TrendingDown,
  Truck,
  Users,
  BookOpen,
  ArrowDownUp,
  Eye,
  CheckCircle2,
  XCircle,
  UtensilsCrossed,
  BarChart2,
  Calendar,
  Download,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import SearchInput from '../components/common/SearchInput';
import { useInventory } from '../hooks/useInventory';
import { useTaxTerminology } from '../hooks/useTaxTerminology';
import { useMenu, type MenuItem } from '../hooks/useMenu';
import { formatCurrency, formatDate } from '../lib/formatters';
import { StockTransactionType, POStatus } from '../../shared/enums';
import type {
  InventoryItem,
  Supplier,
  PurchaseOrder,
  POItem,
  StockTransaction,
  Recipe,
} from '../../shared/types/inventory.types';
import type { ItemStockConsumptionRecord } from '../../shared/types/report.types';
import type {
  CreateInventoryItemDTO,
  UpdateInventoryItemDTO,
  StockAdjustmentDTO,
  CreateSupplierDTO,
  CreatePODTO,
  CreateRecipeDTO,
} from '../hooks/useInventory';

// ---------- Tab definitions ----------

type TabKey = 'stock' | 'purchaseOrders' | 'suppliers' | 'recipes' | 'consumption' | 'wastage';

// ---------- Stock status helpers ----------

function getStockStatus(item: InventoryItem): 'ok' | 'low' | 'out' {
  if (item.currentStock <= 0) return 'out';
  if (item.currentStock <= item.minStock) return 'low';
  return 'ok';
}

function getStockBadge(status: 'ok' | 'low' | 'out', t: TFunction) {
  switch (status) {
    case 'out':
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          {t('inventory.stockStatusOut')}
        </span>
      );
    case 'low':
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
          {t('inventory.stockStatusLow')}
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          {t('inventory.stockStatusOk')}
        </span>
      );
  }
}

function getPOStatusBadge(status: POStatus, t: TFunction) {
  const styles: Record<POStatus, string> = {
    [POStatus.DRAFT]: 'bg-gray-100 text-gray-700',
    [POStatus.ORDERED]: 'bg-blue-100 text-blue-700',
    [POStatus.RECEIVED]: 'bg-green-100 text-green-700',
    [POStatus.CANCELLED]: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${styles[status]}`}>
      {t(`inventory.poStatus.${status}`)}
    </span>
  );
}

// ---------- Main component ----------

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const inv = useInventory();
  const menu = useMenu();

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'stock', label: t('inventory.stockOverview'), icon: <Package size={18} /> },
    { key: 'purchaseOrders', label: t('inventory.purchaseOrders'), icon: <Truck size={18} /> },
    { key: 'suppliers', label: t('inventory.suppliers'), icon: <Users size={18} /> },
    { key: 'recipes', label: t('inventory.recipes'), icon: <BookOpen size={18} /> },
    { key: 'consumption', label: t('inventory.consumption', 'Consumption Report'), icon: <BarChart2 size={18} /> },
    { key: 'wastage', label: t('inventory.wastage'), icon: <TrendingDown size={18} /> },
  ];

  const [activeTab, setActiveTab] = useState<TabKey>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  // Modal states
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showAdjustStock, setShowAdjustStock] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [showWastageLog, setShowWastageLog] = useState(false);

  // Recipe states
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<number | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [showAddRecipe, setShowAddRecipe] = useState(false);

  // Wastage history
  const [wastageHistory, setWastageHistory] = useState<StockTransaction[]>([]);

  // Fetch wastage when tab changes
  useEffect(() => {
    if (activeTab === 'wastage') {
      inv.getTransactions().then((txns) => {
        setWastageHistory(txns.filter((t) => t.transactionType === StockTransactionType.WASTAGE));
      });
    }
  }, [activeTab, inv.getTransactions]);

  // Categories derived from inventory items
  const categories = useMemo(() => {
    const cats = new Set<string>();
    inv.items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [inv.items]);

  // Filtered stock items
  const filteredItems = useMemo(() => {
    return inv.items.filter((item) => {
      if (!item.isActive) return false;
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const status = getStockStatus(item);
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && status === 'low') ||
        (stockFilter === 'out' && status === 'out');
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [inv.items, searchQuery, categoryFilter, stockFilter]);

  const lowStockCount = useMemo(
    () => inv.items.filter((i) => i.isActive && getStockStatus(i) !== 'ok').length,
    [inv.items]
  );

  // Load all recipes when recipes tab is active
  const loadRecipes = useCallback(async () => {
    try {
      const itemIds = menu.items.map((i) => i.id);
      const all = await inv.getAllRecipes(itemIds);
      if (all && all.length > 0) {
        setRecipes(all);
      }
    } catch {
      // ignore
    }
  }, [inv.getAllRecipes, menu.items]);

  useEffect(() => {
    if (activeTab === 'recipes') {
      loadRecipes();
    }
  }, [activeTab, loadRecipes, menu.items]);

  // Fetch / select recipe when menu item selected
  const handleSelectMenuItem = useCallback(
    async (itemId: number) => {
      setSelectedMenuItemId(itemId);
      try {
        const r = await inv.getRecipesByItem(itemId);
        const mapped = (r ?? []).map((item: any) => ({
          ...item,
          menuItemId: item.menuItemId ?? item.menu_item_id,
          inventoryItemId: item.inventoryItemId ?? item.inventory_item_id,
          quantityUsed: item.quantityUsed ?? item.quantity_used,
        }));
        setRecipes((prev) => {
          const others = prev.filter((item) => (item.menuItemId ?? (item as any).menu_item_id) !== itemId);
          return [...others, ...mapped];
        });
      } catch {
        // ignore
      }
    },
    [inv.getRecipesByItem]
  );

  // ============= RENDER =============

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1.5">
          <Package size={15} className="text-blue-600 shrink-0" />
          <h1 className="text-xs font-bold text-gray-900 tracking-tight">{t('inventory.pageTitle')}</h1>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
              <AlertTriangle size={11} />
              {t('inventory.lowStockBadge', { count: lowStockCount })}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/80 border-b border-gray-200 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSearchQuery('');
            }}
            className={`
              flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full
              transition-colors select-none
              ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }
            `}
          >
            {React.cloneElement(tab.icon as React.ReactElement, { size: 12 })}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50/50">
        {activeTab === 'stock' && (
          <StockOverviewTab
            items={filteredItems}
            allItems={inv.items}
            categories={categories}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            stockFilter={stockFilter}
            onStockFilterChange={setStockFilter}
            onAddItem={() => setShowAddItem(true)}
            onEditItem={setEditingItem}
            onDeleteItem={(item) => inv.deleteItem(item.id, { isActive: false })}
            onAdjustStock={() => setShowAdjustStock(true)}
          />
        )}

        {activeTab === 'purchaseOrders' && (
          <PurchaseOrdersTab
            purchaseOrders={inv.purchaseOrders}
            suppliers={inv.suppliers}
            items={inv.items}
            onCreate={() => setShowCreatePO(true)}
            onView={setViewingPO}
            onReceive={setReceivingPO}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersTab
            suppliers={inv.suppliers}
            onAdd={() => setShowAddSupplier(true)}
            onEdit={setEditingSupplier}
          />
        )}

        {activeTab === 'recipes' && (
          <RecipesTab
            items={menu.items}
            menuItems={menu.items}
            inventoryItems={inv.items}
            selectedMenuItemId={selectedMenuItemId}
            recipes={recipes}
            onSelectMenuItem={handleSelectMenuItem}
            onAddRecipe={() => setShowAddRecipe(true)}
            onDeleteRecipe={async (r) => {
              const id = typeof r === 'number' ? r : r.id;
              await inv.deleteRecipe(id);
              setRecipes((prev) => prev.filter((rec) => rec.id !== id));
              await loadRecipes();
            }}
          />
        )}

        {activeTab === 'consumption' && (
          <ConsumptionTab
            getItemStockConsumption={inv.getItemStockConsumption}
            inventoryItems={inv.items}
          />
        )}

        {activeTab === 'wastage' && (
          <WastageTab
            history={wastageHistory}
            items={inv.items}
            onLogWastage={() => setShowWastageLog(true)}
          />
        )}
      </div>

      {/* ========== MODALS ========== */}

      {/* Add/Edit Inventory Item */}
      {(showAddItem || editingItem) && (
        <InventoryItemModal
          item={editingItem}
          onClose={() => {
            setShowAddItem(false);
            setEditingItem(null);
          }}
          onSave={async (data) => {
            if (editingItem) {
              await inv.updateItem(editingItem.id, data);
            } else {
              await inv.createItem(data as CreateInventoryItemDTO);
            }
            setShowAddItem(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Stock Adjustment */}
      {showAdjustStock && (
        <StockAdjustmentModal
          items={inv.items.filter((i) => i.isActive)}
          onClose={() => setShowAdjustStock(false)}
          onSave={async (itemId, adj) => {
            await inv.adjustStock(itemId, adj);
            setShowAdjustStock(false);
          }}
        />
      )}

      {/* Add/Edit Supplier */}
      {(showAddSupplier || editingSupplier) && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => {
            setShowAddSupplier(false);
            setEditingSupplier(null);
          }}
          onSave={async (data) => {
            if (editingSupplier) {
              await inv.updateSupplier(editingSupplier.id, data);
            } else {
              await inv.createSupplier(data as CreateSupplierDTO);
            }
            setShowAddSupplier(false);
            setEditingSupplier(null);
          }}
        />
      )}

      {/* Create Purchase Order */}
      {showCreatePO && (
        <CreatePOModal
          suppliers={inv.suppliers.filter((s) => s.isActive)}
          items={inv.items.filter((i) => i.isActive)}
          onClose={() => setShowCreatePO(false)}
          onSave={async (data) => {
            await inv.createPurchaseOrder(data);
            setShowCreatePO(false);
          }}
        />
      )}

      {/* View PO Details */}
      {viewingPO && (
        <ViewPOModal
          po={viewingPO}
          suppliers={inv.suppliers}
          items={inv.items}
          onClose={() => setViewingPO(null)}
        />
      )}

      {/* Receive PO */}
      {receivingPO && (
        <ReceivePOModal
          po={receivingPO}
          items={inv.items}
          onClose={() => setReceivingPO(null)}
          onSave={async (data) => {
            await inv.receivePurchaseOrder(receivingPO.id, data);
            setReceivingPO(null);
          }}
        />
      )}

      {/* Log Wastage */}
      {showWastageLog && (
        <WastageLogModal
          items={inv.items.filter((i) => i.isActive)}
          onClose={() => setShowWastageLog(false)}
          onSave={async (itemId, qty, notes) => {
            await inv.adjustStock(itemId, {
              quantity: qty,
              transactionType: StockTransactionType.WASTAGE,
              notes,
            });
            setShowWastageLog(false);
            const txns = await inv.getTransactions();
            setWastageHistory(txns.filter((t) => t.transactionType === StockTransactionType.WASTAGE));
          }}
        />
      )}

      {/* Add Recipe */}
      {showAddRecipe && selectedMenuItemId && (
        <AddRecipeModal
          menuItemId={selectedMenuItemId}
          inventoryItems={inv.items.filter((i) => i.isActive)}
          onClose={() => setShowAddRecipe(false)}
          onSave={async (data) => {
            await inv.createRecipe(data);
            if (selectedMenuItemId) {
              await handleSelectMenuItem(selectedMenuItemId);
            }
            await loadRecipes();
            setShowAddRecipe(false);
          }}
        />
      )}
    </div>
  );
};

export default Inventory;

// ========================
// TAB COMPONENTS
// ========================

// ---------- Stock Overview ----------

interface StockOverviewTabProps {
  items: InventoryItem[];
  allItems: InventoryItem[];
  categories: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (c: string) => void;
  stockFilter: string;
  onStockFilterChange: (f: string) => void;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (item: InventoryItem) => void;
  onAdjustStock: () => void;
}

const StockOverviewTab: React.FC<StockOverviewTabProps> = ({
  items,
  allItems,
  categories,
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  stockFilter,
  onStockFilterChange,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onAdjustStock,
}) => {
  const { t } = useTranslation();

  const columns = [
    {
      header: t('inventory.name'),
      accessor: 'name',
      render: (item: InventoryItem) => (
        <div>
          <div className="font-medium text-gray-900">{item.name}</div>
          {item.sku && <div className="text-xs text-gray-400">{item.sku}</div>}
        </div>
      ),
    },
    { header: t('inventory.category'), accessor: 'category' },
    {
      header: t('inventory.currentStock'),
      accessor: 'currentStock',
      align: 'right' as const,
      render: (item: InventoryItem) => {
        const status = getStockStatus(item);
        return (
          <span
            className={`font-semibold ${
              status === 'out'
                ? 'text-red-600'
                : status === 'low'
                ? 'text-orange-600'
                : 'text-gray-900'
            }`}
          >
            {item.currentStock} {item.unit}
          </span>
        );
      },
    },
    {
      header: t('inventory.minStock'),
      accessor: 'minStock',
      align: 'right' as const,
      render: (item: InventoryItem) => (
        <span className="text-gray-500">
          {item.minStock} {item.unit}
        </span>
      ),
    },
    {
      header: t('inventory.costPerUnit'),
      accessor: 'costPerUnit',
      align: 'right' as const,
      render: (item: InventoryItem) => formatCurrency(item.costPerUnit),
    },
    {
      header: t('inventory.status'),
      accessor: 'status',
      render: (item: InventoryItem) => getStockBadge(getStockStatus(item), t),
    },
    {
      header: t('inventory.actions'),
      accessor: 'actions',
      sortable: false,
      width: '120px',
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditItem(item);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title={t('common.edit')}
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(t('inventory.deleteItemConfirm', { name: item.name }))) onDeleteItem(item);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title={t('common.delete')}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder={t('inventory.searchPlaceholder')}
          onChange={onSearchChange}
          className="w-56"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">{t('inventory.allCategories')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => onStockFilterChange(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">{t('inventory.allStatus')}</option>
          <option value="low">{t('inventory.stockStatusLow')}</option>
          <option value="out">{t('inventory.stockStatusOut')}</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={onAdjustStock}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowDownUp size={11} className="text-gray-500" />
          <span>{t('inventory.stockAdjustment')}</span>
        </button>
        <button
          onClick={onAddItem}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
        >
          <Plus size={11} />
          <span>{t('inventory.addItem')}</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(item) => item.id}
        emptyMessage={t('inventory.noItemsFound')}
      />
    </div>
  );
};

// ---------- Purchase Orders ----------

interface PurchaseOrdersTabProps {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  items: InventoryItem[];
  onCreate: () => void;
  onView: (po: PurchaseOrder) => void;
  onReceive: (po: PurchaseOrder) => void;
}

const PurchaseOrdersTab: React.FC<PurchaseOrdersTabProps> = ({
  purchaseOrders,
  suppliers,
  items,
  onCreate,
  onView,
  onReceive,
}) => {
  const { t } = useTranslation();

  const getSupplierName = (id: number) =>
    suppliers.find((s) => s.id === id)?.name ?? '-';

  const columns = [
    {
      header: t('inventory.poNumber'),
      accessor: 'poNumber',
      render: (po: PurchaseOrder) => (
        <span className="font-semibold text-blue-600">{po.poNumber}</span>
      ),
    },
    {
      header: t('inventory.supplier'),
      accessor: 'supplierId',
      render: (po: PurchaseOrder) => getSupplierName(po.supplierId),
    },
    {
      header: t('inventory.status'),
      accessor: 'status',
      render: (po: PurchaseOrder) => getPOStatusBadge(po.status, t),
    },
    {
      header: t('inventory.items'),
      accessor: 'itemCount',
      align: 'center' as const,
      render: (po: PurchaseOrder) => po.items?.length ?? 0,
    },
    {
      header: t('inventory.totalAmount'),
      accessor: 'totalAmount',
      align: 'right' as const,
      render: (po: PurchaseOrder) => formatCurrency(po.totalAmount),
    },
    {
      header: t('inventory.ordered'),
      accessor: 'orderedAt',
      render: (po: PurchaseOrder) => (po.orderedAt ? formatDate(po.orderedAt) : '-'),
    },
    {
      header: t('inventory.received'),
      accessor: 'receivedAt',
      render: (po: PurchaseOrder) => (po.receivedAt ? formatDate(po.receivedAt) : '-'),
    },
    {
      header: t('inventory.actions'),
      accessor: 'actions',
      sortable: false,
      width: '150px',
      render: (po: PurchaseOrder) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(po);
            }}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title={t('inventory.viewDetails')}
          >
            <Eye size={13} />
          </button>
          {po.status === POStatus.ORDERED && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReceive(po);
              }}
              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title={t('inventory.receive')}
            >
              <CheckCircle2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-900">{t('inventory.purchaseOrders')}</h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
        >
          <Plus size={11} />
          <span>{t('inventory.createPurchaseOrder')}</span>
        </button>
      </div>
      <DataTable
        columns={columns}
        data={purchaseOrders}
        keyExtractor={(po) => po.id}
        emptyMessage={t('inventory.noPOFound')}
      />
    </div>
  );
};

// ---------- Suppliers ----------

interface SuppliersTabProps {
  suppliers: Supplier[];
  onAdd: () => void;
  onEdit: (s: Supplier) => void;
}

const SuppliersTab: React.FC<SuppliersTabProps> = ({ suppliers, onAdd, onEdit }) => {
  const { t } = useTranslation();
  const taxTerms = useTaxTerminology();

  const columns = [
    {
      header: t('inventory.name'),
      accessor: 'name',
      render: (s: Supplier) => <span className="font-semibold text-gray-900">{s.name}</span>,
    },
    { header: t('inventory.phone'), accessor: 'phone' },
    { header: t('inventory.email'), accessor: 'email' },
    { header: taxTerms.businessTaxId, accessor: 'gstin' },
    {
      header: t('inventory.status'),
      accessor: 'isActive',
      render: (s: Supplier) =>
        s.isActive ? (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
            {t('common.active')}
          </span>
        ) : (
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
            {t('common.inactive')}
          </span>
        ),
    },
    {
      header: t('inventory.actions'),
      accessor: 'actions',
      sortable: false,
      width: '80px',
      render: (s: Supplier) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(s);
          }}
          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={t('common.edit')}
        >
          <Edit2 size={13} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-900">{t('inventory.suppliers')}</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
        >
          <Plus size={11} />
          <span>{t('inventory.addSupplier')}</span>
        </button>
      </div>
      <DataTable
        columns={columns}
        data={suppliers}
        keyExtractor={(s) => s.id}
        emptyMessage={t('inventory.noSuppliersFound')}
      />
    </div>
  );
};

// ---------- Recipes ----------

interface RecipesTabProps {
  items?: MenuItem[];
  menuItems?: MenuItem[];
  inventoryItems: InventoryItem[];
  selectedMenuItemId?: number | null;
  recipes: Recipe[];
  onSelectMenuItem?: (itemId: number) => Promise<void> | void;
  onAddRecipe: () => void;
  onDeleteRecipe: (recipe: any) => Promise<void> | void;
}

const RecipesTab: React.FC<RecipesTabProps> = ({
  items: propItems,
  menuItems,
  inventoryItems,
  selectedMenuItemId: propSelectedMenuItemId,
  recipes,
  onSelectMenuItem,
  onAddRecipe,
  onDeleteRecipe,
}) => {
  const items = propItems ?? menuItems ?? [];
  const { t } = useTranslation();
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(null);

  const selectedMenuItemId = propSelectedMenuItemId !== undefined ? propSelectedMenuItemId : internalSelectedId;

  // Auto-select first item on mount or when items change if none selected
  useEffect(() => {
    if (selectedMenuItemId === null && items.length > 0) {
      const firstId = items[0].id;
      if (onSelectMenuItem) {
        onSelectMenuItem(firstId);
      } else {
        setInternalSelectedId(firstId);
      }
    }
  }, [items, selectedMenuItemId, onSelectMenuItem]);

  const handleItemSelect = (id: number) => {
    if (onSelectMenuItem) {
      onSelectMenuItem(id);
    } else {
      setInternalSelectedId(id);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedMenuItemId);
  const itemRecipes = recipes.filter((r) => (r.menuItemId ?? (r as any).menu_item_id) === selectedMenuItemId);

  const totalCost = itemRecipes.reduce((sum, r) => {
    const invId = r.inventoryItemId ?? (r as any).inventory_item_id;
    const inv = invId ? inventoryItems.find((i) => i.id === invId) : undefined;
    const qty = r.quantityUsed ?? (r as any).quantity_used ?? (r as any).quantity ?? 0;
    const unitCost =
      r.costPerUnit ??
      (r as any).cost_per_unit ??
      (inv ? (inv.costPerUnit ?? (inv as any).cost_per_unit ?? (inv as any).costPrice ?? 0) : 0);
    return sum + unitCost * qty;
  }, 0);

  const profitMargin =
    selectedItem && selectedItem.basePrice > 0
      ? ((selectedItem.basePrice - totalCost) / selectedItem.basePrice) * 100
      : 0;

  const foodCostPct =
    selectedItem && selectedItem.basePrice > 0
      ? (totalCost / selectedItem.basePrice) * 100
      : 0;

  const getInvItem = (id: number) => inventoryItems.find((i) => i.id === id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Menu item selector */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-700">{t('inventory.menuItems')}</h3>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {items.map((item) => {
            const hasRecipe = recipes.some((r) => (r.menuItemId ?? (r as any).menu_item_id) === item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleItemSelect(item.id)}
                className={`w-full flex items-center justify-between p-2.5 text-left text-xs transition-colors ${
                  selectedMenuItemId === item.id
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>{item.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    hasRecipe
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {hasRecipe ? t('inventory.recipeConfigured') : t('inventory.noRecipe')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recipe details */}
      <div className="md:col-span-2 space-y-3">
        {selectedItem ? (
          <>
            {/* Cost summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-500 block">{t('inventory.menuPrice')}</span>
                <span className="text-sm font-bold text-gray-900">
                  {formatCurrency(selectedItem.basePrice)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-500 block">{t('inventory.recipeCost')}</span>
                <span className="text-sm font-bold text-blue-600">
                  {formatCurrency(totalCost)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-500 block">{t('inventory.foodCostPercent')}</span>
                <div
                  className={`text-sm font-bold ${
                    foodCostPct > 35
                      ? 'text-red-600'
                      : foodCostPct > 25
                      ? 'text-amber-600'
                      : 'text-green-600'
                  }`}
                >
                  {foodCostPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Recipe ingredients table */}
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700">{t('inventory.ingredients')}</h3>
              <button
                onClick={onAddRecipe}
                className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
              >
                <Plus size={11} />
                <span>{t('inventory.addIngredient')}</span>
              </button>
            </div>

            <DataTable
              columns={[
                {
                  header: t('inventory.ingredient'),
                  accessor: 'inventoryItemId',
                  render: (r: Recipe) => {
                    const invId = r.inventoryItemId ?? (r as any).inventory_item_id;
                    const inv = invId ? getInvItem(invId) : undefined;
                    const name =
                      r.ingredientName ??
                      (r as any).ingredient_name ??
                      inv?.name ??
                      (invId ? `#${invId}` : '—');
                    return <span className="font-semibold text-gray-900">{name}</span>;
                  },
                },
                {
                  header: t('inventory.quantity'),
                  accessor: 'quantityUsed',
                  render: (r: Recipe) => {
                    const invId = r.inventoryItemId ?? (r as any).inventory_item_id;
                    const inv = invId ? getInvItem(invId) : undefined;
                    const qty = r.quantityUsed ?? (r as any).quantity_used ?? (r as any).quantity ?? 0;
                    return `${qty} ${r.unit || r.ingredientUnit || (r as any).ingredient_unit || inv?.unit || ''}`;
                  },
                },
                {
                  header: t('inventory.cost'),
                  accessor: 'cost',
                  render: (r: Recipe) => {
                    const invId = r.inventoryItemId ?? (r as any).inventory_item_id;
                    const inv = invId ? getInvItem(invId) : undefined;
                    const qty = r.quantityUsed ?? (r as any).quantity_used ?? (r as any).quantity ?? 0;
                    const unitCost =
                      r.costPerUnit ??
                      (r as any).cost_per_unit ??
                      (inv ? (inv.costPerUnit ?? (inv as any).cost_per_unit ?? (inv as any).costPrice ?? 0) : 0);
                    return formatCurrency(unitCost * qty);
                  },
                },
                {
                  header: t('inventory.actions'),
                  accessor: 'actions',
                  sortable: false,
                  width: '60px',
                  render: (r: Recipe) => (
                    <button
                      onClick={() => onDeleteRecipe(r.id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  ),
                },
              ]}
              data={itemRecipes}
              keyExtractor={(r) => r.id}
              emptyMessage={t('inventory.noIngredientsConfigured')}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 bg-white rounded-lg border border-gray-200">
            <UtensilsCrossed size={32} className="mb-2" />
            <p className="text-xs">{t('inventory.selectItemForRecipe')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// ---------- Stock Consumption Tab ----------
// ==========================================

interface ConsumptionTabProps {
  getItemStockConsumption: (filters?: { startDate?: string; endDate?: string }) => Promise<ItemStockConsumptionRecord[]>;
  inventoryItems: InventoryItem[];
}

type ConsumptionView = 'item' | 'date' | 'ingredient' | 'ledger';
type DatePreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'all' | 'custom';

const ConsumptionTab: React.FC<ConsumptionTabProps> = ({ getItemStockConsumption }) => {
  const { t } = useTranslation();
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [view, setView] = useState<ConsumptionView>('item');
  const [records, setRecords] = useState<ItemStockConsumptionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let range: { startDate?: string; endDate?: string } = {};
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      if (datePreset === 'today') {
        range = { startDate: todayStr, endDate: todayStr };
      } else if (datePreset === 'yesterday') {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yStr = y.toISOString().split('T')[0];
        range = { startDate: yStr, endDate: yStr };
      } else if (datePreset === 'last7') {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 6);
        range = { startDate: d7.toISOString().split('T')[0], endDate: todayStr };
      } else if (datePreset === 'thisMonth') {
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        range = { startDate: mStart, endDate: todayStr };
      } else if (datePreset === 'custom') {
        range = { startDate: customStart, endDate: customEnd };
      }

      const data = await getItemStockConsumption(range);
      setRecords(data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStart, customEnd, getItemStockConsumption]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter records by search
  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.menuItemName.toLowerCase().includes(q) ||
        r.ingredientName.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        (r.orderNumber && r.orderNumber.toLowerCase().includes(q))
    );
  }, [records, search]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCost = filteredRecords.reduce((sum, r) => sum + r.totalCost, 0);
    const totalPortions = filteredRecords.reduce((sum, r) => sum + (r.portionsSold || 1), 0);
    const uniqueIngredients = new Set(filteredRecords.map((r) => r.inventoryItemId)).size;

    // Top consuming dish
    const dishMap = new Map<string, number>();
    for (const r of filteredRecords) {
      dishMap.set(r.menuItemName, (dishMap.get(r.menuItemName) || 0) + r.totalCost);
    }
    let topDish = '—';
    let topCost = 0;
    for (const [dish, cost] of dishMap.entries()) {
      if (cost > topCost) {
        topCost = cost;
        topDish = dish;
      }
    }

    return { totalCost, totalPortions, uniqueIngredients, topDish, topCost };
  }, [filteredRecords]);

  // Grouping: By Menu Item (Which menu item consumed how many stock)
  const itemGroups = useMemo(() => {
    const map = new Map<string, {
      menuItemId?: number;
      menuItemName: string;
      categoryName: string;
      portionsSold: number;
      totalCost: number;
      ingredients: {
        inventoryItemId: number;
        ingredientName: string;
        unit: string;
        quantityConsumed: number;
        costPerUnit: number;
        totalCost: number;
      }[];
      ordersCount: number;
    }>();

    for (const r of filteredRecords) {
      const key = r.menuItemName;
      let g = map.get(key);
      if (!g) {
        g = {
          menuItemId: r.menuItemId,
          menuItemName: r.menuItemName,
          categoryName: r.categoryName,
          portionsSold: 0,
          totalCost: 0,
          ingredients: [],
          ordersCount: 0,
        };
        map.set(key, g);
      }
      g.totalCost += r.totalCost;
      g.portionsSold += (r.portionsSold || 1);
      g.ordersCount += 1;

      const ing = g.ingredients.find((i) => i.inventoryItemId === r.inventoryItemId);
      if (ing) {
        ing.quantityConsumed += r.quantityConsumed;
        ing.totalCost += r.totalCost;
      } else {
        g.ingredients.push({
          inventoryItemId: r.inventoryItemId,
          ingredientName: r.ingredientName,
          unit: r.unit,
          quantityConsumed: r.quantityConsumed,
          costPerUnit: r.costPerUnit,
          totalCost: r.totalCost,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredRecords]);

  // Grouping: Date-Wise
  const dateGroups = useMemo(() => {
    const map = new Map<string, {
      date: string;
      totalCost: number;
      totalPortions: number;
      dishes: {
        menuItemName: string;
        categoryName: string;
        portionsSold: number;
        cost: number;
        ingredients: { name: string; qty: number; unit: string; cost: number }[];
      }[];
    }>();

    for (const r of filteredRecords) {
      const d = r.date || 'Unknown Date';
      let g = map.get(d);
      if (!g) {
        g = {
          date: d,
          totalCost: 0,
          totalPortions: 0,
          dishes: [],
        };
        map.set(d, g);
      }
      g.totalCost += r.totalCost;
      g.totalPortions += (r.portionsSold || 1);

      let dDish = g.dishes.find((item) => item.menuItemName === r.menuItemName);
      if (!dDish) {
        dDish = {
          menuItemName: r.menuItemName,
          categoryName: r.categoryName,
          portionsSold: 0,
          cost: 0,
          ingredients: [],
        };
        g.dishes.push(dDish);
      }
      dDish.portionsSold += (r.portionsSold || 1);
      dDish.cost += r.totalCost;

      const dIng = dDish.ingredients.find((i) => i.name === r.ingredientName);
      if (dIng) {
        dIng.qty += r.quantityConsumed;
        dIng.cost += r.totalCost;
      } else {
        dDish.ingredients.push({
          name: r.ingredientName,
          qty: r.quantityConsumed,
          unit: r.unit,
          cost: r.totalCost,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecords]);

  // Grouping: By Ingredient
  const ingredientGroups = useMemo(() => {
    const map = new Map<number, {
      inventoryItemId: number;
      ingredientName: string;
      unit: string;
      costPerUnit: number;
      totalQuantity: number;
      totalCost: number;
      dishes: {
        menuItemName: string;
        categoryName: string;
        quantity: number;
        cost: number;
      }[];
    }>();

    for (const r of filteredRecords) {
      let g = map.get(r.inventoryItemId);
      if (!g) {
        g = {
          inventoryItemId: r.inventoryItemId,
          ingredientName: r.ingredientName,
          unit: r.unit,
          costPerUnit: r.costPerUnit,
          totalQuantity: 0,
          totalCost: 0,
          dishes: [],
        };
        map.set(r.inventoryItemId, g);
      }
      g.totalQuantity += r.quantityConsumed;
      g.totalCost += r.totalCost;

      const d = g.dishes.find((item) => item.menuItemName === r.menuItemName);
      if (d) {
        d.quantity += r.quantityConsumed;
        d.cost += r.totalCost;
      } else {
        g.dishes.push({
          menuItemName: r.menuItemName,
          categoryName: r.categoryName,
          quantity: r.quantityConsumed,
          cost: r.totalCost,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [filteredRecords]);

  // CSV Export
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      'Date',
      'Order #',
      'Menu Item',
      'Category',
      'Portions Sold',
      'Ingredient',
      'Quantity Consumed',
      'Unit',
      'Cost per Unit',
      'Total Cost',
    ];
    const rows = filteredRecords.map((r) => [
      r.date,
      r.orderNumber || '',
      `"${r.menuItemName.replace(/"/g, '""')}"`,
      `"${r.categoryName.replace(/"/g, '""')}"`,
      r.portionsSold,
      `"${r.ingredientName.replace(/"/g, '""')}"`,
      r.quantityConsumed,
      r.unit,
      (r.costPerUnit / 100).toFixed(2),
      (r.totalCost / 100).toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `inventory_consumption_${datePreset}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3.5">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-[10px] text-gray-500 block">Total Stock Cost</span>
          <span className="text-base font-bold text-gray-900 block mt-0.5">{formatCurrency(metrics.totalCost)}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Ingredients value consumed</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-[10px] text-gray-500 block">Portions Prepared</span>
          <span className="text-base font-bold text-blue-600 block mt-0.5">{metrics.totalPortions}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Menu items ordered</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-[10px] text-gray-500 block">Ingredients Utilized</span>
          <span className="text-base font-bold text-emerald-600 block mt-0.5">{metrics.uniqueIngredients} items</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">Distinct raw items used</span>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <span className="text-[10px] text-gray-500 block">Top Consuming Dish</span>
          <span className="text-xs font-bold text-amber-600 truncate block mt-0.5" title={metrics.topDish}>
            {metrics.topDish}
          </span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">{formatCurrency(metrics.topCost)} consumed</span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Date range presets */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
            {[
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'last7', label: 'Last 7 Days' },
              { key: 'thisMonth', label: 'This Month' },
              { key: 'all', label: 'All Time' },
              { key: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setDatePreset(p.key as DatePreset)}
                className={`px-2.5 py-1 rounded text-xs transition-all ${
                  datePreset === p.key
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={12} className="text-gray-500" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Custom date range inputs */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500 font-medium">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-0.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-gray-500 font-medium">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-0.5 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Button size="sm" onClick={loadData}>Apply</Button>
          </div>
        )}

        {/* Sub-bar: View Switcher and Search */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-500 mr-1">View:</span>
            {[
              { key: 'item', label: 'By Menu Item' },
              { key: 'date', label: 'Date-Wise' },
              { key: 'ingredient', label: 'By Ingredient' },
              { key: 'ledger', label: 'Detailed Log' },
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key as ConsumptionView)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  view === v.key
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="w-56">
            <SearchInput
              placeholder="Search dish or stock..."
              onChange={setSearch}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-xs text-gray-500">
          Loading consumption data...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-400">
          <BarChart2 size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-xs font-semibold text-gray-700">No stock consumption recorded</p>
          <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
            Stock consumption is automatically tracked when menu items with configured recipes are ordered.
          </p>
        </div>
      ) : view === 'item' ? (
        /* ================== VIEW 1: BY MENU ITEM ================== */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Menu Item</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Portions Sold</th>
                  <th className="py-2.5 px-3">Stock Consumed (Ingredients)</th>
                  <th className="py-2.5 px-3 text-right">Total Stock Cost</th>
                  <th className="py-2.5 px-3 text-right">Avg / Portion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {itemGroups.map((g) => {
                  const isExpanded = expandedRows.has(g.menuItemName);
                  const avgCost = g.portionsSold > 0 ? Math.round(g.totalCost / g.portionsSold) : 0;
                  return (
                    <React.Fragment key={g.menuItemName}>
                      <tr
                        onClick={() => toggleExpand(g.menuItemName)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-blue-600 shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            )}
                            <span>{g.menuItemName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            {g.categoryName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-700">
                          {g.portionsSold} portions
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {g.ingredients.map((ing) => (
                              <span
                                key={ing.inventoryItemId}
                                className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-100"
                              >
                                {ing.ingredientName}: {ing.quantityConsumed} {ing.unit}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900 text-right">
                          {formatCurrency(g.totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-right font-medium">
                          {formatCurrency(avgCost)}
                        </td>
                      </tr>
                      {/* Expanded Ingredient Breakdown Table */}
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={6} className="py-2.5 px-6 border-b border-gray-100">
                            <div className="bg-white rounded-md border border-gray-200 p-2.5 space-y-1.5 shadow-2xs">
                              <span className="text-[11px] font-bold text-gray-700 block">
                                Recipe Stock Breakdown for &ldquo;{g.menuItemName}&rdquo;
                              </span>
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-gray-100 text-gray-500 font-medium">
                                    <th className="py-1">Raw Ingredient</th>
                                    <th className="py-1">Total Quantity Consumed</th>
                                    <th className="py-1 text-right">Cost per Unit</th>
                                    <th className="py-1 text-right">Total Ingredient Cost</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {g.ingredients.map((ing) => (
                                    <tr key={ing.inventoryItemId}>
                                      <td className="py-1 font-semibold text-gray-800">{ing.ingredientName}</td>
                                      <td className="py-1 text-gray-700">
                                        {ing.quantityConsumed} {ing.unit}
                                      </td>
                                      <td className="py-1 text-right text-gray-500">
                                        {formatCurrency(ing.costPerUnit)} / {ing.unit}
                                      </td>
                                      <td className="py-1 text-right font-bold text-blue-600">
                                        {formatCurrency(ing.totalCost)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'date' ? (
        /* ================== VIEW 2: DATE-WISE ================== */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Menu Items Prepared</th>
                  <th className="py-2.5 px-3">Total Portions</th>
                  <th className="py-2.5 px-3">Stock Consumed Summary</th>
                  <th className="py-2.5 px-3 text-right">Day Stock Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dateGroups.map((dg) => {
                  const isExpanded = expandedRows.has(dg.date);
                  return (
                    <React.Fragment key={dg.date}>
                      <tr
                        onClick={() => toggleExpand(dg.date)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-blue-600 shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            )}
                            <Calendar size={13} className="text-gray-400" />
                            <span>{formatDate(dg.date)}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-700">
                          {dg.dishes.length} distinct dishes
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-700">
                          {dg.totalPortions} portions
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {dg.dishes.map((dish) => (
                              <span
                                key={dish.menuItemName}
                                className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium"
                              >
                                {dish.menuItemName} ({dish.portionsSold})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900 text-right">
                          {formatCurrency(dg.totalCost)}
                        </td>
                      </tr>
                      {/* Expanded Date Details */}
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={5} className="py-2.5 px-6 border-b border-gray-100">
                            <div className="bg-white rounded-md border border-gray-200 p-2.5 space-y-2 shadow-2xs">
                              <span className="text-[11px] font-bold text-gray-700 block">
                                Dishes Prepared on {formatDate(dg.date)}
                              </span>
                              <div className="space-y-1.5">
                                {dg.dishes.map((dish) => (
                                  <div
                                    key={dish.menuItemName}
                                    className="p-2 rounded bg-gray-50 border border-gray-100 flex items-center justify-between text-[11px]"
                                  >
                                    <div>
                                      <span className="font-semibold text-gray-900">{dish.menuItemName}</span>
                                      <span className="text-gray-500 ml-2">({dish.portionsSold} portions)</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {dish.ingredients.map((ing) => (
                                          <span
                                            key={ing.name}
                                            className="px-1.5 py-0.2 rounded bg-white text-blue-700 text-[10px] border border-blue-200 font-medium"
                                          >
                                            {ing.name}: {ing.qty} {ing.unit} ({formatCurrency(ing.cost)})
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="font-bold text-gray-900">
                                      {formatCurrency(dish.cost)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'ingredient' ? (
        /* ================== VIEW 3: BY INGREDIENT ================== */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Raw Ingredient</th>
                  <th className="py-2.5 px-3">Unit Cost Rate</th>
                  <th className="py-2.5 px-3">Total Quantity Consumed</th>
                  <th className="py-2.5 px-3">Consumed by Dishes</th>
                  <th className="py-2.5 px-3 text-right">Total Ingredient Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ingredientGroups.map((ig) => {
                  const key = String(ig.inventoryItemId);
                  const isExpanded = expandedRows.has(key);
                  return (
                    <React.Fragment key={ig.inventoryItemId}>
                      <tr
                        onClick={() => toggleExpand(key)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-semibold text-gray-900">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-blue-600 shrink-0" />
                            ) : (
                              <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            )}
                            <Package size={13} className="text-gray-400" />
                            <span>{ig.ingredientName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {formatCurrency(ig.costPerUnit)} / {ig.unit}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-800">
                          {ig.totalQuantity} {ig.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {ig.dishes.map((d) => (
                              <span
                                key={d.menuItemName}
                                className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-100"
                              >
                                {d.menuItemName}: {d.quantity} {ig.unit}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900 text-right">
                          {formatCurrency(ig.totalCost)}
                        </td>
                      </tr>
                      {/* Expanded Ingredient Breakdown */}
                      {isExpanded && (
                        <tr className="bg-gray-50/70">
                          <td colSpan={5} className="py-2.5 px-6 border-b border-gray-100">
                            <div className="bg-white rounded-md border border-gray-200 p-2.5 space-y-1.5 shadow-2xs">
                              <span className="text-[11px] font-bold text-gray-700 block">
                                Menu Items Consuming &ldquo;{ig.ingredientName}&rdquo;
                              </span>
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-gray-100 text-gray-500 font-medium">
                                    <th className="py-1">Menu Item</th>
                                    <th className="py-1">Category</th>
                                    <th className="py-1">Stock Consumed</th>
                                    <th className="py-1 text-right">Value Consumed</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {ig.dishes.map((d) => (
                                    <tr key={d.menuItemName}>
                                      <td className="py-1 font-semibold text-gray-800">{d.menuItemName}</td>
                                      <td className="py-1 text-gray-500">{d.categoryName}</td>
                                      <td className="py-1 font-medium text-gray-700">
                                        {d.quantity} {ig.unit}
                                      </td>
                                      <td className="py-1 text-right font-bold text-emerald-600">
                                        {formatCurrency(d.cost)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================== VIEW 4: DETAILED AUDIT LEDGER ================== */
        <DataTable
          columns={[
            {
              header: 'Date & Time',
              accessor: 'timestamp',
              render: (r: ItemStockConsumptionRecord) => (
                <div>
                  <span className="font-semibold text-gray-900 block">{formatDate(r.date)}</span>
                  <span className="text-[10px] text-gray-400 block">{r.timestamp?.split(' ')[1] || ''}</span>
                </div>
              ),
            },
            {
              header: 'Order #',
              accessor: 'orderNumber',
              render: (r: ItemStockConsumptionRecord) => (
                <span className="font-mono text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                  {r.orderNumber || '—'}
                </span>
              ),
            },
            {
              header: 'Menu Item',
              accessor: 'menuItemName',
              render: (r: ItemStockConsumptionRecord) => (
                <div>
                  <span className="font-semibold text-gray-900 block">{r.menuItemName}</span>
                  <span className="text-[10px] text-gray-400">{r.categoryName}</span>
                </div>
              ),
            },
            {
              header: 'Portions Sold',
              accessor: 'portionsSold',
              render: (r: ItemStockConsumptionRecord) => (
                <span className="text-gray-700 font-medium">{r.portionsSold}</span>
              ),
            },
            {
              header: 'Ingredient',
              accessor: 'ingredientName',
              render: (r: ItemStockConsumptionRecord) => (
                <span className="font-semibold text-gray-900">{r.ingredientName}</span>
              ),
            },
            {
              header: 'Quantity Consumed',
              accessor: 'quantityConsumed',
              render: (r: ItemStockConsumptionRecord) => (
                <span className="font-bold text-gray-800">
                  {r.quantityConsumed} {r.unit}
                </span>
              ),
            },
            {
              header: 'Total Cost',
              accessor: 'totalCost',
              render: (r: ItemStockConsumptionRecord) => (
                <span className="font-bold text-gray-900">{formatCurrency(r.totalCost)}</span>
              ),
            },
          ]}
          data={filteredRecords}
          keyExtractor={(r) => r.transactionId}
          emptyMessage="No stock consumption records found"
        />
      )}
    </div>
  );
};

// ---------- Wastage ----------

interface WastageTabProps {
  items: InventoryItem[];
  history: StockTransaction[];
  onLogWastage: () => void;
}

const WastageTab: React.FC<WastageTabProps> = ({ items: _items, history, onLogWastage }) => {
  const { t } = useTranslation();

  const columns = [
    {
      header: t('inventory.date'),
      accessor: 'createdAt',
      render: (tx: StockTransaction) => formatDate(tx.createdAt),
    },
    {
      header: t('inventory.item'),
      accessor: 'itemName',
      render: (tx: StockTransaction) => (
        <span className="font-semibold text-gray-900">{tx.itemName ?? `#${tx.inventoryItemId}`}</span>
      ),
    },
    {
      header: t('inventory.quantity'),
      accessor: 'quantity',
      render: (tx: StockTransaction) => (
        <span className="font-semibold text-red-600">
          -{tx.quantity} {tx.unit ?? ''}
        </span>
      ),
    },
    {
      header: t('inventory.reason'),
      accessor: 'reason',
      render: (tx: StockTransaction) => (
        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
          {tx.reason || t('inventory.wastage')}
        </span>
      ),
    },
    {
      header: t('inventory.notes'),
      accessor: 'notes',
      render: (tx: StockTransaction) => tx.notes || '-',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-gray-900">{t('inventory.wastageLog')}</h2>
        <button
          onClick={onLogWastage}
          className="flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
        >
          <Plus size={11} />
          <span>{t('inventory.logWastage')}</span>
        </button>
      </div>
      <DataTable
        columns={columns}
        data={history}
        keyExtractor={(tx) => tx.id}
        emptyMessage={t('inventory.noWastageRecords')}
      />
    </div>
  );
};

// ========================
// MODAL COMPONENTS
// ========================

// ---------- Inventory Item Modal ----------

interface InventoryItemModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (data: CreateInventoryItemDTO | UpdateInventoryItemDTO) => Promise<void>;
}

const InventoryItemModal: React.FC<InventoryItemModalProps> = ({ item, onClose, onSave }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(item?.name ?? '');
  const [sku, setSku] = useState(item?.sku ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'kg');
  const [category, setCategory] = useState(item?.category ?? '');
  const [currentStock, setCurrentStock] = useState(String(item?.currentStock ?? '0'));
  const [minStock, setMinStock] = useState(String(item?.minStock ?? ''));
  const [costPerUnit, setCostPerUnit] = useState(
    item ? String(item.costPerUnit / 100) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !minStock || !costPerUnit) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        sku: sku.trim() || undefined,
        unit,
        category: category.trim() || undefined,
        currentStock: Number(currentStock) || 0,
        minStock: Number(minStock),
        costPerUnit: Math.round(Number(costPerUnit) * 100),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item ? t('inventory.editItem') : t('inventory.addItem')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {item ? t('common.update') : t('inventory.addItem')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.name')} *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('inventory.itemNamePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('inventory.sku')}</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={t('inventory.skuPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.unit')} *</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="kg">{t('inventory.units.kg')}</option>
              <option value="g">{t('inventory.units.g')}</option>
              <option value="L">{t('inventory.units.L')}</option>
              <option value="ml">{t('inventory.units.ml')}</option>
              <option value="pcs">{t('inventory.units.pcs')}</option>
              <option value="dozen">{t('inventory.units.dozen')}</option>
              <option value="box">{t('inventory.units.box')}</option>
              <option value="pack">{t('inventory.units.pack')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.category')}</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('inventory.categoryPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {item ? t('inventory.currentStock') : t('inventory.openingStock')}
            </label>
            <input
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0"
              step="0.5"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('inventory.minStock')} *
            </label>
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0"
              step="0.5"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('inventory.costPerUnitLabel')} *
            </label>
            <input
              type="number"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0"
              step="0.01"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ---------- Stock Adjustment Modal ----------

interface StockAdjustmentModalProps {
  items: InventoryItem[];
  onClose: () => void;
  onSave: (itemId: number, adj: StockAdjustmentDTO) => Promise<void>;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  items,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState<StockTransactionType>(StockTransactionType.ADJUSTMENT);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!selectedItemId || !quantity) return;
    setSaving(true);
    try {
      await onSave(Number(selectedItemId), {
        quantity: Number(quantity),
        transactionType: type,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('inventory.stockAdjustment')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {t('inventory.saveAdjustment')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('inventory.item')} *</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(Number(e.target.value) || '')}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">{t('inventory.selectItemOption')}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({t('inventory.currentStockShort', { stock: item.currentStock, unit: item.unit })})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.quantity')} *</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={t('inventory.quantityAdjustPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.type')} *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as StockTransactionType)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value={StockTransactionType.PURCHASE}>{t('inventory.movementType.purchase')}</option>
              <option value={StockTransactionType.ADJUSTMENT}>{t('inventory.movementType.adjustment')}</option>
              <option value={StockTransactionType.WASTAGE}>{t('inventory.movementType.wastage')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={2}
            placeholder={t('inventory.adjustmentReason')}
          />
        </div>
      </div>
    </Modal>
  );
};

// ---------- Supplier Modal ----------

interface SupplierModalProps {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

const SupplierModal: React.FC<SupplierModalProps> = ({ supplier, onClose, onSave }) => {
  const { t } = useTranslation();
  const taxTerms = useTaxTerminology();
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [gstin, setGstin] = useState(supplier?.gstin ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() || undefined,
        address: address.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={supplier ? t('inventory.editSupplier') : t('inventory.addSupplier')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {supplier ? t('common.update') : t('inventory.addSupplier')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.name')} *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('inventory.supplierNamePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('inventory.phone')}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={t('inventory.phonePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('inventory.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={t('inventory.emailPlaceholder')}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{taxTerms.businessTaxId}</label>
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder={t('inventory.gstinPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('inventory.address')}</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
};

// ---------- Create PO Modal ----------

interface CreatePOModalProps {
  suppliers: Supplier[];
  items: InventoryItem[];
  onClose: () => void;
  onSave: (data: CreatePODTO) => Promise<void>;
}

interface POLineItem {
  inventoryItemId: number;
  quantity: number;
  unitCost: number;
}

const CreatePOModal: React.FC<CreatePOModalProps> = ({
  suppliers,
  items,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<POLineItem[]>([
    { inventoryItemId: 0, quantity: 0, unitCost: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addLine = () => {
    setLineItems([...lineItems, { inventoryItemId: 0, quantity: 0, unitCost: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof POLineItem, value: number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const total = lineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);

  const handleSubmit = async () => {
    if (!supplierId || lineItems.some((li) => !li.inventoryItemId || !li.quantity)) return;
    setSaving(true);
    try {
      await onSave({
        supplierId: Number(supplierId),
        notes: notes.trim() || undefined,
        items: lineItems.map((li) => ({
          inventoryItemId: li.inventoryItemId,
          quantity: li.quantity,
          unitCost: Math.round(li.unitCost * 100),
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('inventory.createPurchaseOrder')}
      size="xl"
      footer={
        <>
          <div className="flex-1 text-left">
            <span className="text-xs text-gray-500">{t('inventory.totalLabel')}</span>
            <span className="text-sm font-bold text-gray-900 ml-1">
              {formatCurrency(Math.round(total * 100))}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {t('inventory.createPurchaseOrder')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('inventory.supplier')} *</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(Number(e.target.value) || '')}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">{t('inventory.selectSupplierOption')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Line items */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('inventory.items')} *</label>
          <div className="space-y-1.5">
            {lineItems.map((li, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={li.inventoryItemId || ''}
                  onChange={(e) =>
                    updateLine(idx, 'inventoryItemId', Number(e.target.value))
                  }
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">{t('inventory.selectItemPlaceholder')}</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder={t('common.qty')}
                  value={li.quantity || ''}
                  onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  min="0"
                />
                <input
                  type="number"
                  placeholder={t('inventory.costRs')}
                  value={li.unitCost || ''}
                  onChange={(e) => updateLine(idx, 'unitCost', Number(e.target.value))}
                  className="w-24 px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  min="0"
                  step="0.01"
                />
                <span className="text-xs font-semibold text-gray-700 w-20 text-right">
                  {formatCurrency(Math.round(li.quantity * li.unitCost * 100))}
                </span>
                <button
                  onClick={() => removeLine(idx)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                  disabled={lineItems.length <= 1}
                >
                  <XCircle size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={addLine} className="mt-1.5">
            <Plus size={12} /> {t('inventory.addItem')}
          </Button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
};

// ---------- View PO Modal ----------

interface ViewPOModalProps {
  po: PurchaseOrder;
  suppliers: Supplier[];
  items: InventoryItem[];
  onClose: () => void;
}

const ViewPOModal: React.FC<ViewPOModalProps> = ({ po, suppliers, items, onClose }) => {
  const { t } = useTranslation();
  const supplierName = suppliers.find((s) => s.id === po.supplierId)?.name ?? '-';
  const getItemName = (id: number) =>
    items.find((i) => i.id === id)?.name ?? t('inventory.itemNumberFallback', { id });

  return (
    <Modal isOpen onClose={onClose} title={t('inventory.purchaseOrderTitle', { number: po.poNumber })} size="xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-500">{t('inventory.supplier')}:</span>{' '}
            <span className="font-semibold text-gray-900">{supplierName}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('inventory.status')}:</span> {getPOStatusBadge(po.status, t)}
          </div>
          <div>
            <span className="text-gray-500">{t('inventory.ordered')}:</span>{' '}
            {po.orderedAt ? formatDate(po.orderedAt) : '-'}
          </div>
          <div>
            <span className="text-gray-500">{t('inventory.received')}:</span>{' '}
            {po.receivedAt ? formatDate(po.receivedAt) : '-'}
          </div>
        </div>

        {po.notes && (
          <div className="text-xs">
            <span className="text-gray-500">{t('inventory.notesLabel')}</span> {po.notes}
          </div>
        )}

        <DataTable
          columns={[
            {
              header: t('inventory.item'),
              accessor: 'inventoryItemId',
              render: (item: POItem) => getItemName(item.inventoryItemId),
            },
            { header: t('inventory.quantity'), accessor: 'quantity', align: 'right' as const },
            {
              header: t('inventory.unitCost'),
              accessor: 'unitCost',
              align: 'right' as const,
              render: (item: POItem) => formatCurrency(item.unitCost),
            },
            {
              header: t('inventory.totalCost'),
              accessor: 'total',
              align: 'right' as const,
              render: (item: POItem) => formatCurrency(item.quantity * item.unitCost),
            },
            {
              header: t('inventory.receivedQty'),
              accessor: 'receivedQty',
              align: 'right' as const,
            },
          ]}
          data={po.items ?? []}
          keyExtractor={(item) => item.id}
        />

        <div className="text-right pt-2 border-t border-gray-200">
          <span className="text-gray-500 text-xs">{t('inventory.totalLabel')}</span>
          <span className="text-sm font-bold text-gray-900 ml-1">{formatCurrency(po.totalAmount)}</span>
        </div>
      </div>
    </Modal>
  );
};

// ---------- Receive PO Modal ----------

interface ReceivePOModalProps {
  po: PurchaseOrder;
  items: InventoryItem[];
  onClose: () => void;
  onSave: (data: { items: { poItemId: number; receivedQty: number }[] }) => Promise<void>;
}

const ReceivePOModal: React.FC<ReceivePOModalProps> = ({ po, items, onClose, onSave }) => {
  const { t } = useTranslation();
  const getItemName = (id: number) =>
    items.find((i) => i.id === id)?.name ?? t('inventory.itemNumberFallback', { id });
  const [receivedQtys, setReceivedQtys] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    (po.items ?? []).forEach((item) => {
      map[item.id] = item.quantity; // default to ordered qty
    });
    return map;
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave({
        items: Object.entries(receivedQtys).map(([id, qty]) => ({
          poItemId: Number(id),
          receivedQty: qty,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('inventory.receivePOTitle', { number: po.poNumber })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="success" size="sm" onClick={handleSubmit} loading={saving}>
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          {t('inventory.receiveInstructions')}
        </p>
        {(po.items ?? []).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100"
          >
            <div className="flex-1">
              <div className="font-semibold text-gray-900 text-xs">
                {getItemName(item.inventoryItemId)}
              </div>
              <div className="text-[10px] text-gray-400">
                {t('inventory.receiveOrderedReceived', { ordered: item.quantity, received: item.receivedQty })}
              </div>
            </div>
            <input
              type="number"
              value={receivedQtys[item.id] ?? 0}
              onChange={(e) =>
                setReceivedQtys({ ...receivedQtys, [item.id]: Number(e.target.value) })
              }
              className="w-20 px-2.5 py-1 text-xs border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0"
              max={item.quantity}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
};

// ---------- Wastage Log Modal ----------

interface WastageLogModalProps {
  items: InventoryItem[];
  onClose: () => void;
  onSave: (itemId: number, quantity: number, notes: string) => Promise<void>;
}

const WastageLogModal: React.FC<WastageLogModalProps> = ({ items, onClose, onSave }) => {
  const { t } = useTranslation();
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!selectedItemId || !quantity) return;
    setSaving(true);
    try {
      await onSave(Number(selectedItemId), Number(quantity), notes.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('inventory.logWastage')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleSubmit} loading={saving}>
            {t('inventory.logWastage')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">{t('inventory.item')} *</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(Number(e.target.value) || '')}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">{t('inventory.selectItemOption')}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({t('inventory.stockShort', { stock: item.currentStock, unit: item.unit })})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {t('inventory.quantityWasted')} *
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            min="0"
            step="0.5"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {t('inventory.reason')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={2}
            placeholder={t('inventory.wastageReasonPlaceholder')}
          />
        </div>
      </div>
    </Modal>
  );
};

// ---------- Add Recipe Modal ----------

interface AddRecipeModalProps {
  menuItemId: number;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSave: (data: CreateRecipeDTO) => Promise<void>;
}

const AddRecipeModal: React.FC<AddRecipeModalProps> = ({
  menuItemId,
  inventoryItems,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [unit, setUnit] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-fill unit from selected inventory item
  const selectedInvItem = inventoryItems.find((i) => i.id === Number(selectedItemId));

  const handleItemChange = (id: number) => {
    setSelectedItemId(id);
    const inv = inventoryItems.find((i) => i.id === id);
    if (inv) setUnit(inv.unit);
  };

  const handleSubmit = async () => {
    if (!selectedItemId || !quantityUsed) return;
    setSaving(true);
    try {
      await onSave({
        menuItemId,
        inventoryItemId: Number(selectedItemId),
        quantityUsed: Number(quantityUsed),
        unit: unit || selectedInvItem?.unit || 'g',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('inventory.addIngredient')}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {t('inventory.addIngredient')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {t('inventory.inventoryItem')} *
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => handleItemChange(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">{t('inventory.selectIngredientOption')}</option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit}) - {formatCurrency(item.costPerUnit)}{t('inventory.perUnit')}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {t('inventory.quantityUsed')} *
            </label>
            <input
              type="number"
              value={quantityUsed}
              onChange={(e) => setQuantityUsed(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{t('common.unit')}</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder={t('inventory.unitPlaceholder')}
            />
          </div>
        </div>
        {selectedInvItem && quantityUsed && (
          <div className="bg-blue-50 rounded-md px-3 py-2 text-xs">
            <span className="text-gray-600">{t('inventory.ingredientCostLabel')}</span>
            <span className="font-bold text-gray-900 ml-1">
              {formatCurrency(Number(quantityUsed) * selectedInvItem.costPerUnit)}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
};
