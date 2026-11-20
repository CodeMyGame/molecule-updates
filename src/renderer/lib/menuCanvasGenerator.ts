import { type QrStyle } from '../../shared/qr-render';
import { drawQrOnCanvas } from './qrCanvasDraw';
import { downloadDataUri } from './qrCodeGenerator';

export type MenuTheme =
  | 'noir'
  | 'ivory'
  | 'minimal'
  | 'royal'
  | 'garden'
  | 'blush'
  | 'terracotta'
  | 'charcoal'
  | 'crimson';

export interface MenuThemeMetadata {
  id: MenuTheme;
  name: string;
  tagline: string;
  category: 'Modern & Luxury' | 'Bistro & Botanical' | 'Bakery & Cafe' | 'Diner & Street Food';
  accentColor: string;
  badgeBg: string;
  isDark: boolean;
}

export const MENU_THEME_CATALOG: MenuThemeMetadata[] = [
  {
    id: 'noir',
    name: 'Modern Noir',
    tagline: 'Obsidian Black & Gold Luxury',
    category: 'Modern & Luxury',
    accentColor: '#fbbf24',
    badgeBg: '#0b0f19',
    isDark: true,
  },
  {
    id: 'garden',
    name: 'Botanical Garden',
    tagline: 'Fresh Sage Green & Organic Farm Bistro',
    category: 'Bistro & Botanical',
    accentColor: '#2d6a4f',
    badgeBg: '#f4fbf6',
    isDark: false,
  },
  {
    id: 'blush',
    name: 'Blush Bakery & Cafe',
    tagline: 'Sweet Pastel Rose & Floral Patisserie',
    category: 'Bakery & Cafe',
    accentColor: '#e11d48',
    badgeBg: '#fff5f7',
    isDark: false,
  },
  {
    id: 'terracotta',
    name: 'Tuscan Bistro',
    tagline: 'Warm Terracotta Clay & Italian Trattoria',
    category: 'Bistro & Botanical',
    accentColor: '#c2410c',
    badgeBg: '#fdfbf7',
    isDark: false,
  },
  {
    id: 'charcoal',
    name: 'Street Burger & Chalkboard',
    tagline: 'Dark Slate Charcoal & Golden Mustard Diner',
    category: 'Diner & Street Food',
    accentColor: '#fbbf24',
    badgeBg: '#18181b',
    isDark: true,
  },
  {
    id: 'crimson',
    name: 'Fast-Food QSR Diner',
    tagline: 'Bold Crimson Red Wave & Golden Sun',
    category: 'Diner & Street Food',
    accentColor: '#dc2626',
    badgeBg: '#ffffff',
    isDark: false,
  },
  {
    id: 'ivory',
    name: 'Vintage Ivory',
    tagline: 'Classic Parchment & Roasted Espresso',
    category: 'Bistro & Botanical',
    accentColor: '#9a3412',
    badgeBg: '#fdfbf7',
    isDark: false,
  },
  {
    id: 'minimal',
    name: 'Minimal Emerald',
    tagline: 'Clean White & Crisp Emerald Boutique',
    category: 'Modern & Luxury',
    accentColor: '#059669',
    badgeBg: '#ffffff',
    isDark: false,
  },
  {
    id: 'royal',
    name: 'Royal Navy',
    tagline: 'Deep Sapphire Navy & Champagne Gold',
    category: 'Modern & Luxury',
    accentColor: '#f3ba2f',
    badgeBg: '#0a192f',
    isDark: true,
  },
];

export interface MenuCanvasOptions {
  theme?: MenuTheme;
  title?: string;
  subtitle?: string;
  qrUrl?: string;
  qrStyle?: QrStyle;
  showPrices?: boolean;
  showDescriptions?: boolean;
  showMiniQr?: boolean;
  selectedCategoryIds?: number[];
}

