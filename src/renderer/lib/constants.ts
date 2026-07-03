export const PAYMENT_MODES = {
  cash: { label: 'Cash', icon: 'Banknote' },
  card: { label: 'Card', icon: 'CreditCard' },
  upi: { label: 'UPI', icon: 'Smartphone' },
  wallet: { label: 'Wallet', icon: 'Wallet' },
  credit: { label: 'Credit', icon: 'FileText' },
} as const;

export const ORDER_TYPES = {
  dine_in: { label: 'Dine In' },
  takeaway: { label: 'Takeaway' },
  delivery: { label: 'Delivery' },
} as const;

export const TABLE_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  available: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
  occupied: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  reserved: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
  blocked: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300' },
};

export const KOT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  preparing: { bg: 'bg-blue-100', text: 'text-blue-800' },
  ready: { bg: 'bg-green-100', text: 'text-green-800' },
  served: { bg: 'bg-gray-100', text: 'text-gray-800' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
};

export const TAX_RATE_OPTIONS = [5, 12, 18, 28] as const;

export const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { bg: 'bg-green-100', text: 'text-green-800' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
  hold: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
};
