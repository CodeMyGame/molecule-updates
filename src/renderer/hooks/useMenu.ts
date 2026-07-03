import { useState, useEffect, useCallback, useRef } from 'react';
import { ipc } from '../lib/ipc';

export interface MenuCategory {
  id: number;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: number;
}

export interface MenuItem {
  id: number;
  name: string;
  shortCode?: string;
  basePrice: number; // in paise
  categoryId: number;
  taxRate: number;
  isVeg: boolean;
  isAvailable?: boolean;
  imagePath?: string;
  sortOrder?: number;
  station?: string;
  has_variations?: boolean;
  has_addons?: boolean;
}

export interface Variation {
  id: number;
  name: string;
  priceDelta: number; // in paise
  menuItemId: number;
  isDefault?: boolean;
}

export interface Addon {
  id: number;
  name: string;
  price: number; // in paise (default/base price)
  menu_item_id?: number;
  addonGroupId?: number;
  variationPrices?: Record<string, number>; // variation_name → price in paise
}

export interface AddonGroup {
  id: number;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  addons?: Addon[];
}

export interface Combo {
  id: number;
  name: string;
  price: number;
  taxRate: number;
  isActive: boolean;
  items: ComboItem[];
}

export interface ComboItem {
  id: number;
  comboId: number;
  menuItemId: number;
  quantity: number;
  item_name?: string;
}

export interface CreateCategoryDTO {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: number;
}

export interface UpdateCategoryDTO {
  id: number;
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: number;
}

export interface CreateMenuItemDTO {
  name: string;
  shortCode?: string;
  categoryId: number;
  basePrice: number;
  taxRate: number;
  isVeg: boolean;
  isAvailable?: boolean;
  imagePath?: string;
  sortOrder?: number;
  station?: string;
}

export interface UpdateMenuItemDTO {
  id: number;
  name?: string;
  shortCode?: string;
  categoryId?: number;
  basePrice?: number;
  taxRate?: number;
  isVeg?: boolean;
  isAvailable?: boolean;
  imagePath?: string;
  sortOrder?: number;
  station?: string;
}

interface UseMenuReturn {
  categories: MenuCategory[];
  items: MenuItem[];
  filteredItems: MenuItem[];
  selectedCategoryId: number | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  setSelectedCategoryId: (id: number | null) => void;
  setSearchQuery: (query: string) => void;
  getVariations: (itemId: number) => Promise<Variation[]>;
  getAddons: (itemId: number) => Promise<AddonGroup[]>;
  invalidateItemCache: (itemId: number) => void;
  refetch: () => Promise<void>;
  // CRUD - categories
  createCategory: (data: CreateCategoryDTO) => Promise<MenuCategory>;
  updateCategory: (data: UpdateCategoryDTO) => Promise<MenuCategory>;
  deleteCategory: (id: number) => Promise<void>;
  // CRUD - items
  createItem: (data: CreateMenuItemDTO) => Promise<MenuItem>;
  updateItem: (data: UpdateMenuItemDTO) => Promise<MenuItem>;
  deleteItem: (id: number) => Promise<void>;
  toggleAvailability: (id: number, isAvailable: boolean) => Promise<void>;
  // Variations
  createVariation: (data: Omit<Variation, 'id'>) => Promise<Variation>;
  updateVariation: (data: Variation) => Promise<Variation>;
  deleteVariation: (id: number) => Promise<void>;
  // Addons
  getAddonGroups: () => Promise<AddonGroup[]>;
  createAddonGroup: (data: Omit<AddonGroup, 'id' | 'addons'>) => Promise<AddonGroup>;
  updateAddonGroup: (data: AddonGroup) => Promise<AddonGroup>;
  deleteAddonGroup: (id: number) => Promise<void>;
  createAddon: (data: Omit<Addon, 'id'>) => Promise<Addon>;
  updateAddon: (data: Addon) => Promise<Addon>;
  deleteAddon: (id: number) => Promise<void>;
  // Item ↔ Addon Group linking
  getItemAddonGroupIds: (menuItemId: number) => Promise<number[]>;
  linkAddonGroupToItem: (menuItemId: number, addonGroupId: number) => Promise<void>;
  unlinkAddonGroupFromItem: (menuItemId: number, addonGroupId: number) => Promise<void>;
  // Combos
  getCombos: () => Promise<Combo[]>;
  createCombo: (data: Omit<Combo, 'id'>) => Promise<Combo>;
  updateCombo: (data: Combo) => Promise<Combo>;
  deleteCombo: (id: number) => Promise<void>;
}

