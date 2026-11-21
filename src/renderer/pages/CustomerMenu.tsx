import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Wifi,
  Download,
  QrCode,
  Share2,
  Copy,
  Check,
  X,
  Info,
  Utensils,
  ArrowUp,
  Palette,
  ChevronDown,
} from 'lucide-react';
import {
  downloadMenuImage,
  type MenuDataPayload,
  type MenuCategoryData,
  type MenuItemData,
  type MenuTheme,
  MENU_THEME_CATALOG,
} from '../lib/menuCanvasGenerator';
import { downloadTableCardImage } from '../lib/tableCardGenerator';
import { renderQrDataUri } from '../../shared/qr-render';

interface CustomerThemeStyle {
  id: MenuTheme;
  name: string;
  tagline: string;
  isDark: boolean;
  pageBg: string;
  stickyBg: string;
  stickyBorder: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  outerBoardBorder: string;
  outerBoardBg: string;
  innerFrameBorder: string;
  cornerAccentColor: string;
  titleColor: string;
  subtitleColor: string;
  metaColor: string;
  dividerLine: string;
  dividerDiamond: string;
  categoryPillBg: string;
  categoryPillBorder: string;
  categoryPillText: string;
  itemNameColor: string;
  itemPriceColor: string;
  descColor: string;
  leaderDotBorder: string;
  footerBorder: string;
  footerTextColor: string;
  footerSubColor: string;
  footerQrText: string;
  footerQrBoxBorder: string;
  vegBorder: string;
  vegDot: string;
  nonVegBorder: string;
  nonVegDot: string;
  pillActiveBg: string;
  accentPill: string;
}

