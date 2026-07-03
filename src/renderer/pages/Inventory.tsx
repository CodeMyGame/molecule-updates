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
  ClipboardList,
  ArrowDownUp,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import DataTable from '../components/common/DataTable';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import SearchInput from '../components/common/SearchInput';
import { useInventory } from '../hooks/useInventory';
import { useTaxTerminology } from '../hooks/useTaxTerminology';
import { useMenu, type MenuItem } from '../hooks/useMenu';
import { formatCurrency, formatDate, formatDateTime } from '../lib/formatters';
import { StockTransactionType, POStatus } from '../../shared/enums';
import type {
  InventoryItem,
  Supplier,
  PurchaseOrder,
  POItem,
  StockTransaction,
  Recipe,
} from '../../shared/types/inventory.types';
import type {
  CreateInventoryItemDTO,
  UpdateInventoryItemDTO,
  StockAdjustmentDTO,
  CreateSupplierDTO,
  CreatePODTO,
  CreateRecipeDTO,
} from '../hooks/useInventory';

// ---------- Tab definitions ----------

type TabKey = 'stock' | 'purchaseOrders' | 'suppliers' | 'recipes' | 'wastage';

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

  // Fetch recipes when menu item selected
  const handleSelectMenuItem = useCallback(
    async (itemId: number) => {
      setSelectedMenuItemId(itemId);
      const r = await inv.getRecipesByItem(itemId);
      setRecipes(r);
    },
    [inv.getRecipesByItem]
  );

  // ============= RENDER =============

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <Package size={24} className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('inventory.pageTitle')}</h1>
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
              <AlertTriangle size={14} />
              {t('inventory.lowStockBadge', { count: lowStockCount })}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 bg-white border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSearchQuery('');
            }}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg
              transition-colors border-b-2
              ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
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
            menuItems={menu.items}
            inventoryItems={inv.items}
            selectedMenuItemId={selectedMenuItemId}
            recipes={recipes}
            onSelectMenuItem={handleSelectMenuItem}
            onAddRecipe={() => setShowAddRecipe(true)}
            onDeleteRecipe={async (id) => {
              await inv.deleteRecipe(id);
              if (selectedMenuItemId) handleSelectMenuItem(selectedMenuItemId);
            }}
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
            handleSelectMenuItem(selectedMenuItemId);
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder={t('inventory.searchPlaceholder')}
          onChange={onSearchChange}
          className="w-64"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="all">{t('inventory.allStatus')}</option>
          <option value="low">{t('inventory.stockStatusLow')}</option>
          <option value="out">{t('inventory.stockStatusOut')}</option>
        </select>
        <div className="flex-1" />
        <Button
          variant="secondary"
          icon={<ArrowDownUp size={16} />}
          onClick={onAdjustStock}
        >
          {t('inventory.stockAdjustment')}
        </Button>
        <Button icon={<Plus size={16} />} onClick={onAddItem}>
          {t('inventory.addItem')}
        </Button>
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
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title={t('inventory.viewDetails')}
          >
            <Eye size={15} />
          </button>
          {po.status === POStatus.ORDERED && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReceive(po);
              }}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
              title={t('inventory.receive')}
            >
              <CheckCircle2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t('inventory.purchaseOrders')}</h2>
        <Button icon={<Plus size={16} />} onClick={onCreate}>
          {t('inventory.createPurchaseOrder')}
        </Button>
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
      render: (s: Supplier) => <span className="font-medium text-gray-900">{s.name}</span>,
    },
    { header: t('inventory.phone'), accessor: 'phone' },
    { header: t('inventory.email'), accessor: 'email' },
    { header: taxTerms.businessTaxId, accessor: 'gstin' },
    {
      header: t('inventory.status'),
      accessor: 'isActive',
      render: (s: Supplier) =>
        s.isActive ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            {t('common.active')}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
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
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title={t('common.edit')}
        >
          <Edit2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t('inventory.suppliers')}</h2>
        <Button icon={<Plus size={16} />} onClick={onAdd}>
          {t('inventory.addSupplier')}
        </Button>
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
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  selectedMenuItemId: number | null;
  recipes: Recipe[];
  onSelectMenuItem: (id: number) => void;
  onAddRecipe: () => void;
  onDeleteRecipe: (id: number) => void;
}

