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
} from 'lucide-react';
import { downloadMenuImage, type MenuDataPayload, type MenuCategoryData, type MenuItemData } from '../lib/menuCanvasGenerator';
import { downloadTableCardImage } from '../lib/tableCardGenerator';
import { renderQrDataUri } from '../../shared/qr-render';

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
  const [selectedTheme, setSelectedTheme] = useState<'noir' | 'ivory' | 'minimal' | 'royal'>('noir');

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

  // Fetch menu data if not supplied
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

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

  // Render a Category Block with the classic dark pill banner and item rows
  const renderCategoryBlock = (cat: MenuCategoryData, items: MenuItemData[]) => {
    return (
      <div key={cat.id} className="space-y-2.5">
        {/* Category Pill Banner (exact noir style from poster: bg #1e293b, border #d4af37, text #fbbf24) */}
        <div className="bg-[#1e293b] border border-[#d4af37]/70 rounded-md py-1 px-4 text-center shadow-sm">
          <h2 className="font-extrabold text-xs sm:text-sm tracking-widest uppercase text-[#fbbf24]">
            {cat.name}
          </h2>
        </div>

        {/* Category Items */}
        <div className="space-y-2 px-1">
          {items.map((item) => {
            const isVeg = !!item.isVeg;
            const priceVal = item.basePrice > 1000 ? (item.basePrice / 100).toFixed(0) : item.basePrice.toString();
            const hasVariations = item.variations && item.variations.length > 0;
            const variationText = hasVariations
              ? item.variations!
                  .map((v) => {
                    const vPrice = v.basePrice || item.basePrice + (v.priceDelta || 0);
                    const formatted = vPrice > 1000 ? (vPrice / 100).toFixed(0) : vPrice;
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
                        isVeg ? 'border-[#10b981]' : 'border-[#ef4444]'
                      }`}
                      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
                    </span>

                    {/* Dish Name (never wrapped or overlapped) */}
                    <span className="font-semibold text-xs sm:text-sm text-slate-100 tracking-normal whitespace-nowrap">
                      {item.name}
                    </span>
                  </div>

                  {/* Dotted Leader Line */}
                  <div className="flex-1 border-b border-dotted border-slate-700/80 mx-2 self-baseline min-w-[20px] translate-y-[-3px]" />

                  {/* Price */}
                  <span className="font-bold text-xs sm:text-sm text-[#fbbf24] shrink-0 text-right font-mono whitespace-nowrap">
                    {currencySymbol}{priceVal}
                  </span>
                </div>

                {/* Sub Row: Variations or Description */}
                {variationText ? (
                  <div className="pl-5 text-[10px] sm:text-xs text-slate-400 italic font-normal tracking-wide whitespace-nowrap">
                    {variationText}
                  </div>
                ) : item.description ? (
                  <div className="pl-5 text-[10px] sm:text-xs text-slate-400 italic font-normal whitespace-nowrap overflow-hidden text-ellipsis">
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
    <div className={`customer-menu ${previewMode ? 'min-h-full pb-6' : 'min-h-screen pb-16'} bg-[#070b14] text-slate-100 selection:bg-amber-500 selection:text-slate-950 w-max min-w-[780px]`} data-customer-menu="true">
      {/* ── Optional Minimal Sticky Control Bar ── */}
      <div className="sticky top-0 z-40 bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800/80 px-3 py-2 w-full min-w-[780px]">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full bg-[#131b2e] border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                  ? 'bg-slate-200 text-slate-950'
                  : 'bg-[#131b2e] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setDietaryFilter(dietaryFilter === 'veg' ? 'all' : 'veg')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition border ${
                dietaryFilter === 'veg'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-[#131b2e] border-slate-800 text-slate-400 hover:text-emerald-400'
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
                  ? 'bg-red-500/20 border-red-500 text-red-300'
                  : 'bg-[#131b2e] border-slate-800 text-slate-400 hover:text-red-400'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span>Non-Veg</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
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
                className="flex items-center gap-1 px-2 py-1 bg-[#131b2e] hover:bg-slate-800 border border-slate-800 rounded-md text-[11px] font-medium text-slate-300 transition"
                title="Wi-Fi Information"
              >
                <Wifi size={12} className="text-amber-400" />
                <span>Wi-Fi</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setDownloadModalOpen(true)}
              className="p-1.5 bg-[#131b2e] hover:bg-slate-800 border border-slate-800 rounded-md text-slate-300 transition"
              title="Download Menu Poster"
            >
              <Download size={13} className="text-amber-400" />
            </button>
            <button
              type="button"
              onClick={shareOrCopyLink}
              className="p-1.5 bg-[#131b2e] hover:bg-slate-800 border border-slate-800 rounded-md text-slate-300 transition"
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
          {/* Outer Frame with Solid Gold Border */}
          <div className="relative rounded-2xl border-[3px] border-[#d4af37] bg-gradient-to-b from-[#0b0f19] via-[#080d19] to-[#030712] p-3 sm:p-5 md:p-7 shadow-2xl">
            
            {/* Inner Frame with Thin Amber Border */}
            <div className="relative rounded-lg border border-[#fbbf24]/50 p-3 sm:p-5 md:p-7">
              
              {/* 4 Corner Ornamental Accents (Exact reproduction of menuCanvasGenerator corner ornaments) */}
              <div className="absolute top-1.5 left-1.5 w-6 h-6 sm:w-8 sm:h-8 border-t-[3px] border-l-[3px] border-[#fbbf24] pointer-events-none" />
              <div className="absolute top-1.5 right-1.5 w-6 h-6 sm:w-8 sm:h-8 border-t-[3px] border-r-[3px] border-[#fbbf24] pointer-events-none" />
              <div className="absolute bottom-1.5 left-1.5 w-6 h-6 sm:w-8 sm:h-8 border-b-[3px] border-l-[3px] border-[#fbbf24] pointer-events-none" />
              <div className="absolute bottom-1.5 right-1.5 w-6 h-6 sm:w-8 sm:h-8 border-b-[3px] border-r-[3px] border-[#fbbf24] pointer-events-none" />

              {/* Header Section */}
              <header className="text-center pt-1 pb-4 space-y-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-serif font-black tracking-widest text-white drop-shadow uppercase">
                  {data.restaurant.name || 'Restaurant'}
                </h1>
                <p className="text-[10px] sm:text-xs md:text-sm font-bold tracking-[0.22em] text-[#fbbf24] uppercase">
                  {data.settings?.subtitle || 'SCAN TO BROWSE OUR DIGITAL MENU'}
                </p>
                {(data.restaurant.address || data.restaurant.phone) && (
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wide">
                    {[data.restaurant.address, data.restaurant.phone].filter(Boolean).join('   •   ')}
                  </p>
                )}

                {/* Horizontal Gold Divider Line with Center Diamond */}
                <div className="relative flex items-center justify-center pt-2 max-w-xs sm:max-w-sm md:max-w-md mx-auto">
                  <div className="w-full border-t border-[#d4af37]/80" />
                  <div className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[#fbbf24] rotate-45 shadow-sm" />
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
              <footer className="mt-8 pt-4 border-t border-[#d4af37]/60">
                <div className="flex flex-row items-center justify-between gap-4">
                  {/* Left: Disclaimers */}
                  <div className="text-[10px] sm:text-xs text-slate-400 space-y-0.5 text-left">
                    <p>Prices inclusive of all applicable taxes • Freshly prepared on order</p>
                    <p className="text-slate-500">Thank you for dining with us!  •  Powered by Molecule POS</p>
                  </div>

                  {/* Right: Mini QR Code with call to action */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#fbbf24] tracking-wider uppercase">
                        SCAN FOR LIVE DIGITAL MENU
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Browse latest dishes, dietary details & specials on your phone
                      </p>
                    </div>
                    {footerQrUri && (
                      <div className="p-1 bg-white rounded-xl border border-[#d4af37] shadow-md shrink-0">
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
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'noir', name: 'Modern Noir', desc: 'Dark obsidian & gold', color: 'bg-slate-950' },
                  { id: 'ivory', name: 'Vintage Bistro', desc: 'Warm ivory & espresso', color: 'bg-amber-50' },
                  { id: 'minimal', name: 'Minimal White', desc: 'Crisp white & emerald', color: 'bg-white' },
                  { id: 'royal', name: 'Royal Navy', desc: 'Deep blue & champagne', color: 'bg-sky-950' },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setSelectedTheme(th.id as any)}
                    className={`p-3 rounded-xl border text-left transition ${
                      selectedTheme === th.id
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border border-slate-600 ${th.color}`} />
                      <span className="text-xs font-bold">{th.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1">{th.desc}</span>
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