export interface MenuItemData {
  id: number;
  name: string;
  shortCode?: string;
  categoryId: number;
  categoryName?: string;
  basePrice: number; // in paise
  taxRate?: number;
  isVeg: boolean;
  isAvailable?: boolean;
  description?: string;
  station?: string;
  variations?: Array<{ id: number; name: string; priceDelta: number; basePrice: number }>;
  addonGroups?: any[];
}

export interface MenuCategoryData {
  id: number;
  name: string;
  sortOrder?: number;
}

export interface TableData {
  id: number;
  name: string;
  capacity?: number;
  floorName?: string;
}

export interface MenuDataPayload {
  restaurant: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    fssai?: string;
    gstin?: string;
    logo?: string;
    currency?: string;
    currencySymbol?: string;
  };
  settings?: {
    subtitle?: string;
    notice?: string;
    wifiSsid?: string;
    wifiPassword?: string;
    theme?: string;
    tableCardTitle?: string;
    tableCardSubtitle?: string;
    customUrl?: string;
  };
  categories: MenuCategoryData[];
  items: MenuItemData[];
  tables: TableData[];
  server?: {
    activeUrl?: string | null;
  };
}

const MENU_THEMES: Record<
  MenuTheme,
  {
    bgStart: string;
    bgEnd: string;
    border: string;
    cornerAccent: string;
    headerColor: string;
    categoryBg: string;
    categoryText: string;
    categoryBorder: string;
    itemNameColor: string;
    itemPriceColor: string;
    descColor: string;
    leaderDotColor: string;
    footerText: string;
    miniQrBg: string;
    vegBorder: string;
    vegDot: string;
    nonVegBorder: string;
    nonVegDot: string;
  }