const RecipesTab: React.FC<RecipesTabProps> = ({
  menuItems,
  inventoryItems,
  selectedMenuItemId,
  recipes,
  onSelectMenuItem,
  onAddRecipe,
  onDeleteRecipe,
}) => {
  const { t } = useTranslation();
  const getInvItem = (id: number) => inventoryItems.find((i) => i.id === id);
  const selectedItem = menuItems.find((m) => m.id === selectedMenuItemId);

  const totalFoodCost = recipes.reduce((sum, r) => {
    const invItem = getInvItem(r.inventoryItemId);
    return sum + (invItem ? r.quantityUsed * invItem.costPerUnit : 0);
  }, 0);

  const sellingPrice = selectedItem?.basePrice ?? 0;
  const foodCostPct = sellingPrice > 0 ? (totalFoodCost / sellingPrice) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-800">{t('inventory.recipeManagement')}</h2>
      </div>

      {/* Menu item selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('inventory.selectMenuItem')}
        </label>
        <select
          value={selectedMenuItemId ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id) onSelectMenuItem(id);
          }}
          className="w-full max-w-md px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">{t('inventory.selectMenuItemOption')}</option>
          {menuItems.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.shortCode ? `(${m.shortCode})` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedMenuItemId && (
        <>
          {/* Cost summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">{t('inventory.sellingPrice')}</div>
              <div className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(sellingPrice)}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">{t('inventory.foodCost')}</div>
              <div className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalFoodCost)}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">{t('inventory.foodCostPct')}</div>
              <div
                className={`text-xl font-bold mt-1 ${
                  foodCostPct > 35 ? 'text-red-600' : foodCostPct > 25 ? 'text-orange-600' : 'text-green-600'
                }`}
              >
                {foodCostPct.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Recipe ingredients table */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{t('inventory.ingredients')}</h3>
            <Button size="sm" icon={<Plus size={14} />} onClick={onAddRecipe}>
              {t('inventory.addIngredient')}
            </Button>
          </div>

          <DataTable
            columns={[
              {
                header: t('inventory.ingredient'),
                accessor: 'inventoryItemId',
                render: (r: Recipe) => {
                  const inv = getInvItem(r.inventoryItemId);
                  return inv?.name ?? t('inventory.itemNumberFallback', { id: r.inventoryItemId });
                },
              },
              {
                header: t('inventory.quantity'),
                accessor: 'quantityUsed',
                align: 'right' as const,
                render: (r: Recipe) => `${r.quantityUsed} ${r.unit}`,
              },
              {
                header: t('inventory.unitCost'),
                accessor: 'unitCost',
                align: 'right' as const,
                render: (r: Recipe) => {
                  const inv = getInvItem(r.inventoryItemId);
                  return inv ? formatCurrency(inv.costPerUnit) : '-';
                },
              },
              {
                header: t('inventory.totalCost'),
                accessor: 'totalCost',
                align: 'right' as const,
                render: (r: Recipe) => {
                  const inv = getInvItem(r.inventoryItemId);
                  return inv ? formatCurrency(r.quantityUsed * inv.costPerUnit) : '-';
                },
              },
              {
                header: '',
                accessor: 'actions',
                sortable: false,
                width: '60px',
                render: (r: Recipe) => (
                  <button
                    onClick={() => {
                      if (confirm(t('inventory.removeIngredientConfirm'))) onDeleteRecipe(r.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                ),
              },
            ]}
            data={recipes}
            keyExtractor={(r) => r.id}
            emptyMessage={t('inventory.noIngredientsAdded')}
          />
        </>
      )}
    </div>
  );
};

// ---------- Wastage ----------

interface WastageTabProps {
  history: StockTransaction[];
  items: InventoryItem[];
  onLogWastage: () => void;
}

const WastageTab: React.FC<WastageTabProps> = ({ history, items, onLogWastage }) => {
  const { t } = useTranslation();
  const getName = (id: number) =>
    items.find((i) => i.id === id)?.name ?? t('inventory.itemNumberFallback', { id });
  const getUnit = (id: number) => items.find((i) => i.id === id)?.unit ?? '';

  const columns = [
    {
      header: t('inventory.date'),
      accessor: 'createdAt',
      render: (tx: StockTransaction) => formatDateTime(tx.createdAt),
    },
    {
      header: t('inventory.item'),
      accessor: 'inventoryItemId',
      render: (tx: StockTransaction) => (
        <span className="font-medium text-gray-900">{getName(tx.inventoryItemId)}</span>
      ),
    },
    {
      header: t('inventory.quantity'),
      accessor: 'quantity',
      align: 'right' as const,
      render: (tx: StockTransaction) => (
        <span className="text-red-600 font-semibold">
          -{Math.abs(tx.quantity)} {getUnit(tx.inventoryItemId)}
        </span>
      ),
    },
    {
      header: t('inventory.reason'),
      accessor: 'notes',
      render: (tx: StockTransaction) => tx.notes || '-',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t('inventory.wastageLog')}</h2>
        <Button icon={<Plus size={16} />} onClick={onLogWastage}>
          {t('inventory.logWastage')}
        </Button>
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
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {item ? t('common.update') : t('inventory.addItem')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder={t('inventory.itemNamePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.sku')}</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('inventory.skuPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.unit')} *</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.category')}</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder={t('inventory.categoryPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {item ? t('inventory.currentStock') : t('inventory.openingStock')}
            </label>
            <input
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              min="0"
              step="0.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('inventory.minStock')} *
            </label>
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              min="0"
              step="0.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('inventory.costPerUnitLabel')} *
            </label>
            <input
              type="number"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {t('inventory.saveAdjustment')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.item')} *</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(Number(e.target.value) || '')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">{t('inventory.selectItemOption')}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({t('inventory.currentStockShort', { stock: item.currentStock, unit: item.unit })})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.quantity')} *</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('inventory.quantityAdjustPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.type')} *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as StockTransactionType)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value={StockTransactionType.PURCHASE}>{t('inventory.movementType.purchase')}</option>
              <option value={StockTransactionType.ADJUSTMENT}>{t('inventory.movementType.adjustment')}</option>
              <option value={StockTransactionType.WASTAGE}>{t('inventory.movementType.wastage')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
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
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {supplier ? t('common.update') : t('inventory.addSupplier')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder={t('inventory.supplierNamePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.phone')}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('inventory.phonePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('inventory.emailPlaceholder')}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{taxTerms.businessTaxId}</label>
          <input
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder={t('inventory.gstinPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.address')}</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
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
            <span className="text-sm text-gray-500">{t('inventory.totalLabel')}</span>
            <span className="text-lg font-bold text-gray-900">
              {formatCurrency(Math.round(total * 100))}
            </span>
          </div>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {t('inventory.createPurchaseOrder')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.supplier')} *</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(Number(e.target.value) || '')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('inventory.items')} *</label>
          <div className="space-y-2">
            {lineItems.map((li, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={li.inventoryItemId || ''}
                  onChange={(e) =>
                    updateLine(idx, 'inventoryItemId', Number(e.target.value))
                  }
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                  className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  min="0"
                />
                <input
                  type="number"
                  placeholder={t('inventory.costRs')}
                  value={li.unitCost || ''}
                  onChange={(e) => updateLine(idx, 'unitCost', Number(e.target.value))}
                  className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  min="0"
                  step="0.01"
                />
                <span className="text-sm text-gray-500 w-24 text-right">
                  {formatCurrency(Math.round(li.quantity * li.unitCost * 100))}
                </span>
                <button
                  onClick={() => removeLine(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                  disabled={lineItems.length <= 1}
                >
                  <XCircle size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={addLine} className="mt-2">
            <Plus size={14} /> {t('inventory.addItem')}
          </Button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
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
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('inventory.supplier')}:</span>{' '}
            <span className="font-medium">{supplierName}</span>
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
          <div className="text-sm">
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
          <span className="text-gray-500 text-sm">{t('inventory.totalLabel')}</span>
          <span className="text-lg font-bold">{formatCurrency(po.totalAmount)}</span>
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
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="success" onClick={handleSubmit} loading={saving}>
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          {t('inventory.receiveInstructions')}
        </p>
        {(po.items ?? []).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 py-2 border-b border-gray-100"
          >
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">
                {getItemName(item.inventoryItemId)}
              </div>
              <div className="text-xs text-gray-400">
                {t('inventory.receiveOrderedReceived', { ordered: item.quantity, received: item.receivedQty })}
              </div>
            </div>
            <input
              type="number"
              value={receivedQtys[item.id] ?? 0}
              onChange={(e) =>
                setReceivedQtys({ ...receivedQtys, [item.id]: Number(e.target.value) })
              }
              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleSubmit} loading={saving}>
            {t('inventory.logWastage')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventory.item')} *</label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(Number(e.target.value) || '')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('inventory.quantityWasted')} *
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            min="0"
            step="0.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('inventory.reason')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
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
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {t('inventory.addIngredient')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('inventory.inventoryItem')} *
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => handleItemChange(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">{t('inventory.selectIngredientOption')}</option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit}) - {formatCurrency(item.costPerUnit)}{t('inventory.perUnit')}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('inventory.quantityUsed')} *
            </label>
            <input
              type="number"
              value={quantityUsed}
              onChange={(e) => setQuantityUsed(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.unit')}</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={t('inventory.unitPlaceholder')}
            />
          </div>
        </div>
        {selectedInvItem && quantityUsed && (
          <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
            <span className="text-gray-600">{t('inventory.ingredientCostLabel')}</span>
            <span className="font-bold text-gray-900">
              {formatCurrency(Number(quantityUsed) * selectedInvItem.costPerUnit)}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
};
