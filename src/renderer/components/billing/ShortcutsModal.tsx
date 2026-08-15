import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  Search,
  ShoppingCart,
  Utensils,
  Layers,
  ChefHat,
  X,
} from 'lucide-react';
import Modal from '../common/Modal';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'checkout' | 'kitchen' | 'navigation' | 'modes';
}

const SHORTCUTS: ShortcutItem[] = [
  // Billing & Checkout
  {
    keys: ['Space', 'or', 'Ctrl', 'P'],
    description: 'Quick Pay / Open Checkout Modal',
    category: 'checkout',
  },
  {
    keys: ['Enter'],
    description: 'Confirm & Settle Payment (inside Payment Modal)',
    category: 'checkout',
  },
  {
    keys: ['Ctrl', 'D'],
    description: 'Open Discount & Coupon Dialog',
    category: 'checkout',
  },
  {
    keys: ['Ctrl', 'H'],
    description: 'Hold Current Order',
    category: 'checkout',
  },
  {
    keys: ['Ctrl', 'B'],
    description: 'Preview Thermal / PDF Bill',
    category: 'checkout',
  },
  {
    keys: ['Ctrl', 'T'],
    description: 'Add Custom Temporary Item to Cart',
    category: 'checkout',
  },

  // Kitchen & KOT
  {
    keys: ['Ctrl', 'K'],
    description: 'Send KOT to Kitchen (Digital Only)',
    category: 'kitchen',
  },
  {
    keys: ['Ctrl', 'Shift', 'K'],
    description: 'Print KOT & Send to Kitchen (Thermal + Digital)',
    category: 'kitchen',
  },

  // Category & Navigation
  {
    keys: ['F1'],
    description: 'Show "All" Categories',
    category: 'navigation',
  },
  {
    keys: ['F2', '–', 'F12'],
    description: 'Quick Jump to Category 1 to 11',
    category: 'navigation',
  },
  {
    keys: ['/'],
    description: 'Focus Menu Item Search Bar',
    category: 'navigation',
  },
  {
    keys: ['?', 'or', 'Ctrl', '/'],
    description: 'Open this Keyboard Shortcuts Cheat Sheet',
    category: 'navigation',
  },
  {
    keys: ['Esc'],
    description: 'Close Modals / Deselect / Clear',
    category: 'navigation',
  },

  // Order Modes
  {
    keys: ['Alt', '1'],
    description: 'Switch to Dine-In Mode',
    category: 'modes',
  },
  {
    keys: ['Alt', '2'],
    description: 'Switch to Takeaway Mode',
    category: 'modes',
  },
  {
    keys: ['Alt', '3'],
    description: 'Switch to Delivery Mode',
    category: 'modes',
  },
];

const CATEGORY_META = {
  checkout: {
    label: 'Billing & Checkout',
    icon: ShoppingCart,
    color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800',
  },
  kitchen: {
    label: 'Kitchen & KOT',
    icon: ChefHat,
    color: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800',
  },
  navigation: {
    label: 'Categories & Navigation',
    icon: Layers,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800',
  },
  modes: {
    label: 'Order Modes',
    icon: Utensils,
    color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800',
  },
};

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredShortcuts = SHORTCUTS.filter((s) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      s.description.toLowerCase().includes(query) ||
      s.keys.some((k) => k.toLowerCase().includes(query)) ||
      CATEGORY_META[s.category].label.toLowerCase().includes(query)
    );
  });

  const categories: Array<keyof typeof CATEGORY_META> = [
    'checkout',
    'kitchen',
    'navigation',
    'modes',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('shortcuts.title', 'POS Keyboard Shortcuts (Cheat Sheet)')}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full text-xs text-gray-500">
          <span>{t('shortcuts.footerHint', 'Press Esc or click outside to dismiss.')}</span>
          <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-[11px] font-mono">
            Esc
          </kbd>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('shortcuts.searchPlaceholder', 'Search shortcuts (e.g. Pay, KOT, F1)...')}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Categories Grid */}
        <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
          {categories.map((catKey) => {
            const items = filteredShortcuts.filter((s) => s.category === catKey);
            if (items.length === 0) return null;
            const meta = CATEGORY_META[catKey];
            const Icon = meta.icon;

            return (
              <div key={catKey} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Category Header */}
                <div className={`px-3 py-2 border-b flex items-center gap-2 ${meta.color}`}>
                  <Icon size={14} />
                  <span className="text-xs font-bold">{meta.label}</span>
                  <span className="text-[10px] opacity-75 font-normal ml-auto">
                    {items.length} {items.length === 1 ? 'shortcut' : 'shortcuts'}
                  </span>
                </div>

                {/* Shortcut Rows */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.keys.map((k, kIdx) =>
                          k === '–' || k === 'or' ? (
                            <span key={kIdx} className="text-[10px] text-gray-400 px-0.5">
                              {k}
                            </span>
                          ) : (
                            <kbd
                              key={kIdx}
                              className="px-2 py-1 min-w-[24px] text-center text-[11px] font-mono font-bold text-gray-800 dark:text-gray-200 bg-gradient-to-b from-gray-50 to-gray-200 dark:from-gray-700 dark:to-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-xs"
                            >
                              {k}
                            </kbd>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredShortcuts.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Keyboard size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">{t('shortcuts.noResults', 'No matching shortcuts found.')}</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ShortcutsModal;