export function useMenu(): UseMenuReturn {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache for variations and addons
  const variationsCache = useRef<Map<number, Variation[]>>(new Map());
  const addonsCache = useRef<Map<number, AddonGroup[]>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, menuItems] = await Promise.all([
        ipc<MenuCategory[]>(window.electronAPI.menu.getCategories()),
        ipc<MenuItem[]>(window.electronAPI.menu.getItems()),
      ]);
      setCategories(cats ?? []);
      setItems(menuItems ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      selectedCategoryId === null || item.categoryId === selectedCategoryId;

    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.shortCode && item.shortCode.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const getVariations = useCallback(async (itemId: number): Promise<Variation[]> => {
    const cached = variationsCache.current.get(itemId);
    if (cached) return cached;

    try {
      const variations = await ipc<Variation[]>(window.electronAPI.menu.getVariations(itemId));
      const result = variations ?? [];
      variationsCache.current.set(itemId, result);
      return result;
    } catch {
      return [];
    }
  }, []);

  const getAddons = useCallback(async (itemId: number): Promise<AddonGroup[]> => {
    const cached = addonsCache.current.get(itemId);
    if (cached) return cached;

    try {
      const groups = await ipc<AddonGroup[]>(window.electronAPI.menu.getAddons(itemId));
      const result = groups ?? [];
      addonsCache.current.set(itemId, result);
      return result;
    } catch {
      return [];
    }
  }, []);

  const invalidateItemCache = useCallback((itemId: number) => {
    variationsCache.current.delete(itemId);
    addonsCache.current.delete(itemId);
  }, []);

  // --- Category CRUD ---

  const createCategory = useCallback(
    async (data: CreateCategoryDTO): Promise<MenuCategory> => {
      try {
        const cat = await ipc<MenuCategory>(window.electronAPI.menu.createCategory(data));
        await fetchData();
        return cat;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create category');
        throw err;
      }
    },
    [fetchData]
  );

  const updateCategory = useCallback(
    async (data: UpdateCategoryDTO): Promise<MenuCategory> => {
      try {
        const { id, ...rest } = data;
        const cat = await ipc<MenuCategory>(window.electronAPI.menu.updateCategory(id, rest));
        await fetchData();
        return cat;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update category');
        throw err;
      }
    },
    [fetchData]
  );

  const deleteCategory = useCallback(
    async (id: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.menu.deleteCategory(id));
        if (selectedCategoryId === id) {
          setSelectedCategoryId(null);
        }
        await fetchData();
      } catch (err: any) {
        setError(err.message ?? 'Failed to delete category');
        throw err;
      }
    },
    [fetchData, selectedCategoryId]
  );

  // --- Item CRUD ---

  const createItem = useCallback(
    async (data: CreateMenuItemDTO): Promise<MenuItem> => {
      try {
        const item = await ipc<MenuItem>(window.electronAPI.menu.createItem(data));
        await fetchData();
        return item;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create item');
        throw err;
      }
    },
    [fetchData]
  );

  const updateItem = useCallback(
    async (data: UpdateMenuItemDTO): Promise<MenuItem> => {
      try {
        const { id, ...rest } = data;
        const item = await ipc<MenuItem>(window.electronAPI.menu.updateItem(id, rest));
        await fetchData();
        return item;
      } catch (err: any) {
        setError(err.message ?? 'Failed to update item');
        throw err;
      }
    },
    [fetchData]
  );

  const deleteItem = useCallback(
    async (id: number): Promise<void> => {
      try {
        await ipc(window.electronAPI.menu.deleteItem(id));
        await fetchData();
      } catch (err: any) {
        setError(err.message ?? 'Failed to delete item');
        throw err;
      }
    },
    [fetchData]
  );

  const toggleAvailability = useCallback(
    async (id: number, isAvailable: boolean): Promise<void> => {
      try {
        await ipc(window.electronAPI.menu.updateItem(id, { isAvailable }));
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isAvailable } : item))
        );
      } catch (err: any) {
        setError(err.message ?? 'Failed to toggle availability');
        throw err;
      }
    },
    []
  );

  // --- Variations ---

  const createVariation = useCallback(
    async (data: Omit<Variation, 'id'>): Promise<Variation> => {
      try {
        const v = await ipc<Variation>(window.electronAPI.menu.createVariation(data));
        variationsCache.current.delete(data.menuItemId);
        return v;
      } catch (err: any) {
        setError(err.message ?? 'Failed to create variation');
        throw err;
      }
    },
    []
  );

  const updateVariation = useCallback(async (data: Variation): Promise<Variation> => {
    try {
      const { id, ...rest } = data;
      const v = await ipc<Variation>(window.electronAPI.menu.updateVariation(id, rest));
      variationsCache.current.delete(data.menuItemId);
      return v;
    } catch (err: any) {
      setError(err.message ?? 'Failed to update variation');
      throw err;
    }
  }, []);

  const deleteVariation = useCallback(async (id: number): Promise<void> => {
    try {
      await ipc(window.electronAPI.menu.deleteVariation(id));
      variationsCache.current.clear();
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete variation');
      throw err;
    }
  }, []);

  // --- Addon groups ---

  const getAddonGroups = useCallback(async (): Promise<AddonGroup[]> => {
    try {
      return (await ipc<AddonGroup[]>(window.electronAPI.menu.getAddonGroups())) ?? [];
    } catch {
      return [];
    }
  }, []);

  const createAddonGroup = useCallback(
    async (data: Omit<AddonGroup, 'id' | 'addons'>): Promise<AddonGroup> => {
      try {
        return await ipc<AddonGroup>(window.electronAPI.menu.createAddonGroup(data));
      } catch (err: any) {
        setError(err.message ?? 'Failed to create addon group');
        throw err;
      }
    },
    []
  );

  const updateAddonGroup = useCallback(async (data: AddonGroup): Promise<AddonGroup> => {
    try {
      const { id, ...rest } = data;
      return await ipc<AddonGroup>(window.electronAPI.menu.updateAddonGroup(id, rest));
    } catch (err: any) {
      setError(err.message ?? 'Failed to update addon group');
      throw err;
    }
  }, []);

  const deleteAddonGroup = useCallback(async (id: number): Promise<void> => {
    try {
      await ipc(window.electronAPI.menu.deleteAddonGroup(id));
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete addon group');
      throw err;
    }
  }, []);

  const createAddon = useCallback(async (data: Omit<Addon, 'id'>): Promise<Addon> => {
    try {
      const addon = await ipc<Addon>(window.electronAPI.menu.createAddon(data));
      addonsCache.current.clear();
      return addon;
    } catch (err: any) {
      setError(err.message ?? 'Failed to create addon');
      throw err;
    }
  }, []);

  const updateAddon = useCallback(async (data: Addon): Promise<Addon> => {
    try {
      const { id, ...rest } = data;
      const addon = await ipc<Addon>(window.electronAPI.menu.updateAddon(id, rest));
      addonsCache.current.clear();
      return addon;
    } catch (err: any) {
      setError(err.message ?? 'Failed to update addon');
      throw err;
    }
  }, []);

  const deleteAddon = useCallback(async (id: number): Promise<void> => {
    try {
      await ipc(window.electronAPI.menu.deleteAddon(id));
      addonsCache.current.clear();
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete addon');
      throw err;
    }
  }, []);

  // --- Item ↔ Addon Group linking ---

  const getItemAddonGroupIds = useCallback(async (menuItemId: number): Promise<number[]> => {
    try {
      return (await ipc<number[]>(window.electronAPI.menu.getItemAddonGroupIds(menuItemId))) ?? [];
    } catch {
      return [];
    }
  }, []);

  const linkAddonGroupToItem = useCallback(async (menuItemId: number, addonGroupId: number): Promise<void> => {
    try {
      await ipc(window.electronAPI.menu.linkAddonGroupToItem(menuItemId, addonGroupId));
      addonsCache.current.delete(menuItemId);
      await fetchData();
    } catch (err: any) {
      setError(err.message ?? 'Failed to link addon group');
      throw err;
    }
  }, [fetchData]);

  const unlinkAddonGroupFromItem = useCallback(async (menuItemId: number, addonGroupId: number): Promise<void> => {
    try {
      await ipc(window.electronAPI.menu.unlinkAddonGroupFromItem(menuItemId, addonGroupId));
      addonsCache.current.delete(menuItemId);
      await fetchData();
    } catch (err: any) {
      setError(err.message ?? 'Failed to unlink addon group');
      throw err;
    }
  }, [fetchData]);

  // --- Combos ---

  const getCombos = useCallback(async (): Promise<Combo[]> => {
    try {
      return (await ipc<Combo[]>(window.electronAPI.menu.getCombos())) ?? [];
    } catch {
      return [];
    }
  }, []);

  const createCombo = useCallback(async (data: Omit<Combo, 'id'>): Promise<Combo> => {
    try {
      return await ipc<Combo>(window.electronAPI.menu.createCombo(data));
    } catch (err: any) {
      setError(err.message ?? 'Failed to create combo');
      throw err;
    }
  }, []);

  const updateCombo = useCallback(async (data: Combo): Promise<Combo> => {
    try {
      const { id, ...rest } = data;
      return await ipc<Combo>(window.electronAPI.menu.updateCombo(id, rest));
    } catch (err: any) {
      setError(err.message ?? 'Failed to update combo');
      throw err;
    }
  }, []);

  const deleteCombo = useCallback(async (id: number): Promise<void> => {
    try {
      await ipc(window.electronAPI.menu.deleteCombo(id));
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete combo');
      throw err;
    }
  }, []);

  return {
    categories,
    items,
    filteredItems,
    selectedCategoryId,
    searchQuery,
    loading,
    error,
    setSelectedCategoryId,
    setSearchQuery,
    getVariations,
    getAddons,
    invalidateItemCache,
    refetch: fetchData,
    // Category CRUD
    createCategory,
    updateCategory,
    deleteCategory,
    // Item CRUD
    createItem,
    updateItem,
    deleteItem,
    toggleAvailability,
    // Variations
    createVariation,
    updateVariation,
    deleteVariation,
    // Addon groups
    getAddonGroups,
    createAddonGroup,
    updateAddonGroup,
    deleteAddonGroup,
    createAddon,
    updateAddon,
    deleteAddon,
    // Item ↔ Addon Group linking
    getItemAddonGroupIds,
    linkAddonGroupToItem,
    unlinkAddonGroupFromItem,
    // Combos
    getCombos,
    createCombo,
    updateCombo,
    deleteCombo,
  };
}
