// Tablet-side API client for waiter mode. Always uses fetch — this code is
// only loaded in browser-mode for the /take-order route.

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    if (res.status === 401) {
      throw new Error(detail || 'Unauthorized — token missing or invalid');
    }
    throw new Error(detail || `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface MenuCategory {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  shortCode?: string;
  categoryId: number;
  basePrice: number;
  taxRate: number;
  isAvailable: boolean;
  isVegetarian?: boolean;
  station?: string;
}

export interface Variation {
  id: number;
  menuItemId: number;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface Addon {
  id: number;
  addonGroupId: number;
  name: string;
  price: number;
  variationPrices?: Record<string, number>;
}

export interface AddonGroup {
  id: number;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  addons: Addon[];
}

export interface Table {
  id: number;
  name: string;
  capacity: number;
  status: string;
  floorId?: number;
  floorName?: string;
  // Set by the server: another waiter (different IP) is handling this table.
  lockedToOther?: boolean;
  // Set by the server: this tablet (same IP) currently owns the table.
  ownedByMe?: boolean;
}

export const waiterApi = {
  getCategories: () => request<MenuCategory[]>('/api/menu/categories'),
  getItems: (categoryId?: number) =>
    request<MenuItem[]>(
      categoryId ? `/api/menu/items?categoryId=${categoryId}` : '/api/menu/items',
    ),
  getVariations: (itemId: number) => request<Variation[]>(`/api/menu/items/${itemId}/variations`),
  getAddonGroups: (itemId: number) => request<AddonGroup[]>(`/api/menu/items/${itemId}/addon-groups`),
  getFavorites: () => request<number[]>('/api/menu/favorites'),
  getTopSelling: (limit = 10) => request<number[]>(`/api/menu/top-selling?limit=${limit}`),
  getTables: () => request<Table[]>('/api/tables'),
  claimTable: (tableId: number) =>
    request<{ ok: true }>(`/api/tables/${tableId}/claim`, { method: 'POST', body: '{}' }),
  getOrderByTable: (tableId: number) => request<any | null>(`/api/orders/by-table/${tableId}`),
  createOrder: (data: any) => request<any>('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  addItemsToOrder: (orderId: number, items: any[]) =>
    request<any>(`/api/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
};
