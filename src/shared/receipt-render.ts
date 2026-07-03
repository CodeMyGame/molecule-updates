/**
 * Pure receipt text renderers driven by a ReceiptLayout.
 *
 * Used by the renderer (real bill + settings preview), the main process
 * (test bill + raster KOT). No electron / DOM imports.
 *
 * Only used for the Raster print mode; thermal/html keep their own builders.
 */

import {
  ReceiptLayout,
  ReceiptFieldConfig,
  ReceiptFieldDef,
  BILL_FIELD_DEFS,
  KOT_FIELD_DEFS,
  getFieldDef,
  isFieldVisible,
} from './receipt-layout';

export type ReceiptItemStyle = 'name_qty' | 'qty_x_name' | 'qty_name' | 'sno_name_qty';

// ── paper / font sizing (shared by the real print path + settings preview) ─────

/** Horizontal dot resolution of each supported paper width. */
export const PAPER_DOTS: Record<string, number> = {
  '58mm': 384, '72mm': 512, '76mm': 536, '80mm': 576, '112mm': 832,
};

/** Default characters-per-line at the printer's base font for each paper width. */
export const BASE_CHAR_WIDTH: Record<string, number> = {
  '58mm': 32, '72mm': 38, '76mm': 40, '80mm': 42, '112mm': 56,
};

/** Relative font scale factor for a font-size setting (1x .. 3x). */
export function fontScale(fontSize?: string | null): number {
  switch (fontSize) {
    case 'large': return 3;
    case 'medium': return 2;
    case 'regular': return 1.5;
    case 'small':
    default: return 1;
  }
}

/**
 * Characters-per-line for a given paper width + print mode + font size.
 *
 * In raster mode a larger font means wider character cells, so fewer
 * characters fit per line. Thermal / HTML modes keep the printer's base
 * character width (the firmware handles the font scaling).
 *
 * Pass `forceFontScaling` to always apply the font scaling regardless of mode
 * — used by the settings preview so the user can see the effect of font size
 * in every mode.
 */
export function computePrintLineWidth(
  paperWidth?: string | null,
  printMode?: string | null,
  fontSize?: string | null,
  forceFontScaling = false,
): number {
  const paper = paperWidth ?? '80mm';
  const scaled = (printMode === 'raster' || forceFontScaling) && !!fontSize && fontSize !== 'small';
  if (scaled) {
    const cellBase = paper === '58mm' ? 9 : 14;
    const cellWidth = Math.round(cellBase * fontScale(fontSize));
    const dots = PAPER_DOTS[paper] ?? 576;
    return Math.floor(dots / cellWidth);
  }
  return BASE_CHAR_WIDTH[paper] ?? 42;
}

// ── text helpers ──────────────────────────────────────────────────────────────

function padLine(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, space)) + right;
}

function centerText(text: string, width: number): string {
  const space = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(space) + text;
}

function divider(char: string, width: number): string {
  return char.repeat(width);
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > width) {
    let cut = remaining.lastIndexOf(' ', width);
    if (cut <= 0) cut = width;
    lines.push(remaining.substring(0, cut));
    remaining = remaining.substring(cut).trimStart();
  }
  if (remaining) lines.push(remaining);
  return lines;
}

