import { BrowserWindow } from 'electron';
import * as settingsRepo from '../db/repositories/settings.repo';
import { createPrinter, sendRawToPrinter } from './escpos-print.service';
import { mergeLayout, KOT_FIELD_DEFS } from '../../shared/receipt-layout';
import { renderKotText, KotModel, DEFAULT_KOT_LABELS } from '../../shared/receipt-render';

interface KOTPrintData {
  kotNumber: string;
  orderNumber: string;
  tableName?: string;
  orderType: string;
  items: { name: string; quantity: number; notes?: string; addons?: { name: string }[] }[];
  printedAt: string;
  /** Ordinal position of this KOT among all KOTs for the same order (1-based). */
  kotCount?: number;
}

type ItemStyle = 'name_qty' | 'qty_x_name' | 'qty_name' | 'sno_name_qty';

function formatDateTime(isoStr: string): string {
  try {
    const ts = isoStr.endsWith('Z') ? isoStr : isoStr + 'Z';
    const d = new Date(ts);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

function formatKotItemLine(
  name: string, quantity: number, index: number, style: ItemStyle, width: number
): string {
  const maxName = width - 5;
  const truncName = name.length > maxName ? name.substring(0, maxName) : name;
  switch (style) {
    case 'qty_x_name':
      return `${quantity} x ${name}`.substring(0, width);
    case 'qty_name':
      return `${String(quantity).padStart(3)}  ${name}`.substring(0, width);
    case 'sno_name_qty': {
      const prefix = `${index + 1}. `;
      const snoName = (prefix + name).length > maxName
        ? (prefix + name).substring(0, maxName)
        : (prefix + name);
      return `${snoName.padEnd(width - 3)}${String(quantity).padStart(3)}`;
    }
    case 'name_qty':
    default:
      return `${truncName.padEnd(width - 3)}${String(quantity).padStart(3)}`;
  }
}

type FontSize = 'regular' | 'small' | 'medium' | 'large';

function applyFontSize(p: any, size: FontSize): void {
  switch (size) {
    case 'regular': p.setTextNormal(); break;
    case 'small': p.setTextNormal(); break;
    case 'medium': p.setTextDoubleHeight(); break;
    case 'large': p.setTextQuadArea(); break;
    default: p.setTextDoubleHeight(); break;
  }
}

/** Character-width lookup for supported thermal-printer paper sizes */
const PAPER_CHAR_WIDTH: Record<string, number> = {
  '58mm': 32,
  '72mm': 38,
  '76mm': 40,
  '80mm': 42,
  '112mm': 56,
};

/**
 * Maximum print-area width in dots for each paper size (203 DPI / 8 dots-per-mm).
 * GS W command (1D 57 nL nH) sets this; combined with GS L = 0 it maximises
 * the usable area — the remaining margins are hardware-imposed.
 */
const PAPER_PRINT_DOTS: Record<string, [number, number]> = {
  '58mm': [0x80, 0x01],   // 384 dots ≈ 48mm
  '72mm': [0x00, 0x02],   // 512 dots ≈ 64mm
  '76mm': [0x18, 0x02],   // 536 dots ≈ 67mm
  '80mm': [0x40, 0x02],   // 576 dots ≈ 72mm
  '112mm': [0x40, 0x03],  // 832 dots ≈ 104mm
};

/** Base character width derived from the paper_width setting */
function getBaseCharWidth(): number {
  const paper = settingsRepo.get('paper_width') ?? '80mm';
  return PAPER_CHAR_WIDTH[paper] ?? 42;
}

/** Width multiplier: how many times wider than normal each font size prints */
function getWidthMultiplier(size: FontSize): number {
  switch (size) {
    case 'regular': case 'small': case 'medium': return 1;
    case 'large': return 2;
    default: return 1;
  }
}

function buildKotEscPos(data: KOTPrintData, style: ItemStyle, fontSize: FontSize): Buffer {
  const paper = settingsRepo.get('paper_width') ?? '80mm';
  const baseWidth = PAPER_CHAR_WIDTH[paper] ?? 42;
  const p = createPrinter(baseWidth);
  const effectiveWidth = Math.floor(baseWidth / getWidthMultiplier(fontSize));

  // Ensure Font A, reset left margin to 0, and maximise print area
  p.setTypeFontA();
  p.add(Buffer.from([0x1d, 0x4c, 0x00, 0x00]));
  const [nL, nH] = PAPER_PRINT_DOTS[paper] ?? [0x40, 0x02];
  p.add(Buffer.from([0x1d, 0x57, nL, nH]));

  const location = data.tableName
    ? `Table: ${data.tableName}`
    : `Type: ${data.orderType.replace('_', ' ')}`;

  // Header — bold, double-height (not double-width to avoid cutoff), centered
  p.alignCenter();
  p.bold(true);
  p.setTextDoubleHeight();
  p.println('KOT');
  p.setTextNormal();
  p.bold(true);
  p.drawLine('=');

  // Order info
  p.alignLeft();
  applyFontSize(p, fontSize);
  p.println(location.substring(0, effectiveWidth));
  if (data.kotCount != null) {
    p.println(`KOT Count: ${data.kotCount}`.substring(0, effectiveWidth));
  }
  p.println(`Date: ${formatDateTime(data.printedAt)}`.substring(0, effectiveWidth));

  // Items section
  p.setTextNormal();
  p.bold(true);
  p.drawLine('-');
  applyFontSize(p, fontSize);
  if (style === 'name_qty' || style === 'sno_name_qty') {
    p.println('Item'.padEnd(effectiveWidth - 3) + 'Qty'.padStart(3));
  } else {
    p.println('Items');
  }
  p.setTextNormal();
  p.bold(true);
  p.drawLine('-');

  // Item lines
  applyFontSize(p, fontSize);
  data.items.forEach((item, idx) => {
    p.println(formatKotItemLine(item.name, item.quantity, idx, style, effectiveWidth));
    if (item.addons?.length) {
      for (const addon of item.addons) {
        p.println(`  + ${addon.name}`.substring(0, effectiveWidth));
      }
    }
    if (item.notes) {
      p.println(`  * ${item.notes}`.substring(0, effectiveWidth));
    }
  });

  // Footer
  const totalItems = data.items.reduce((sum, i) => sum + i.quantity, 0);
  p.setTextNormal();
  p.bold(true);
  p.drawLine('-');
  applyFontSize(p, fontSize);
  p.println(`Total Items: ${totalItems}`);
  p.setTextNormal();

  p.cut();
  return p.getBuffer();
}

const FONT_SIZE_MAP: Record<FontSize, string> = { small: '12px', regular: '14px', medium: '16px', large: '20px' };

function buildKotModel(data: KOTPrintData, style: ItemStyle): KotModel {
  return {
    title: 'KOT',
    location: data.tableName
      ? `Table: ${data.tableName}`
      : `Type: ${data.orderType.replace('_', ' ')}`,
    kotCount: data.kotCount != null ? String(data.kotCount) : undefined,
    date: formatDateTime(data.printedAt),
    itemStyle: style,
    items: data.items.map((i) => ({
      name: i.name,
      qty: i.quantity,
      addons: i.addons?.map((a) => a.name) ?? [],
      note: i.notes,
    })),
    totalItems: String(data.items.reduce((sum, i) => sum + i.quantity, 0)),
    labels: { ...DEFAULT_KOT_LABELS },
  };
}

function generateKotHtml(data: KOTPrintData, style: ItemStyle, fontSize: FontSize = 'medium', useLayout = false): string {
  const W = getBaseCharWidth();

  // Raster mode honours the user's KOT field layout (show/hide, reorder, rename).
  if (useLayout) {
    const layout = mergeLayout(settingsRepo.get('kot_layout'), KOT_FIELD_DEFS);
    const receipt = renderKotText(buildKotModel(data, style), layout, W);
    const safeReceipt = receipt
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/ /g, '&nbsp;')
      .replace(/\n/g, '<br>');
    return `<!DOCTYPE html>
<html>
<head>
<style>
  @page { margin: 0; }
  body { margin: 0; padding: 2px; }
  .receipt {
    font-family: 'Menlo', 'Consolas', 'Monaco', 'Liberation Mono', monospace;
    font-size: {{FONT_SIZE}};
    line-height: 1.6;
    color: #000;
    font-weight: 600;
    white-space: pre;
  }
</style>
</head>
<body><div class="receipt">${safeReceipt}</div></body>
</html>`.replace('{{FONT_SIZE}}', FONT_SIZE_MAP[fontSize]);
  }

  const location = data.tableName
    ? `Table: ${data.tableName}`
    : `Type: ${data.orderType.replace('_', ' ')}`;

  const itemsHtml = data.items
    .map((item, idx) => {
      const line = formatKotItemLine(item.name, item.quantity, idx, style, W);
      const addonLines = item.addons?.length
        ? item.addons.map((a) => `  + ${a.name}`).join('\n')
        : '';
      const noteHtml = item.notes ? `\n  * ${item.notes}` : '';
      return line + (addonLines ? '\n' + addonLines : '') + noteHtml;
    })
    .join('\n');

  const totalItems = data.items.reduce((sum, i) => sum + i.quantity, 0);

  const header = (style === 'name_qty' || style === 'sno_name_qty')
    ? 'Item'.padEnd(W - 3) + 'Qty'
    : 'Items';

  const kotCountLine = data.kotCount != null ? `KOT Count: ${data.kotCount}\n` : '';
  const receipt = `
           KOT
-------------------------
${location}
${kotCountLine}Date: ${formatDateTime(data.printedAt)}
---------
${header}
---------
${itemsHtml}
---------
Total Items: ${totalItems}
`.trim();

  const safeReceipt = receipt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/ /g, '&nbsp;')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html>
<head>
<style>
  @page { margin: 0; }
  body { margin: 0; padding: 2px; }
  .receipt {
    font-family: 'Menlo', 'Consolas', 'Monaco', 'Liberation Mono', monospace;
    font-size: {{FONT_SIZE}};
    line-height: 1.6;
    color: #000;
    font-weight: 600;
    white-space: pre;
  }
</style>
</head>
<body><div class="receipt">${safeReceipt}</div></body>
</html>`.replace('{{FONT_SIZE}}', FONT_SIZE_MAP[fontSize]);
}

function printViaHtml(html: string, printerName: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 400,
      height: 600,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    win.webContents.on('did-finish-load', async () => {
      let resolvedPrinterName: string | undefined;
      if (printerName) {
        const printers = await win.webContents.getPrintersAsync();
        const match = printers.find(
          (p) => p.name === printerName || p.displayName === printerName
        );
        resolvedPrinterName = match?.name;
      }

      const silent = !!resolvedPrinterName;
      if (!silent) win.show();

      const printOptions: Electron.WebContentsPrintOptions = {
        silent,
        printBackground: true,
        ...(resolvedPrinterName ? { deviceName: resolvedPrinterName } : {}),
      };

      win.webContents.print(printOptions, (success, failureReason) => {
        win.destroy();
        if (success || failureReason === 'cancelled') {
          resolve();
        } else {
          reject(new Error(`Print failed: ${failureReason}`));
        }
      });
    });

    win.webContents.on('did-fail-load', () => {
      win.destroy();
      reject(new Error('Failed to load print content'));
    });
  });
}

export async function printKotReceipt(data: KOTPrintData): Promise<void> {
  const savedPrinterName = settingsRepo.get('printer_kot');
  const style = (settingsRepo.get('kot_item_style') ?? 'name_qty') as ItemStyle;
  const fontSize = (settingsRepo.get('kot_font_size') ?? 'medium') as FontSize;
  const printMode = settingsRepo.get('print_mode') ?? 'thermal';

  // If customer chose HTML mode, skip ESC/POS entirely
  if (printMode === 'html') {
    const html = generateKotHtml(data, style, fontSize);
    await printViaHtml(html, savedPrinterName || null);
    return;
  }

  if (printMode === 'raster') {
    const html = generateKotHtml(data, style, fontSize, true);
    await printViaHtml(html, savedPrinterName || null);
    return;
  }

  // Thermal mode: try ESC/POS first, fallback to HTML on failure
  if (savedPrinterName) {
    try {
      const escposBuffer = buildKotEscPos(data, style, fontSize);
      await sendRawToPrinter(savedPrinterName, escposBuffer);
      return;
    } catch (err: any) {
      console.warn('ESC/POS KOT print failed, falling back to HTML.');
      console.warn('  Printer:', savedPrinterName);
      console.warn('  Error:', err?.message ?? err);
    }
  }

  const html = generateKotHtml(data, style, fontSize);
  await printViaHtml(html, savedPrinterName || null);
}

