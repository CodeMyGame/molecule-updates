export interface MenuCategory {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  parentId?: number;
}

export interface MenuItem {
  id: number;
  name: string;
  shortCode: string;
  categoryId: number;
  basePrice: number;
  taxRate: number;
  isVeg: boolean;
  isAvailable: boolean;
  imagePath?: string;
  sortOrder: number;
  station?: string;
  isPinned?: boolean;
}

export interface ItemVariation {
  id: number;
  menuItemId: number;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface AddonGroup {
  id: number;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
}

export interface Addon {
  id: number;
  addonGroupId: number;
  name: string;
  price: number;
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
}

export interface CreateMenuItemDTO {
  name: string;
  shortCode: string;
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