/** Item line formatter shared with KOT (mirrors kot-print.service thermal logic). */
function formatKotItemLine(
  name: string, quantity: number, index: number, style: ReceiptItemStyle, width: number
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

function labelFor(cfg: ReceiptFieldConfig, labels: Record<string, string>): string {
  return cfg.label ?? labels[cfg.id] ?? '';
}

// ── Bill ────────────────────────────────────────────────────────────────────

export interface BillItem {
  name: string;
  qty: number;
  /** formatted total (no currency padding) e.g. "990.00" */
  totalStr: string;
  addons: string[];
  note?: string;
}

export interface BillTax {
  labelA: string;
  valueA: string;
  labelB: string;
  valueB: string;
}

export interface BillModel {
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  fssai?: string;
  orderNo?: string;
  date?: string;
  type?: string;
  table?: string;
  cashier?: string;
  itemStyle: ReceiptItemStyle;
  items: BillItem[];
  subtotalStr?: string;
  discount?: { percentSuffix?: string; valueStr: string };
  taxes: BillTax[];
  roundOffStr?: string;
  grandTotalStr?: string;
  coins?: { redeemedStr?: string; earnedStr?: string };
  /** default labels keyed by field id (plus item/qty/amount/coinsRedeemed/coinsEarned) */
  labels: Record<string, string>;
}

export const DEFAULT_BILL_LABELS: Record<string, string> = {
  phone: 'Tel',
  gstin: 'GSTIN',
  fssai: 'FSSAI',
  orderNo: 'Order No',
  date: 'Date',
  type: 'Type',
  table: 'Table',
  cashier: 'Cashier',
  item: 'Item',
  qty: 'Qty',
  amount: 'Amount',
  subtotal: 'Subtotal',
  discount: 'Discount',
  roundOff: 'Round Off',
  grandTotal: 'GRAND TOTAL',
  coinsRedeemed: 'Coins Redeemed',
  coinsEarned: 'Coins Earned',
  thankYou: 'Thank you! Visit again',
};

function renderBillItems(model: BillModel, W: number, wordWrap: boolean): string[] {
  const out: string[] = [];
  const L = model.labels;
  if (model.itemStyle === 'qty_x_name' || model.itemStyle === 'qty_name') {
    out.push(padLine(L.item ?? 'Item', L.amount ?? 'Amount', W));
  } else {
    out.push(padLine(L.item ?? 'Item', `   ${L.qty ?? 'Qty'}    ${L.amount ?? 'Amount'}`, W));
  }
  out.push(divider('-', W));

  model.items.forEach((group, idx) => {
    const name = group.name;
    const totalStr = group.totalStr.padStart(10, ' ');
    switch (model.itemStyle) {
      case 'qty_x_name': {
        const line = `${group.qty} x ${name}`;
        if (line.length > W - 11) {
          if (wordWrap) wrapText(line, W).forEach((l) => out.push(l));
          else out.push(line.substring(0, W));
          out.push(padLine('', totalStr, W));
        } else out.push(padLine(line, totalStr, W));
        break;
      }
      case 'qty_name': {
        const line = `${String(group.qty).padStart(3)}  ${name}`;
        if (line.length > W - 11) {
          if (wordWrap) wrapText(line, W).forEach((l) => out.push(l));
          else out.push(line.substring(0, W));
          out.push(padLine('', totalStr, W));
        } else out.push(padLine(line, totalStr, W));
        break;
      }
      case 'sno_name_qty': {
        const snoName = `${idx + 1}. ${name}`;
        const qtyStr = String(group.qty).padStart(3, ' ');
        if (snoName.length > W - 18) {
          if (wordWrap) wrapText(snoName, W).forEach((l) => out.push(l));
          else out.push(snoName);
          out.push(padLine('', `${qtyStr}${totalStr}`, W));
        } else out.push(padLine(snoName, `${qtyStr}${totalStr}`, W));
        break;
      }
      default: {
        const qtyStr = String(group.qty).padStart(3, ' ');
        if (name.length > W - 18) {
          if (wordWrap) wrapText(name, W).forEach((l) => out.push(l));
          else out.push(name);
          out.push(padLine('', `${qtyStr}${totalStr}`, W));
        } else out.push(padLine(name, `${qtyStr}${totalStr}`, W));
        break;
      }
    }
    for (const addon of group.addons) out.push(`  + ${addon}`);
    if (group.note) out.push(`  * ${group.note}`);
  });

  return out;
}

function renderBillField(
  cfg: ReceiptFieldConfig, def: ReceiptFieldDef, model: BillModel, W: number, wordWrap: boolean
): string[] | null {
  switch (cfg.id) {
    case 'logo':
      return null; // logo is an image, added separately in the HTML print path
    case 'name':
      return [centerText(model.name.toUpperCase(), W)];
    case 'address': {
      if (!model.address) return null;
      const words = model.address.split(' ');
      const out: string[] = [];
      let line = '';
      for (const word of words) {
        if (line.length + word.length + 1 > W) { out.push(centerText(line.trim(), W)); line = word; }
        else line += (line ? ' ' : '') + word;
      }
      if (line) out.push(centerText(line.trim(), W));
      return out.length ? out : null;
    }
    case 'phone':
      return model.phone ? [centerText(`${labelFor(cfg, model.labels)}: ${model.phone}`, W)] : null;
    case 'gstin':
      return model.gstin ? [centerText(`${labelFor(cfg, model.labels)}: ${model.gstin}`, W)] : null;
    case 'fssai':
      return model.fssai ? [centerText(`${labelFor(cfg, model.labels)}: ${model.fssai}`, W)] : null;
    case 'orderNo':
      return model.orderNo ? [padLine(labelFor(cfg, model.labels), model.orderNo, W)] : null;
    case 'date':
      return model.date ? [padLine(labelFor(cfg, model.labels), model.date, W)] : null;
    case 'type':
      return model.type ? [padLine(labelFor(cfg, model.labels), model.type, W)] : null;
    case 'table':
      return model.table ? [padLine(labelFor(cfg, model.labels), model.table, W)] : null;
    case 'cashier':
      return model.cashier ? [padLine(labelFor(cfg, model.labels), model.cashier, W)] : null;
    case 'items':
      return renderBillItems(model, W, wordWrap);
    case 'subtotal':
      return model.subtotalStr ? [padLine(labelFor(cfg, model.labels), model.subtotalStr, W)] : null;
    case 'discount': {
      if (!model.discount) return null;
      const base = labelFor(cfg, model.labels);
      const lbl = model.discount.percentSuffix ? `${base} (${model.discount.percentSuffix})` : base;
      return [padLine(lbl, model.discount.valueStr, W)];
    }
    case 'tax':
      return model.taxes.length
        ? model.taxes.flatMap((tax) => [padLine(tax.labelA, tax.valueA, W), padLine(tax.labelB, tax.valueB, W)])
        : null;
    case 'roundOff':
      return model.roundOffStr ? [padLine(labelFor(cfg, model.labels), model.roundOffStr, W)] : null;
    case 'grandTotal':
      return model.grandTotalStr ? [padLine(labelFor(cfg, model.labels), model.grandTotalStr, W)] : null;
    case 'coins': {
      if (!model.coins) return null;
      const out: string[] = [];
      if (model.coins.redeemedStr) out.push(padLine(model.labels.coinsRedeemed ?? 'Coins Redeemed', model.coins.redeemedStr, W));
      if (model.coins.earnedStr) out.push(padLine(model.labels.coinsEarned ?? 'Coins Earned', model.coins.earnedStr, W));
      return out.length ? out : null;
    }
    case 'thankYou':
      return ['', centerText(labelFor(cfg, model.labels), W), ''];
    default:
      return null;
  }
}

function sectionDividerChar(from: string, to: string): string {
  if (from === 'header' || to === 'grand' || from === 'grand') return '=';
  return '-';
}

export function renderBillText(
  model: BillModel, layout: ReceiptLayout, width: number, wordWrap: boolean
): string {
  const lines: string[] = [];
  let prevSection: string | null = null;
  for (const cfg of layout) {
    const def = getFieldDef(BILL_FIELD_DEFS, cfg.id);
    if (!def) continue;
    if (!cfg.visible && !def.core) continue;
    const out = renderBillField(cfg, def, model, width, wordWrap);
    if (out === null) continue;
    if (prevSection !== null && def.section !== prevSection) {
      lines.push(divider(sectionDividerChar(prevSection, def.section), width));
    }
    out.forEach((l) => lines.push(l));
    prevSection = def.section;
  }
  return lines.join('\n');
}

// ── KOT ───────────────────────────────────────────────────────────────────────

export interface KotItem {
  name: string;
  qty: number;
  addons: string[];
  note?: string;
}

export interface KotModel {
  title: string;
  location?: string;
  kotCount?: string;
  date?: string;
  itemStyle: ReceiptItemStyle;
  items: KotItem[];
  totalItems?: string;
  labels: Record<string, string>;
}

export const DEFAULT_KOT_LABELS: Record<string, string> = {
  title: 'KOT',
  kotCount: 'KOT Count',
  date: 'Date',
  totalItems: 'Total Items',
  item: 'Item',
  qty: 'Qty',
};

function renderKotItems(model: KotModel, W: number, showNotes: boolean): string[] {
  const out: string[] = [];
  const L = model.labels;
  const header = (model.itemStyle === 'name_qty' || model.itemStyle === 'sno_name_qty')
    ? `${(L.item ?? 'Item').padEnd(W - 3)}${(L.qty ?? 'Qty')}`
    : (L.item ? L.item : 'Items');
  out.push(header);
  out.push(divider('-', W));
  model.items.forEach((item, idx) => {
    out.push(formatKotItemLine(item.name, item.qty, idx, model.itemStyle, W));
    if (showNotes) {
      for (const addon of item.addons) out.push(`  + ${addon}`.substring(0, W));
      if (item.note) out.push(`  * ${item.note}`.substring(0, W));
    }
  });
  return out;
}

function renderKotField(
  cfg: ReceiptFieldConfig, def: ReceiptFieldDef, model: KotModel, W: number, showNotes: boolean
): string[] | null {
  switch (cfg.id) {
    case 'title':
      return [centerText(labelFor(cfg, model.labels) || model.title, W)];
    case 'location':
      return model.location ? [model.location.substring(0, W)] : null;
    case 'kotCount':
      return model.kotCount != null ? [`${labelFor(cfg, model.labels)}: ${model.kotCount}`.substring(0, W)] : null;
    case 'date':
      return model.date ? [`${labelFor(cfg, model.labels)}: ${model.date}`.substring(0, W)] : null;
    case 'items':
      return renderKotItems(model, W, showNotes);
    case 'totalItems':
      return model.totalItems != null ? [`${labelFor(cfg, model.labels)}: ${model.totalItems}`] : null;
    default:
      return null;
  }
}

export function renderKotText(model: KotModel, layout: ReceiptLayout, width: number): string {
  const showNotes = isFieldVisible(layout, 'itemNotes');
  const lines: string[] = [];
  let prevSection: string | null = null;
  for (const cfg of layout) {
    if (cfg.id === 'itemNotes') continue; // controlled within items
    const def = getFieldDef(KOT_FIELD_DEFS, cfg.id);
    if (!def) continue;
    if (!cfg.visible && !def.core) continue;
    const out = renderKotField(cfg, def, model, width, showNotes);
    if (out === null) continue;
    if (prevSection !== null && def.section !== prevSection) {
      const ch = (prevSection === 'title' || def.section === 'title') ? '=' : '-';
      lines.push(divider(ch, width));
    }
    out.forEach((l) => lines.push(l));
    prevSection = def.section;
  }
  return lines.join('\n');
}

// ── Sample models (settings preview + test print) ──────────────────────────────

export function buildSampleBillModel(labels: Record<string, string>, itemStyle: ReceiptItemStyle): BillModel {
  return {
    name: 'My Restaurant',
    address: '123 Main Street, City',
    phone: '90000 00000',
    gstin: '22ABCDE1234F1Z5',
    fssai: '12345678901234',
    orderNo: '001',
    date: '17/05/26 12:00 PM',
    type: 'Dine In',
    table: '#5',
    cashier: 'John',
    itemStyle,
    items: [
      { name: 'Margarita Pizza', qty: 3, totalStr: '990.00', addons: ['Extra Cheese'], note: undefined },
      { name: 'Paneer Wrap', qty: 1, totalStr: '330.00', addons: [], note: 'No onion' },
    ],
    subtotalStr: '1,320.00',
    discount: { percentSuffix: '10%', valueStr: '- 132.00' },
    taxes: [{ labelA: 'CGST @ 2.5%', valueA: '29.70', labelB: 'SGST @ 2.5%', valueB: '29.70' }],
    roundOffStr: undefined,
    grandTotalStr: '1,247.40',
    coins: { redeemedStr: '- 50', earnedStr: '+ 12' },
    labels,
  };
}

export function buildSampleKotModel(labels: Record<string, string>, itemStyle: ReceiptItemStyle): KotModel {
  return {
    title: labels.title ?? 'KOT',
    location: 'Table: 5',
    kotCount: '2',
    date: '17/05/26 12:00 PM',
    itemStyle,
    items: [
      { name: 'Margarita Pizza', qty: 3, addons: ['Extra Cheese'], note: undefined },
      { name: 'Paneer Wrap', qty: 1, addons: [], note: 'No onion' },
    ],
    totalItems: '4',
    labels,
  };
}
