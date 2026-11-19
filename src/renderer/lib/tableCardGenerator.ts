import { type QrStyle } from '../../shared/qr-render';
import { drawQrOnCanvas } from './qrCanvasDraw';
import { downloadDataUri } from './qrCodeGenerator';

export type TableCardTheme = 'noir' | 'ivory' | 'minimal' | 'royal';
export type TableCardFormat = 'tent' | 'square' | 'wide';

export interface TableCardOptions {
  theme?: TableCardTheme;
  format?: TableCardFormat;
  qrStyle?: QrStyle;
  centerIcon?: boolean;
  title?: string;
  subtitle?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  logoDataUrl?: string;
}

export interface TableInfo {
  id?: number;
  name?: string;
  capacity?: number;
  floorName?: string;
}

const THEME_PALETTES: Record<
  TableCardTheme,
  {
    bgStart: string;
    bgEnd: string;
    border: string;
    cornerAccent: string;
    titleColor: string;
    accentColor: string;
    textColor: string;
    mutedColor: string;
    tableBadgeBg: string;
    tableBadgeText: string;
    qrCardBg: string;
    qrCardBorder: string;
    wifiBg: string;
    wifiBorder: string;
    wifiText: string;
  }
> = {
  noir: {
    bgStart: '#0f172a',
    bgEnd: '#020617',
    border: '#d4af37',
    cornerAccent: '#fbbf24',
    titleColor: '#ffffff',
    accentColor: '#fbbf24',
    textColor: '#f8fafc',
    mutedColor: '#94a3b8',
    tableBadgeBg: '#fbbf24',
    tableBadgeText: '#0f172a',
    qrCardBg: '#ffffff',
    qrCardBorder: '#334155',
    wifiBg: 'rgba(251, 191, 36, 0.1)',
    wifiBorder: '#d4af37',
    wifiText: '#f8fafc',
  },
  ivory: {
    bgStart: '#faf7f2',
    bgEnd: '#f3ece2',
    border: '#8b4513',
    cornerAccent: '#b45309',
    titleColor: '#2b1d0c',
    accentColor: '#9a3412',
    textColor: '#332211',
    mutedColor: '#78716c',
    tableBadgeBg: '#8b4513',
    tableBadgeText: '#ffffff',
    qrCardBg: '#ffffff',
    qrCardBorder: '#d6c7b2',
    wifiBg: 'rgba(139, 69, 19, 0.08)',
    wifiBorder: '#b45309',
    wifiText: '#2b1d0c',
  },
  minimal: {
    bgStart: '#ffffff',
    bgEnd: '#f8fafc',
    border: '#e2e8f0',
    cornerAccent: '#059669',
    titleColor: '#0f172a',
    accentColor: '#059669',
    textColor: '#1e293b',
    mutedColor: '#64748b',
    tableBadgeBg: '#059669',
    tableBadgeText: '#ffffff',
    qrCardBg: '#ffffff',
    qrCardBorder: '#cbd5e1',
    wifiBg: '#f1f5f9',
    wifiBorder: '#94a3b8',
    wifiText: '#0f172a',
  },
  royal: {
    bgStart: '#0a192f',
    bgEnd: '#020c1b',
    border: '#f3ba2f',
    cornerAccent: '#ffd700',
    titleColor: '#ffffff',
    accentColor: '#f3ba2f',
    textColor: '#f1f5f9',
    mutedColor: '#94a3b8',
    tableBadgeBg: '#f3ba2f',
    tableBadgeText: '#0a192f',
    qrCardBg: '#ffffff',
    qrCardBorder: '#1e3a8a',
    wifiBg: 'rgba(243, 186, 47, 0.12)',
    wifiBorder: '#f3ba2f',
    wifiText: '#ffffff',
  },
};

