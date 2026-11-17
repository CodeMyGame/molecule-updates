import { BrowserWindow } from 'electron';
import * as settingsRepo from '../db/repositories/settings.repo';
import { mergeLayout, KOT_FIELD_DEFS } from '../../shared/receipt-layout';
import {
  renderKotText,
  KotModel,
  DEFAULT_KOT_LABELS,
  formatKotItemLines,
  wrapText,
  normalizePrintMode,
} from '../../shared/receipt-render';

interface KOTPrintData {
  kotNumber: string;
  orderNumber: string;
  tableName?: string;
  parcelName?: string;
  orderType: string;
  items: { name: string; quantity: number; notes?: string; addons?: { name: string }[] }[];
  printedAt: string;
  /** Ordinal position of this KOT among all KOTs for the same order (1-based). */
  kotCount?: number;
  station?: string;
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

/** Character-width lookup for supported receipt paper sizes */
const PAPER_CHAR_WIDTH: Record<string, number> = {
  '58mm': 32,
  '72mm': 38,
  '76mm': 40,
  '80mm': 42,
  '112mm': 56,
};

/** Base character width derived from the paper_width setting */
function getBaseCharWidth(): number {
  const paper = settingsRepo.get('paper_width') ?? '58mm';
  return PAPER_CHAR_WIDTH[paper] ?? 32;
}

type FontSize = 'regular' | 'small' | 'medium' | 'large';
const FONT_SIZE_MAP: Record<FontSize, string> = { small: '12px', regular: '14px', medium: '16px', large: '20px' };

function buildKotModel(data: KOTPrintData, style: ItemStyle): KotModel {
  return {
    title: 'KOT',
    location: data.orderType === 'dine_in' && data.tableName
      ? `Table: ${data.tableName}`
      : data.orderType === 'takeaway' && data.parcelName
      ? `Takeaway (${data.parcelName})`
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

function generateKotHtml(data: KOTPrintData, style: ItemStyle, fontSize: FontSize = 'small', useLayout = false): string {
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

  const location = data.orderType === 'dine_in' && data.tableName
    ? `Table: ${data.tableName}`
    : `Type: ${data.orderType.replace('_', ' ')}`;

  const itemsHtml = data.items
    .map((item, idx) => {
      const itemLines = formatKotItemLines(item.name, item.quantity, idx, style, W);
      const addonLines = item.addons?.length
        ? item.addons.flatMap((a) => wrapText(`  + ${a.name}`, W)).join('\n')
        : '';
      const noteHtml = item.notes
        ? '\n' + wrapText(`  * ${item.notes}`, W).join('\n')
        : '';
      return itemLines.join('\n') + (addonLines ? '\n' + addonLines : '') + noteHtml;
    })
    .join('\n');

  const totalItems = data.items.reduce((sum, i) => sum + i.quantity, 0);

  const header = (style === 'name_qty' || style === 'sno_name_qty')
    ? 'Item'.padEnd(W - 3) + 'Qty'
    : 'Items';

  const stationLine = data.station ? `Station: ${data.station.replace(/_/g, ' ').toUpperCase()}\n` : '';
  const kotCountLine = data.kotCount != null ? `KOT Count: ${data.kotCount}\n` : '';
  const receipt = `
           KOT
-------------------------
${location}
${stationLine}${kotCountLine}Date: ${formatDateTime(data.printedAt)}
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

export function resolveKotPrinter(station?: string): string | null {
  const multiStationEnabled = settingsRepo.get('multi_station_kot_printing') === 'true';
  const defaultKotPrinter = settingsRepo.get('printer_kot') || null;

  if (multiStationEnabled && station) {
    try {
      const stationPrintersRaw = settingsRepo.get('station_printers');
      if (stationPrintersRaw) {
        const mapping = JSON.parse(stationPrintersRaw);
        if (mapping && typeof mapping === 'object' && mapping[station]) {
          return mapping[station];
        }
      }
    } catch (err) {
      console.warn('Failed to parse station_printers setting:', err);
    }
  }

  return defaultKotPrinter;
}

export async function printKotReceipt(data: KOTPrintData): Promise<void> {
  const savedPrinterName = resolveKotPrinter(data.station);
  const style = (settingsRepo.get('kot_item_style') ?? 'name_qty') as ItemStyle;
  const fontSize = (settingsRepo.get('kot_font_size') ?? 'small') as FontSize;
  const printMode = normalizePrintMode(settingsRepo.get('print_mode'));

  if (printMode === 'raster') {
    const html = generateKotHtml(data, style, fontSize, true);
    await printViaHtml(html, savedPrinterName || null);
    return;
  }

  const html = generateKotHtml(data, style, fontSize);
  await printViaHtml(html, savedPrinterName || null);
}

