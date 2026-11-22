import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  LayoutGrid,
  List,
  ToggleLeft,
  ToggleRight,
  Upload,
  Download,
  Package,
  Leaf,
  Circle,
  FolderPlus,
  Image as ImageIcon,
  X,
  Loader2,
  PlusCircle,
  Check,
  QrCode,
  SlidersHorizontal,
  AlertCircle,
  CheckCircle2,
  UtensilsCrossed,
  Tag,
} from 'lucide-react';
import {
  useMenu,
  MenuCategory,
  MenuItem,
  Variation,
  Addon,
  AddonGroup,
  Combo,
} from '../hooks/useMenu';
import toast from 'react-hot-toast';
import { formatCurrency } from '../lib/formatters';
import { ipc } from '../lib/ipc';
import { useSettings } from '../hooks/useSettings';
import {
  getTaxLocalePresetForLanguage,
  getTaxRegionForLanguage,
} from '../lib/taxLocalePresets';
import { getEffectiveTaxConfigForRegion } from '../lib/taxConfigByRegion';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';

type ActiveTab = 'items' | 'combos' | 'addons';
type ViewMode = 'list' | 'grid';
type SortField = 'name' | 'basePrice' | 'categoryId';
type SortDir = 'asc' | 'desc';
type StockFilter = 'all' | 'in_stock' | 'out_of_stock';
type DietFilter = 'all' | 'veg' | 'nonveg';

const KITCHEN_STATION_DEFS: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'menu.stationNone' },
  { value: 'main_kitchen', labelKey: 'kitchen.stationMainKitchen' },
  { value: 'tandoor', labelKey: 'kitchen.stationTandoor' },
  { value: 'bar', labelKey: 'kitchen.stationBar' },
  { value: 'dessert', labelKey: 'kitchen.stationDessert' },
];

interface ItemFormData {
  name: string;
  shortCode: string;
  categoryId: number | null;
  basePrice: string; // rupees string, converted to paise on save
  taxRate: string;
  isVeg: boolean;
  isAvailable: boolean;
  imagePath: string;
  station: string;
}

const defaultItemForm: ItemFormData = {
  name: '',
  shortCode: '',
  categoryId: null,
  basePrice: '',
  taxRate: '0',
  isVeg: true,
  isAvailable: true,
  imagePath: '',
  station: '',
};