const CUSTOMER_THEMES: Record<MenuTheme, CustomerThemeStyle> = {
  noir: {
    id: 'noir',
    name: 'Modern Noir',
    tagline: 'Obsidian Black & Gold Luxury',
    isDark: true,
    pageBg: 'bg-[#070b14]',
    stickyBg: 'bg-[#0b0f19]/95 border-slate-800/80',
    stickyBorder: 'border-slate-800/80',
    inputBg: 'bg-[#131b2e]',
    inputBorder: 'border-slate-800 focus:border-amber-500/60',
    inputText: 'text-slate-200',
    inputPlaceholder: 'placeholder:text-slate-500',
    outerBoardBorder: 'border-[#d4af37]',
    outerBoardBg: 'bg-gradient-to-b from-[#0b0f19] via-[#080d19] to-[#030712]',
    innerFrameBorder: 'border-[#fbbf24]/50',
    cornerAccentColor: '#fbbf24',
    titleColor: 'text-white',
    subtitleColor: 'text-[#fbbf24]',
    metaColor: 'text-slate-400',
    dividerLine: 'border-[#d4af37]/80',
    dividerDiamond: 'bg-[#fbbf24]',
    categoryPillBg: 'bg-[#1e293b]',
    categoryPillBorder: 'border-[#d4af37]/70',
    categoryPillText: 'text-[#fbbf24]',
    itemNameColor: 'text-slate-100',
    itemPriceColor: 'text-[#fbbf24]',
    descColor: 'text-slate-400',
    leaderDotBorder: 'border-slate-700/80',
    footerBorder: 'border-[#d4af37]/60',
    footerTextColor: 'text-slate-400',
    footerSubColor: 'text-slate-500',
    footerQrText: 'text-[#fbbf24]',
    footerQrBoxBorder: 'border-[#d4af37]',
    vegBorder: 'border-[#10b981]',
    vegDot: 'bg-[#10b981]',
    nonVegBorder: 'border-[#ef4444]',
    nonVegDot: 'bg-[#ef4444]',
    pillActiveBg: 'bg-amber-500 text-slate-950 font-bold',
    accentPill: 'text-amber-400',
  },
  garden: {
    id: 'garden',
    name: 'Botanical Garden',
    tagline: 'Fresh Sage Green & Organic Farm Bistro',
    isDark: false,
    pageBg: 'bg-[#16382b]',
    stickyBg: 'bg-[#1b4332]/95 border-emerald-900/60',
    stickyBorder: 'border-emerald-900/60',
    inputBg: 'bg-[#112d22]',
    inputBorder: 'border-emerald-800/80 focus:border-emerald-400',
    inputText: 'text-emerald-100',
    inputPlaceholder: 'placeholder:text-emerald-300/50',
    outerBoardBorder: 'border-[#2d6a4f]',
    outerBoardBg: 'bg-gradient-to-b from-[#f7fcf9] via-[#f0fdf4] to-[#e8f5ec]',
    innerFrameBorder: 'border-[#52b788]/60',
    cornerAccentColor: '#52b788',
    titleColor: 'text-[#1b4332]',
    subtitleColor: 'text-[#2d6a4f]',
    metaColor: 'text-[#52796f]',
    dividerLine: 'border-[#2d6a4f]/70',
    dividerDiamond: 'bg-[#2d6a4f]',
    categoryPillBg: 'bg-[#2d6a4f]',
    categoryPillBorder: 'border-[#1b4332]',
    categoryPillText: 'text-white font-serif',
    itemNameColor: 'text-[#1b4332]',
    itemPriceColor: 'text-[#2d6a4f]',
    descColor: 'text-[#52796f]',
    leaderDotBorder: 'border-[#95d5b2]',
    footerBorder: 'border-[#2d6a4f]/50',
    footerTextColor: 'text-[#52796f]',
    footerSubColor: 'text-[#74c69d]',
    footerQrText: 'text-[#2d6a4f]',
    footerQrBoxBorder: 'border-[#2d6a4f]',
    vegBorder: 'border-[#2d6a4f]',
    vegDot: 'bg-[#2d6a4f]',
    nonVegBorder: 'border-[#dc2626]',
    nonVegDot: 'bg-[#dc2626]',
    pillActiveBg: 'bg-emerald-600 text-white font-bold',
    accentPill: 'text-emerald-400',
  },
  blush: {
    id: 'blush',
    name: 'Blush Bakery & Cafe',
    tagline: 'Sweet Pastel Rose & Floral Patisserie',
    isDark: false,
    pageBg: 'bg-[#4c0519]',
    stickyBg: 'bg-[#881337]/95 border-rose-900/60',
    stickyBorder: 'border-rose-900/60',
    inputBg: 'bg-[#5a061d]',
    inputBorder: 'border-rose-800 focus:border-rose-400',
    inputText: 'text-rose-100',
    inputPlaceholder: 'placeholder:text-rose-300/50',
    outerBoardBorder: 'border-[#e11d48]',
    outerBoardBg: 'bg-gradient-to-b from-[#fff7f9] via-[#fff1f4] to-[#fce7ec]',
    innerFrameBorder: 'border-[#fda4af]',
    cornerAccentColor: '#f43f5e',
    titleColor: 'text-[#881337]',
    subtitleColor: 'text-[#e11d48]',
    metaColor: 'text-[#9f1239]',
    dividerLine: 'border-[#e11d48]/70',
    dividerDiamond: 'bg-[#e11d48]',
    categoryPillBg: 'bg-[#e11d48]',
    categoryPillBorder: 'border-[#9f1239]',
    categoryPillText: 'text-white font-serif',
    itemNameColor: 'text-[#4c0519]',
    itemPriceColor: 'text-[#e11d48]',
    descColor: 'text-[#9f1239]',
    leaderDotBorder: 'border-[#fecdd3]',
    footerBorder: 'border-[#e11d48]/50',
    footerTextColor: 'text-[#9f1239]',
    footerSubColor: 'text-[#fb7185]',
    footerQrText: 'text-[#e11d48]',
    footerQrBoxBorder: 'border-[#e11d48]',
    vegBorder: 'border-[#15803d]',
    vegDot: 'bg-[#15803d]',
    nonVegBorder: 'border-[#e11d48]',
    nonVegDot: 'bg-[#e11d48]',
    pillActiveBg: 'bg-rose-500 text-white font-bold',
    accentPill: 'text-rose-400',
  },
  terracotta: {
    id: 'terracotta',
    name: 'Tuscan Bistro',
    tagline: 'Warm Terracotta Clay & Italian Trattoria',
    isDark: false,
    pageBg: 'bg-[#331407]',
    stickyBg: 'bg-[#431407]/95 border-amber-950/70',
    stickyBorder: 'border-amber-950/70',
    inputBg: 'bg-[#290d04]',
    inputBorder: 'border-orange-950 focus:border-orange-400',
    inputText: 'text-orange-100',
    inputPlaceholder: 'placeholder:text-orange-300/50',
    outerBoardBorder: 'border-[#c2410c]',
    outerBoardBg: 'bg-gradient-to-b from-[#fdfbf7] via-[#fef7ee] to-[#fbeee4]',
    innerFrameBorder: 'border-[#fdba74]',
    cornerAccentColor: '#ea580c',
    titleColor: 'text-[#431407]',
    subtitleColor: 'text-[#c2410c]',
    metaColor: 'text-[#78716c]',
    dividerLine: 'border-[#c2410c]/70',
    dividerDiamond: 'bg-[#c2410c]',
    categoryPillBg: 'bg-[#c2410c]',
    categoryPillBorder: 'border-[#7c2d12]',
    categoryPillText: 'text-white font-serif',
    itemNameColor: 'text-[#291b0f]',
    itemPriceColor: 'text-[#c2410c]',
    descColor: 'text-[#78716c]',
    leaderDotBorder: 'border-[#fed7aa]',
    footerBorder: 'border-[#c2410c]/50',
    footerTextColor: 'text-[#78716c]',
    footerSubColor: 'text-[#ea580c]',
    footerQrText: 'text-[#c2410c]',
    footerQrBoxBorder: 'border-[#c2410c]',
    vegBorder: 'border-[#15803d]',
    vegDot: 'bg-[#15803d]',
    nonVegBorder: 'border-[#b91c1c]',
    nonVegDot: 'bg-[#b91c1c]',
    pillActiveBg: 'bg-orange-600 text-white font-bold',
    accentPill: 'text-orange-400',
  },
  charcoal: {
    id: 'charcoal',
    name: 'Street Burger & Chalkboard',
    tagline: 'Dark Slate Charcoal & Golden Mustard Diner',
    isDark: true,
    pageBg: 'bg-[#09090b]',
    stickyBg: 'bg-[#18181b]/95 border-zinc-800',
    stickyBorder: 'border-zinc-800',
    inputBg: 'bg-[#27272a]',
    inputBorder: 'border-zinc-700 focus:border-amber-400',
    inputText: 'text-zinc-100',
    inputPlaceholder: 'placeholder:text-zinc-500',
    outerBoardBorder: 'border-[#f59e0b]',
    outerBoardBg: 'bg-gradient-to-b from-[#18181b] via-[#121215] to-[#09090b]',
    innerFrameBorder: 'border-[#fbbf24]/50',
    cornerAccentColor: '#fbbf24',
    titleColor: 'text-white',
    subtitleColor: 'text-[#fbbf24]',
    metaColor: 'text-[#a1a1aa]',
    dividerLine: 'border-[#f59e0b]/70',
    dividerDiamond: 'bg-[#fbbf24]',
    categoryPillBg: 'bg-[#27272a]',
    categoryPillBorder: 'border-[#f59e0b]',
    categoryPillText: 'text-[#fbbf24] font-black',
    itemNameColor: 'text-[#fafafa]',
    itemPriceColor: 'text-[#fbbf24]',
    descColor: 'text-[#a1a1aa]',
    leaderDotBorder: 'border-[#3f3f46]',
    footerBorder: 'border-[#f59e0b]/50',
    footerTextColor: 'text-[#a1a1aa]',
    footerSubColor: 'text-[#71717a]',
    footerQrText: 'text-[#fbbf24]',
    footerQrBoxBorder: 'border-[#f59e0b]',
    vegBorder: 'border-[#10b981]',
    vegDot: 'bg-[#10b981]',
    nonVegBorder: 'border-[#ef4444]',
    nonVegDot: 'bg-[#ef4444]',
    pillActiveBg: 'bg-amber-400 text-zinc-950 font-bold',
    accentPill: 'text-amber-400',
  },
  crimson: {
    id: 'crimson',
    name: 'Fast-Food QSR Diner',
    tagline: 'Bold Crimson Red Wave & Golden Sun',
    isDark: false,
    pageBg: 'bg-[#450a0a]',
    stickyBg: 'bg-[#991b1b]/95 border-red-950/70',
    stickyBorder: 'border-red-950/70',
    inputBg: 'bg-[#7f1d1d]',
    inputBorder: 'border-red-900 focus:border-yellow-400',
    inputText: 'text-red-50',
    inputPlaceholder: 'placeholder:text-red-300/50',
    outerBoardBorder: 'border-[#dc2626]',
    outerBoardBg: 'bg-gradient-to-b from-[#ffffff] via-[#fff8f8] to-[#fff1f1]',
    innerFrameBorder: 'border-[#fca5a5]',
    cornerAccentColor: '#eab308',
    titleColor: 'text-[#991b1b]',
    subtitleColor: 'text-[#dc2626]',
    metaColor: 'text-[#6b7280]',
    dividerLine: 'border-[#dc2626]/70',
    dividerDiamond: 'bg-[#eab308]',
    categoryPillBg: 'bg-[#dc2626]',
    categoryPillBorder: 'border-[#991b1b]',
    categoryPillText: 'text-white font-black',
    itemNameColor: 'text-[#111827]',
    itemPriceColor: 'text-[#dc2626]',
    descColor: 'text-[#6b7280]',
    leaderDotBorder: 'border-[#fca5a5]',
    footerBorder: 'border-[#dc2626]/50',
    footerTextColor: 'text-[#6b7280]',
    footerSubColor: 'text-[#991b1b]',
    footerQrText: 'text-[#dc2626]',
    footerQrBoxBorder: 'border-[#dc2626]',
    vegBorder: 'border-[#16a34a]',
    vegDot: 'bg-[#16a34a]',
    nonVegBorder: 'border-[#dc2626]',
    nonVegDot: 'bg-[#dc2626]',
    pillActiveBg: 'bg-red-600 text-white font-bold',
    accentPill: 'text-red-400',
  },
  ivory: {
    id: 'ivory',
    name: 'Vintage Ivory',
    tagline: 'Classic Parchment & Roasted Espresso',
    isDark: false,
    pageBg: 'bg-[#2b1d0c]',
    stickyBg: 'bg-[#3d2913]/95 border-amber-950/60',
    stickyBorder: 'border-amber-950/60',
    inputBg: 'bg-[#221609]',
    inputBorder: 'border-amber-900',
    inputText: 'text-amber-100',
    inputPlaceholder: 'placeholder:text-amber-300/50',
    outerBoardBorder: 'border-[#8b4513]',
    outerBoardBg: 'bg-gradient-to-b from-[#fdfbf7] via-[#f8f3eb] to-[#f4ede2]',
    innerFrameBorder: 'border-[#9a3412]/40',
    cornerAccentColor: '#9a3412',
    titleColor: 'text-[#2b1d0c]',
    subtitleColor: 'text-[#9a3412]',
    metaColor: 'text-[#78716c]',
    dividerLine: 'border-[#8b4513]/70',
    dividerDiamond: 'bg-[#9a3412]',
    categoryPillBg: 'bg-[#8b4513]',
    categoryPillBorder: 'border-[#78350f]',
    categoryPillText: 'text-white font-serif',
    itemNameColor: 'text-[#291b0f]',
    itemPriceColor: 'text-[#9a3412]',
    descColor: 'text-[#78716c]',
    leaderDotBorder: 'border-[#d6c7b2]',
    footerBorder: 'border-[#8b4513]/50',
    footerTextColor: 'text-[#78716c]',
    footerSubColor: 'text-[#9a3412]',
    footerQrText: 'text-[#9a3412]',
    footerQrBoxBorder: 'border-[#8b4513]',
    vegBorder: 'border-[#15803d]',
    vegDot: 'bg-[#15803d]',
    nonVegBorder: 'border-[#b91c1c]',
    nonVegDot: 'bg-[#b91c1c]',
    pillActiveBg: 'bg-amber-800 text-white font-bold',
    accentPill: 'text-amber-400',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Emerald',
    tagline: 'Clean White & Crisp Emerald Boutique',
    isDark: false,
    pageBg: 'bg-[#0f172a]',
    stickyBg: 'bg-[#1e293b]/95 border-slate-700/80',
    stickyBorder: 'border-slate-700/80',
    inputBg: 'bg-[#0f172a]',
    inputBorder: 'border-slate-700',
    inputText: 'text-slate-100',
    inputPlaceholder: 'placeholder:text-slate-400',
    outerBoardBorder: 'border-[#e2e8f0]',
    outerBoardBg: 'bg-gradient-to-b from-[#ffffff] via-[#fbfcfd] to-[#f8fafc]',
    innerFrameBorder: 'border-[#cbd5e1]',
    cornerAccentColor: '#059669',
    titleColor: 'text-[#0f172a]',
    subtitleColor: 'text-[#059669]',
    metaColor: 'text-[#64748b]',
    dividerLine: 'border-[#e2e8f0]',
    dividerDiamond: 'bg-[#059669]',
    categoryPillBg: 'bg-[#f1f5f9]',
    categoryPillBorder: 'border-[#cbd5e1]',
    categoryPillText: 'text-[#0f172a] font-bold',
    itemNameColor: 'text-[#0f172a]',
    itemPriceColor: 'text-[#059669]',
    descColor: 'text-[#64748b]',
    leaderDotBorder: 'border-[#cbd5e1]',
    footerBorder: 'border-[#e2e8f0]',
    footerTextColor: 'text-[#94a3b8]',
    footerSubColor: 'text-[#059669]',
    footerQrText: 'text-[#059669]',
    footerQrBoxBorder: 'border-[#cbd5e1]',
    vegBorder: 'border-[#059669]',
    vegDot: 'bg-[#059669]',
    nonVegBorder: 'border-[#e11d48]',
    nonVegDot: 'bg-[#e11d48]',
    pillActiveBg: 'bg-emerald-600 text-white font-bold',
    accentPill: 'text-emerald-400',
  },
  royal: {
    id: 'royal',
    name: 'Royal Navy',
    tagline: 'Deep Sapphire Navy & Champagne Gold',
    isDark: true,
    pageBg: 'bg-[#030b19]',
    stickyBg: 'bg-[#0a192f]/95 border-sky-900/60',
    stickyBorder: 'border-sky-900/60',
    inputBg: 'bg-[#051329]',
    inputBorder: 'border-sky-800',
    inputText: 'text-sky-100',
    inputPlaceholder: 'placeholder:text-sky-400/50',
    outerBoardBorder: 'border-[#f3ba2f]',
    outerBoardBg: 'bg-gradient-to-b from-[#0a192f] via-[#061426] to-[#020c1b]',
    innerFrameBorder: 'border-[#ffd700]/50',
    cornerAccentColor: '#ffd700',
    titleColor: 'text-white',
    subtitleColor: 'text-[#f3ba2f]',
    metaColor: 'text-[#94a3b8]',
    dividerLine: 'border-[#f3ba2f]/70',
    dividerDiamond: 'bg-[#ffd700]',
    categoryPillBg: 'bg-[#172a45]',
    categoryPillBorder: 'border-[#f3ba2f]',
    categoryPillText: 'text-[#f3ba2f] font-serif',
    itemNameColor: 'text-[#f8fafc]',
    itemPriceColor: 'text-[#f3ba2f]',
    descColor: 'text-[#94a3b8]',
    leaderDotBorder: 'border-[#1e3a8a]',
    footerBorder: 'border-[#f3ba2f]/50',
    footerTextColor: 'text-[#64748b]',
    footerSubColor: 'text-[#f3ba2f]',
    footerQrText: 'text-[#f3ba2f]',
    footerQrBoxBorder: 'border-[#f3ba2f]',
    vegBorder: 'border-[#10b981]',
    vegDot: 'bg-[#10b981]',
    nonVegBorder: 'border-[#ef4444]',
    nonVegDot: 'bg-[#ef4444]',
    pillActiveBg: 'bg-yellow-500 text-slate-950 font-bold',
    accentPill: 'text-yellow-400',
  },
};