> = {
  noir: {
    bgStart: '#0b0f19',
    bgEnd: '#030712',
    border: '#d4af37',
    cornerAccent: '#fbbf24',
    headerColor: '#ffffff',
    categoryBg: '#1e293b',
    categoryText: '#fbbf24',
    categoryBorder: '#d4af37',
    itemNameColor: '#f8fafc',
    itemPriceColor: '#fbbf24',
    descColor: '#94a3b8',
    leaderDotColor: '#334155',
    footerText: '#64748b',
    miniQrBg: '#ffffff',
    vegBorder: '#10b981',
    vegDot: '#10b981',
    nonVegBorder: '#ef4444',
    nonVegDot: '#ef4444',
  },
  ivory: {
    bgStart: '#fdfbf7',
    bgEnd: '#f4ede2',
    border: '#8b4513',
    cornerAccent: '#9a3412',
    headerColor: '#2b1d0c',
    categoryBg: '#8b4513',
    categoryText: '#ffffff',
    categoryBorder: '#78350f',
    itemNameColor: '#291b0f',
    itemPriceColor: '#9a3412',
    descColor: '#78716c',
    leaderDotColor: '#d6c7b2',
    footerText: '#78716c',
    miniQrBg: '#ffffff',
    vegBorder: '#15803d',
    vegDot: '#15803d',
    nonVegBorder: '#b91c1c',
    nonVegDot: '#b91c1c',
  },
  minimal: {
    bgStart: '#ffffff',
    bgEnd: '#f8fafc',
    border: '#e2e8f0',
    cornerAccent: '#059669',
    headerColor: '#0f172a',
    categoryBg: '#f1f5f9',
    categoryText: '#0f172a',
    categoryBorder: '#cbd5e1',
    itemNameColor: '#0f172a',
    itemPriceColor: '#059669',
    descColor: '#64748b',
    leaderDotColor: '#cbd5e1',
    footerText: '#94a3b8',
    miniQrBg: '#ffffff',
    vegBorder: '#059669',
    vegDot: '#059669',
    nonVegBorder: '#e11d48',
    nonVegDot: '#e11d48',
  },
  royal: {
    bgStart: '#0a192f',
    bgEnd: '#020c1b',
    border: '#f3ba2f',
    cornerAccent: '#ffd700',
    headerColor: '#ffffff',
    categoryBg: '#172a45',
    categoryText: '#f3ba2f',
    categoryBorder: '#f3ba2f',
    itemNameColor: '#f8fafc',
    itemPriceColor: '#f3ba2f',
    descColor: '#94a3b8',
    leaderDotColor: '#1e3a8a',
    footerText: '#64748b',
    miniQrBg: '#ffffff',
    vegBorder: '#10b981',
    vegDot: '#10b981',
    nonVegBorder: '#ef4444',
    nonVegDot: '#ef4444',
  },
  garden: {
    bgStart: '#f5faf6',
    bgEnd: '#e8f5ec',
    border: '#2d6a4f',
    cornerAccent: '#52b788',
    headerColor: '#1b4332',
    categoryBg: '#2d6a4f',
    categoryText: '#ffffff',
    categoryBorder: '#1b4332',
    itemNameColor: '#1b4332',
    itemPriceColor: '#2d6a4f',
    descColor: '#52796f',
    leaderDotColor: '#95d5b2',
    footerText: '#52796f',
    miniQrBg: '#ffffff',
    vegBorder: '#2d6a4f',
    vegDot: '#2d6a4f',
    nonVegBorder: '#dc2626',
    nonVegDot: '#dc2626',
  },
  blush: {
    bgStart: '#fff7f9',
    bgEnd: '#fce7ec',
    border: '#e11d48',
    cornerAccent: '#f43f5e',
    headerColor: '#881337',
    categoryBg: '#e11d48',
    categoryText: '#ffffff',
    categoryBorder: '#9f1239',
    itemNameColor: '#4c0519',
    itemPriceColor: '#e11d48',
    descColor: '#9f1239',
    leaderDotColor: '#fecdd3',
    footerText: '#9f1239',
    miniQrBg: '#ffffff',
    vegBorder: '#15803d',
    vegDot: '#15803d',
    nonVegBorder: '#e11d48',
    nonVegDot: '#e11d48',
  },
  terracotta: {
    bgStart: '#fdfbf7',
    bgEnd: '#fbeee4',
    border: '#c2410c',
    cornerAccent: '#ea580c',
    headerColor: '#431407',
    categoryBg: '#c2410c',
    categoryText: '#ffffff',
    categoryBorder: '#7c2d12',
    itemNameColor: '#291b0f',
    itemPriceColor: '#c2410c',
    descColor: '#78716c',
    leaderDotColor: '#fed7aa',
    footerText: '#78716c',
    miniQrBg: '#ffffff',
    vegBorder: '#15803d',
    vegDot: '#15803d',
    nonVegBorder: '#b91c1c',
    nonVegDot: '#b91c1c',
  },
  charcoal: {
    bgStart: '#18181b',
    bgEnd: '#09090b',
    border: '#f59e0b',
    cornerAccent: '#fbbf24',
    headerColor: '#ffffff',
    categoryBg: '#27272a',
    categoryText: '#fbbf24',
    categoryBorder: '#f59e0b',
    itemNameColor: '#fafafa',
    itemPriceColor: '#fbbf24',
    descColor: '#a1a1aa',
    leaderDotColor: '#3f3f46',
    footerText: '#71717a',
    miniQrBg: '#ffffff',
    vegBorder: '#10b981',
    vegDot: '#10b981',
    nonVegBorder: '#ef4444',
    nonVegDot: '#ef4444',
  },
  crimson: {
    bgStart: '#ffffff',
    bgEnd: '#fff1f1',
    border: '#dc2626',
    cornerAccent: '#eab308',
    headerColor: '#991b1b',
    categoryBg: '#dc2626',
    categoryText: '#ffffff',
    categoryBorder: '#991b1b',
    itemNameColor: '#111827',
    itemPriceColor: '#dc2626',
    descColor: '#6b7280',
    leaderDotColor: '#fca5a5',
    footerText: '#6b7280',
    miniQrBg: '#ffffff',
    vegBorder: '#16a34a',
    vegDot: '#16a34a',
    nonVegBorder: '#dc2626',
    nonVegDot: '#dc2626',
  },
};