const MenuManagement: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { settings, fetchSettings } = useSettings();

  const {
    categories,
    items,
    filteredItems,
    selectedCategoryId,
    searchQuery,
    loading,
    error,
    setSelectedCategoryId,
    setSearchQuery,
    refetch,
    createCategory,
    updateCategory,
    deleteCategory,
    createItem,
    updateItem,
    deleteItem,
    toggleAvailability,
    getVariations,
    createVariation,
    updateVariation,
    deleteVariation,
    getAddonGroups,
    createAddonGroup,
    deleteAddonGroup,
    createAddon,
    deleteAddon,
    getItemAddonGroupIds,
    linkAddonGroupToItem,
    unlinkAddonGroupFromItem,
    getCombos,
    createCombo,
    updateCombo,
    deleteCombo,
  } = useMenu();

  useEffect(() => {
    void fetchSettings(['default_tax_rate', 'tax_inclusive']);
  }, [fetchSettings, i18n.language]);

  // Tab, view, sort state
  const [activeTab, setActiveTab] = useState<ActiveTab>('items');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Enterprise Quick Filter states
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [categorySearch, setCategorySearch] = useState<string>('');

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [showComboModal, setShowComboModal] = useState(false);

  // Form state
  const [itemForm, setItemForm] = useState<ItemFormData>(defaultItemForm);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [saving, setSaving] = useState(false);

  // Bulk selection
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());

  // Variations state
  const [variationsItem, setVariationsItem] = useState<MenuItem | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [newVariationName, setNewVariationName] = useState('');
  const [newVariationPrice, setNewVariationPrice] = useState('');
  const [editingVariationId, setEditingVariationId] = useState<number | null>(null);
  const [editingVariationName, setEditingVariationName] = useState('');
  const [editingVariationPrice, setEditingVariationPrice] = useState('');

  // Addon groups
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [expandedAddonId, setExpandedAddonId] = useState<number | null>(null);
  const [allVariationNames, setAllVariationNames] = useState<string[]>([]);
  const [addonVarPrices, setAddonVarPrices] = useState<Record<string, string>>({});
  const [editAddonName, setEditAddonName] = useState('');
  const [editAddonPrice, setEditAddonPrice] = useState('');

  // Item addons assignment modal
  const [showItemAddonsModal, setShowItemAddonsModal] = useState(false);
  const [itemAddonsItem, setItemAddonsItem] = useState<MenuItem | null>(null);
  const [allAddonGroups, setAllAddonGroups] = useState<AddonGroup[]>([]);
  const [itemAddonGroupIds, setItemAddonGroupIds] = useState<Set<number>>(new Set());

  // Combos
  const [combos, setCombos] = useState<Combo[]>([]);
  const [comboName, setComboName] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [comboItems, setComboItems] = useState<{ menuItemId: number; quantity: number }[]>([]);
  const [comboItemSearch, setComboItemSearch] = useState('');
  const [editingComboId, setEditingComboId] = useState<number | null>(null);

  // Tax Preset
  const menuTaxPreset = getTaxLocalePresetForLanguage(i18n.language);

  // Executive Catalog Metrics
  const catalogStats = useMemo(() => {
    const total = items.length;
    const inStock = items.filter((i) => i.isAvailable !== false).length;
    const outOfStock = total - inStock;
    const vegCount = items.filter((i) => i.isVeg).length;
    const nonVegCount = total - vegCount;
    return {
      total,
      inStock,
      outOfStock,
      vegCount,
      nonVegCount,
      categoriesCount: categories.length,
      combosCount: combos.length,
      addonGroupsCount: addonGroups.length,
    };
  }, [items, categories.length, combos.length, addonGroups.length]);

  // Categories filtered by search
  const filteredCategoriesList = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  // Sorted & Multi-filtered items
  const sortedItems = useMemo(() => {
    let arr = [...filteredItems];

    if (stockFilter === 'in_stock') {
      arr = arr.filter((i) => i.isAvailable !== false);
    } else if (stockFilter === 'out_of_stock') {
      arr = arr.filter((i) => i.isAvailable === false);
    }

    if (dietFilter === 'veg') {
      arr = arr.filter((i) => i.isVeg);
    } else if (dietFilter === 'nonveg') {
      arr = arr.filter((i) => !i.isVeg);
    }

    if (stationFilter !== 'all') {
      arr = arr.filter((i) => (i.station || '') === stationFilter);
    }

    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'basePrice') cmp = a.basePrice - b.basePrice;
      else if (sortField === 'categoryId') cmp = a.categoryId - b.categoryId;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return arr;
  }, [filteredItems, stockFilter, dietFilter, stationFilter, sortField, sortDir]);

  const getCategoryName = (catId: number) =>
    categories.find((c) => c.id === catId)?.name ?? t('menuMgmt.uncategorized');

  const getStationLabel = (station?: string) => {
    const def = KITCHEN_STATION_DEFS.find((s) => s.value === station);
    return def ? t(def.labelKey) : (station ?? '');
  };

  const getStationBadgeColor = (station?: string) => {
    switch (station) {
      case 'main_kitchen':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60';
      case 'tandoor':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60';
      case 'bar':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60';
      case 'dessert':
        return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800/60';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  // --- Category handlers ---

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return;
    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory({ id: editingCategory.id, name: categoryName.trim() });
      } else {
        await createCategory({ name: categoryName.trim() });
      }
      setShowCategoryModal(false);
    } catch {
      // handled by hook
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (cat: MenuCategory) => {
    const catItems = items.filter((i) => i.categoryId === cat.id);
    if (catItems.length > 0) {
      alert(t('menuMgmt.cannotDeleteCategory', { name: cat.name, count: catItems.length }));
      return;
    }
    try {
      await deleteCategory(cat.id);
    } catch {
      // handled by hook
    }
  };

  // --- Item handlers ---

  const openAddItem = () => {
    setEditingItem(null);
    const defRate = settings.default_tax_rate ?? menuTaxPreset.defaultRate;
    setItemForm({
      ...defaultItemForm,
      categoryId: selectedCategoryId,
      taxRate: defRate,
    });
    setShowItemModal(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      shortCode: item.shortCode ?? '',
      categoryId: item.categoryId,
      basePrice: String(item.basePrice / 100),
      taxRate: String(item.taxRate),
      isVeg: item.isVeg,
      isAvailable: item.isAvailable !== false,
      imagePath: item.imagePath ?? '',
      station: item.station ?? '',
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.categoryId) return;
    setSaving(true);
    const priceInPaise = Math.round(parseFloat(itemForm.basePrice || '0') * 100);
    const taxRate = Math.min(menuTaxPreset.maxRate, Math.max(0, parseFloat(itemForm.taxRate || '0')));

    try {
      if (editingItem) {
        await updateItem({
          id: editingItem.id,
          name: itemForm.name.trim(),
          shortCode: itemForm.shortCode.trim() || undefined,
          categoryId: itemForm.categoryId!,
          basePrice: priceInPaise,
          taxRate: taxRate,
          isVeg: itemForm.isVeg,
          isAvailable: itemForm.isAvailable,
          imagePath: itemForm.imagePath || undefined,
          station: itemForm.station || undefined,
        });
      } else {
        await createItem({
          name: itemForm.name.trim(),
          shortCode: itemForm.shortCode.trim() || undefined,
          categoryId: itemForm.categoryId!,
          basePrice: priceInPaise,
          taxRate: taxRate,
          isVeg: itemForm.isVeg,
          isAvailable: itemForm.isAvailable,
          imagePath: itemForm.imagePath || undefined,
          station: itemForm.station || undefined,
        });
      }
      setShowItemModal(false);
    } catch {
      // handled by hook
    } finally {
      setSaving(false);
    }
  };

  const [deleteItemError, setDeleteItemError] = useState<string | null>(null);
  const [allowForceDeleteItem, setAllowForceDeleteItem] = useState(false);
  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    setSaving(true);
    setDeleteItemError(null);
    try {
      await deleteItem(deletingItem.id);
      setShowDeleteConfirm(false);
      setDeletingItem(null);
      setAllowForceDeleteItem(false);
    } catch (err: any) {
      setDeleteItemError(err?.message ?? t('menuMgmt.failedToDeleteItem'));
      setAllowForceDeleteItem(true);
    } finally {
      setSaving(false);
    }
  };
  const handleForceDeleteItem = async () => {
    if (!deletingItem) return;
    setSaving(true);
    try {
      await ipc(window.electronAPI.menu.forceDeleteItem(deletingItem.id));
      await refetch();
      setShowDeleteConfirm(false);
      setDeletingItem(null);
      setAllowForceDeleteItem(false);
    } catch (err: any) {
      setDeleteItemError(err?.message ?? t('menuMgmt.failedToForceDeleteItem'));
    } finally {
      setSaving(false);
    }
  };

  const handleBulkToggle = async (available: boolean) => {
    for (const id of selectedItemIds) {
      try {
        await toggleAvailability(id, available);
      } catch {
        // continue
      }
    }
    setSelectedItemIds(new Set());
  };

  const toggleItemSelection = (id: number) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === sortedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(sortedItems.map((i) => i.id)));
    }
  };

  // --- Variations ---

  const openVariations = async (item: MenuItem) => {
    setVariationsItem(item);
    const v = await getVariations(item.id);
    setVariations(v);
    setNewVariationName('');
    setNewVariationPrice('');
    setShowVariationsModal(true);
  };

  const refreshVariationsState = async (menuItemId: number) => {
    const freshItems = await ipc<MenuItem[]>(window.electronAPI.menu.getItems());
    const freshItem = freshItems?.find((i) => i.id === menuItemId);
    if (freshItem) {
      setVariationsItem((prev) => prev ? { ...prev, basePrice: freshItem.basePrice } : prev);
    }
    const updatedVariations = await ipc<Variation[]>(window.electronAPI.menu.getVariations(menuItemId));
    setVariations(updatedVariations ?? []);
    await refetch();
  };

  const handleAddVariation = async () => {
    if (!variationsItem || !newVariationName.trim()) return;
    setSaving(true);
    try {
      const actualPricePaise = Math.round(parseFloat(newVariationPrice || '0') * 100);
      await createVariation({
        menuItemId: variationsItem.id,
        name: newVariationName.trim(),
        priceDelta: actualPricePaise - variationsItem.basePrice,
        isDefault: variations.length === 0,
      });
      await refreshVariationsState(variationsItem.id);
      setNewVariationName('');
      setNewVariationPrice('');
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariation = async (id: number) => {
    if (!variationsItem) return;
    try {
      await deleteVariation(id);
      await refreshVariationsState(variationsItem.id);
    } catch {
      // handled
    }
  };

  const startEditingVariation = (v: Variation) => {
    setEditingVariationId(v.id);
    setEditingVariationName(v.name);
    setEditingVariationPrice(String(((variationsItem?.basePrice ?? 0) + v.priceDelta) / 100));
  };

  const handleSaveVariation = async () => {
    if (editingVariationId === null || !editingVariationName.trim() || !variationsItem) return;
    setSaving(true);
    try {
      const existing = variations.find((v) => v.id === editingVariationId);
      if (!existing) return;
      const actualPricePaise = Math.round(parseFloat(editingVariationPrice || '0') * 100);
      const basePrice = variationsItem.basePrice;
      await updateVariation({
        ...existing,
        name: editingVariationName.trim(),
        priceDelta: actualPricePaise - basePrice,
      });
      await refreshVariationsState(variationsItem.id);
      setEditingVariationId(null);
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  // --- Item Addons assignment ---

  const openItemAddons = async (item: MenuItem) => {
    setItemAddonsItem(item);
    const [groups, linkedIds] = await Promise.all([
      getAddonGroups(),
      getItemAddonGroupIds(item.id),
    ]);
    setAllAddonGroups(groups);
    setItemAddonGroupIds(new Set(linkedIds));
    setShowItemAddonsModal(true);
  };

  const handleToggleItemAddonGroup = async (addonGroupId: number) => {
    if (!itemAddonsItem) return;
    setSaving(true);
    try {
      if (itemAddonGroupIds.has(addonGroupId)) {
        await unlinkAddonGroupFromItem(itemAddonsItem.id, addonGroupId);
        setItemAddonGroupIds((prev) => {
          const next = new Set(prev);
          next.delete(addonGroupId);
          return next;
        });
      } else {
        await linkAddonGroupToItem(itemAddonsItem.id, addonGroupId);
        setItemAddonGroupIds((prev) => new Set(prev).add(addonGroupId));
      }
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  // --- Addons tab ---

  const loadAddonGroups = async () => {
    const groups = await getAddonGroups();
    setAddonGroups(groups);
  };

  useEffect(() => {
    if (activeTab === 'addons') {
      loadAddonGroups();
    }
  }, [activeTab]);

  const handleAddAddonGroup = async () => {
    if (!newGroupName.trim()) return;
    setSaving(true);
    try {
      await createAddonGroup({
        name: newGroupName.trim(),
        minSelect: 0,
        maxSelect: 3,
        isRequired: false,
      });
      setNewGroupName('');
      await loadAddonGroups();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddon = async () => {
    if (!selectedGroupId || !newAddonName.trim()) return;
    setSaving(true);
    try {
      await createAddon({
        addonGroupId: selectedGroupId,
        name: newAddonName.trim(),
        price: Math.round(parseFloat(newAddonPrice || '0') * 100),
      });
      setNewAddonName('');
      setNewAddonPrice('');
      await loadAddonGroups();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const expandAddonVariationPrices = async (addon: Addon, addonGroupId: number) => {
    if (expandedAddonId === addon.id) {
      setExpandedAddonId(null);
      return;
    }
    setEditAddonName(addon.name);
    setEditAddonPrice(String(addon.price / 100));
    try {
      const varNames = await ipc<string[]>(window.electronAPI.menu.getVariationNamesForAddonGroup(addonGroupId));
      setAllVariationNames(varNames ?? []);
      const prices: Record<string, string> = {};
      for (const name of (varNames ?? [])) {
        const paise = addon.variationPrices?.[name];
        prices[name] = paise !== undefined ? String(paise / 100) : '';
      }
      setAddonVarPrices(prices);
      setExpandedAddonId(addon.id);
    } catch {
      setAllVariationNames([]);
      setExpandedAddonId(addon.id);
    }
  };

  const handleSaveAddon = async (addonId: number) => {
    setSaving(true);
    try {
      await ipc(window.electronAPI.menu.updateAddon(addonId, {
        name: editAddonName.trim(),
        price: Math.round(parseFloat(editAddonPrice) * 100),
      }));
      if (allVariationNames.length > 0) {
        const pricesInPaise: Record<string, number> = {};
        for (const [name, val] of Object.entries(addonVarPrices)) {
          if (val.trim() !== '') {
            pricesInPaise[name] = Math.round(parseFloat(val) * 100);
          }
        }
        await ipc(window.electronAPI.menu.setAddonVariationPrices(addonId, pricesInPaise));
      }
      setExpandedAddonId(null);
      await loadAddonGroups();
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  // --- Combos ---

  const loadCombos = async () => {
    const c = await getCombos();
    setCombos(c);
  };

  useEffect(() => {
    if (activeTab === 'combos') {
      loadCombos();
    }
  }, [activeTab]);

  // --- Export / Import ---

  const handleExport = async () => {
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const variations = await getVariations(item.id);
        const addonGroupIds = await getItemAddonGroupIds(item.id);
        return {
          ...item,
          variations: variations.map((v) => ({
            name: v.name,
            price: item.basePrice + v.priceDelta,
            isDefault: v.isDefault,
          })),
          addonGroupIds,
        };
      })
    );

    const addonGroups = await getAddonGroups();

    const data = JSON.stringify({ categories, items: enrichedItems, addonGroups }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const [importing, setImporting] = useState(false);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.categories || !data.items || !data.addonGroups) {
          throw new Error('Invalid menu file format');
        }

        await ipc(window.electronAPI.menu.replaceMenu(data));
        await refetch();
        toast.success(t('menu.importSuccessBulk', 'Menu successfully replaced with the uploaded one!'));
      } catch (err: any) {
        console.error('Import failed:', err);
        toast.error(err.message || t('menu.importFailed'));
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  // --- Sort handler ---

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // --- Shimmer Loading state ---
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-blue-600 dark:text-blue-400 opacity-50" />
            <div className="shimmer h-5 w-36 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="shimmer h-8 w-24 rounded-lg" />
            <div className="shimmer h-8 w-24 rounded-lg" />
            <div className="shimmer h-8 w-32 rounded-lg" />
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-50/80 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-800">
          <div className="shimmer h-8 w-28 rounded-lg" />
          <div className="shimmer h-8 w-28 rounded-lg" />
          <div className="shimmer h-8 w-36 rounded-lg" />
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-60 border-r border-gray-200 dark:border-slate-800 p-3 space-y-2">
            <div className="shimmer h-8 w-full rounded-lg" />
            <div className="shimmer h-8 w-full rounded-lg" />
            <div className="shimmer h-8 w-full rounded-lg" />
            <div className="shimmer h-8 w-full rounded-lg" />
          </div>
          <div className="flex-1 p-4 space-y-3">
            <div className="shimmer h-9 w-full rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={`shimmer-${i}`}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3 h-40 flex flex-col justify-between"
                >
                  <div className="shimmer h-20 w-full rounded-lg" />
                  <div className="shimmer h-4 w-3/4 rounded mt-2" />
                  <div className="shimmer h-4 w-1/3 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 text-gray-900 dark:text-white overflow-hidden select-none">
      {/* Enterprise Top Header */}
      <header className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between px-5 py-2.5 gap-4">
          {/* Left: Branding & Executive Metric Chips */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
              <UtensilsCrossed size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white leading-tight">
                  {t('menu.menuManagement', 'Menu Management')}
                </h1>

                {/* Metric Capsules */}
                <div className="hidden lg:flex items-center gap-1.5 ml-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-[11px] font-semibold text-gray-700 dark:text-slate-300 border border-gray-200/80 dark:border-slate-700">
                    <Package size={11} className="text-blue-500" />
                    <span>{catalogStats.total} {t('menu.items', 'Items')}</span>
                  </span>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{catalogStats.inStock} {t('menu.activeCount', 'In Stock')}</span>
                  </span>

                  {catalogStats.outOfStock > 0 && (
                    <button
                      type="button"
                      onClick={() => setStockFilter(stockFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                        stockFilter === 'out_of_stock'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100'
                      }`}
                      title={t('menu.filterOutOfStock', 'Filter to Out of Stock items')}
                    >
                      <AlertCircle size={11} className={stockFilter === 'out_of_stock' ? 'text-white' : 'text-rose-500'} />
                      <span>{catalogStats.outOfStock} {t('menu.outOfStockCount', 'Out of Stock')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/qr-menu')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 dark:hover:bg-amber-500/30 transition-colors shadow-2xs"
              title="Create and print QR codes, table stands, and menu cards"
            >
              <QrCode size={14} className="text-amber-600 dark:text-amber-400" />
              <span>{t('menu.qrMenu', 'QR Menu & Stands')}</span>
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
            >
              <Download size={13} className="text-gray-500 dark:text-slate-400" />
              <span className="hidden sm:inline">{t('menu.export', 'Export')}</span>
            </button>

            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-2xs"
            >
              {importing ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <Upload size={13} className="text-gray-500 dark:text-slate-400" />}
              <span className="hidden sm:inline">{importing ? t('menu.importing', 'Importing...') : t('menu.import', 'Import')}</span>
            </button>

            <button
              onClick={openAddItem}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>{t('menu.addItem', 'Add Menu Item')}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Capsule Ribbon */}
        <div className="flex items-center justify-between px-5 py-2 bg-gray-50/90 dark:bg-slate-900/90 border-t border-gray-200/80 dark:border-slate-800">
          <div className="inline-flex items-center p-1 bg-gray-200/70 dark:bg-slate-800/90 rounded-xl border border-gray-200/80 dark:border-slate-700/70 shadow-2xs gap-1">
            {([
              { key: 'items', label: t('menu.items', 'Items Catalog'), count: items.length },
              { key: 'combos', label: t('menu.combos', 'Combos & Packs'), count: combos.length },
              { key: 'addons', label: t('menu.addons', 'Add-ons & Modifiers'), count: addonGroups.length },
            ] as { key: ActiveTab; label: string; count: number }[]).map(({ key, label, count }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`
                    relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold
                    transition-all duration-150 select-none whitespace-nowrap
                    ${
                      isActive
                        ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-xs border border-gray-200/60 dark:border-blue-500/50'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50 border border-transparent'
                    }
                  `}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className={`
                        inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5
                        rounded-full text-[11px] font-bold tabular-nums
                        ${
                          isActive
                            ? 'bg-blue-100 text-blue-700 dark:bg-white dark:text-blue-700'
                            : 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-200'
                        }
                      `}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-gray-500 dark:text-slate-400 font-medium hidden sm:block">
            {catalogStats.categoriesCount} {t('menu.categories', 'Categories')}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-5 mt-3 px-4 py-2 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 rounded-xl text-xs text-red-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Main content area */}
      {activeTab === 'items' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - Categories */}
          <aside className="w-60 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-gray-50/60 dark:bg-slate-900/50 flex-shrink-0">
            <div className="p-3 border-b border-gray-200 dark:border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                  {t('menu.categories', 'Categories')}
                </span>
                <button
                  onClick={openAddCategory}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                  title={t('menu.addCategory')}
                >
                  <FolderPlus size={14} />
                  <span>{t('common.add', 'Add')}</span>
                </button>
              </div>

              {/* Category Search Input */}
              {categories.length > 5 && (
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder={t('menu.categorySearch', 'Filter categories...')}
                    className="w-full pl-7 pr-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {categorySearch && (
                    <button
                      onClick={() => setCategorySearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* All items category button */}
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategoryId === null
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{t('menu.allItems', 'All Items')}</span>
                <span
                  className={`text-[11px] px-2 py-0.2 rounded-full font-bold tabular-nums ${
                    selectedCategoryId === null
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200/80 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  {items.length}
                </span>
              </button>

              {/* Category Rows */}
              {filteredCategoriesList.map((cat) => {
                const catItems = items.filter((i) => i.categoryId === cat.id);
                const isSelected = selectedCategoryId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="flex-1 text-left truncate py-1"
                    >
                      {cat.name}
                    </button>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <span
                        className={`text-[11px] px-2 py-0.2 rounded-full font-bold tabular-nums ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-200/80 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                        }`}
                      >
                        {catItems.length}
                      </span>

                      {/* Touch-accessible Action buttons */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCategory(cat);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isSelected
                            ? 'text-white/80 hover:text-white hover:bg-white/10'
                            : 'text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                        title={t('common.edit')}
                      >
                        <Edit2 size={12} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(cat);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isSelected
                            ? 'text-white/80 hover:text-white hover:bg-white/10'
                            : 'text-gray-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                        }`}
                        title={t('common.delete')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Right panel - Items Catalog Surface */}
          <main className="flex-1 flex flex-col overflow-hidden bg-gray-50/40 dark:bg-slate-950/40">
            {/* Enterprise Items Filter & Action Toolbar */}
            <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {/* Search Field */}
                <div className="relative min-w-[200px] max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('menu.searchItems', 'Search items...')}
                    className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Quick Status Filter Chips */}
                <div className="inline-flex items-center p-0.5 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 gap-1">
                  <button
                    type="button"
                    onClick={() => setStockFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      stockFilter === 'all'
                        ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                    }`}
                  >
                    {t('kitchen.stationAll', 'All')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockFilter('in_stock')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      stockFilter === 'in_stock'
                        ? 'bg-white dark:bg-blue-600 text-emerald-700 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{t('menu.activeCount', 'In Stock')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockFilter('out_of_stock')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      stockFilter === 'out_of_stock'
                        ? 'bg-white dark:bg-rose-600 text-rose-700 dark:text-white shadow-2xs font-bold'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>{t('menu.stock86', 'Out of Stock')}</span>
                    {catalogStats.outOfStock > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-bold">
                        {catalogStats.outOfStock}
                      </span>
                    )}
                  </button>
                </div>

                {/* Dietary Filter */}
                <div className="inline-flex items-center p-0.5 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 gap-1">
                  <button
                    type="button"
                    onClick={() => setDietFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      dietFilter === 'all'
                        ? 'bg-white dark:bg-blue-600 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                    }`}
                  >
                    {t('menu.allTypes', 'All Types')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDietFilter('veg')}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      dietFilter === 'veg'
                        ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                    }`}
                  >
                    <Leaf size={11} className="text-emerald-500" />
                    <span>{t('menu.veg', 'Veg')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDietFilter('nonveg')}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      dietFilter === 'nonveg'
                        ? 'bg-white dark:bg-rose-600 text-rose-700 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-slate-300 hover:text-gray-900'
                    }`}
                  >
                    <Circle size={10} className="text-rose-500" />
                    <span>{t('menu.nonVeg', 'Non-Veg')}</span>
                  </button>
                </div>

                {/* Station Filter Dropdown */}
                <select
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                  className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">{t('menu.allStations', 'All Stations')}</option>
                  {KITCHEN_STATION_DEFS.filter((s) => s.value).map((s) => (
                    <option key={s.value} value={s.value}>
                      {t(s.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              {/* View & Sort Controls */}
              <div className="flex items-center gap-2">
                {/* Sort dropdown */}
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs">
                  <Filter size={12} className="text-gray-400" />
                  <select
                    value={sortField}
                    onChange={(e) => handleSort(e.target.value as SortField)}
                    className="bg-transparent text-gray-700 dark:text-slate-300 text-xs outline-none"
                  >
                    <option value="name">{t('menu.itemName')}</option>
                    <option value="basePrice">{t('menu.price')}</option>
                    <option value="categoryId">{t('menu.categoryName')}</option>
                  </select>
                  <button
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="font-bold text-gray-500 dark:text-slate-400 hover:text-blue-600 px-1"
                  >
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </button>
                </div>

                {/* View toggle (List vs Grid) */}
                <div className="inline-flex items-center p-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-2xs'
                        : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'
                    }`}
                    title="Table List View"
                  >
                    <List size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-2xs'
                        : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'
                    }`}
                    title="Grid Card View"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Action Ribbon (appears when items are checked) */}
            {selectedItemIds.size > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/60 border-b border-blue-200 dark:border-blue-900/60 px-5 py-2 flex items-center justify-between text-xs transition-all">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    {t('menuMgmt.selectedCount', { count: selectedItemIds.size })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds(new Set())}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-[11px]"
                  >
                    {t('common.clear', 'Clear')}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkToggle(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors"
                  >
                    <CheckCircle2 size={13} />
                    <span>{t('menuMgmt.enable', 'Enable (In Stock)')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkToggle(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition-colors"
                  >
                    <AlertCircle size={13} />
                    <span>{t('menuMgmt.disable', 'Disable (Out of Stock)')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Items display area */}
            <div className="flex-1 overflow-y-auto p-4">
              {sortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500 py-16">
                  <Package size={48} className="mb-3 opacity-30 text-blue-500" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    {t('menu.noItemsFound', 'No items found')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    {searchQuery || stockFilter !== 'all' || dietFilter !== 'all'
                      ? 'Try clearing filters to see all menu items.'
                      : 'Click "+ Add Menu Item" to get started.'}
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                /* Enterprise Table List View */
                <div className="space-y-1.5">
                  {/* Table Header */}
                  <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider bg-gray-100/90 dark:bg-slate-900/90 border border-gray-200/80 dark:border-slate-800 rounded-xl">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.size === sortedItems.length && sortedItems.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1">{t('menu.itemName', 'Item Name')}</span>
                    <span className="w-28">{t('menu.categoryName', 'Category')}</span>
                    <span className="w-24">{t('menu.station', 'Station')}</span>
                    <span className="w-24 text-right">{t('menu.price', 'Price')}</span>
                    <span className="w-20 text-center">{t('menu.type', 'Type')}</span>
                    <span className="w-24 text-center">{t('menu.availability', 'Stock Status')}</span>
                    <span className="w-36 text-right">{t('menu.actions', 'Actions')}</span>
                  </div>

                  {/* Table Rows */}
                  {sortedItems.map((item) => {
                    const isAvailable = item.isAvailable !== false;
                    const isSelected = selectedItemIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-900 border rounded-xl transition-all ${
                          isSelected
                            ? 'border-blue-400 dark:border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs'
                            : 'border-gray-200/80 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-xs'
                        } ${!isAvailable ? 'opacity-70 bg-gray-50/50 dark:bg-slate-900/50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItemSelection(item.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />

                        {/* Dish Details: Photo thumbnail & Name & Short code */}
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {item.imagePath ? (
                              <img src={item.imagePath} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <UtensilsCrossed size={16} className="text-gray-400 dark:text-slate-500" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                {item.name}
                              </p>
                              {item.shortCode && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                                  {item.shortCode}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">
                              {getCategoryName(item.categoryId)}
                            </p>
                          </div>
                        </div>

                        {/* Category */}
                        <span className="w-28 text-xs text-gray-600 dark:text-slate-400 truncate">
                          {getCategoryName(item.categoryId)}
                        </span>

                        {/* Kitchen Station */}
                        <span className="w-24 text-xs truncate">
                          {item.station ? (
                            <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold truncate ${getStationBadgeColor(item.station)}`}>
                              {getStationLabel(item.station)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-slate-600 text-xs">—</span>
                          )}
                        </span>

                        {/* Price */}
                        <span className="w-24 text-xs font-mono font-bold text-gray-900 dark:text-white text-right">
                          {formatCurrency(item.basePrice)}
                        </span>

                        {/* Veg / Non-Veg badge */}
                        <span className="w-20 flex justify-center">
                          {item.isVeg ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                              <Leaf size={10} /> {t('menu.veg', 'VEG')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 px-2 py-0.5 rounded-full">
                              <Circle size={8} fill="currentColor" /> {t('menu.nonVeg', 'NON')}
                            </span>
                          )}
                        </span>

                        {/* Instant 86'd / In Stock switch button */}
                        <span className="w-24 flex justify-center">
                          <button
                            type="button"
                            onClick={() => toggleAvailability(item.id, !isAvailable)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                              isAvailable
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-100'
                                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/60 hover:bg-rose-100 font-bold'
                            }`}
                            title={isAvailable ? 'Click to mark Out of Stock' : 'Click to put back in stock'}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{isAvailable ? t('menu.activeCount', 'In Stock') : t('menu.stock86', 'Out of Stock')}</span>
                          </button>
                        </span>

                        {/* Action buttons */}
                        <div className="w-36 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openVariations(item)}
                            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title={t('menu.variations')}
                          >
                            <SlidersHorizontal size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openItemAddons(item)}
                            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title={t('menu.addons')}
                          >
                            <PlusCircle size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditItem(item)}
                            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title={t('common.edit')}
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeletingItem(item);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Enterprise Grid Cards View */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                  {sortedItems.map((item) => {
                    const isAvailable = item.isAvailable !== false;

                    return (
                      <div
                        key={item.id}
                        className={`relative flex flex-col rounded-2xl border overflow-hidden transition-all hover:shadow-md ${
                          isAvailable
                            ? 'border-gray-200/90 dark:border-slate-800 bg-white dark:bg-slate-900'
                            : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-slate-900/40 opacity-75'
                        }`}
                      >
                        {/* Food Type Pill in top-left */}
                        <div className="absolute top-2 left-2 z-10">
                          {item.isVeg ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/95 dark:bg-slate-900/95 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/70 shadow-2xs">
                              <Leaf size={9} /> {t('menu.veg', 'VEG')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/95 dark:bg-slate-900/95 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/70 shadow-2xs">
                              <Circle size={7} fill="currentColor" /> {t('menu.nonVeg', 'NON')}
                            </span>
                          )}
                        </div>

                        {/* Station in top-right */}
                        {item.station && (
                          <div className="absolute top-2 right-2 z-10">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shadow-2xs ${getStationBadgeColor(item.station)}`}>
                              {getStationLabel(item.station)}
                            </span>
                          </div>
                        )}

                        {/* Image Preview Container */}
                        <div className="h-28 bg-gray-100 dark:bg-slate-800 flex items-center justify-center border-b border-gray-100 dark:border-slate-800 overflow-hidden">
                          {item.imagePath ? (
                            <img src={item.imagePath} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <UtensilsCrossed size={28} className="text-gray-300 dark:text-slate-600" />
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight" title={item.name}>
                              {item.name}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                              {getCategoryName(item.categoryId)}
                            </p>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                              {formatCurrency(item.basePrice)}
                            </span>
                            {item.shortCode && (
                              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
                                #{item.shortCode}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: 86'd Toggle & Quick Actions */}
                        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-slate-800/80 bg-gray-50/70 dark:bg-slate-900/80">
                          <button
                            type="button"
                            onClick={() => toggleAvailability(item.id, !isAvailable)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                              isAvailable
                                ? 'bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
                                : 'bg-rose-100/90 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 font-bold'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{isAvailable ? t('menu.activeCount', 'In Stock') : t('menu.stock86', 'Out of Stock')}</span>
                          </button>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => openVariations(item)}
                              className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded transition-colors"
                              title={t('menu.variations')}
                            >
                              <SlidersHorizontal size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openItemAddons(item)}
                              className="p-1 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 rounded transition-colors"
                              title={t('menu.addons')}
                            >
                              <PlusCircle size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditItem(item)}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                              title={t('common.edit')}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingItem(item);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                              title={t('common.delete')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Combos tab */}
      {activeTab === 'combos' && (
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50/40 dark:bg-slate-950/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('menu.combos', 'Combos & Meal Packs')}</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Bundle multiple menu items together with custom discount pricing.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingComboId(null);
                setComboName('');
                setComboPrice('');
                setComboItems([]);
                setComboItemSearch('');
                setShowComboModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-colors"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>{t('menu.addCombo', 'Add Combo')}</span>
            </button>
          </div>

          {combos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-slate-500 gap-2">
              <Package size={42} className="opacity-40 text-blue-500" />
              <p className="text-sm font-medium">{t('menu.noItemsFound', 'No combos found')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="p-4 border border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs hover:border-gray-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{combo.name}</p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          combo.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {combo.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      {t('menuMgmt.comboItemsSummary', {
                        count: combo.items.length,
                        price: formatCurrency(combo.price),
                      })}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
                    <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                      {formatCurrency(combo.price)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingComboId(combo.id);
                          setComboName(combo.name);
                          setComboPrice((combo.price / 100).toString());
                          setComboItems(
                            (combo.items ?? []).map((ci: any) => ({
                              menuItemId: ci.menuItemId,
                              quantity: ci.quantity ?? 1,
                            })),
                          );
                          setComboItemSearch('');
                          setShowComboModal(true);
                        }}
                        className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={t('common.edit')}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          await deleteCombo(combo.id);
                          await loadCombos();
                        }}
                        className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Addons tab */}
      {activeTab === 'addons' && (
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50/40 dark:bg-slate-950/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('menu.addons', 'Addon Groups & Modifiers')}</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Define optional or mandatory item choices such as Extra Cheese, Spice Level, or Sides.
              </p>
            </div>
          </div>

          {/* Add group form */}
          <div className="flex items-center gap-2 mb-4 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-2xs">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('menuMgmt.newGroupNamePlaceholder', 'New group name (e.g. Extra Toppings)')}
              className="flex-1 max-w-sm px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddAddonGroup()}
            />
            <button
              onClick={handleAddAddonGroup}
              disabled={!newGroupName.trim() || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-xs transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={2.5} />}
              <span>{t('menu.addGroup', 'Add Group')}</span>
            </button>
          </div>

          {addonGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-slate-500 gap-2">
              <Package size={42} className="opacity-40 text-blue-500" />
              <p className="text-sm font-medium">{t('menu.noItemsFound', 'No addon groups created yet')}</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {addonGroups.map((group) => (
                <div
                  key={group.id}
                  className="border border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{group.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                        {t('menuMgmt.select')}{group.minSelect}-{group.maxSelect} &middot;{' '}
                        {group.isRequired ? t('common.required') : t('common.optional')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setSelectedGroupId(selectedGroupId === group.id ? null : group.id)
                        }
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Plus size={13} />
                        <span>Add Option</span>
                      </button>
                      <button
                        onClick={async () => {
                          await deleteAddonGroup(group.id);
                          await loadAddonGroups();
                        }}
                        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Addons list */}
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {(group.addons ?? []).map((addon) => (
                      <div key={addon.id}>
                        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                          <span className="font-medium text-gray-800 dark:text-slate-200">{addon.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-gray-900 dark:text-white">
                              {addon.variationPrices && Object.keys(addon.variationPrices).length > 0
                                ? (() => {
                                    const prices = Object.values(addon.variationPrices!);
                                    const min = Math.min(...prices);
                                    const max = Math.max(...prices);
                                    return min === max
                                      ? formatCurrency(min)
                                      : `${formatCurrency(min)} - ${formatCurrency(max)}`;
                                  })()
                                : formatCurrency(addon.price)}
                            </span>
                            <button
                              onClick={() => expandAddonVariationPrices(addon, group.id)}
                              className={`p-1 rounded-lg transition-colors ${
                                expandedAddonId === addon.id
                                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/80'
                                  : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                              }`}
                              title={t('menuMgmt.variationPricesTitle')}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={async () => {
                                await deleteAddon(addon.id);
                                await loadAddonGroups();
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                              title={t('common.delete')}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Inline Modifier Price Matrix */}
                        {expandedAddonId === addon.id && (
                          <div className="px-5 py-3.5 bg-blue-50/60 dark:bg-slate-800/80 border-t border-blue-100 dark:border-slate-700 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1 block">
                                  {t('common.name')}
                                </label>
                                <input
                                  type="text"
                                  value={editAddonName}
                                  onChange={(e) => setEditAddonName(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1 block">
                                  {t('menu.basePrice')}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editAddonPrice}
                                  onChange={(e) => setEditAddonPrice(e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {allVariationNames.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                                  {t('menuMgmt.pricePerVariation')}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {allVariationNames.map((name) => (
                                    <div key={name} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-gray-200 dark:border-slate-700">
                                      <span className="text-xs text-gray-600 dark:text-slate-400 w-24 truncate font-medium">{name}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={addonVarPrices[name] ?? ''}
                                        onChange={(e) => setAddonVarPrices((prev) => ({ ...prev, [name]: e.target.value }))}
                                        placeholder={editAddonPrice}
                                        className="flex-1 px-2 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => setExpandedAddonId(null)}
                                className="px-3 py-1 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-800 rounded-lg"
                              >
                                {t('common.cancel')}
                              </button>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleSaveAddon(addon.id)}
                                loading={saving}
                              >
                                {t('common.save')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {(group.addons ?? []).length === 0 && (
                      <div className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">{t('menu.noAddonsInGroup')}</div>
                    )}
                  </div>

                  {/* Add addon inline row */}
                  {selectedGroupId === group.id && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-blue-50/70 dark:bg-slate-800/80 border-t border-blue-100 dark:border-slate-700">
                      <input
                        type="text"
                        value={newAddonName}
                        onChange={(e) => setNewAddonName(e.target.value)}
                        placeholder={t('menuMgmt.addonNamePlaceholder', 'Addon name')}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <input
                        type="number"
                        value={newAddonPrice}
                        onChange={(e) => setNewAddonPrice(e.target.value)}
                        placeholder={t('common.price', 'Price')}
                        className="w-24 px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button size="sm" variant="primary" onClick={handleAddAddon} loading={saving}>
                        {t('menu.addItem', 'Add')}
                      </Button>
                      <button
                        onClick={() => setSelectedGroupId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === Add/Edit Item Modal === */}
      <Modal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        title={editingItem ? t('menu.editItem') : t('menu.addItem')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowItemModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSaveItem}
              disabled={!itemForm.name.trim() || !itemForm.basePrice}
            >
              {editingItem ? t('common.save') : t('menu.addItem')}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.itemName')} *</label>
              <input
                type="text"
                value={itemForm.name}
                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('menuMgmt.itemNamePlaceholder')}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
            </div>

            {/* Short code */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.shortCode')}</label>
              <input
                type="text"
                value={itemForm.shortCode}
                onChange={(e) => setItemForm((f) => ({ ...f, shortCode: e.target.value }))}
                placeholder={t('menuMgmt.shortCodePlaceholder')}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.categoryName')}</label>
            <select
              value={itemForm.categoryId ?? ''}
              onChange={(e) =>
                setItemForm((f) => ({
                  ...f,
                  categoryId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">{t('menu.selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Price */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.price')} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={itemForm.basePrice}
                onChange={(e) => setItemForm((f) => ({ ...f, basePrice: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Tax */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.taxRate')}</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max={menuTaxPreset.maxRate}
                value={itemForm.taxRate}
                onChange={(e) => setItemForm((f) => ({ ...f, taxRate: e.target.value }))}
                placeholder="5"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Veg/Non-veg toggle & Availability */}
          <div className="flex items-center gap-6 pt-1">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">{t('menu.type')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setItemForm((f) => ({ ...f, isVeg: true }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    itemForm.isVeg
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                      : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                  }`}
                >
                  <Leaf size={13} />
                  {t('menu.veg', 'VEG')}
                </button>
                <button
                  type="button"
                  onClick={() => setItemForm((f) => ({ ...f, isVeg: false }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    !itemForm.isVeg
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 shadow-2xs'
                      : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300'
                  }`}
                >
                  <Circle size={10} fill="currentColor" />
                  {t('menu.nonVeg', 'NON-VEG')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">{t('menu.availability')}</label>
              <button
                type="button"
                onClick={() => setItemForm((f) => ({ ...f, isAvailable: !f.isAvailable }))}
                className="flex items-center gap-2 py-1"
              >
                {itemForm.isAvailable ? (
                  <ToggleRight size={24} className="text-emerald-600" />
                ) : (
                  <ToggleLeft size={24} className="text-gray-400 dark:text-slate-600" />
                )}
                <span className="text-xs text-gray-800 dark:text-slate-200 font-bold">
                  {itemForm.isAvailable ? t('menu.activeCount', 'In Stock') : t('menu.stock86', 'Out of Stock')}
                </span>
              </button>
            </div>
          </div>

          {/* Image path */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.imagePath')}</label>
            <input
              type="text"
              value={itemForm.imagePath}
              onChange={(e) => setItemForm((f) => ({ ...f, imagePath: e.target.value }))}
              placeholder={t('menuMgmt.imagePathPlaceholder')}
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Kitchen station */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.kitchenStation')}</label>
            <select
              value={itemForm.station}
              onChange={(e) => setItemForm((f) => ({ ...f, station: e.target.value }))}
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {KITCHEN_STATION_DEFS.map((s) => (
                <option key={s.value || 'none'} value={s.value}>{t(s.labelKey)}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
              {t('menuMgmt.kitchenStationHint')}
            </p>
          </div>
        </div>
      </Modal>

      {/* === Category Modal === */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? t('menu.editCategory') : t('menu.addCategory')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCategoryModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={handleSaveCategory}
              disabled={!categoryName.trim()}
            >
              {editingCategory ? t('common.save') : t('menu.addCategory')}
            </Button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
            {t('menu.categoryName')} *
          </label>
          <input
            type="text"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder={t('menuMgmt.categoryNamePlaceholder')}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory()}
          />
        </div>
      </Modal>

      {/* === Delete Confirm Modal === */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteItemError(null);
          setAllowForceDeleteItem(false);
        }}
        title={t('menu.deleteItem')}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteItemError(null);
                setAllowForceDeleteItem(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            {allowForceDeleteItem ? (
              <Button
                variant="danger"
                size="sm"
                loading={saving}
                onClick={handleForceDeleteItem}
              >
                {t('common.forceDelete', 'Force Delete')}
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                loading={saving}
                onClick={handleDeleteItem}
              >
                {t('common.delete')}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-xs text-gray-600 dark:text-slate-300">
            {t('menuMgmt.deleteItemConfirm', { name: deletingItem?.name ?? '' })}
          </p>
          {deleteItemError && (
            <div className="p-3 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 rounded-lg text-xs text-red-700 dark:text-rose-300 space-y-1">
              <p className="font-semibold">{deleteItemError}</p>
              <p className="text-[11px] text-red-600 dark:text-rose-400">
                {t('menuMgmt.forceDeleteWarning')}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* === Variations Modal === */}
      <Modal
        isOpen={showVariationsModal}
        onClose={() => {
          setShowVariationsModal(false);
          setVariationsItem(null);
          setEditingVariationId(null);
        }}
        title={`${t('menu.variations')} - ${variationsItem?.name ?? ''}`}
        size="md"
      >
        <div className="space-y-4">
          {variations.length > 0 ? (
            <div className="space-y-2">
              {variations.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700"
                >
                  {editingVariationId === v.id ? (
                    <>
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingVariationName}
                          onChange={(e) => setEditingVariationName(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editingVariationPrice}
                          onChange={(e) => setEditingVariationPrice(e.target.value)}
                          className="w-24 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleSaveVariation}
                          disabled={saving || !editingVariationName.trim()}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingVariationId(null)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{v.name}</span>
                        {v.isDefault && (
                          <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded-full">
                            {t('menuMgmt.default')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300">
                          {formatCurrency((variationsItem?.basePrice ?? 0) + v.priceDelta)}
                        </span>
                        <button
                          onClick={() => startEditingVariation(v)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteVariation(v.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">
              {t('menu.noVariationsYet')}
            </p>
          )}

          {/* Add variation form */}
          <div className="flex items-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-800">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.itemName')}</label>
              <input
                type="text"
                value={newVariationName}
                onChange={(e) => setNewVariationName(e.target.value)}
                placeholder={t('menuMgmt.variationNamePlaceholder')}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.price')}</label>
              <input
                type="number"
                step="0.01"
                value={newVariationPrice}
                onChange={(e) => setNewVariationPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={handleAddVariation}
              loading={saving}
              disabled={!newVariationName.trim()}
            >
              {t('menu.addItem', 'Add')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* === Item Addons Assignment Modal === */}
      <Modal
        isOpen={showItemAddonsModal}
        onClose={() => {
          setShowItemAddonsModal(false);
          setItemAddonsItem(null);
        }}
        title={`${t('menu.addons')} - ${itemAddonsItem?.name ?? ''}`}
        size="md"
      >
        <div className="space-y-3">
          {allAddonGroups.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">
              {t('menu.noAddonGroupsYet', 'No addon groups created yet. Go to the Addons tab to create groups first.')}
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
                {t('menu.selectAddonGroupsHint', 'Select which addon groups should be available for this item.')}
              </p>
              <div className="space-y-2">
                {allAddonGroups.map((group) => {
                  const isLinked = itemAddonGroupIds.has(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleToggleItemAddonGroup(group.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        isLinked
                          ? 'border-orange-400 dark:border-orange-500 bg-orange-50/70 dark:bg-orange-950/30'
                          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isLinked ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-slate-600'
                          }`}
                        >
                          {isLinked && <Check size={12} className="text-white" strokeWidth={3} />}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{group.name}</span>
                          <span className="block text-[11px] text-gray-400 dark:text-slate-500">
                            {t('menuMgmt.addonGroupSummary', { count: (group.addons ?? []).length, rule: `${group.minSelect}-${group.maxSelect}` })} &middot;{' '}
                            {group.isRequired ? t('common.required') : t('common.optional')}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* === Add/Edit Combo Modal === */}
      <Modal
        isOpen={showComboModal}
        onClose={() => setShowComboModal(false)}
        title={editingComboId ? t('menu.editCombo', 'Edit Combo') : t('menu.addCombo')}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowComboModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              onClick={async () => {
                if (!comboName.trim()) return;
                setSaving(true);
                try {
                  const region = getTaxRegionForLanguage(i18n.language);
                  const eff = getEffectiveTaxConfigForRegion(region);
                  const comboPreset = getTaxLocalePresetForLanguage(i18n.language);
                  const comboTax = Math.min(
                    comboPreset.maxRate,
                    Math.max(0, parseFloat(eff.default_tax_rate) || 0),
                  );
                  if (editingComboId) {
                    await updateCombo({
                      id: editingComboId,
                      name: comboName.trim(),
                      price: Math.round(parseFloat(comboPrice || '0') * 100),
                      taxRate: comboTax,
                      isActive: true,
                      items: comboItems,
                    } as any);
                  } else {
                    await createCombo({
                      name: comboName.trim(),
                      price: Math.round(parseFloat(comboPrice || '0') * 100),
                      taxRate: comboTax,
                      isActive: true,
                      items: comboItems,
                    } as any);
                  }
                  setShowComboModal(false);
                  await loadCombos();
                } catch {
                  // handled
                } finally {
                  setSaving(false);
                }
              }}
              disabled={!comboName.trim()}
            >
              {editingComboId ? t('common.save', 'Save') : t('menu.addCombo')}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.comboName')}</label>
            <input
              type="text"
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              placeholder={t('menuMgmt.comboNamePlaceholder')}
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.price')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={comboPrice}
              onChange={(e) => setComboPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('menu.items')}</label>

            {comboItems.length > 0 && (
              <div className="space-y-1.5 mb-2.5">
                {comboItems.map((ci) => {
                  const item = items.find((i) => i.id === ci.menuItemId);
                  if (!item) return null;
                  return (
                    <div key={ci.menuItemId} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-[11px] font-mono text-gray-500 dark:text-slate-400">{formatCurrency(item.basePrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setComboItems((prev) =>
                              prev.flatMap((p) =>
                                p.menuItemId === ci.menuItemId
                                  ? p.quantity > 1
                                    ? [{ ...p, quantity: p.quantity - 1 }]
                                    : []
                                  : [p],
                              ),
                            )
                          }
                          className="w-6 h-6 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-xs"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-gray-900 dark:text-white">{ci.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setComboItems((prev) =>
                              prev.map((p) =>
                                p.menuItemId === ci.menuItemId ? { ...p, quantity: p.quantity + 1 } : p,
                              ),
                            )
                          }
                          className="w-6 h-6 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-xs"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setComboItems((prev) => prev.filter((p) => p.menuItemId !== ci.menuItemId))
                        }
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <input
              type="text"
              value={comboItemSearch}
              onChange={(e) => setComboItemSearch(e.target.value)}
              placeholder={t('menu.searchItems')}
              className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />

            {comboItemSearch.trim() && (
              <div className="mt-1.5 max-h-44 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                {items
                  .filter((it) => {
                    if (comboItems.some((ci) => ci.menuItemId === it.id)) return false;
                    return it.name.toLowerCase().includes(comboItemSearch.trim().toLowerCase());
                  })
                  .slice(0, 20)
                  .map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => {
                        setComboItems((prev) => [...prev, { menuItemId: it.id, quantity: 1 }]);
                        setComboItemSearch('');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-700"
                    >
                      <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{it.name}</span>
                      <span className="text-xs font-mono text-gray-500 dark:text-slate-400 ml-2 flex-shrink-0">{formatCurrency(it.basePrice)}</span>
                    </button>
                  ))}
              </div>
            )}

            {comboItems.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 font-medium">
                {t('menuMgmt.individualTotal')}{' '}
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {formatCurrency(
                    comboItems.reduce((sum, ci) => {
                      const it = items.find((i) => i.id === ci.menuItemId);
                      return sum + (it ? it.basePrice * ci.quantity : 0);
                    }, 0),
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MenuManagement;