interface CustomerMenuProps {
  initialData?: MenuDataPayload;
  previewMode?: boolean;
}

export function extractCustomerSlug(pathname: string, search: string): string | null {
  // 1. Prefix-based paths: /m/:slug, /r/:slug, /c/:slug, /menu/:slug
  const prefixMatch = pathname.match(/^\/(?:m|r|c|menu)\/([^/?#]+)/i);
  if (prefixMatch && prefixMatch[1]) {
    return decodeURIComponent(prefixMatch[1]).trim().toLowerCase();
  }

  // 2. Query parameter fallback: ?customer=slug, ?c=slug, ?restaurant=slug, ?slug=slug
  const params = new URLSearchParams(search);
  const q = params.get('customer') || params.get('c') || params.get('restaurant') || params.get('slug');
  if (q && q.trim().length > 0) {
    return q.trim().toLowerCase();
  }

  // 3. Direct root path: /:slug (ignoring reserved app routes)
  const reserved = [
    '',
    'kitchen',
    'take-order',
    'qr-menu',
    'menu-card',
    'index.html',
    'api',
    'assets',
    'menus',
    'data',
    'favicon.ico',
  ];
  const rootMatch = pathname.match(/^\/([^/?#]+)/);
  if (rootMatch && rootMatch[1]) {
    const candidate = decodeURIComponent(rootMatch[1]).trim().toLowerCase();
    if (!reserved.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({ initialData, previewMode = false }) => {
  const [data, setData] = useState<MenuDataPayload | null>(initialData ?? null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [requestedSlug, setRequestedSlug] = useState<string | null>(null);

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');

  // Modals
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<MenuTheme>('noir');
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);

  // Mini QR Data URI for the footer
  const [footerQrUri, setFooterQrUri] = useState<string>('');

  // Detect table from query parameter (e.g. ?table=4 or ?table=Table%204 or ?tableId=4)
  const currentTable = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    const tableIdParam = params.get('tableId');

    if (tableParam) {
      return { name: tableParam };
    }
    if (tableIdParam && data?.tables) {
      const found = data.tables.find((t: any) => String(t.id) === tableIdParam);
      if (found) return found;
      return { name: `Table ${tableIdParam}` };
    }
    return null;
  }, [data]);

  // Sync theme with initialData or URL query ?theme=
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      if (initialData.settings?.theme && CUSTOMER_THEMES[initialData.settings.theme as MenuTheme]) {
        setSelectedTheme(initialData.settings.theme as MenuTheme);
      }
      setLoading(false);
      return;
    }
  }, [initialData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qTheme = params.get('theme') as MenuTheme;
      if (qTheme && CUSTOMER_THEMES[qTheme]) {
        setSelectedTheme(qTheme);
        return;
      }
    }
    if (data?.settings?.theme && CUSTOMER_THEMES[data.settings.theme as MenuTheme]) {
      setSelectedTheme(data.settings.theme as MenuTheme);
    }
  }, [data?.settings?.theme]);

  // Fetch menu data if not supplied
  useEffect(() => {
    if (initialData) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if inside Electron
        if (typeof window !== 'undefined' && (window as any).electronAPI?.qrMenu) {
          const res = await (window as any).electronAPI.qrMenu.getMenuData();
          setData(res);
          return;
        }

        // Browser mode: detect customer path (e.g. /m/:slug, /r/:slug, or /:slug)
        const slug =
          typeof window !== 'undefined'
            ? extractCustomerSlug(window.location.pathname, window.location.search)
            : null;
        if (slug) setRequestedSlug(slug);

        // 1. If slug is present, attempt to load that specific customer's menu
        if (slug) {
          // A. Supabase Cloud Storage (Public CDN bucket - zero manual Firebase CLI required)
          try {
            const supabaseUrl = 'https://bkziskyecxiozsdmmrfs.supabase.co';
            const cloudRes = await fetch(
              `${supabaseUrl}/storage/v1/object/public/molecule-storage/menus/${encodeURIComponent(slug)}.json`,
              { headers: { Accept: 'application/json' } }
            );
            if (cloudRes.ok) {
              const json = await cloudRes.json();
              if (json && (json.categories || json.items)) {
                setData(json);
                return;
              }
            }
          } catch {
            /* continue to local / hosting fallbacks */
          }

          // B. Local / Hosting static file fallbacks
          try {
            const staticRes = await fetch(`/menus/${encodeURIComponent(slug)}.json`);
            if (staticRes.ok) {
              const json = await staticRes.json();
              setData(json);
              return;
            }
          } catch {
            /* continue */
          }

          try {
            const staticCustRes = await fetch(`/menus/${encodeURIComponent(slug)}/menu.json`);
            if (staticCustRes.ok) {
              const json = await staticCustRes.json();
              setData(json);
              return;
            }
          } catch {
            /* continue */
          }

          // C. Firestore direct REST fallback
          try {
            const fsRes = await fetch(
              `https://firestore.googleapis.com/v1/projects/molecule-e2e95/databases/(default)/documents/qr_menus/${encodeURIComponent(slug)}`
            );
            if (fsRes.ok) {
              const doc = await fsRes.json();
              if (doc.fields?.payload?.stringValue) {
                const json = JSON.parse(doc.fields.payload.stringValue);
                setData(json);
                return;
              }
            }
          } catch {
            /* continue */
          }
        }

        try {
          const defRes = await fetch('/menus/default.json');
          if (defRes.ok) {
            const json = await defRes.json();
            setData(json);
            return;
          }
        } catch {
          /* continue */
        }

        try {
          const menuRes = await fetch('/menu.json');
          if (menuRes.ok) {
            const json = await menuRes.json();
            setData(json);
            return;
          }
        } catch {
          /* continue */
        }

        if (slug) {
          throw new Error(
            `No digital menu published for customer path "/m/${slug}". If you are the restaurant manager, open Molecule POS and sync your menu to cloud.`
          );
        } else {
          throw new Error('Could not connect to restaurant menu service. Please check your connection or scan the table QR code.');
        }
      } catch (err: any) {
        console.error('Failed to load QR menu:', err);
        setError(err?.message || 'Could not load menu. Please check your connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [initialData]);

  // Generate footer QR code URI
  useEffect(() => {
    const url = typeof window !== 'undefined' ? window.location.href : (data?.server?.activeUrl || '');
    if (url) {
      try {
        const uri = renderQrDataUri(url, 'rounded', 2, true);
        setFooterQrUri(uri);
      } catch (e) {
        console.warn('Failed to render footer QR data URI:', e);
      }
    }
  }, [data]);

  // Scroll to top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter items based on active search, category, and veg/non-veg filter
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];

    return data.items.filter((item) => {
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) {
        return false;
      }
      if (dietaryFilter === 'veg' && !item.isVeg) return false;
      if (dietaryFilter === 'non-veg' && item.isVeg) return false;

      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCode = item.shortCode?.toLowerCase().includes(query) ?? false;
        const matchCategory = item.categoryName?.toLowerCase().includes(query) ?? false;
        const matchDesc = item.description?.toLowerCase().includes(query) ?? false;
        return matchName || matchCode || matchCategory || matchDesc;
      }

      return true;
    });
  }, [data, selectedCategory, dietaryFilter, searchQuery]);

  // Group items by category
  const categoriesWithItems = useMemo(() => {
    if (!data?.categories || !filteredItems) return [];

    const map = new Map<number, MenuItemData[]>();
    for (const item of filteredItems) {
      if (!map.has(item.categoryId)) {
        map.set(item.categoryId, []);
      }
      map.get(item.categoryId)!.push(item);
    }

    return data.categories
      .filter((cat) => map.has(cat.id))
      .map((cat) => ({
        category: cat,
        items: map.get(cat.id) || [],
      }));
  }, [data, filteredItems]);

  // Split categories evenly between Left and Right columns (matching menuCanvasGenerator)
  const { leftColumns, rightColumns } = useMemo(() => {
    const left: typeof categoriesWithItems = [];
    const right: typeof categoriesWithItems = [];
    let leftCount = 0;
    let rightCount = 0;

    for (const catBlock of categoriesWithItems) {
      if (leftCount <= rightCount) {
        left.push(catBlock);
        leftCount += catBlock.items.length + 2;
      } else {
        right.push(catBlock);
        rightCount += catBlock.items.length + 2;
      }
    }
    return { leftColumns: left, rightColumns: right };
  }, [categoriesWithItems]);

  const currencySymbol = data?.restaurant.currencySymbol || data?.restaurant.currency || '₹';

  const copyWifiPassword = () => {
    const pass = data?.settings?.wifiPassword || '';
    if (!pass) return;
    navigator.clipboard.writeText(pass).then(() => {
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2000);
    });
  };

  const shareOrCopyLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      navigator.share({
        title: `${data?.restaurant.name || 'Restaurant'} - Menu`,
        text: 'Browse our digital menu & daily specials!',
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const handleDownloadMenu = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      await downloadMenuImage(data, {
        theme: selectedTheme,
        qrUrl: typeof window !== 'undefined' ? window.location.href : '',
      });
      setDownloadModalOpen(false);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadTableCard = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const targetUrl = typeof window !== 'undefined' ? window.location.href : '';
      await downloadTableCardImage(targetUrl, currentTable, {
        theme: selectedTheme,
        restaurantName: data.restaurant.name,
        restaurantAddress: data.restaurant.address,
        restaurantPhone: data.restaurant.phone,
        wifiSsid: data.settings?.wifiSsid,
        wifiPassword: data.settings?.wifiPassword,
        logoDataUrl: data.restaurant.logo,
      });
      setQrModalOpen(false);
    } catch (err) {
      console.error('Table card download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-white p-4 max-w-2xl mx-auto space-y-5">
        {/* Restaurant Header Shimmer */}
        <div className="text-center py-6 border-b border-slate-800 space-y-2">
          <div className="shimmer h-7 w-48 mx-auto rounded-lg" />
          <div className="shimmer h-3.5 w-64 mx-auto rounded" />
          <div className="shimmer h-6 w-24 mx-auto rounded-full mt-2" />
        </div>

        {/* Categories Bar Shimmer */}
        <div className="flex gap-2 overflow-x-hidden py-1">
          <div className="shimmer h-8 w-20 rounded-full shrink-0" />
          <div className="shimmer h-8 w-24 rounded-full shrink-0" />
          <div className="shimmer h-8 w-20 rounded-full shrink-0" />
          <div className="shimmer h-8 w-28 rounded-full shrink-0" />
        </div>

        {/* Dishes list Shimmer */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`dish-shimmer-${i}`} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="shimmer h-4 w-40 rounded" />
                <div className="shimmer h-3 w-56 rounded" />
                <div className="shimmer h-4 w-16 rounded mt-1" />
              </div>
              <div className="shimmer h-16 w-16 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-500/20 shadow-lg">
          <Info size={28} />
        </div>
        <h2 className="text-lg font-bold mb-2">
          {requestedSlug ? `Menu Not Found: /m/${requestedSlug}` : 'Unable to Load Menu'}
        </h2>
        {requestedSlug && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 text-amber-400 rounded-full text-xs font-mono mb-3">
            <span>Customer Path: /m/{requestedSlug}</span>
          </div>
        )}
        <p className="text-slate-400 text-xs max-w-md mb-6 leading-relaxed">
          {error || 'Could not connect to restaurant menu service.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  const themeStyle = CUSTOMER_THEMES[selectedTheme] || CUSTOMER_THEMES.noir;

  // Render a Category Block with dynamic theme styling matching reference menus
  const renderCategoryBlock = (cat: MenuCategoryData, items: MenuItemData[]) => {
    return (
      <div key={cat.id} className="space-y-2.5">
        {/* Category Pill Banner */}
        <div className={`${themeStyle.categoryPillBg} border ${themeStyle.categoryPillBorder} rounded-md py-1 px-4 text-center shadow-sm`}>
          <h2 className={`font-extrabold text-xs sm:text-sm tracking-widest uppercase ${themeStyle.categoryPillText}`}>
            {cat.name}
          </h2>
        </div>

        {/* Category Items */}
        <div className="space-y-2 px-1">
          {items.map((item) => {
            const isVeg = !!item.isVeg;
            const rupees = (item.basePrice || 0) / 100;
            const priceVal = rupees % 1 === 0 ? rupees.toFixed(0) : rupees.toFixed(2);
            const hasVariations = item.variations && item.variations.length > 0;
            const variationText = hasVariations
              ? item.variations!
                  .map((v) => {
                    const vPrice = v.basePrice || item.basePrice + (v.priceDelta || 0);
                    const vRupees = (vPrice || 0) / 100;
                    const formatted = vRupees % 1 === 0 ? vRupees.toFixed(0) : vRupees.toFixed(2);
                    return `${v.name}: ${currencySymbol}${formatted}`;
                  })
                  .join('  •  ')
              : null;

            return (
              <div key={item.id} className="group py-0.5">
                {/* Main Row: [Veg Icon] [Item Name] [Dotted Leader] [Price] */}
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 shrink-0">
                    {/* Square Veg/Non-Veg Icon with center dot */}
                    <span
                      className={`w-3.5 h-3.5 border rounded-[2px] flex items-center justify-center shrink-0 ${
                        isVeg ? themeStyle.vegBorder : themeStyle.nonVegBorder
                      }`}
                      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? themeStyle.vegDot : themeStyle.nonVegDot}`} />
                    </span>

                    {/* Dish Name */}
                    <span className={`font-semibold text-xs sm:text-sm ${themeStyle.itemNameColor} tracking-normal whitespace-nowrap`}>
                      {item.name}
                    </span>
                  </div>

                  {/* Dotted Leader Line */}
                  <div className={`flex-1 border-b border-dotted ${themeStyle.leaderDotBorder} mx-2 self-baseline min-w-[20px] translate-y-[-3px]`} />

                  {/* Price */}
                  <span className={`font-bold text-xs sm:text-sm ${themeStyle.itemPriceColor} shrink-0 text-right font-mono whitespace-nowrap`}>
                    {currencySymbol}{priceVal}
                  </span>
                </div>

                {/* Sub Row: Variations or Description */}
                {variationText ? (
                  <div className={`pl-5 text-[10px] sm:text-xs ${themeStyle.descColor} italic font-normal tracking-wide whitespace-nowrap`}>
                    {variationText}
                  </div>
                ) : item.description ? (
                  <div className={`pl-5 text-[10px] sm:text-xs ${themeStyle.descColor} italic font-normal whitespace-nowrap overflow-hidden text-ellipsis`}>
                    {item.description}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`customer-menu ${previewMode ? 'min-h-full pb-6' : 'min-h-screen pb-16'} ${themeStyle.pageBg} selection:bg-amber-500 selection:text-slate-950 w-max min-w-[780px] transition-colors duration-300`} data-customer-menu="true">
      {/* ── Optional Minimal Sticky Control Bar ── */}
      <div className={`sticky top-0 z-40 ${themeStyle.stickyBg} backdrop-blur-md border-b ${themeStyle.stickyBorder} px-3 py-2 w-full min-w-[780px] transition-colors`}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className={`w-full ${themeStyle.inputBg} border ${themeStyle.inputBorder} ${themeStyle.inputText} ${themeStyle.inputPlaceholder} rounded-lg pl-8 pr-7 py-1.5 text-xs focus:outline-none transition-colors`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Center: Veg / Non-Veg filter pills */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDietaryFilter('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                dietaryFilter === 'all'
                  ? themeStyle.pillActiveBg
                  : `${themeStyle.inputBg} text-slate-300 hover:text-white border ${themeStyle.inputBorder}`
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDietaryFilter(dietaryFilter === 'veg' ? 'all' : 'veg')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
                dietaryFilter === 'veg'
                  ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300'
                  : `${themeStyle.inputBg} ${themeStyle.inputBorder} text-slate-300 hover:text-emerald-400`
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Veg</span>
            </button>
            <button
              type="button"
              onClick={() => setDietaryFilter(dietaryFilter === 'non-veg' ? 'all' : 'non-veg')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
                dietaryFilter === 'non-veg'
                  ? 'bg-red-500/25 border-red-500 text-red-300'
                  : `${themeStyle.inputBg} ${themeStyle.inputBorder} text-slate-300 hover:text-red-400`
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Non-Veg</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {/* Theme Switcher Pill & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
                  themeStyle.isDark
                    ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                    : 'bg-white/90 hover:bg-white border-black/15 text-slate-800 shadow-sm'
                }`}
                title="Change Menu Design Template"
              >
                <Palette size={12} className={themeStyle.accentPill} />
                <span className="hidden md:inline font-normal opacity-75">Design:</span>
                <span className="font-bold">{themeStyle.name}</span>
                <ChevronDown size={11} className="opacity-70" />
              </button>

              {themeDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setThemeDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 space-y-1 animate-fadeIn">
                    <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Select Restaurant Menu Design
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-0.5">
                      {MENU_THEME_CATALOG.map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => {
                            setSelectedTheme(th.id);
                            setThemeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition ${
                            selectedTheme === th.id
                              ? 'bg-amber-500/20 text-white font-bold ring-1 ring-amber-500/50'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: th.accentColor }}
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold block truncate">{th.name}</span>
                              <span className="text-[10px] text-slate-400 block truncate">{th.tagline}</span>
                            </div>
                          </div>
                          {selectedTheme === th.id && (
                            <Check size={14} className="text-amber-400 shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {currentTable?.name && (
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-md text-[11px] font-bold">
                <Utensils size={11} />
                <span>{currentTable.name}</span>
              </span>
            )}
            {data.settings?.wifiSsid && (
              <button
                type="button"
                onClick={() => setWifiModalOpen(true)}
                className={`flex items-center gap-1 px-2 py-1 ${themeStyle.inputBg} hover:bg-slate-800 border ${themeStyle.inputBorder} rounded-md text-[11px] font-medium text-slate-300 transition`}
                title="Wi-Fi Information"
              >
                <Wifi size={12} className={themeStyle.accentPill} />
                <span>Wi-Fi</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setDownloadModalOpen(true)}
              className={`p-1.5 ${themeStyle.inputBg} hover:bg-slate-800 border ${themeStyle.inputBorder} rounded-md text-slate-300 transition`}
              title="Download Menu Poster"
            >
              <Download size={13} className={themeStyle.accentPill} />
            </button>
            <button
              type="button"
              onClick={shareOrCopyLink}
              className={`p-1.5 ${themeStyle.inputBg} hover:bg-slate-800 border ${themeStyle.inputBorder} rounded-md text-slate-300 transition`}
              title="Share Menu Link"
            >
              {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN MENU BOARD CONTAINER (Exact Poster Layout from Image - Always 2 Columns with Horizontal & Vertical Scrolling) ── */}
      <main className="w-full py-3 px-2 sm:px-4">
        <div className="w-max min-w-[780px] max-w-5xl mx-auto">
          {/* Outer Frame with Theme Border & Background Gradient */}
          <div className={`relative rounded-2xl border-[3px] ${themeStyle.outerBoardBorder} ${themeStyle.outerBoardBg} p-3 sm:p-5 md:p-7 shadow-2xl transition-all duration-300`}>
            
            {/* Inner Frame with Accent Border */}
            <div className={`relative rounded-lg border ${themeStyle.innerFrameBorder} p-3 sm:p-5 md:p-7`}>
              
              {/* 4 Corner Ornamental Accents */}
              <div
                className="absolute top-1.5 left-1.5 w-6 h-6 sm:w-8 sm:h-8 border-t-[3px] border-l-[3px] pointer-events-none"
                style={{ borderColor: themeStyle.cornerAccentColor }}
              />
              <div
                className="absolute top-1.5 right-1.5 w-6 h-6 sm:w-8 sm:h-8 border-t-[3px] border-r-[3px] pointer-events-none"
                style={{ borderColor: themeStyle.cornerAccentColor }}
              />
              <div
                className="absolute bottom-1.5 left-1.5 w-6 h-6 sm:w-8 sm:h-8 border-b-[3px] border-l-[3px] pointer-events-none"
                style={{ borderColor: themeStyle.cornerAccentColor }}
              />
              <div
                className="absolute bottom-1.5 right-1.5 w-6 h-6 sm:w-8 sm:h-8 border-b-[3px] border-r-[3px] pointer-events-none"
                style={{ borderColor: themeStyle.cornerAccentColor }}
              />

              {/* Header Section */}
              <header className="text-center pt-1 pb-4 space-y-1">
                <h1 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif font-black tracking-widest ${themeStyle.titleColor} drop-shadow uppercase`}>
                  {data.restaurant.name || 'Restaurant'}
                </h1>
                <p className={`text-[10px] sm:text-xs md:text-sm font-bold tracking-[0.22em] ${themeStyle.subtitleColor} uppercase`}>
                  {data.settings?.subtitle || 'SCAN TO BROWSE OUR DIGITAL MENU'}
                </p>
                {(data.restaurant.address || data.restaurant.phone) && (
                  <p className={`text-[10px] sm:text-xs ${themeStyle.metaColor} font-medium tracking-wide`}>
                    {[data.restaurant.address, data.restaurant.phone].filter(Boolean).join('   •   ')}
                  </p>
                )}

                {/* Horizontal Divider Line with Center Diamond */}
                <div className="relative flex items-center justify-center pt-2 max-w-xs sm:max-w-sm md:max-w-md mx-auto">
                  <div className={`w-full border-t ${themeStyle.dividerLine}`} />
                  <div className={`absolute w-2 h-2 sm:w-2.5 sm:h-2.5 ${themeStyle.dividerDiamond} rotate-45 shadow-sm`} />
                </div>
              </header>

              {/* Two-Column Menu Body - Always 2 columns, never squished, horizontally scrollable */}
              {categoriesWithItems.length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <p className="text-sm font-semibold text-slate-400">No dishes match your filter</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDietaryFilter('all');
                      setSelectedCategory('all');
                    }}
                    className="px-3 py-1 bg-slate-800 text-amber-400 text-xs font-semibold rounded hover:bg-slate-700"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 lg:gap-x-12 gap-y-6 pt-2">
                  {/* Column 1 (Left) */}
                  <div className="space-y-5 min-w-[340px]">
                    {leftColumns.map(({ category, items }) => renderCategoryBlock(category, items))}
                  </div>

                  {/* Column 2 (Right) */}
                  <div className="space-y-5 min-w-[340px]">
                    {rightColumns.map(({ category, items }) => renderCategoryBlock(category, items))}
                  </div>
                </div>
              )}

              {/* Footer Section */}
              <footer className={`mt-8 pt-4 border-t ${themeStyle.footerBorder}`}>
                <div className="flex flex-row items-center justify-between gap-4">
                  {/* Left: Disclaimers */}
                  <div className={`text-[10px] sm:text-xs ${themeStyle.footerTextColor} space-y-0.5 text-left`}>
                    <p>Prices inclusive of all applicable taxes • Freshly prepared on order</p>
                    <p className={themeStyle.footerSubColor}>Thank you for dining with us!  •  Powered by Molecule POS</p>
                  </div>

                  {/* Right: Mini QR Code with call to action */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-xs font-bold ${themeStyle.footerQrText} tracking-wider uppercase`}>
                        SCAN FOR LIVE DIGITAL MENU
                      </p>
                      <p className={`text-[10px] ${themeStyle.footerTextColor}`}>
                        Browse latest dishes, dietary details & specials on your phone
                      </p>
                    </div>
                    {footerQrUri && (
                      <div className={`p-1 bg-white rounded-xl border ${themeStyle.footerQrBoxBorder} shadow-md shrink-0`}>
                        <img src={footerQrUri} alt="Menu QR" className="w-14 h-14 sm:w-16 sm:h-16 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </main>

      {/* ── Scroll to Top Button ── */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 p-3 bg-amber-500 text-slate-950 font-bold rounded-full shadow-2xl hover:bg-amber-400 transition transform hover:scale-110 z-40"
          title="Scroll to top"
        >
          <ArrowUp size={18} />
        </button>
      )}

      {/* ── Wi-Fi Modal ── */}
      {wifiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Wifi size={18} />
                </div>
                <h3 className="font-bold text-white text-base">Guest Wi-Fi</h3>
              </div>
              <button
                type="button"
                onClick={() => setWifiModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 p-4 bg-slate-950/70 rounded-2xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Network Name</span>
                <span className="text-sm font-bold text-white font-mono block mt-0.5">{data.settings?.wifiSsid}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Password</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono block mt-0.5">
                    {data.settings?.wifiPassword || 'No Password'}
                  </span>
                </div>
                {data.settings?.wifiPassword && (
                  <button
                    type="button"
                    onClick={copyWifiPassword}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    {copiedWifi ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedWifi ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Download Menu Modal ── */}
      {downloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Download Menu Card</h3>
                  <p className="text-xs text-slate-400">Save high-res menu poster image</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDownloadModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Choose Card Theme</label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {MENU_THEME_CATALOG.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setSelectedTheme(th.id)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      selectedTheme === th.id
                        ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500/50'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0"
                        style={{ backgroundColor: th.accentColor }}
                      />
                      <span className="text-xs font-bold truncate">{th.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 truncate">{th.tagline}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={shareOrCopyLink}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                <span>{copiedLink ? 'Link Copied' : 'Share Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMenu}
                disabled={downloading}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
              >
                {downloading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>{downloading ? 'Generating...' : 'Download Image'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table QR Code Modal ── */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-left">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Table QR Code</h3>
                  <p className="text-xs text-slate-400">{currentTable?.name || 'Table Menu'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {footerQrUri && (
              <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-xl border-4 border-slate-800">
                <img src={footerQrUri} alt="Table QR" className="w-52 h-52 object-contain mx-auto" />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={shareOrCopyLink}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTableCard}
                disabled={downloading}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
              >
                <Download size={14} />
                <span>Download Stand</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