export async function generateMenuCanvas(
  data: MenuDataPayload,
  options: MenuCanvasOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    theme = 'noir',
    title = data.restaurant.name || 'Menu',
    subtitle = data.settings?.subtitle || 'Culinary Delights & House Specialties',
    qrUrl = data.server?.activeUrl || '',
    qrStyle = 'rounded',
    showPrices = true,
    showDescriptions = true,
    showMiniQr = true,
    selectedCategoryIds,
  } = options;

  const pal = MENU_THEMES[theme];
  const curSymbol = data.restaurant.currencySymbol || data.restaurant.currency || '₹';

  // Filter categories and items
  let activeCategories = data.categories;
  if (selectedCategoryIds && selectedCategoryIds.length > 0) {
    activeCategories = activeCategories.filter((c) => selectedCategoryIds.includes(c.id));
  }

  // Map category to items
  const catItemsMap = new Map<number, MenuItemData[]>();
  for (const item of data.items) {
    if (selectedCategoryIds && selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(item.categoryId)) {
      continue;
    }
    if (!catItemsMap.has(item.categoryId)) {
      catItemsMap.set(item.categoryId, []);
    }
    catItemsMap.get(item.categoryId)!.push(item);
  }

  // Only keep categories that have items
  const displayCategories = activeCategories.filter((c) => (catItemsMap.get(c.id) ?? []).length > 0);

  // Set high-res canvas dimensions (A4 portrait ratio 1800 x 2600)
  const width = 1800;
  const height = 2600;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 1. Background Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, pal.bgStart);
  grad.addColorStop(1, pal.bgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Borders & Corner Accents
  const outerMargin = 40;
  const innerMargin = 55;
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 4;
  ctx.strokeRect(outerMargin, outerMargin, width - outerMargin * 2, height - outerMargin * 2);

  ctx.strokeStyle = pal.cornerAccent;
  ctx.lineWidth = 1;
  ctx.strokeRect(innerMargin, innerMargin, width - innerMargin * 2, height - innerMargin * 2);

  // Corner ornaments
  const cornerSize = 50;
  const drawCorner = (x: number, y: number, dx: number, dy: number) => {
    ctx.strokeStyle = pal.cornerAccent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + dy * cornerSize);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * cornerSize, y);
    ctx.stroke();
  };
  drawCorner(innerMargin, innerMargin, 1, 1);
  drawCorner(width - innerMargin, innerMargin, -1, 1);
  drawCorner(innerMargin, height - innerMargin, 1, -1);
  drawCorner(width - innerMargin, height - innerMargin, -1, -1);

  // 3. Header Section
  let curY = 120;

  if (data.restaurant.logo) {
    try {
      const logoImg = await loadImage(data.restaurant.logo);
      const maxLogoW = 160;
      const maxLogoH = 80;
      const ratio = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
      const lw = logoImg.width * ratio;
      const lh = logoImg.height * ratio;
      ctx.drawImage(logoImg, (width - lw) / 2, curY, lw, lh);
      curY += lh + 20;
    } catch {
      // skip logo on failure
    }
  }

  // Restaurant Name
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.headerColor;
  ctx.font = `bold 52px 'Inter', serif`;
  ctx.fillText(title.toUpperCase(), width / 2, curY);
  curY += 40;

  // Subtitle
  ctx.fillStyle = pal.cornerAccent;
  ctx.font = `600 24px 'Inter', sans-serif`;
  ctx.fillText(subtitle.toUpperCase(), width / 2, curY);
  curY += 34;

  // Address & Contact line
  const metaParts = [data.restaurant.address, data.restaurant.phone].filter(Boolean);
  if (metaParts.length > 0) {
    ctx.fillStyle = pal.descColor;
    ctx.font = `500 20px 'Inter', sans-serif`;
    ctx.fillText(metaParts.join('   •   '), width / 2, curY);
    curY += 30;
  }

  // Divider
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 200, curY);
  ctx.lineTo(width / 2 + 200, curY);
  ctx.stroke();

  // Diamond center ornament
  ctx.fillStyle = pal.cornerAccent;
  ctx.beginPath();
  ctx.arc(width / 2, curY, 5, 0, Math.PI * 2);
  ctx.fill();
  curY += 50;

  // 4. Two-Column Layout for Categories and Items
  const colGap = 80;
  const colWidth = (width - innerMargin * 2 - 100 - colGap) / 2;
  const colLeftX = innerMargin + 50;
  const colRightX = colLeftX + colWidth + colGap;

  const bodyStartY = curY;
  const footerReservedH = showMiniQr ? 220 : 120;
  const maxBodyY = height - innerMargin - footerReservedH;

  // Split categories between left and right column evenly based on item count
  const leftCats: MenuCategoryData[] = [];
  const rightCats: MenuCategoryData[] = [];
  let leftItemCount = 0;
  let rightItemCount = 0;

  for (const cat of displayCategories) {
    const items = catItemsMap.get(cat.id) || [];
    if (leftItemCount <= rightItemCount) {
      leftCats.push(cat);
      leftItemCount += items.length + 2; // +2 for category header weight
    } else {
      rightCats.push(cat);
      rightItemCount += items.length + 2;
    }
  }

  const renderCategoryColumn = (cats: MenuCategoryData[], startX: number) => {
    let y = bodyStartY;

    for (const cat of cats) {
      const items = catItemsMap.get(cat.id) || [];
      if (items.length === 0 || y > maxBodyY - 80) break;

      // Category Header Banner
      const catH = 44;
      drawRoundedRect(ctx, startX, y, colWidth, catH, 8);
      ctx.fillStyle = pal.categoryBg;
      ctx.fill();
      ctx.strokeStyle = pal.categoryBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = pal.categoryText;
      ctx.font = `bold 22px 'Inter', sans-serif`;
      ctx.fillText(cat.name.toUpperCase(), startX + colWidth / 2, y + 30);
      y += catH + 20;

      // Items in this Category
      for (const item of items) {
        if (y > maxBodyY - 50) break;

        // Draw Veg / Non-Veg Icon
        const iconSize = 14;
        const iconX = startX + 4;
        const iconY = y - 13;
        ctx.strokeStyle = item.isVeg ? pal.vegBorder : pal.nonVegBorder;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(iconX, iconY, iconSize, iconSize);

        ctx.fillStyle = item.isVeg ? pal.vegDot : pal.nonVegDot;
        ctx.beginPath();
        ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Item Name
        ctx.textAlign = 'left';
        ctx.fillStyle = pal.itemNameColor;
        ctx.font = `600 21px 'Inter', sans-serif`;
        const itemNameX = iconX + iconSize + 12;
        ctx.fillText(item.name, itemNameX, y);

        // Price formatting
        if (showPrices) {
          const priceStr = `${curSymbol}${(item.basePrice / 100).toFixed(0)}`;
          ctx.textAlign = 'right';
          ctx.fillStyle = pal.itemPriceColor;
          ctx.font = `bold 21px 'Inter', sans-serif`;
          ctx.fillText(priceStr, startX + colWidth - 4, y);

          // Dotted Leader line
          const nameWidth = ctx.measureText(item.name).width;
          const priceWidth = ctx.measureText(priceStr).width;
          const dotStartX = itemNameX + nameWidth + 12;
          const dotEndX = startX + colWidth - priceWidth - 14;

          if (dotEndX > dotStartX + 20) {
            ctx.fillStyle = pal.leaderDotColor;
            for (let dotX = dotStartX; dotX < dotEndX; dotX += 10) {
              ctx.beginPath();
              ctx.arc(dotX, y - 4, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        y += 24;

        // Variations or Description
        if (item.variations && item.variations.length > 0) {
          const varText = item.variations
            .map((v) => `${v.name}: ${curSymbol}${((v.basePrice || item.basePrice + v.priceDelta) / 100).toFixed(0)}`)
            .join('  •  ');
          ctx.textAlign = 'left';
          ctx.fillStyle = pal.descColor;
          ctx.font = `italic 16px 'Inter', sans-serif`;
          ctx.fillText(varText, itemNameX, y);
          y += 20;
        } else if (showDescriptions && item.description && item.description.trim().length > 0) {
          ctx.textAlign = 'left';
          ctx.fillStyle = pal.descColor;
          ctx.font = `400 15px 'Inter', sans-serif`;
          ctx.fillText(item.description.slice(0, 50), itemNameX, y);
          y += 20;
        }

        y += 10; // spacing between items
      }

      y += 20; // spacing between categories
    }
  };

  renderCategoryColumn(leftCats, colLeftX);
  renderCategoryColumn(rightCats, colRightX);

  // 5. Footer Section (Mini QR code + Tax / Disclaimer)
  const footerY = height - innerMargin - (showMiniQr ? 180 : 90);

  // Footer divider line
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(colLeftX, footerY);
  ctx.lineTo(colRightX + colWidth, footerY);
  ctx.stroke();

  if (showMiniQr && qrUrl && qrUrl.trim().length > 0) {
    try {
      const miniQrSize = 130;
      const miniQrX = width - innerMargin - 60 - miniQrSize;
      const miniQrY = footerY + 20;

      // Draw QR container card
      drawRoundedRect(ctx, miniQrX - 10, miniQrY - 10, miniQrSize + 20, miniQrSize + 20, 12);
      ctx.fillStyle = pal.miniQrBg;
      ctx.fill();
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      drawQrOnCanvas(ctx, qrUrl, miniQrX, miniQrY, miniQrSize, qrStyle, true);

      ctx.textAlign = 'right';
      ctx.fillStyle = pal.cornerAccent;
      ctx.font = `bold 18px 'Inter', sans-serif`;
      ctx.fillText('SCAN FOR LIVE DIGITAL MENU', miniQrX - 25, miniQrY + 45);

      ctx.fillStyle = pal.descColor;
      ctx.font = `500 16px 'Inter', sans-serif`;
      ctx.fillText('Browse latest dishes, dietary details & specials on your phone', miniQrX - 25, miniQrY + 75);

      ctx.textAlign = 'left';
      ctx.fillStyle = pal.footerText;
      ctx.font = `400 16px 'Inter', sans-serif`;
      ctx.fillText('Prices inclusive of all applicable taxes • Freshly prepared on order', colLeftX, miniQrY + 50);
      ctx.fillText('Thank you for dining with us!  •  Powered by Molecule POS', colLeftX, miniQrY + 80);
    } catch {
      // Fallback text footer if QR image failed
      renderStandardFooter(ctx, pal, colLeftX, footerY + 50);
    }
  } else {
    renderStandardFooter(ctx, pal, colLeftX, footerY + 40);
  }

  return canvas;
}

function renderStandardFooter(
  ctx: CanvasRenderingContext2D,
  pal: typeof MENU_THEMES['noir'],
  x: number,
  y: number
) {
  ctx.textAlign = 'left';
  ctx.fillStyle = pal.footerText;
  ctx.font = `400 18px 'Inter', sans-serif`;
  ctx.fillText('Prices inclusive of all applicable taxes • Freshly prepared on order', x, y);
  ctx.fillText('Thank you for dining with us!  •  Powered by Molecule POS', x, y + 30);
}

export async function downloadMenuImage(
  data: MenuDataPayload,
  options: MenuCanvasOptions = {},
  filename?: string
): Promise<void> {
  const canvas = await generateMenuCanvas(data, options);
  const dataUri = canvas.toDataURL('image/png');
  const safeName = (data.restaurant.name || 'menu').replace(/\s+/g, '-').toLowerCase();
  const outName = filename || `molecule-menu-${safeName}.png`;
  downloadDataUri(dataUri, outName);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
