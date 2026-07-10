import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Leaf, CircleDot, Loader2, TrendingUp, Star, Plus, Settings, Pencil, Trash2, Pin } from 'lucide-react';
import type { MenuCategory, MenuItem, Variation, Addon, AddonGroup } from '../../hooks/useMenu';
import { formatCurrency } from '../../lib/formatters';
import { ipc } from '../../lib/ipc';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useMenuTranslations } from '../../hooks/useMenuTranslations';
import { useTranslation } from 'react-i18next';

interface MenuGridProps {
  categories: MenuCategory[];
  items: MenuItem[];
  selectedCategoryId: number | null;
  searchQuery: string;
  onCategorySelect: (id: number | null) => void;
  onSearchChange: (query: string) => void;
  onAddToCart: (item: MenuItem, variation?: Variation, addons?: Addon[]) => void;
  getVariations: (itemId: number) => Promise<Variation[]>;
  getAddons: (itemId: number) => Promise<AddonGroup[]>;
  loading: boolean;
  compact?: boolean;
  showPrices?: boolean;
  vegFilter?: 'all' | 'veg' | 'nonveg';
  viewMode?: 'grid' | 'list';
  onItemAdded?: () => void;
  invalidateItemCache?: (itemId: number) => void;
}

const MenuGrid: React.FC<MenuGridProps> = ({
  categories,
  items,
  selectedCategoryId,
  searchQuery,
  onCategorySelect,
  onSearchChange,
  onAddToCart,
  getVariations,
  getAddons,
  loading,
  compact = false,
  showPrices = true,
  vegFilter: externalVegFilter,
  viewMode = 'grid',
  onItemAdded,
  invalidateItemCache,
}) => {
  const [variationModal, setVariationModal] = useState<{
    item: MenuItem;
    variations: Variation[];
    addonGroups: AddonGroup[];
    mode: 'order' | 'customize';
  } | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [loadingItem, setLoadingItem] = useState<number | null>(null);
  const [topSellingIds, setTopSellingIds] = useState<number[]>([]);
  const [showTopSelling, setShowTopSelling] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ name: '', basePrice: '', isVeg: true });
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [editingVariation, setEditingVariation] = useState(false);
  const [newVariationForm, setNewVariationForm] = useState({ name: '', price: '' });
  const [savingVariation, setSavingVariation] = useState(false);
  const [editingAddonGroupId, setEditingAddonGroupId] = useState<number | null>(null);
  const [newAddonForm, setNewAddonForm] = useState({ name: '', price: '' });
  const [savingAddon, setSavingAddon] = useState(false);
  const [addingNewGroup, setAddingNewGroup] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', minSelect: '0', maxSelect: '1', isRequired: false });
  const [savingGroup, setSavingGroup] = useState(false);

  const clickedItemsRef = useRef(new Set<number>());
  const confirmLockRef = useRef(false);

  // Edit state
  const [editVariationId, setEditVariationId] = useState<number | null>(null);
  const [editVariationForm, setEditVariationForm] = useState({ name: '', price: '' });
  const [editAddonId, setEditAddonId] = useState<number | null>(null);
  const [editAddonForm, setEditAddonForm] = useState({ name: '', price: '' });

  const handleSaveVariationEdit = async (variationId: number) => {
    if (!variationModal || !editVariationForm.name.trim() || !editVariationForm.price) return;
    try {
      const priceInPaise = Math.round(parseFloat(editVariationForm.price) * 100);
      const priceDelta = priceInPaise - variationModal.item.basePrice;
      await ipc(window.electronAPI.menu.updateVariation(variationId, {
        name: editVariationForm.name.trim(),
        priceDelta,
      }));
      await refreshVariationModalData(variationModal.item.id);
      setEditVariationId(null);
    } catch (err) {
      console.error('Failed to update variation', err);
    }
  };

  const handleDeleteVariation = async (variationId: number) => {
    if (!variationModal) return;
    try {
      await ipc(window.electronAPI.menu.deleteVariation(variationId));
      await refreshVariationModalData(variationModal.item.id);
      setEditVariationId(null);
    } catch (err) {
      console.error('Failed to delete variation', err);
    }
  };

  const handleSaveAddonEdit = async (addonId: number) => {
    if (!variationModal || !editAddonForm.name.trim() || editAddonForm.price === '') return;
    try {
      const priceInPaise = Math.round(parseFloat(editAddonForm.price) * 100);
      await ipc(window.electronAPI.menu.updateAddon(addonId, {
        name: editAddonForm.name.trim(),
        price: priceInPaise,
      }));
      await refreshVariationModalData(variationModal.item.id);
      setEditAddonId(null);
    } catch (err) {
      console.error('Failed to update addon', err);
    }
  };

  const handleDeleteAddon = async (addonId: number) => {
    if (!variationModal) return;
    try {
      await ipc(window.electronAPI.menu.deleteAddon(addonId));
      await refreshVariationModalData(variationModal.item.id);
      setEditAddonId(null);
    } catch (err) {
      console.error('Failed to delete addon', err);
    }
  };

  const handleQuickAddAddonGroup = async () => {
    if (!variationModal || !newGroupForm.name.trim()) return;
    setSavingGroup(true);
    try {
      const newGroup = await ipc<{ id: number }>(window.electronAPI.menu.createAddonGroup({
        name: newGroupForm.name.trim(),
        minSelect: parseInt(newGroupForm.minSelect) || 0,
        maxSelect: parseInt(newGroupForm.maxSelect) || 1,
        isRequired: newGroupForm.isRequired,
      }));
      if (newGroup?.id) {
        await ipc(window.electronAPI.menu.linkAddonGroupToItem(variationModal.item.id, newGroup.id));
        // Newly created groups are item-exclusive — mark as already isolated
        setIsolatedGroupIds((prev) => new Set(prev).add(newGroup.id));
      }
      await refreshVariationModalData(variationModal.item.id);
      setNewGroupForm({ name: '', minSelect: '0', maxSelect: '1', isRequired: false });
      setAddingNewGroup(false);
    } catch (err) {
      console.error('Failed to create addon group', err);
    } finally {
      setSavingGroup(false);
    }
  };

  const refreshVariationModalData = async (itemId: number) => {
    // Invalidate the useMenu cache so subsequent modal opens fetch fresh data
    invalidateItemCache?.(itemId);
    // Bypass useMenu's cache — call IPC directly so we see freshly-created data
    const [variations, addonGroups] = await Promise.all([
      ipc<Variation[]>(window.electronAPI.menu.getVariations(itemId)).catch(() => []),
      ipc<AddonGroup[]>(window.electronAPI.menu.getAddons(itemId)).catch(() => []),
    ]);
    setVariationModal((prev) => prev ? { ...prev, variations: variations ?? [], addonGroups: addonGroups ?? [] } : prev);
  };

  const handleQuickAddVariation = async () => {
    if (!variationModal || !newVariationForm.name.trim() || !newVariationForm.price) return;
    setSavingVariation(true);
    try {
      const priceInPaise = Math.round(parseFloat(newVariationForm.price) * 100);
      const priceDelta = priceInPaise - variationModal.item.basePrice;
      await ipc(window.electronAPI.menu.createVariation({
        menuItemId: variationModal.item.id,
        name: newVariationForm.name.trim(),
        priceDelta,
      }));
      await refreshVariationModalData(variationModal.item.id);
      setNewVariationForm({ name: '', price: '' });
      setEditingVariation(false);
    } catch (err) {
      console.error('Failed to create variation', err);
    } finally {
      setSavingVariation(false);
    }
  };

  // Tracks addon groups already isolated (cloned) for the current item in this modal session
  const [isolatedGroupIds, setIsolatedGroupIds] = useState<Set<number>>(new Set());

  // Right-click context menu on category buttons
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ x: number; y: number; category: MenuCategory } | null>(null);
  const [editCategoryDialog, setEditCategoryDialog] = useState<MenuCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const handleSaveEditCategory = async () => {
    if (!editCategoryDialog || !editCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await ipc(window.electronAPI.menu.updateCategory(editCategoryDialog.id, { name: editCategoryName.trim() }));
      setEditCategoryDialog(null);
      onItemAdded?.();
    } catch (err) {
      console.error('Failed to update category', err);
    } finally {
      setSavingCategory(false);
    }
  };
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<MenuCategory | null>(null);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);
  const [allowForceDeleteCategory, setAllowForceDeleteCategory] = useState(false);
  const confirmDeleteCategory = async () => {
    if (!deleteCategoryConfirm) return;
    const cat = deleteCategoryConfirm;
    try {
      await ipc(window.electronAPI.menu.deleteCategory(cat.id));
      if (selectedCategoryId === cat.id) onCategorySelect(null);
      setDeleteCategoryConfirm(null);
      onItemAdded?.();
    } catch (err: any) {
      setDeleteCategoryError(err?.message ?? t('menuEdit.failedDeleteCategory'));
      setAllowForceDeleteCategory(true);
    }
  };
  const forceDeleteCategoryAction = async () => {
    if (!deleteCategoryConfirm) return;
    const cat = deleteCategoryConfirm;
    try {
      await ipc(window.electronAPI.menu.forceDeleteCategory(cat.id));
      if (selectedCategoryId === cat.id) onCategorySelect(null);
      setDeleteCategoryConfirm(null);
      setAllowForceDeleteCategory(false);
      onItemAdded?.();
    } catch (err: any) {
      setDeleteCategoryError(err?.message ?? t('menuEdit.failedForceDeleteCategory'));
    }
  };

  // Right-click context menu on item cards
  const [itemContextMenu, setItemContextMenu] = useState<{ x: number; y: number; item: MenuItem } | null>(null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<MenuItem | null>(null);
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null);
  const [allowForceDeleteItem, setAllowForceDeleteItem] = useState(false);
  const confirmDeleteItem = async () => {
    if (!deleteItemConfirm) return;
    try {
      await ipc(window.electronAPI.menu.deleteItem(deleteItemConfirm.id));
      invalidateItemCache?.(deleteItemConfirm.id);
      setDeleteItemConfirm(null);
      onItemAdded?.();
    } catch (err: any) {
      setDeleteItemError(err?.message ?? t('menuEdit.failedDeleteItem'));
      setAllowForceDeleteItem(true);
    }
  };
  const forceDeleteItemAction = async () => {
    if (!deleteItemConfirm) return;
    try {
      await ipc(window.electronAPI.menu.forceDeleteItem(deleteItemConfirm.id));
      invalidateItemCache?.(deleteItemConfirm.id);
      setDeleteItemConfirm(null);
      setAllowForceDeleteItem(false);
      onItemAdded?.();
    } catch (err: any) {
      setDeleteItemError(err?.message ?? t('menuEdit.failedForceDeleteItem'));
    }
  };

  const [editPriceItem, setEditPriceItem] = useState<MenuItem | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const handleSaveItemPrice = async () => {
    if (!editPriceItem || !editPriceValue) return;
    setSavingPrice(true);
    try {
      const paise = Math.round(parseFloat(editPriceValue) * 100);
      await ipc(window.electronAPI.menu.updateItem(editPriceItem.id, { basePrice: paise }));
      invalidateItemCache?.(editPriceItem.id);
      setEditPriceItem(null);
      setEditPriceValue('');
      onItemAdded?.();
    } catch (err) {
      console.error('Failed to update price', err);
    } finally {
      setSavingPrice(false);
    }
  };
  const openItemContextMenu = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    // Use viewport coordinates so position: fixed works correctly
    setItemContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleQuickAddAddon = async (groupId: number) => {
    if (!variationModal || !newAddonForm.name.trim() || newAddonForm.price === '') return;
    setSavingAddon(true);
    try {
      const priceInPaise = Math.round(parseFloat(newAddonForm.price) * 100);
      const itemId = variationModal.item.id;
      let targetGroupId = groupId;

      // If this group hasn't already been isolated for this item, clone it so the
      // new option only affects THIS item (not all items sharing the original group)
      if (!isolatedGroupIds.has(groupId)) {
        const currentGroup = variationModal.addonGroups.find((g) => g.id === groupId);
        if (currentGroup) {
          // Create an item-exclusive copy of the addon group
          const newGroup = await ipc<{ id: number }>(window.electronAPI.menu.createAddonGroup({
            name: currentGroup.name,
            minSelect: currentGroup.minSelect,
            maxSelect: currentGroup.maxSelect,
            isRequired: currentGroup.isRequired,
          }));
          if (newGroup?.id) {
            // Copy existing addons into the clone
            for (const a of (currentGroup.addons ?? [])) {
              await ipc(window.electronAPI.menu.createAddon({
                addonGroupId: newGroup.id,
                name: a.name,
                price: a.price,
              }));
            }
            // Swap the link: original group stays linked to other items, only THIS item moves to the clone
            await ipc(window.electronAPI.menu.linkAddonGroupToItem(itemId, newGroup.id));
            await ipc(window.electronAPI.menu.unlinkAddonGroupFromItem(itemId, groupId));
            targetGroupId = newGroup.id;
            setIsolatedGroupIds((prev) => new Set(prev).add(newGroup.id));
          }
        }
      }

      await ipc(window.electronAPI.menu.createAddon({
        addonGroupId: targetGroupId,
        name: newAddonForm.name.trim(),
        price: priceInPaise,
      }));
      await refreshVariationModalData(itemId);
      setNewAddonForm({ name: '', price: '' });
      setEditingAddonGroupId(null);
    } catch (err) {
      console.error('Failed to create addon', err);
    } finally {
      setSavingAddon(false);
    }
  };

  const handleQuickAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setAddCategoryLoading(true);
    try {
      await ipc(window.electronAPI.menu.createCategory({ name: newCategoryName.trim() }));
      setShowAddCategoryDialog(false);
      setNewCategoryName('');
      onItemAdded?.();
    } catch (err) {
      console.error('Failed to create category', err);
    } finally {
      setAddCategoryLoading(false);
    }
  };

  const handleQuickAddItem = async () => {
    if (!addItemForm.name.trim() || !addItemForm.basePrice) return;
    setAddItemLoading(true);
    try {
      await ipc(window.electronAPI.menu.createItem({
        name: addItemForm.name.trim(),
        basePrice: Math.round(parseFloat(addItemForm.basePrice) * 100),
        categoryId: selectedCategoryId ?? categories[0]?.id ?? null,
        isVeg: addItemForm.isVeg,
        isAvailable: true,
      }));
      setShowAddItemDialog(false);
      setAddItemForm({ name: '', basePrice: '', isVeg: true });
      onItemAdded?.();
    } catch (err: any) {
      console.error('Failed to create item', err);
    } finally {
      setAddItemLoading(false);
    }
  };

  const toggleFavorite = useCallback(async (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    const isFav = favoriteIds.includes(itemId);
    try {
      if (isFav) {
        await ipc(window.electronAPI.favorites.remove(itemId));
        setFavoriteIds((prev) => prev.filter((id) => id !== itemId));
      } else {
        await ipc(window.electronAPI.favorites.add(itemId));
        setFavoriteIds((prev) => [...prev, itemId]);
      }
    } catch { /* ignore */ }
  }, [favoriteIds]);
  const [internalVegFilter, setInternalVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const vegFilter = externalVegFilter ?? internalVegFilter;
  const { getName } = useMenuTranslations(items);
  const { t } = useTranslation();

  useEffect(() => {
    ipc<number[]>(window.electronAPI.menu.getTopSellingIds(10))
      .then((ids) => setTopSellingIds(ids ?? []))
      .catch(() => {});
    ipc<number[]>(window.electronAPI.favorites.getAll())
      .then((ids) => setFavoriteIds(ids ?? []))
      .catch(() => {});
  }, []);

  const openCustomizeModal = useCallback(
    async (item: MenuItem) => {
      setLoadingItem(item.id);
      try {
        const [variations, addons] = await Promise.all([
          ipc<Variation[]>(window.electronAPI.menu.getVariations(item.id)).catch(() => []),
          ipc<AddonGroup[]>(window.electronAPI.menu.getAddons(item.id)).catch(() => []),
        ]);
        setSelectedVariation((variations ?? []).length > 0 ? variations![0] : null);
        setSelectedAddons([]);
        setIsolatedGroupIds(new Set());
        setEditingVariation(false);
        setEditingAddonGroupId(null);
        setAddingNewGroup(false);
        confirmLockRef.current = false;
        setVariationModal({ item, variations: variations ?? [], addonGroups: addons ?? [], mode: 'customize' });
      } catch {
        // ignore
      } finally {
        setLoadingItem(null);
      }
    },
    [],
  );

  const handleItemClick = useCallback(
    async (item: MenuItem) => {
      if (clickedItemsRef.current.has(item.id)) return;
      clickedItemsRef.current.add(item.id);
      setLoadingItem(item.id);
      try {
        // Always fetch — the has_variations/has_addons flags on `item` come from a snapshot
        // of the items list and can be stale after the user adds variations/options via
        // the customize modal. The cache makes this cheap when nothing has changed.
        const [variations, addons] = await Promise.all([
          getVariations(item.id),
          getAddons(item.id),
        ]);

        if (variations.length > 0 || addons.length > 0) {
          setSelectedVariation(variations.length > 0 ? variations[0] : null);
          setSelectedAddons([]);
          setIsolatedGroupIds(new Set());
          setEditingVariation(false);
          setEditingAddonGroupId(null);
          setAddingNewGroup(false);
          confirmLockRef.current = false;
          setVariationModal({ item, variations, addonGroups: addons, mode: 'order' });
        } else {
          onAddToCart(item);
        }
      } catch {
        // Fallback: add without variations/addons
        onAddToCart(item);
      } finally {
        setLoadingItem(null);
        clickedItemsRef.current.delete(item.id);
      }
    },
    [getVariations, getAddons, onAddToCart]
  );

  const handleConfirmVariation = useCallback(() => {
    if (!variationModal || confirmLockRef.current) return;
    confirmLockRef.current = true;
    const { item } = variationModal;
    // Resolve addon prices based on the selected variation
    const resolvedAddons = selectedAddons.map((addon) => {
      if (selectedVariation && addon.variationPrices?.[selectedVariation.name] !== undefined) {
        return { ...addon, price: addon.variationPrices[selectedVariation.name] };
      }
      return addon;
    });
    onAddToCart(
      item,
      selectedVariation ?? undefined,
      resolvedAddons.length > 0 ? resolvedAddons : undefined
    );
    setVariationModal(null);
    setSelectedVariation(null);
    setSelectedAddons([]);
  }, [variationModal, selectedVariation, selectedAddons, onAddToCart]);

  const toggleAddon = useCallback((addon: Addon, group: AddonGroup) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.id === addon.id);
      if (exists) return prev.filter((a) => a.id !== addon.id);
      const groupSelected = prev.filter((a) => a.addonGroupId === group.id).length;
      if (groupSelected >= group.maxSelect) return prev; // at group limit
      return [...prev, addon];
    });
  }, []);

  return (
    <div className="flex h-full">
      {/* Category sidebar */}
      <div className={`flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto scrollbar-thin
        ${compact ? 'w-28 py-1' : 'w-36 py-2'}`}>
        <div className="flex flex-col gap-1 px-1.5">
          <button
            onClick={() => { setShowTopSelling(false); setShowFavorites(false); onCategorySelect(null); }}
            className={`w-full text-left rounded-lg font-medium transition-colors
              ${compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}
              ${
                selectedCategoryId === null && !showTopSelling && !showFavorites
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('menuGrid.all')}
          </button>
          {favoriteIds.length > 0 && (
            <button
              onClick={() => { setShowFavorites(true); setShowTopSelling(false); onCategorySelect(null); }}
              className={`w-full text-left flex items-center gap-1.5 rounded-lg font-medium transition-colors
                ${compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}
                ${
                  showFavorites
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
            >
              <Star size={compact ? 12 : 14} />
              {t('menuEdit.favorites')}
            </button>
          )}
          {topSellingIds.length > 0 && (
            <button
              onClick={() => { setShowTopSelling(true); setShowFavorites(false); onCategorySelect(null); }}
              className={`w-full text-left flex items-center gap-1.5 rounded-lg font-medium transition-colors
                ${compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}
                ${
                  showTopSelling
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
            >
              <TrendingUp size={compact ? 12 : 14} />
              {t('menuGrid.top10')}
            </button>
          )}
          {categories.map((cat, index) => (
            <button
              key={cat.id}
              onClick={() => { setShowTopSelling(false); setShowFavorites(false); onCategorySelect(cat.id); }}
              onContextMenu={(e) => { e.preventDefault(); setCategoryContextMenu({ x: e.clientX, y: e.clientY, category: cat }); }}
              className={`w-full text-left rounded-lg font-medium transition-colors
                ${compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}
                ${
                  selectedCategoryId === cat.id && !showTopSelling && !showFavorites
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              title={index < 12 ? `F${index + 1}` : undefined}
            >
                {cat.name}
            </button>
          ))}
          {/* Add category button */}
          <button
            onClick={() => setShowAddCategoryDialog(true)}
            className={`group w-full flex items-center gap-1.5 rounded-lg font-medium transition-colors text-gray-400 hover:text-blue-600 hover:bg-blue-50 border-2 border-dashed border-gray-200 hover:border-blue-300 justify-center
              ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
          >
            <Plus size={compact ? 12 : 14} />
            {t('common.add')}
          </button>
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search bar */}
        <div className={compact ? 'px-3 pt-2 pb-1' : 'px-4 pt-4 pb-2'}>
          <div className="relative">
            <Search
              size={compact ? 14 : 18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('menuGrid.searchPlaceholder')}
              className={`w-full bg-white border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400
                placeholder:text-gray-400 transition-shadow
                ${compact ? 'pl-8 py-1.5 text-xs' : 'pl-10 py-2.5 text-sm'}
                pr-4`}
            />
          </div>
        </div>

        {!externalVegFilter && (
          <div className={`${compact ? 'px-3 pb-1' : 'px-4 pb-2'} flex items-center gap-2`}>
            <span className="text-xs text-gray-400 mr-1">{t('menuGrid.filter')}</span>
            {([
              { key: 'all' as const, label: t('menuGrid.all'), color: 'bg-gray-600' },
              { key: 'veg' as const, label: t('menu.veg'), color: 'bg-green-600' },
              { key: 'nonveg' as const, label: t('menu.nonVeg'), color: 'bg-red-600' },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setInternalVegFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${vegFilter === key
                    ? `${color} text-white`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {key === 'veg' && <CircleDot size={10} className={vegFilter === key ? 'text-white' : 'text-green-600'} />}
                {key === 'nonveg' && <CircleDot size={10} className={vegFilter === key ? 'text-white' : 'text-red-600'} />}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Item grid */}
        <div className={`flex-1 overflow-y-auto ${compact ? 'px-3 pb-3' : 'px-4 pb-4'}`}>
        {(() => {
          let displayItems = showFavorites
            ? favoriteIds
                .map((id) => items.find((i) => i.id === id))
                .filter((i): i is MenuItem => i !== undefined)
            : showTopSelling
            ? topSellingIds
                .map((id) => items.find((i) => i.id === id))
                .filter((i): i is MenuItem => i !== undefined)
            : items;

          if (vegFilter === 'veg') displayItems = displayItems.filter((i) => i.isVeg);
          else if (vegFilter === 'nonveg') displayItems = displayItems.filter((i) => !i.isVeg);

          if (loading) {
            return (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            );
          }
          if (displayItems.length === 0 && (showTopSelling || showFavorites || selectedCategoryId === null)) {
            return (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Search size={40} strokeWidth={1.5} />
                <p className="mt-2 text-sm">{showTopSelling ? t('menuGrid.noTopSelling') : t('menuGrid.noItemsFound')}</p>
              </div>
            );
          }
          if (displayItems.length === 0 && selectedCategoryId !== null) {
            return (
              <div className={`grid ${compact ? 'grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-1.5' : 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2'}`}>
                <button
                  onClick={() => setShowAddItemDialog(true)}
                  className={`group relative flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-200
                    rounded-lg text-left transition-all duration-150 select-none
                    hover:border-blue-400 hover:bg-blue-50/50
                    ${compact ? 'p-2 min-h-[68px]' : 'p-2.5 min-h-[80px]'}`}
                >
                  <Plus size={compact ? 18 : 22} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                  <span className={`text-gray-300 group-hover:text-blue-400 transition-colors font-medium ${compact ? 'text-[10px] mt-0.5' : 'text-[11px] mt-1'}`}>
                    {t('menuEdit.addItem')}
                  </span>
                </button>
              </div>
            );
          }
          if (viewMode === 'list') {
            return (
              <div className="columns-2 xl:columns-3 2xl:columns-4 gap-1">
                {displayItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    disabled={loadingItem === item.id}
                    className="relative w-full flex items-center gap-1.5 bg-white border border-gray-200
                      rounded px-2 py-[5px] text-left transition-all duration-100
                      hover:border-blue-300 hover:bg-blue-50 active:scale-[0.98]
                      focus:outline-none focus:ring-1 focus:ring-blue-300
                      disabled:opacity-60 disabled:cursor-wait select-none mb-0.5 break-inside-avoid"
                  >
                    {item.isVeg ? (
                      <div className="flex-shrink-0 w-2.5 h-2.5 border-[1.5px] border-green-600 rounded-sm flex items-center justify-center">
                        <CircleDot size={5} className="text-green-600" />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-2.5 h-2.5 border-[1.5px] border-red-600 rounded-sm flex items-center justify-center">
                        <CircleDot size={5} className="text-red-600" />
                      </div>
                    )}
                    <span className="flex-1 font-medium text-gray-900 text-[11px] leading-tight truncate">
                      {getName(item)}
                    </span>
                    {showPrices && (
                      <span className="flex-shrink-0 font-semibold text-blue-700 text-[11px]">
                        {formatCurrency(item.basePrice)}
                      </span>
                    )}
                    <span
                      onClick={(e) => toggleFavorite(e, item.id)}
                      className={`flex-shrink-0 cursor-pointer transition-colors ${favoriteIds.includes(item.id) ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}
                    >
                      <Star size={10} fill={favoriteIds.includes(item.id) ? 'currentColor' : 'none'} />
                    </span>
                    {loadingItem === item.id && (
                      <Loader2 size={12} className="flex-shrink-0 text-blue-500 animate-spin" />
                    )}
                  </button>
                ))}
              </div>
            );
          }
          return (
          <div className={`grid ${compact ? 'grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-1.5' : 'grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2'}`}>
            {displayItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                onContextMenu={(e) => { e.preventDefault(); openItemContextMenu(e, item); }}
                disabled={loadingItem === item.id}
                className={`relative flex flex-col items-start bg-white border border-gray-200
                  rounded-lg text-left transition-all duration-150
                  hover:border-blue-300 hover:shadow-md active:scale-[0.97] active:shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-300
                  disabled:opacity-60 disabled:cursor-wait select-none
                  ${compact ? 'p-2 min-h-[68px]' : 'p-2.5 min-h-[80px]'}`}
              >
                {/* Veg / Non-veg indicator */}
                <div className={`absolute ${compact ? 'top-1 right-1' : 'top-1.5 right-1.5'}`}>
                  {item.isVeg ? (
                    <div className={`border-2 border-green-600 rounded-sm flex items-center justify-center ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`}>
                      <CircleDot size={compact ? 5 : 6} className="text-green-600" />
                    </div>
                  ) : (
                    <div className={`border-2 border-red-600 rounded-sm flex items-center justify-center ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`}>
                      <CircleDot size={compact ? 5 : 6} className="text-red-600" />
                    </div>
                  )}
                </div>

                {item.isPinned && (
                  <span className={`absolute ${compact ? 'top-1 right-5' : 'top-1.5 right-6'} text-blue-500`} title={t('common.pinned')}>
                    <Pin size={compact ? 9 : 11} className="fill-current" />
                  </span>
                )}

                {loadingItem === item.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
                    <Loader2 size={16} className="text-blue-500 animate-spin" />
                  </div>
                )}

                <span className={`font-medium text-gray-900 leading-tight line-clamp-2 ${compact ? 'text-[11px] pr-3' : 'text-xs pr-4'}`}>
                  {getName(item)}
                </span>

                {item.shortCode && !compact && (
                  <span className="text-[9px] text-gray-400 mt-0.5">{item.shortCode}</span>
                )}

                <div className={`mt-auto flex items-center justify-between w-full ${compact ? 'pt-1' : 'pt-1.5'}`}>
                  {showPrices ? (
                    <span className={`font-semibold text-blue-700 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                      {formatCurrency(item.basePrice)}
                    </span>
                  ) : <span />}
                  <span
                    onClick={(e) => toggleFavorite(e, item.id)}
                    className={`cursor-pointer transition-colors ${favoriteIds.includes(item.id) ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}
                  >
                    <Star size={compact ? 10 : 12} fill={favoriteIds.includes(item.id) ? 'currentColor' : 'none'} />
                  </span>
                </div>

                {(item.has_variations || item.has_addons) && !compact && (
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    {item.has_variations ? t('menuGrid.customizable') : t('menuGrid.addonsShort')}
                  </span>
                )}
              </button>
            ))}
            {/* Add new item card — only for real categories, not virtual views */}
            {selectedCategoryId !== null && !showTopSelling && !showFavorites && <button
              onClick={() => setShowAddItemDialog(true)}
              className={`group relative flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-200
                rounded-lg text-left transition-all duration-150 select-none
                hover:border-blue-400 hover:bg-blue-50/50
                ${compact ? 'p-2 min-h-[68px]' : 'p-2.5 min-h-[80px]'}`}
            >
              <Plus size={compact ? 18 : 22} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
              <span className={`text-gray-300 group-hover:text-blue-400 transition-colors font-medium ${compact ? 'text-[10px] mt-0.5' : 'text-[11px] mt-1'}`}>
                {t('menuEdit.addItem')}
              </span>
            </button>}
          </div>
          );
        })()}
      </div>
      </div>

      {/* Variation / Addon picker modal */}
      {variationModal && (
        <Modal
          isOpen={true}
          onClose={() => setVariationModal(null)}
          title={t('menuGrid.customizeTitle', { name: variationModal.item.name })}
          size="md"
          footer={
            <div className="flex gap-2 w-full">
              <Button variant="secondary" onClick={() => setVariationModal(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={variationModal.mode === 'customize' ? () => setVariationModal(null) : handleConfirmVariation}
                fullWidth
              >
                {variationModal.mode === 'customize' ? t('common.save') : t('menuGrid.addToCart')}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Variations */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('menuGrid.selectVariation')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {variationModal.variations.map((v) => (
                  editVariationId === v.id ? (
                    <div key={v.id} className="p-2 rounded-lg border border-blue-300 bg-blue-50/30 space-y-1.5">
                      <input
                        autoFocus
                        type="text"
                        value={editVariationForm.name}
                        onChange={(e) => setEditVariationForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editVariationForm.price}
                        onChange={(e) => setEditVariationForm((f) => ({ ...f, price: e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <div className="flex gap-1">
                        <button onClick={() => handleDeleteVariation(v.id)} className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
                          <Trash2 size={11} />
                        </button>
                        <button onClick={() => setEditVariationId(null)} className="flex-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                          {t('common.cancel')}
                        </button>
                        <button onClick={() => handleSaveVariationEdit(v.id)} className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={v.id} className="relative group/var">
                      <button
                        onClick={() => setSelectedVariation(v)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors text-sm
                          ${
                            selectedVariation?.id === v.id
                              ? 'border-blue-500 bg-blue-50 text-blue-800'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                      >
                        <span className="font-medium">{v.name}</span>
                        <span className="block text-xs mt-0.5 opacity-80">
                          {formatCurrency(variationModal.item.basePrice + v.priceDelta)}
                        </span>
                      </button>
                      {variationModal.mode === 'customize' && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditVariationForm({
                              name: v.name,
                              price: ((variationModal.item.basePrice + v.priceDelta) / 100).toFixed(2),
                            });
                            setEditVariationId(v.id);
                          }}
                          title={t('menuEdit.editVariation')}
                          className="absolute top-1.5 right-1.5 opacity-0 group-hover/var:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-white cursor-pointer"
                        >
                          <Pencil size={11} />
                        </span>
                      )}
                    </div>
                  )
                ))}
                {editingVariation ? (
                  <div className="p-2 rounded-lg border border-blue-300 bg-blue-50/30 space-y-1.5 col-span-2">
                    <input
                      autoFocus
                      type="text"
                      value={newVariationForm.name}
                      onChange={(e) => setNewVariationForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t('menuEdit.variationNamePlaceholder')}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newVariationForm.price}
                      onChange={(e) => setNewVariationForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder={t('common.price')}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setEditingVariation(false); setNewVariationForm({ name: '', price: '' }); }}
                        className="flex-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handleQuickAddVariation}
                        disabled={savingVariation || !newVariationForm.name.trim() || !newVariationForm.price}
                        className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingVariation ? t('common.saving') : t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : variationModal.mode === 'customize' ? (
                  <button
                    onClick={() => setEditingVariation(true)}
                    className="p-3 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
                  >
                    <Plus size={14} /> {t('menuEdit.addVariation')}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Addons */}
            <div className="space-y-4">
              {variationModal.addonGroups.map((group) => {
                  const groupSelected = selectedAddons.filter((a) => a.addonGroupId === group.id).length;
                  return (
                    <div key={group.id}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">
                          {group.name}
                          {group.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </h4>
                        <span className="text-xs text-gray-400">
                          {t('menuGrid.selectedCount', { selected: groupSelected, max: group.maxSelect })}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {(group.addons ?? []).map((addon) => {
                          const isSelected = selectedAddons.some((a) => a.id === addon.id);
                          const atLimit = !isSelected && groupSelected >= group.maxSelect;
                          if (editAddonId === addon.id) {
                            return (
                              <div key={addon.id} className="p-2 rounded-lg border border-blue-300 bg-blue-50/30 space-y-1.5">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editAddonForm.name}
                                  onChange={(e) => setEditAddonForm((f) => ({ ...f, name: e.target.value }))}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editAddonForm.price}
                                  onChange={(e) => setEditAddonForm((f) => ({ ...f, price: e.target.value }))}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                <div className="flex gap-1">
                                  <button onClick={() => handleDeleteAddon(addon.id)} className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
                                    <Trash2 size={11} />
                                  </button>
                                  <button onClick={() => setEditAddonId(null)} className="flex-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
                                    {t('common.cancel')}
                                  </button>
                                  <button onClick={() => handleSaveAddonEdit(addon.id)} className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
                                    {t('common.save')}
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={addon.id} className="relative group/addon">
                              <button
                                onClick={() => toggleAddon(addon, group)}
                                disabled={atLimit}
                                className={`w-full flex items-center justify-between p-3 rounded-lg border
                                  transition-colors text-sm
                                  ${isSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : atLimit
                                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center
                                    ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                                  >
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24"
                                        stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-gray-700">{addon.name}</span>
                                </div>
                                <span className="text-gray-500 text-xs pr-6">
                                  +{formatCurrency(
                                    (selectedVariation && addon.variationPrices?.[selectedVariation.name])
                                      ?? addon.price
                                  )}
                                </span>
                              </button>
                              {variationModal.mode === 'customize' && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditAddonForm({
                                      name: addon.name,
                                      price: (addon.price / 100).toFixed(2),
                                    });
                                    setEditAddonId(addon.id);
                                  }}
                                  title={t('menuEdit.editOption')}
                                  className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover/addon:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-white cursor-pointer"
                                >
                                  <Pencil size={11} />
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {/* Add option inline form / button */}
                        {editingAddonGroupId === group.id ? (
                          <div className="p-2 rounded-lg border border-blue-300 bg-blue-50/30 space-y-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={newAddonForm.name}
                              onChange={(e) => setNewAddonForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder={t('menuEdit.optionNamePlaceholder')}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newAddonForm.price}
                              onChange={(e) => setNewAddonForm((f) => ({ ...f, price: e.target.value }))}
                              placeholder={t('menuEdit.extraPricePlaceholder')}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { setEditingAddonGroupId(null); setNewAddonForm({ name: '', price: '' }); }}
                                className="flex-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                              >
                                {t('common.cancel')}
                              </button>
                              <button
                                onClick={() => handleQuickAddAddon(group.id)}
                                disabled={savingAddon || !newAddonForm.name.trim() || newAddonForm.price === ''}
                                className="flex-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingAddon ? t('common.saving') : t('common.save')}
                              </button>
                            </div>
                          </div>
                        ) : variationModal.mode === 'customize' ? (
                          <button
                            onClick={() => { setEditingAddonGroupId(group.id); setNewAddonForm({ name: '', price: '' }); }}
                            className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors text-sm font-medium"
                          >
                            <Plus size={14} /> {t('menuEdit.addOption')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {/* Add a new addon group */}
                {addingNewGroup ? (
                  <div className="p-3 rounded-lg border border-blue-300 bg-blue-50/30 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">{t('menuEdit.newAddonGroup')}</h4>
                    <input
                      autoFocus
                      type="text"
                      value={newGroupForm.name}
                      onChange={(e) => setNewGroupForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t('menuEdit.groupNamePlaceholder')}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-0.5">{t('menuEdit.minSelect')}</label>
                        <input
                          type="number"
                          min="0"
                          value={newGroupForm.minSelect}
                          onChange={(e) => setNewGroupForm((f) => ({ ...f, minSelect: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-500 mb-0.5">{t('menuEdit.maxSelect')}</label>
                        <input
                          type="number"
                          min="1"
                          value={newGroupForm.maxSelect}
                          onChange={(e) => setNewGroupForm((f) => ({ ...f, maxSelect: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 mt-4">
                        <input
                          type="checkbox"
                          checked={newGroupForm.isRequired}
                          onChange={(e) => setNewGroupForm((f) => ({ ...f, isRequired: e.target.checked }))}
                          className="rounded"
                        />
                        {t('common.required')}
                      </label>
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => { setAddingNewGroup(false); setNewGroupForm({ name: '', minSelect: '0', maxSelect: '1', isRequired: false }); }}
                        className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        onClick={handleQuickAddAddonGroup}
                        disabled={savingGroup || !newGroupForm.name.trim()}
                        className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingGroup ? t('common.saving') : t('menuEdit.createGroup')}
                      </button>
                    </div>
                  </div>
                ) : variationModal.mode === 'customize' ? (
                  <button
                    onClick={() => setAddingNewGroup(true)}
                    className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-colors text-sm font-medium"
                  >
                    <Plus size={14} /> {variationModal.addonGroups.length === 0 ? t('menuEdit.addAddonGroupHint') : t('menuEdit.addAddonGroup')}
                  </button>
                ) : null}
              </div>
          </div>
        </Modal>
      )}

      {/* Item context menu (right-click) — portaled to body so it isn't clipped */}
      {itemContextMenu && createPortal(
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setItemContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setItemContextMenu(null); }}
        >
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]"
            style={{ left: itemContextMenu.x, top: itemContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              {itemContextMenu.item.name}
            </div>
            <button
              onClick={() => {
                const item = itemContextMenu.item;
                setItemContextMenu(null);
                openCustomizeModal(item);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings size={14} className="text-gray-500" />
              {t('menuEdit.customizeItem')}
            </button>
            <button
              onClick={() => {
                const item = itemContextMenu.item;
                setItemContextMenu(null);
                setEditPriceItem(item);
                setEditPriceValue((item.basePrice / 100).toFixed(2));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} className="text-gray-500" />
              {t('menuEdit.editPrice')}
            </button>
            <button
              onClick={() => {
                const item = itemContextMenu.item;
                setItemContextMenu(null);
                setDeleteItemError(null);
                setAllowForceDeleteItem(false);
                setDeleteItemConfirm(item);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              {t('menuEdit.deleteItem')}
            </button>
            {(() => {
              const isFav = favoriteIds.includes(itemContextMenu.item.id);
              return (
                <button
                  onClick={(e) => {
                    const itemId = itemContextMenu.item.id;
                    setItemContextMenu(null);
                    toggleFavorite(e, itemId);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Star
                    size={14}
                    className={isFav ? 'text-amber-400' : 'text-gray-500'}
                    fill={isFav ? 'currentColor' : 'none'}
                  />
                  {isFav ? t('menuEdit.removeFromFavorites') : t('menuEdit.addToFavorites')}
                </button>
              );
            })()}
            <button
              onClick={async () => {
                const item = itemContextMenu.item;
                setItemContextMenu(null);
                try {
                  await ipc(window.electronAPI.menu.togglePin(item.id));
                  onItemAdded?.();
                } catch { /* ignore */ }
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pin
                size={14}
                className={itemContextMenu.item.isPinned ? 'text-blue-500' : 'text-gray-500'}
                fill={itemContextMenu.item.isPinned ? 'currentColor' : 'none'}
              />
              {itemContextMenu.item.isPinned ? t('common.unpinFromTop') : t('common.pinToTop')}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Category right-click context menu */}
      {categoryContextMenu && createPortal(
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setCategoryContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setCategoryContextMenu(null); }}
        >
          <div
            className="absolute bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]"
            style={{ left: categoryContextMenu.x, top: categoryContextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              {categoryContextMenu.category.name}
            </div>
            <button
              onClick={() => {
                const cat = categoryContextMenu.category;
                setCategoryContextMenu(null);
                setEditCategoryDialog(cat);
                setEditCategoryName(cat.name);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} className="text-gray-500" />
              {t('menuEdit.renameCategory')}
            </button>
            <button
              onClick={() => {
                const cat = categoryContextMenu.category;
                setCategoryContextMenu(null);
                setDeleteCategoryError(null);
                setAllowForceDeleteCategory(false);
                setDeleteCategoryConfirm(cat);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              {t('menuEdit.deleteCategory')}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Item Confirmation */}
      {deleteItemConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setDeleteItemConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('menuEdit.deleteItem')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('menuEdit.deleteItemConfirm', { name: deleteItemConfirm.name })}
            </p>
            {deleteItemError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {deleteItemError}
              </div>
            )}
            {allowForceDeleteItem && (
              <p className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                {t('menuEdit.forceDeleteItemWarning')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleteItemConfirm(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              {allowForceDeleteItem ? (
                <button onClick={forceDeleteItemAction} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800">{t('common.forceDelete')}</button>
              ) : (
                <button onClick={confirmDeleteItem} className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">{t('common.delete')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation */}
      {deleteCategoryConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setDeleteCategoryConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('menuEdit.deleteCategory')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('menuEdit.deleteCategoryConfirm', { name: deleteCategoryConfirm.name })}
            </p>
            {deleteCategoryError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {deleteCategoryError}
              </div>
            )}
            {allowForceDeleteCategory && (
              <p className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                {t('menuEdit.forceDeleteCategoryWarning')}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setDeleteCategoryConfirm(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              {allowForceDeleteCategory ? (
                <button
                  onClick={forceDeleteCategoryAction}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800"
                >
                  {t('common.forceDelete')}
                </button>
              ) : (
                <button
                  onClick={confirmDeleteCategory}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rename Category Dialog */}
      {editCategoryDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setEditCategoryDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('menuEdit.renameCategoryTitle')}</h3>
            <input
              autoFocus
              type="text"
              value={editCategoryName}
              onChange={(e) => setEditCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditCategory()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditCategoryDialog(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              <button
                onClick={handleSaveEditCategory}
                disabled={savingCategory || !editCategoryName.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingCategory ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Price Dialog */}
      {editPriceItem && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setEditPriceItem(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('menuEdit.editPrice')}</h3>
            <p className="text-xs text-gray-500 mb-4">{editPriceItem.name}</p>
            <input
              autoFocus
              type="number"
              min="0"
              step="0.01"
              value={editPriceValue}
              onChange={(e) => setEditPriceValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveItemPrice()}
              placeholder={t('common.price')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditPriceItem(null)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveItemPrice}
                disabled={savingPrice || !editPriceValue}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPrice ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Dialog */}
      {showAddCategoryDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setShowAddCategoryDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-72 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('menuEdit.addCategory')}</h3>
            <input
              autoFocus
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAddCategory()}
              placeholder={t('menuEdit.categoryNamePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddCategoryDialog(false)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleQuickAddCategory}
                disabled={addCategoryLoading || !newCategoryName.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addCategoryLoading ? t('common.adding') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Item Dialog */}
      {showAddItemDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30" onClick={() => setShowAddItemDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('menuEdit.addMenuItem')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('menuEdit.itemName')}</label>
                <input
                  autoFocus
                  type="text"
                  value={addItemForm.name}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('menuEdit.itemNamePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.price')}</label>
                <input
                  type="number"
                  value={addItemForm.basePrice}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, basePrice: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600">{t('common.type')}</span>
                <button
                  onClick={() => setAddItemForm((f) => ({ ...f, isVeg: true }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${addItemForm.isVeg ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}
                >
                  <span className="w-2 h-2 rounded-full bg-green-500" /> {t('common.veg')}
                </button>
                <button
                  onClick={() => setAddItemForm((f) => ({ ...f, isVeg: false }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!addItemForm.isVeg ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" /> {t('common.nonVeg')}
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAddItemDialog(false)} className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                {t('common.cancel')}
              </button>
              <button
                onClick={handleQuickAddItem}
                disabled={addItemLoading || !addItemForm.name.trim() || !addItemForm.basePrice}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addItemLoading ? t('common.adding') : t('menuEdit.addItem')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuGrid;
