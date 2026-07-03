import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight,
  ChevronDown,
  Upload,
  Download,
  Package,
  Leaf,
  Circle,
  FolderPlus,
  Image,
  X,
  Loader2,
  PlusCircle,
  Check,
} from 'lucide-react';
import {
  useMenu,
  MenuCategory,
  MenuItem,
  Variation,
  Addon,
  AddonGroup,
  Combo,
  ComboItem,
  CreateMenuItemDTO,
  UpdateMenuItemDTO,
  CreateCategoryDTO,
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
  taxRate: '5',
  isVeg: true,
  isAvailable: true,
  imagePath: '',
  station: '',
};

const MenuManagement: React.FC = () => {
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

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showVariationsModal, setShowVariationsModal] = useState(false);
  const [showAddonsTab, setShowAddonsTab] = useState(false);
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

  // Sorted + filtered items
  const menuTaxPreset = getTaxLocalePresetForLanguage(i18n.language);

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'basePrice') cmp = a.basePrice - b.basePrice;
      else if (sortField === 'categoryId') cmp = a.categoryId - b.categoryId;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filteredItems, sortField, sortDir]);

  const getCategoryName = (catId: number) =>
    categories.find((c) => c.id === catId)?.name ?? t('menuMgmt.uncategorized');

  const getStationLabel = (station?: string) => {
    const def = KITCHEN_STATION_DEFS.find((s) => s.value === station);
    return def ? t(def.labelKey) : (station ?? '');
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

  /** After variation changes, refresh variationsItem basePrice and re-read variations */
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
      // Save name and base price — use ipc directly to avoid passing addonGroupId
      await ipc(window.electronAPI.menu.updateAddon(addonId, {
        name: editAddonName.trim(),
        price: Math.round(parseFloat(editAddonPrice) * 100),
      }));
      // Save variation prices if any
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
    // Enrich each item with its variations and addon group IDs
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

    // Export all addon groups with their addons
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

        // Additive import — only add NEW items, categories, variations, addons.
        // Never overwrite or delete existing data.

        const categoryIdMap = new Map<number, number>();
        const categoryNameMap = new Map(
          categories.map((c) => [c.name.trim().toLowerCase(), c.id])
        );

        let catCount = 0;
        let itemCount = 0;

        // 1. Import categories — skip existing
        if (data.categories) {
          for (const cat of data.categories) {
            const existingId = categoryNameMap.get(cat.name.trim().toLowerCase());
            if (existingId !== undefined) {
              categoryIdMap.set(cat.id, existingId);
            } else {
              const created = await ipc<{ id: number }>(window.electronAPI.menu.createCategory({ name: cat.name, sortOrder: cat.sortOrder }));
              categoryIdMap.set(cat.id, created.id);
              categoryNameMap.set(cat.name.trim().toLowerCase(), created.id);
              catCount++;
            }
          }
        }

        // 2. Import items — skip existing, only add new
        const itemNameMap = new Map(
          items.map((i) => [i.name.trim().toLowerCase(), i])
        );

        if (data.items) {
          for (const item of data.items) {
            const mappedCategoryId = categoryIdMap.get(item.categoryId) ?? item.categoryId;
            const existing = itemNameMap.get(item.name.trim().toLowerCase());

            if (existing) {
              // Item exists — only add missing variations
              if (Array.isArray(item.variations) && item.variations.length > 0) {
                const existingVariations = await getVariations(existing.id);
                const existingVarNames = new Set(existingVariations.map((v) => v.name.trim().toLowerCase()));
                for (let i = 0; i < item.variations.length; i++) {
                  const v = item.variations[i];
                  if (!existingVarNames.has(v.name.trim().toLowerCase())) {
                    await createVariation({
                      menuItemId: existing.id,
                      name: v.name,
                      priceDelta: v.price - item.basePrice,
                      isDefault: false,
                    });
                  }
                }
              }
            } else {
              // New item — create it with all variations
              const created = await ipc<{ id: number }>(window.electronAPI.menu.createItem({
                name: item.name,
                shortCode: item.shortCode,
                categoryId: mappedCategoryId,
                basePrice: item.basePrice,
                taxRate: item.taxRate,
                isVeg: item.isVeg,
                isAvailable: item.isAvailable,
              }));
              itemNameMap.set(item.name.trim().toLowerCase(), { id: created.id } as any);

              if (Array.isArray(item.variations) && item.variations.length > 0) {
                for (let i = 0; i < item.variations.length; i++) {
                  const v = item.variations[i];
                  await createVariation({
                    menuItemId: created.id,
                    name: v.name,
                    priceDelta: v.price - item.basePrice,
                    isDefault: i === 0,
                  });
                }
              }
              itemCount++;
            }
          }
        }

        // 3. Import addon groups — skip existing by name, only add new
        if (Array.isArray(data.addonGroups) && data.addonGroups.length > 0) {
          const existingGroups = await getAddonGroups();
          const existingGroupNames = new Map(
            existingGroups.map((g) => [g.name.trim().toLowerCase(), g])
          );

          const addonGroupIdMap = new Map<number, number>();

          for (const group of data.addonGroups) {
            const existingGroup = existingGroupNames.get(group.name.trim().toLowerCase());

            if (existingGroup) {
              // Group exists — only add missing addons
              addonGroupIdMap.set(group.id, existingGroup.id);
              if (Array.isArray(group.addons)) {
                const existingAddonNames = new Set(
                  (existingGroup.addons ?? []).map((a: any) => a.name.trim().toLowerCase())
                );
                for (const addon of group.addons) {
                  if (!existingAddonNames.has(addon.name.trim().toLowerCase())) {
                    const createdAddon = await createAddon({
                      addonGroupId: existingGroup.id,
                      name: addon.name,
                      price: addon.price,
                    });
                    if (addon.variationPrices && Object.keys(addon.variationPrices).length > 0) {
                      await ipc(window.electronAPI.menu.setAddonVariationPrices(createdAddon.id, addon.variationPrices));
                    }
                  }
                }
              }
            } else {
              // New group — create with all addons
              const created = await createAddonGroup({
                name: group.name,
                minSelect: group.minSelect,
                maxSelect: group.maxSelect,
                isRequired: group.isRequired,
              });
              addonGroupIdMap.set(group.id, created.id);

              if (Array.isArray(group.addons)) {
                for (const addon of group.addons) {
                  const createdAddon = await createAddon({
                    addonGroupId: created.id,
                    name: addon.name,
                    price: addon.price,
                  });
                  if (addon.variationPrices && Object.keys(addon.variationPrices).length > 0) {
                    await ipc(window.electronAPI.menu.setAddonVariationPrices(createdAddon.id, addon.variationPrices));
                  }
                }
              }
            }
          }

          // Link new addon groups to items (only new links)
          const refreshedItems = await ipc<any[]>(window.electronAPI.menu.getItems());
          const itemNameToId = new Map(
            (refreshedItems ?? []).map((i: any) => [i.name.trim().toLowerCase(), i.id])
          );

          if (data.items) {
            for (const item of data.items) {
              if (Array.isArray(item.addonGroupIds) && item.addonGroupIds.length > 0) {
                const newItemId = itemNameToId.get(item.name.trim().toLowerCase());
                if (newItemId) {
                  const existingLinks = await getItemAddonGroupIds(newItemId);
                  const existingLinkSet = new Set(existingLinks);
                  for (const oldGroupId of item.addonGroupIds) {
                    const newGroupId = addonGroupIdMap.get(oldGroupId);
                    if (newGroupId && !existingLinkSet.has(newGroupId)) {
                      await linkAddonGroupToItem(newItemId, newGroupId);
                    }
                  }
                }
              }
            }
          }
        }

        await refetch();
        toast.success(t('menu.importSuccess', { categories: catCount, items: itemCount }));
      } catch (err) {
        console.error('Import failed:', err);
        toast.error(t('menu.importFailed'));
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
          <Package size={22} className="text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">{t('menu.menuManagement')}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={16} />} onClick={handleExport}>
            {t('menu.export')}
          </Button>
          <Button variant="secondary" size="sm" icon={importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} onClick={handleImport} disabled={importing}>
            {importing ? t('menu.importing', 'Importing...') : t('menu.import')}
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={openAddItem}>
            {t('menu.addItem')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-2 bg-gray-50 border-b border-gray-200">
        {([
          { key: 'items', label: t('menu.items') },
          { key: 'combos', label: t('menu.combos') },
          { key: 'addons', label: t('menu.addons') },
        ] as { key: ActiveTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors tap-target ${
              activeTab === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main content area */}
      {activeTab === 'items' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - Categories */}
          <div className="w-64 border-r border-gray-200 flex flex-col bg-gray-50/50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">{t('menu.categories')}</span>
              <button
                onClick={openAddCategory}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title={t('menu.addCategory')}
              >
                <FolderPlus size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* All items */}
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors tap-target ${
                  selectedCategoryId === null
                    ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span>{t('menu.allItems')}</span>
                <span className="text-xs text-gray-400">{items.length}</span>
              </button>

              {categories.map((cat) => {
                const count = items.filter((i) => i.categoryId === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className={`group flex items-center justify-between px-4 py-3 text-sm transition-colors tap-target ${
                      selectedCategoryId === cat.id
                        ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <button
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className="flex-1 text-left truncate"
                    >
                      {cat.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 mr-1">{count}</span>
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 rounded transition-all"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 rounded transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel - Items */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('menu.searchItems')}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Filter size={14} />
                <select
                  value={sortField}
                  onChange={(e) => handleSort(e.target.value as SortField)}
                  className="bg-white border border-gray-300 rounded-md px-2 py-1.5 text-xs outline-none"
                >
                  <option value="name">{t('menu.itemName')}</option>
                  <option value="basePrice">{t('menu.price')}</option>
                  <option value="categoryId">{t('menu.categoryName')}</option>
                </select>
                <button
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="px-1.5 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-xs"
                >
                  {sortDir === 'asc' ? t('menuMgmt.sortAsc') : t('menuMgmt.sortDesc')}
                </button>
              </div>

              {/* View toggle */}
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>

              {/* Bulk actions */}
              {selectedItemIds.size > 0 && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                  <span className="text-xs text-gray-500">{t('menuMgmt.selectedCount', { count: selectedItemIds.size })}</span>
                  <Button size="sm" variant="success" onClick={() => handleBulkToggle(true)}>
                    {t('menuMgmt.enable')}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleBulkToggle(false)}>
                    {t('menuMgmt.disable')}
                  </Button>
                </div>
              )}
            </div>

            {/* Items display */}
            <div className="flex-1 overflow-y-auto p-4">
              {sortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                  <Package size={48} />
                  <p className="text-sm">
                    {t('menu.noItemsFound')}
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                /* List view */
                <div className="space-y-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.size === sortedItems.length && sortedItems.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="flex-1">{t('menu.itemName')}</span>
                    <span className="w-24">{t('menu.categoryName')}</span>
                    <span className="w-20 text-right">{t('menu.price')}</span>
                    <span className="w-16 text-center">{t('menu.type')}</span>
                    <span className="w-20 text-center">{t('menu.available')}</span>
                    <span className="w-40 text-right">{t('menu.actions')}</span>
                  </div>

                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 hover:shadow-sm transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />

                      {/* Name + code */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        {item.shortCode && (
                          <p className="text-xs text-gray-400">{item.shortCode}</p>
                        )}
                      </div>

                      {/* Category */}
                      <span className="w-24 text-xs text-gray-500 truncate">
                        {getCategoryName(item.categoryId)}
                      </span>

                      {/* Station */}
                      <span className="w-24 text-xs truncate">
                        {item.station ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
                            {getStationLabel(item.station)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </span>

                      {/* Price */}
                      <span className="w-20 text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(item.basePrice)}
                      </span>

                      {/* Veg/Non-veg */}
                      <span className="w-16 flex justify-center">
                        {item.isVeg ? (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <Leaf size={12} /> {t('menu.veg')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <Circle size={12} /> {t('menu.nonVeg')}
                          </span>
                        )}
                      </span>

                      {/* Availability toggle */}
                      <span className="w-20 flex justify-center">
                        <button
                          onClick={() => toggleAvailability(item.id, !(item.isAvailable !== false))}
                          className="tap-target"
                        >
                          {item.isAvailable !== false ? (
                            <ToggleRight size={24} className="text-green-600" />
                          ) : (
                            <ToggleLeft size={24} className="text-gray-400" />
                          )}
                        </button>
                      </span>

                      {/* Actions */}
                      <div className="w-40 flex items-center justify-end gap-1">
                        <button
                          onClick={() => openVariations(item)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title={t('menu.variations')}
                        >
                          <List size={14} />
                        </button>
                        <button
                          onClick={() => openItemAddons(item)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title={t('menu.addons')}
                        >
                          <PlusCircle size={14} />
                        </button>
                        <button
                          onClick={() => openEditItem(item)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingItem(item);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Grid view */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      className={`relative flex flex-col rounded-xl border-2 overflow-hidden transition-all hover:shadow-md ${
                        item.isAvailable !== false
                          ? 'border-gray-200 bg-white'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      {/* Veg badge */}
                      <div className="absolute top-2 left-2 z-10">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.isVeg
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-red-100 text-red-700 border border-red-300'
                          }`}
                        >
                          {item.isVeg ? t('menuMgmt.vegBadge') : t('menuMgmt.nonVegBadge')}
                        </span>
                      </div>

                      {/* Image area */}
                      <div className="h-28 bg-gray-100 flex items-center justify-center">
                        {item.imagePath ? (
                          <img
                            src={item.imagePath}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Image size={32} className="text-gray-300" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {getCategoryName(item.categoryId)}
                        </p>
                        {item.station && (
                          <p className="text-xs text-orange-600 mt-0.5 truncate">{getStationLabel(item.station)}</p>
                        )}
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {formatCurrency(item.basePrice)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                        <button
                          onClick={() => toggleAvailability(item.id, !(item.isAvailable !== false))}
                          className="tap-target"
                        >
                          {item.isAvailable !== false ? (
                            <ToggleRight size={20} className="text-green-600" />
                          ) : (
                            <ToggleLeft size={20} className="text-gray-400" />
                          )}
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditItem(item)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingItem(item);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Combos tab */}
      {activeTab === 'combos' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('menu.combos')}</h2>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={16} />}
              onClick={() => {
                setEditingComboId(null);
                setComboName('');
                setComboPrice('');
                setComboItems([]);
                setComboItemSearch('');
                setShowComboModal(true);
              }}
            >
              {t('menu.addCombo')}
            </Button>
          </div>

          {combos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <Package size={48} />
              <p className="text-sm">{t('menu.noItemsFound')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg bg-white"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{combo.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('menuMgmt.comboItemsSummary', { count: combo.items.length, price: formatCurrency(combo.price) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        combo.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {combo.isActive ? t('common.active') : t('common.inactive')}
                    </span>
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
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        await deleteCombo(combo.id);
                        await loadCombos();
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Addons tab */}
      {activeTab === 'addons' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('menu.addons')}</h2>
          </div>

          {/* Add group form */}
          <div className="flex items-center gap-2 mb-6">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={t('menuMgmt.newGroupNamePlaceholder')}
              className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAddAddonGroup()}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={16} />}
              loading={saving}
              onClick={handleAddAddonGroup}
              disabled={!newGroupName.trim()}
            >
              {t('menu.addGroup')}
            </Button>
          </div>

          {addonGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <Package size={48} />
              <p className="text-sm">{t('menu.noItemsFound')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {addonGroups.map((group) => (
                <div
                  key={group.id}
                  className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{group.name}</p>
                      <p className="text-xs text-gray-500">
                        {t('menuMgmt.select')}{group.minSelect}-{group.maxSelect} &middot;{' '}
                        {group.isRequired ? t('common.required') : t('common.optional')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setSelectedGroupId(selectedGroupId === group.id ? null : group.id)
                        }
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          await deleteAddonGroup(group.id);
                          await loadAddonGroups();
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Addons list */}
                  <div className="divide-y divide-gray-100">
                    {(group.addons ?? []).map((addon) => (
                      <div key={addon.id}>
                        <div className="flex items-center justify-between px-4 py-2">
                          <span className="text-sm text-gray-700">{addon.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
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
                              className={`p-1 rounded transition-colors ${expandedAddonId === addon.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'}`}
                              title={t('menuMgmt.variationPricesTitle')}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={async () => {
                                await deleteAddon(addon.id);
                                await loadAddonGroups();
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 rounded"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        {expandedAddonId === addon.id && (
                          <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 space-y-3">
                            {/* Name and base price */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('common.name')}</label>
                                <input
                                  type="text"
                                  value={editAddonName}
                                  onChange={(e) => setEditAddonName(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">{t('menu.basePrice')}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editAddonPrice}
                                  onChange={(e) => setEditAddonPrice(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Variation-based prices (if any) */}
                            {allVariationNames.length > 0 && (
                              <>
                                <p className="text-xs font-medium text-gray-500">{t('menuMgmt.pricePerVariation')}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {allVariationNames.map((name) => (
                                    <div key={name} className="flex items-center gap-2">
                                      <span className="text-xs text-gray-600 w-20 truncate">{name}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={addonVarPrices[name] ?? ''}
                                        onChange={(e) => setAddonVarPrices((prev) => ({ ...prev, [name]: e.target.value }))}
                                        placeholder={editAddonPrice}
                                        className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}

                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setExpandedAddonId(null)}
                                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 rounded"
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
                      <div className="px-4 py-3 text-xs text-gray-400">{t('menu.noAddonsInGroup')}</div>
                    )}
                  </div>

                  {/* Add addon inline */}
                  {selectedGroupId === group.id && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-t border-blue-100">
                      <input
                        type="text"
                        value={newAddonName}
                        onChange={(e) => setNewAddonName(e.target.value)}
                        placeholder={t('menuMgmt.addonNamePlaceholder')}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <input
                        type="number"
                        value={newAddonPrice}
                        onChange={(e) => setNewAddonPrice(e.target.value)}
                        placeholder={t('common.price')}
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <Button size="sm" variant="primary" onClick={handleAddAddon} loading={saving}>
                        {t('menu.addItem')}
                      </Button>
                      <button
                        onClick={() => setSelectedGroupId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
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
            <Button variant="secondary" onClick={() => setShowItemModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={handleSaveItem}
              disabled={!itemForm.name.trim() || !itemForm.categoryId}
            >
              {editingItem ? t('common.save') : t('menu.addItem')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.itemName')}</label>
              <input
                type="text"
                value={itemForm.name}
                onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('menuMgmt.itemNamePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
            </div>

            {/* Short code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.shortCode')}</label>
              <input
                type="text"
                value={itemForm.shortCode}
                onChange={(e) => setItemForm((f) => ({ ...f, shortCode: e.target.value }))}
                placeholder={t('menuMgmt.shortCodePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.categoryName')}</label>
            <select
              value={itemForm.categoryId ?? ''}
              onChange={(e) =>
                setItemForm((f) => ({
                  ...f,
                  categoryId: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">{t('menu.selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.price')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={itemForm.basePrice}
                onChange={(e) => setItemForm((f) => ({ ...f, basePrice: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Tax */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.taxRate')}</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max={menuTaxPreset.maxRate}
                value={itemForm.taxRate}
                onChange={(e) => setItemForm((f) => ({ ...f, taxRate: e.target.value }))}
                placeholder="5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Veg/Non-veg toggle */}
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('menu.type')}</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setItemForm((f) => ({ ...f, isVeg: true }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    itemForm.isVeg
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Leaf size={16} />
                  {t('menu.veg')}
                </button>
                <button
                  onClick={() => setItemForm((f) => ({ ...f, isVeg: false }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    !itemForm.isVeg
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Circle size={16} />
                  {t('menu.nonVeg')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('menu.availability')}</label>
              <button
                onClick={() => setItemForm((f) => ({ ...f, isAvailable: !f.isAvailable }))}
                className="flex items-center gap-2 tap-target"
              >
                {itemForm.isAvailable ? (
                  <ToggleRight size={28} className="text-green-600" />
                ) : (
                  <ToggleLeft size={28} className="text-gray-400" />
                )}
                <span className="text-sm text-gray-600">
                  {itemForm.isAvailable ? t('menu.available') : t('menu.unavailable')}
                </span>
              </button>
            </div>
          </div>

          {/* Image path */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.imagePath')}</label>
            <input
              type="text"
              value={itemForm.imagePath}
              onChange={(e) => setItemForm((f) => ({ ...f, imagePath: e.target.value }))}
              placeholder={t('menuMgmt.imagePathPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Kitchen station */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.kitchenStation')}</label>
            <select
              value={itemForm.station}
              onChange={(e) => setItemForm((f) => ({ ...f, station: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {KITCHEN_STATION_DEFS.map((s) => (
                <option key={s.value || 'none'} value={s.value}>{t(s.labelKey)}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {t('menuMgmt.kitchenStationHint')}
            </p>
          </div>
        </div>
      </Modal>

      {/* === Add/Edit Category Modal === */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? t('menu.editCategory') : t('menu.addCategory')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.categoryName')}</label>
          <input
            type="text"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder={t('menuMgmt.categoryNamePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory()}
          />
        </div>
      </Modal>

      {/* === Delete Confirmation Modal === */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingItem(null);
          setDeleteItemError(null);
          setAllowForceDeleteItem(false);
        }}
        title={t('menu.deleteItem')}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletingItem(null);
                setDeleteItemError(null);
                setAllowForceDeleteItem(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            {allowForceDeleteItem ? (
              <Button variant="danger" loading={saving} onClick={handleForceDeleteItem}>
                {t('common.forceDelete')}
              </Button>
            ) : (
              <Button variant="danger" loading={saving} onClick={handleDeleteItem}>
                {t('common.delete')}
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm text-gray-600">
          {t('menuMgmt.deleteItemConfirm', { name: deletingItem?.name ?? '' })}
        </p>
        {deleteItemError && (
          <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {deleteItemError}
          </div>
        )}
        {allowForceDeleteItem && (
          <p className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {t('menuMgmt.forceDeleteWarning')}
          </p>
        )}
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
          {/* Existing variations */}
          {variations.length > 0 ? (
            <div className="space-y-2">
              {variations.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                >
                  {editingVariationId === v.id ? (
                    <>
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingVariationName}
                          onChange={(e) => setEditingVariationName(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editingVariationPrice}
                          onChange={(e) => setEditingVariationPrice(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleSaveVariation}
                          disabled={saving || !editingVariationName.trim()}
                          className="p-1 text-green-600 hover:text-green-700 rounded disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingVariationId(null)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{v.name}</span>
                        {v.isDefault && (
                          <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            {t('menuMgmt.default')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {formatCurrency((variationsItem?.basePrice ?? 0) + v.priceDelta)}
                        </span>
                        <button
                          onClick={() => startEditingVariation(v)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteVariation(v.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              {t('menu.noVariationsYet')}
            </p>
          )}

          {/* Add variation form */}
          <div className="flex items-end gap-2 pt-2 border-t border-gray-100">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('menu.itemName')}</label>
              <input
                type="text"
                value={newVariationName}
                onChange={(e) => setNewVariationName(e.target.value)}
                placeholder={t('menuMgmt.variationNamePlaceholder')}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('menu.price')}</label>
              <input
                type="number"
                step="0.01"
                value={newVariationPrice}
                onChange={(e) => setNewVariationPrice(e.target.value)}
                placeholder="0"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={handleAddVariation}
              loading={saving}
              disabled={!newVariationName.trim()}
            >
              {t('menu.addItem')}
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
            <p className="text-sm text-gray-400 text-center py-6">
              {t('menu.noAddonGroupsYet', 'No addon groups created yet. Go to the Addons tab to create groups first.')}
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                {t('menu.selectAddonGroupsHint', 'Select which addon groups should be available for this item.')}
              </p>
              {allAddonGroups.map((group) => {
                const isLinked = itemAddonGroupIds.has(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => handleToggleItemAddonGroup(group.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                      isLinked
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isLinked ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                        }`}
                      >
                        {isLinked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{group.name}</span>
                        <span className="block text-xs text-gray-400">
                          {t('menuMgmt.addonGroupSummary', { count: (group.addons ?? []).length, rule: `${group.minSelect}-${group.maxSelect}` })} &middot;{' '}
                          {group.isRequired ? t('common.required') : t('common.optional')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </Modal>

      {/* === Add Combo Modal === */}
      <Modal
        isOpen={showComboModal}
        onClose={() => setShowComboModal(false)}
        title={editingComboId ? t('menu.editCombo', 'Edit Combo') : t('menu.addCombo')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowComboModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
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
                    });
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.comboName')}</label>
            <input
              type="text"
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              placeholder={t('menuMgmt.comboNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.price')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={comboPrice}
              onChange={(e) => setComboPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('menu.items')}</label>

            {comboItems.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {comboItems.map((ci) => {
                  const item = items.find((i) => i.id === ci.menuItemId);
                  if (!item) return null;
                  return (
                    <div key={ci.menuItemId} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(item.basePrice)}</p>
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
                          className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm">{ci.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setComboItems((prev) =>
                              prev.map((p) =>
                                p.menuItemId === ci.menuItemId ? { ...p, quantity: p.quantity + 1 } : p,
                              ),
                            )
                          }
                          className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setComboItems((prev) => prev.filter((p) => p.menuItemId !== ci.menuItemId))
                        }
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} />
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />

            {comboItemSearch.trim() && (
              <div className="mt-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
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
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50"
                    >
                      <span className="text-sm text-gray-900 truncate">{it.name}</span>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatCurrency(it.basePrice)}</span>
                    </button>
                  ))}
                {items.filter((it) => !comboItems.some((ci) => ci.menuItemId === it.id) && it.name.toLowerCase().includes(comboItemSearch.trim().toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">{t('menu.noItemsFound')}</div>
                )}
              </div>
            )}

            {comboItems.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {t('menuMgmt.individualTotal')}{' '}
                {formatCurrency(
                  comboItems.reduce((sum, ci) => {
                    const it = items.find((i) => i.id === ci.menuItemId);
                    return sum + (it ? it.basePrice * ci.quantity : 0);
                  }, 0),
                )}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MenuManagement;