export async function generateTableCardCanvas(
  targetUrl: string,
  table: TableInfo | null,
  options: TableCardOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    theme = 'noir',
    format = 'tent',
    qrStyle = 'rounded',
    centerIcon = true,
    title = 'Scan for Digital Menu',
    subtitle = 'Point phone camera at QR code • Live dishes, prices & specials',
    wifiSsid,
    wifiPassword,
    restaurantName = 'Our Restaurant',
    restaurantAddress,
    restaurantPhone,
    logoDataUrl,
  } = options;

  const pal = THEME_PALETTES[theme];

  let width = 1200;
  let height = 1800; // 'tent' 4x6 / A6 ratio
  if (format === 'square') {
    width = 1200;
    height = 1200;
  } else if (format === 'wide') {
    width = 1800;
    height = 1200;
  }

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

  // 2. Elegant Outer & Inner Borders
  const outerMargin = 30;
  const innerMargin = 45;
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(outerMargin, outerMargin, width - outerMargin * 2, height - outerMargin * 2);

  ctx.strokeStyle = pal.cornerAccent;
  ctx.lineWidth = 1;
  ctx.strokeRect(innerMargin, innerMargin, width - innerMargin * 2, height - innerMargin * 2);

  // Corner decorative marks
  const cornerSize = 40;
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

  // 3. Header Section (Restaurant Name & Logo)
  let curY = format === 'square' ? 80 : 120;

  // Draw Logo if available
  if (logoDataUrl) {
    try {
      const logoImg = await loadImage(logoDataUrl);
      const maxLogoW = 140;
      const maxLogoH = 80;
      const ratio = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
      const lw = logoImg.width * ratio;
      const lh = logoImg.height * ratio;
      ctx.drawImage(logoImg, (width - lw) / 2, curY, lw, lh);
      curY += lh + 20;
    } catch {
      // Skip logo if failed
    }
  }

  // Restaurant Name
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.titleColor;
  ctx.font = `bold ${format === 'square' ? 36 : 44}px 'Inter', sans-serif`;
  ctx.fillText(restaurantName.toUpperCase(), width / 2, curY);
  curY += 32;

  // Sub-header (address / phone)
  if (restaurantAddress || restaurantPhone) {
    ctx.fillStyle = pal.mutedColor;
    ctx.font = `500 ${format === 'square' ? 18 : 22}px 'Inter', sans-serif`;
    const contactLine = [restaurantAddress, restaurantPhone].filter(Boolean).join(' • ');
    ctx.fillText(contactLine, width / 2, curY);
    curY += format === 'square' ? 30 : 40;
  } else {
    curY += 15;
  }

  // Decorative divider
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, curY);
  ctx.lineTo(width / 2 + 120, curY);
  ctx.stroke();

  // Little diamond in the center of the divider
  ctx.fillStyle = pal.accentColor;
  ctx.beginPath();
  ctx.arc(width / 2, curY, 4, 0, Math.PI * 2);
  ctx.fill();
  curY += format === 'square' ? 35 : 45;

  // 4. Table Badge Pill
  const tableText = table?.name ? table.name.toUpperCase() : 'TABLE MENU';
  ctx.font = 'bold 26px sans-serif';
  const tableTextMetrics = ctx.measureText(tableText);
  const badgeWidth = Math.max(220, tableTextMetrics.width + 60);
  const badgeHeight = 50;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = curY;

  // Draw rounded table pill
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 25);
  ctx.fillStyle = pal.tableBadgeBg;
  ctx.fill();
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = pal.tableBadgeText;
  ctx.fillText(tableText, width / 2, badgeY + 34);

  curY += badgeHeight + (format === 'square' ? 30 : 50);

  // 5. QR Code Card Container
  const qrSize = format === 'square' ? 420 : 520;
  const qrCardPadding = 24;
  const qrCardW = qrSize + qrCardPadding * 2;
  const qrCardH = qrSize + qrCardPadding * 2;
  const qrCardX = (width - qrCardW) / 2;
  const qrCardY = curY;

  // Card Background with slight shadow & rounded corners
  drawRoundedRect(ctx, qrCardX, qrCardY, qrCardW, qrCardH, 24);
  ctx.fillStyle = pal.qrCardBg;
  ctx.fill();
  ctx.strokeStyle = pal.qrCardBorder;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Render QR Code directly on Canvas
  drawQrOnCanvas(
    ctx,
    targetUrl,
    qrCardX + qrCardPadding,
    qrCardY + qrCardPadding,
    qrSize,
    qrStyle,
    centerIcon
  );

  curY += qrCardH + (format === 'square' ? 35 : 55);

  // 6. Action Title & Subtitle
  ctx.fillStyle = pal.accentColor;
  ctx.font = `bold ${format === 'square' ? 34 : 42}px 'Inter', sans-serif`;
  ctx.fillText(title.toUpperCase(), width / 2, curY);
  curY += format === 'square' ? 34 : 42;

  ctx.fillStyle = pal.mutedColor;
  ctx.font = `500 ${format === 'square' ? 20 : 24}px 'Inter', sans-serif`;
  ctx.fillText(subtitle, width / 2, curY);
  curY += format === 'square' ? 40 : 55;

  // 7. 3-Step Flow Icons
  const steps = [
    '① Open Camera',
    '② Scan QR Code',
    '③ Browse & Enjoy',
  ];
  ctx.fillStyle = pal.textColor;
  ctx.font = `600 ${format === 'square' ? 18 : 22}px 'Inter', sans-serif`;
  const stepText = steps.join('   •   ');
  ctx.fillText(stepText, width / 2, curY);
  curY += format === 'square' ? 45 : 65;

  // 8. Guest Wi-Fi Box (if SSID provided)
  if (wifiSsid && wifiSsid.trim().length > 0) {
    const wifiBoxW = Math.min(width - 160, 680);
    const wifiBoxH = 65;
    const wifiBoxX = (width - wifiBoxW) / 2;
    const wifiBoxY = curY;

    drawRoundedRect(ctx, wifiBoxX, wifiBoxY, wifiBoxW, wifiBoxH, 14);
    ctx.fillStyle = pal.wifiBg;
    ctx.fill();
    ctx.strokeStyle = pal.wifiBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = pal.wifiText;
    ctx.font = `bold 22px 'Inter', sans-serif`;
    const passPart = wifiPassword ? `   |   Password: ${wifiPassword}` : '';
    ctx.fillText(`📶 Free Wi-Fi: ${wifiSsid}${passPart}`, width / 2, wifiBoxY + 41);
    curY += wifiBoxH + 30;
  }

  // 9. Footer Note
  ctx.fillStyle = pal.mutedColor;
  ctx.font = `400 18px 'Inter', sans-serif`;
  ctx.fillText('Contactless Digital Dining  •  Powered by Molecule POS', width / 2, height - outerMargin - 20);

  return canvas;
}

export async function downloadTableCardImage(
  targetUrl: string,
  table: TableInfo | null,
  options: TableCardOptions = {},
  filename?: string
): Promise<void> {
  const canvas = await generateTableCardCanvas(targetUrl, table, options);
  const dataUri = canvas.toDataURL('image/png');
  const safeName = table?.name ? table.name.replace(/\s+/g, '-').toLowerCase() : 'table-menu';
  const outName = filename || `molecule-qr-${safeName}.png`;
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
