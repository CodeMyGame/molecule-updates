import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { formatDateTime } from '../../lib/formatters';
import { useBillingStore } from '../../stores/billing.store';
import { useAuthStore } from '../../stores/auth.store';
import { ipc } from '../../lib/ipc';
import { useMenuTranslations } from '../../hooks/useMenuTranslations';
import { useTaxTerminology } from '../../hooks/useTaxTerminology';
import { mergeLayout, BILL_FIELD_DEFS, getFieldDef, ReceiptLayout, ReceiptFieldConfig, ReceiptFieldDef } from '../../../shared/receipt-layout';
import { renderBillText, BillModel, ReceiptItemStyle, computePrintLineWidth } from '../../../shared/receipt-render';

interface BillPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: number | null;
  customerPhone?: string;
  coinInfo?: { earned: number; redeemed: number };
}

interface RestaurantInfo {
  name: string;
  address: string;
  gstin: string;
  fssai: string;
  phone: string;
  logoPath?: string;
}

// ── helpers used only for building the print string ──────────────────────────

function padLine(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, space)) + right;
}

function centerText(text: string, width: number): string {
  const space = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(space) + text;
}

function divider(char = '-', width: number): string {
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

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── component ─────────────────────────────────────────────────────────────────

const BillPreview: React.FC<BillPreviewProps> = ({ isOpen, onClose, orderId, customerPhone, coinInfo }) => {
  const { t } = useTranslation();
  const taxTerms = useTaxTerminology();
  const cart = useBillingStore((s) => s.cart);
  const orderType = useBillingStore((s) => s.orderType);
  const selectedTableId = useBillingStore((s) => s.selectedTableId);
  const discount = useBillingStore((s) => s.discount);
  const getSubtotal = useBillingStore((s) => s.getSubtotal);
  const getDiscountAmount = useBillingStore((s) => s.getDiscountAmount);
  const getTaxBreakdown = useBillingStore((s) => s.getTaxBreakdown);
  const getRoundOff = useBillingStore((s) => s.getRoundOff);
  const getGrandTotal = useBillingStore((s) => s.getGrandTotal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const { getName } = useMenuTranslations(cart.map((i) => i.menuItem));

  const [restaurant, setRestaurant] = useState<RestaurantInfo>({ name: t('bill.defaultRestaurantName'), address: '', gstin: '', fssai: '', phone: '' });
  const [tableName, setTableName] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [billItemStyle, setBillItemStyle] = useState<string>('name_qty');
  const [printMode, setPrintMode] = useState<string>('thermal');
  const [billLayout, setBillLayout] = useState<ReceiptLayout>(() => mergeLayout(null, BILL_FIELD_DEFS));
  // print-only state — does NOT affect the visual preview
  const [printLineWidth, setPrintLineWidth] = useState(42);
  const [rasterWordWrap, setRasterWordWrap] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    ipc<RestaurantInfo>(window.electronAPI.settings.getRestaurant())
      .then((info) => {
        if (info) {
          setRestaurant(info);
          if (info.logoPath?.startsWith('data:')) { setLogoDataUrl(info.logoPath); return; }
        }
        return ipc<string | null>(window.electronAPI.settings.getLogoDataUrl());
      })
      .then((url) => { if (url) setLogoDataUrl(url); })
      .catch(() => setLogoDataUrl(null));

    if (orderType === 'dine_in' && selectedTableId) {
      ipc<Array<{ id: number; name: string }>>(window.electronAPI.tables.getAll())
        .then((list) => setTableName(list?.find((tb) => tb.id === selectedTableId)?.name ?? null))
        .catch(() => setTableName(null));
    } else {
      setTableName(null);
    }

    ipc<string | null>(window.electronAPI.settings.get('bill_item_style'))
      .then((val) => { if (val) setBillItemStyle(val); })
      .catch(() => {});

    ipc<string | null>(window.electronAPI.settings.get('bill_layout'))
      .then((val) => setBillLayout(mergeLayout(val, BILL_FIELD_DEFS)))
      .catch(() => {});

    Promise.all([
      ipc<string | null>(window.electronAPI.settings.get('paper_width')),
      ipc<string | null>(window.electronAPI.settings.get('print_mode')),
      ipc<string | null>(window.electronAPI.settings.get('bill_font_size')),
    ]).then(([paperVal, printMode, fontSize]) => {
      setPrintMode(printMode ?? 'thermal');
      setPrintLineWidth(computePrintLineWidth(paperVal, printMode, fontSize));
      setRasterWordWrap(printMode === 'raster' && !!fontSize && fontSize !== 'small');
    }).catch(() => {});
  }, [isOpen, orderType, selectedTableId]);

  // Display value for the table field: prefer the table's name, fall back to its id.
  const tableDisplay = tableName ?? (selectedTableId != null ? `#${selectedTableId}` : null);

  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const taxBreakdown = getTaxBreakdown();
  const roundOff = getRoundOff();
  const grandTotal = getGrandTotal();
  const now = new Date().toISOString();

  const orderTypeLabels: Record<string, string> = {
    dine_in: t('billing.dineIn'),
    takeaway: t('billing.takeaway'),
    delivery: t('billing.delivery'),
  };

  // ── group cart items ────────────────────────────────────────────────────────
  type BillGroup = { item: typeof cart[number]; quantity: number; total: number };
  const billGroups: BillGroup[] = [];
  for (const item of cart) {
    const addonKey = [...item.addons.map((a) => a.id)].sort((a, b) => a - b).join(',');
    const noteKey = (item.notes ?? '').trim();
    const variationKey = item.variation?.id ?? 'none';
    const itemKey = item.menuItem.id === 0 ? `temp:${item.menuItem.name}:${item.unitPrice}` : String(item.menuItem.id);
    const key = `${itemKey}|${variationKey}|${addonKey}|${noteKey}`;
    const existing = billGroups.find((g) => {
      const gItemKey = g.item.menuItem.id === 0 ? `temp:${g.item.menuItem.name}:${g.item.unitPrice}` : String(g.item.menuItem.id);
      return `${gItemKey}|${g.item.variation?.id ?? 'none'}|${[...g.item.addons.map((a) => a.id)].sort((a, b) => a - b).join(',')}|${(g.item.notes ?? '').trim()}` === key;
    });
    if (existing) { existing.quantity += item.quantity; existing.total += item.total; }
    else billGroups.push({ item, quantity: item.quantity, total: item.total });
  }

  // ── labels + model shared with the raster renderer and styled preview ──────────
  const billLabels = (): Record<string, string> => ({
    phone: t('bill.tel'),
    gstin: taxTerms.businessTaxId,
    fssai: taxTerms.foodLicense,
    orderNo: t('bill.orderNo'),
    date: t('bill.date'),
    type: t('bill.type'),
    table: t('bill.table'),
    cashier: t('bill.cashier'),
    item: t('bill.item'),
    qty: t('bill.qty'),
    amount: t('bill.amount'),
    subtotal: t('bill.subtotal'),
    discount: t('bill.discount'),
    roundOff: t('bill.roundOff'),
    grandTotal: t('bill.grandTotal'),
    coinsRedeemed: t('bill.coinsRedeemed'),
    coinsEarned: t('bill.coinsEarned'),
    thankYou: t('bill.thankYou'),
  });

  const buildBillModel = (): BillModel => ({
    name: restaurant.name,
    address: restaurant.address || undefined,
    phone: restaurant.phone || undefined,
    gstin: restaurant.gstin || undefined,
    fssai: restaurant.fssai || undefined,
    orderNo: orderId ? String(orderId).padStart(3, '0') : undefined,
    date: formatDateTime(now),
    type: orderTypeLabels[orderType] ?? orderType,
    table: (orderType === 'dine_in' && tableDisplay) ? tableDisplay : undefined,
    cashier: currentUser ? currentUser.name : undefined,
    itemStyle: billItemStyle as ReceiptItemStyle,
    items: billGroups.map((g) => {
      const translatedName = getName(g.item.menuItem);
      const name = g.item.variation ? `${translatedName} (${g.item.variation.name})` : translatedName;
      return {
        name,
        qty: g.quantity,
        totalStr: formatRupees(g.total),
        addons: g.item.addons.map((a) => a.name),
        note: g.item.notes || undefined,
      };
    }),
    subtotalStr: formatRupees(subtotal),
    discount: discountAmount > 0
      ? { percentSuffix: discount?.type === 'percent' ? `${discount.value}%` : undefined, valueStr: `- ${formatRupees(discountAmount)}` }
      : undefined,
    taxes: taxBreakdown
      .filter((tx) => !(tx.cgst === 0 && tx.sgst === 0))
      .map((tx) => ({
        labelA: `${taxTerms.componentA} @ ${tx.rate / 2}%`,
        valueA: formatRupees(tx.cgst),
        labelB: `${taxTerms.componentB} @ ${tx.rate / 2}%`,
        valueB: formatRupees(tx.sgst),
      })),
    roundOffStr: roundOff !== 0 ? `${roundOff > 0 ? '+' : ''}${formatRupees(roundOff)}` : undefined,
    grandTotalStr: formatRupees(grandTotal),
    coins: (coinInfo && (coinInfo.redeemed > 0 || coinInfo.earned > 0))
      ? { redeemedStr: coinInfo.redeemed > 0 ? `- ${coinInfo.redeemed}` : undefined, earnedStr: coinInfo.earned > 0 ? `+ ${coinInfo.earned}` : undefined }
      : undefined,
    labels: billLabels(),
  });

  // ── build print string (unchanged logic, uses printLineWidth + rasterWordWrap) ──
  const buildReceiptText = (): string => {
    // Raster mode honours the user's field layout (show/hide, reorder, rename).
    if (printMode === 'raster') {
      return renderBillText(buildBillModel(), billLayout, printLineWidth, rasterWordWrap);
    }
    const W = printLineWidth;
    const lines: string[] = [];
    lines.push(centerText(restaurant.name.toUpperCase(), W));
    if (restaurant.address) {
      const words = restaurant.address.split(' ');
      let line = '';
      for (const word of words) {
        if (line.length + word.length + 1 > W) { lines.push(centerText(line.trim(), W)); line = word; }
        else line += (line ? ' ' : '') + word;
      }
      if (line) lines.push(centerText(line.trim(), W));
    }
    if (restaurant.phone) lines.push(centerText(`${t('bill.tel')}: ${restaurant.phone}`, W));
    if (restaurant.gstin) lines.push(centerText(`${taxTerms.businessTaxId}: ${restaurant.gstin}`, W));
    if (restaurant.fssai) lines.push(centerText(`${taxTerms.foodLicense}: ${restaurant.fssai}`, W));
    lines.push(divider('=', W));
    if (orderId) lines.push(padLine(t('bill.orderNo'), String(orderId).padStart(3, '0'), W));
    lines.push(padLine(t('bill.date'), formatDateTime(now), W));
    lines.push(padLine(t('bill.type'), orderTypeLabels[orderType] ?? orderType, W));
    if (orderType === 'dine_in' && tableDisplay) lines.push(padLine(t('bill.table'), tableDisplay, W));
    if (currentUser) lines.push(padLine(t('bill.cashier'), currentUser.name, W));
    lines.push(divider('-', W));
    if (billItemStyle === 'qty_x_name' || billItemStyle === 'qty_name') {
      lines.push(padLine(t('bill.item'), t('bill.amount'), W));
    } else {
      lines.push(padLine(t('bill.item'), `   ${t('bill.qty')}    ${t('bill.amount')}`, W));
    }
    lines.push(divider('-', W));

    billGroups.forEach((group, idx) => {
      const translatedName = getName(group.item.menuItem);
      const name = group.item.variation ? `${translatedName} (${group.item.variation.name})` : translatedName;
      const totalStr = formatRupees(group.total).padStart(10, ' ');
      switch (billItemStyle) {
        case 'qty_x_name': {
          const line = `${group.quantity} x ${name}`;
          if (line.length > W - 11) {
            if (rasterWordWrap) wrapText(line, W).forEach((l) => lines.push(l));
            else lines.push(line.substring(0, W));
            lines.push(padLine('', totalStr, W));
          } else lines.push(padLine(line, totalStr, W));
          break;
        }
        case 'qty_name': {
          const line = `${String(group.quantity).padStart(3)}  ${name}`;
          if (line.length > W - 11) {
            if (rasterWordWrap) wrapText(line, W).forEach((l) => lines.push(l));
            else lines.push(line.substring(0, W));
            lines.push(padLine('', totalStr, W));
          } else lines.push(padLine(line, totalStr, W));
          break;
        }
        case 'sno_name_qty': {
          const snoName = `${idx + 1}. ${name}`;
          const qtyStr = String(group.quantity).padStart(3, ' ');
          if (snoName.length > W - 18) {
            if (rasterWordWrap) wrapText(snoName, W).forEach((l) => lines.push(l));
            else lines.push(snoName);
            lines.push(padLine('', `${qtyStr}${totalStr}`, W));
          } else lines.push(padLine(snoName, `${qtyStr}${totalStr}`, W));
          break;
        }
        default: {
          const qtyStr = String(group.quantity).padStart(3, ' ');
          if (name.length > W - 18) {
            if (rasterWordWrap) wrapText(name, W).forEach((l) => lines.push(l));
            else lines.push(name);
            lines.push(padLine('', `${qtyStr}${totalStr}`, W));
          } else lines.push(padLine(name, `${qtyStr}${totalStr}`, W));
          break;
        }
      }
      for (const addon of group.item.addons) lines.push(`  + ${addon.name}`);
      if (group.item.notes) lines.push(`  * ${group.item.notes}`);
    });

    lines.push(divider('-', W));
    lines.push(padLine(t('bill.subtotal'), formatRupees(subtotal), W));
    if (discountAmount > 0) {
      const discLabel = discount?.type === 'percent' ? `${t('bill.discount')} (${discount.value}%)` : t('bill.discount');
      lines.push(padLine(discLabel, `- ${formatRupees(discountAmount)}`, W));
    }
    for (const tax of taxBreakdown) {
      if (tax.cgst === 0 && tax.sgst === 0) continue;
      lines.push(padLine(`${taxTerms.componentA} @ ${tax.rate / 2}%`, formatRupees(tax.cgst), W));
      lines.push(padLine(`${taxTerms.componentB} @ ${tax.rate / 2}%`, formatRupees(tax.sgst), W));
    }
    if (roundOff !== 0) lines.push(padLine(t('bill.roundOff'), `${roundOff > 0 ? '+' : ''}${formatRupees(roundOff)}`, W));
    lines.push(divider('=', W));
    lines.push(padLine(t('bill.grandTotal'), formatRupees(grandTotal), W));
    lines.push(divider('=', W));
    if (coinInfo && (coinInfo.redeemed > 0 || coinInfo.earned > 0)) {
      lines.push('');
      if (coinInfo.redeemed > 0) lines.push(padLine(t('bill.coinsRedeemed'), `- ${coinInfo.redeemed}`, W));
      if (coinInfo.earned > 0) lines.push(padLine(t('bill.coinsEarned'), `+ ${coinInfo.earned}`, W));
      lines.push(divider('-', W));
    }
    lines.push('');
    lines.push(centerText(t('bill.thankYou'), W));
    lines.push('');
    return lines.join('\n');
  };

  const handlePrint = async () => {
    try {
      await ipc(window.electronAPI.bill.printReceipt(buildReceiptText()));
    } catch {
      toast.error(t('bill.printerNotAvailable'));
    }
  };

  // ── styled visual preview (non-raster: fixed; raster: follows field layout) ──
  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className={`flex justify-between items-baseline gap-2 py-0.5 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-gray-500 text-xs shrink-0">{label}</span>
      <span className={`text-right text-xs ${bold ? 'text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );

  // Item rendering that mirrors the selected bill item style so the on-screen
  // preview matches the printed bill when the format is changed.
  const billItemLeft = (name: string, qty: number, idx: number): React.ReactNode => {
    switch (billItemStyle) {
      case 'qty_x_name':
        return <><span className="text-gray-400 mr-1 tabular-nums">{qty} ×</span>{name}</>;
      case 'qty_name':
        return <><span className="text-gray-400 mr-1 tabular-nums">{qty}</span> {name}</>;
      case 'sno_name_qty':
        return <><span className="text-gray-400 mr-1 tabular-nums">{idx + 1}.</span>{name}</>;
      case 'name_qty':
      default:
        return <>{name}</>;
    }
  };

  // Styles that don't carry qty on the left show it next to the amount.
  const billItemQtyBadge = (qty: number): React.ReactNode =>
    (billItemStyle === 'name_qty' || billItemStyle === 'sno_name_qty')
      ? <span className="text-gray-400 mr-2 tabular-nums">×{qty}</span>
      : null;

  const BillItemRow = ({ name, qty, totalStr, addons, note, idx }: {
    name: string; qty: number; totalStr: string; addons: string[]; note?: string; idx: number;
  }) => (
    <div className="flex justify-between items-start gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-800 leading-snug">{billItemLeft(name, qty, idx)}</span>
        {addons.map((a, i) => <p key={i} className="text-[10px] text-gray-400 pl-3">+ {a}</p>)}
        {note && <p className="text-[10px] text-gray-400 pl-3 italic">* {note}</p>}
      </div>
      <span className="text-xs text-gray-800 font-medium shrink-0 tabular-nums flex items-baseline">
        {billItemQtyBadge(qty)}{totalStr}
      </span>
    </div>
  );

  const styledBillField = (cfg: ReceiptFieldConfig, _def: ReceiptFieldDef, model: BillModel): React.ReactNode => {
    const label = cfg.label ?? model.labels[cfg.id] ?? '';
    switch (cfg.id) {
      case 'logo':
        return logoDataUrl ? <img src={logoDataUrl} alt="" className="max-h-14 max-w-[120px] object-contain mx-auto" /> : null;
      case 'name':
        return <p className="font-bold text-sm text-gray-900 tracking-wide text-center">{model.name.toUpperCase()}</p>;
      case 'address':
        return model.address ? <p className="text-xs text-gray-500 text-center">{model.address}</p> : null;
      case 'phone':
        return model.phone ? <p className="text-xs text-gray-500 text-center">{label}: {model.phone}</p> : null;
      case 'gstin':
        return model.gstin ? <p className="text-xs text-gray-500 text-center">{label}: {model.gstin}</p> : null;
      case 'fssai':
        return model.fssai ? <p className="text-xs text-gray-500 text-center">{label}: {model.fssai}</p> : null;
      case 'orderNo':
        return model.orderNo ? <Row label={label} value={`#${model.orderNo}`} /> : null;
      case 'date':
        return model.date ? <Row label={label} value={model.date} /> : null;
      case 'type':
        return model.type ? <Row label={label} value={model.type} /> : null;
      case 'table':
        return model.table ? <Row label={label} value={model.table} /> : null;
      case 'cashier':
        return model.cashier ? <Row label={label} value={model.cashier} /> : null;
      case 'items':
        return (
          <div>
            <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              <span>{model.labels.item}</span><span>{model.labels.amount}</span>
            </div>
            <div className="space-y-2">
              {model.items.map((it, idx) => (
                <BillItemRow key={idx} name={it.name} qty={it.qty} totalStr={it.totalStr} addons={it.addons} note={it.note} idx={idx} />
              ))}
            </div>
          </div>
        );
      case 'subtotal':
        return model.subtotalStr ? <Row label={label} value={model.subtotalStr} /> : null;
      case 'discount':
        return model.discount
          ? <Row label={model.discount.percentSuffix ? `${label} (${model.discount.percentSuffix})` : label} value={model.discount.valueStr} />
          : null;
      case 'tax':
        return model.taxes.length
          ? <>{model.taxes.map((tx, i) => <React.Fragment key={i}><Row label={tx.labelA} value={tx.valueA} /><Row label={tx.labelB} value={tx.valueB} /></React.Fragment>)}</>
          : null;
      case 'roundOff':
        return model.roundOffStr ? <Row label={label} value={model.roundOffStr} /> : null;
      case 'grandTotal':
        return model.grandTotalStr
          ? <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-900">{label}</span><span className="text-sm font-bold text-gray-900 tabular-nums">{model.grandTotalStr}</span></div>
          : null;
      case 'coins':
        return model.coins
          ? <>{model.coins.redeemedStr && <Row label={model.labels.coinsRedeemed} value={model.coins.redeemedStr} />}{model.coins.earnedStr && <Row label={model.labels.coinsEarned} value={model.coins.earnedStr} />}</>
          : null;
      case 'thankYou':
        return <p className="text-xs text-gray-400 italic text-center">{label}</p>;
      default:
        return null;
    }
  };

  const renderStyledBillRaster = (): React.ReactNode => {
    const model = buildBillModel();
    const nodes: React.ReactNode[] = [];
    let prevSection: string | null = null;
    billLayout.forEach((cfg) => {
      const def = getFieldDef(BILL_FIELD_DEFS, cfg.id);
      if (!def) return;
      if (!cfg.visible && !def.core) return;
      const node = styledBillField(cfg, def, model);
      if (node === null || node === undefined) return;
      if (prevSection !== null && def.section !== prevSection) {
        nodes.push(<div key={`sep-${cfg.id}`} className="border-t border-dashed border-gray-300 my-2" />);
      }
      nodes.push(<div key={cfg.id}>{node}</div>);
      prevSection = def.section;
    });
    return <div className="px-5 py-4 space-y-1">{nodes}</div>;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('bill.preview')}
      size="md"
      footer={
        <div className="flex gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
          <Button variant="primary" icon={<Printer size={16} />} onClick={handlePrint} fullWidth>
            {t('bill.printBill')}
          </Button>
        </div>
      }
    >
      <div className="max-h-[65vh] overflow-y-auto">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mx-auto max-w-xs">
          {printMode === 'raster' ? renderStyledBillRaster() : (<>
          {/* Header */}
          <div className="px-5 pt-5 pb-3 text-center border-b border-dashed border-gray-300">
            {logoDataUrl && (
              <img src={logoDataUrl} alt="" className="max-h-14 max-w-[120px] object-contain mx-auto mb-2" />
            )}
            <p className="font-bold text-sm text-gray-900 tracking-wide">{restaurant.name.toUpperCase()}</p>
            {restaurant.address && <p className="text-xs text-gray-500 mt-0.5">{restaurant.address}</p>}
            {restaurant.phone && <p className="text-xs text-gray-500">{t('bill.tel')}: {restaurant.phone}</p>}
            {restaurant.gstin && <p className="text-xs text-gray-500">{taxTerms.businessTaxId}: {restaurant.gstin}</p>}
            {restaurant.fssai && <p className="text-xs text-gray-500">{taxTerms.foodLicense}: {restaurant.fssai}</p>}
          </div>

          {/* Order info */}
          <div className="px-5 py-3 border-b border-dashed border-gray-300 space-y-0.5">
            {orderId && <Row label={t('bill.orderNo')} value={`#${String(orderId).padStart(3, '0')}`} />}
            <Row label={t('bill.date')} value={formatDateTime(now)} />
            <Row label={t('bill.type')} value={orderTypeLabels[orderType] ?? orderType} />
            {orderType === 'dine_in' && tableDisplay && <Row label={t('bill.table')} value={tableDisplay} />}
            {currentUser && <Row label={t('bill.cashier')} value={currentUser.name} />}
          </div>

          {/* Items */}
          <div className="px-5 py-3 border-b border-dashed border-gray-300">
            <div className="flex justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              <span>{t('bill.item')}</span>
              <span>{t('bill.amount')}</span>
            </div>
            <div className="space-y-2">
              {billGroups.map((group, idx) => {
                const translatedName = getName(group.item.menuItem);
                const name = group.item.variation
                  ? `${translatedName} (${group.item.variation.name})`
                  : translatedName;
                return (
                  <BillItemRow
                    key={idx}
                    name={name}
                    qty={group.quantity}
                    totalStr={formatRupees(group.total)}
                    addons={group.item.addons.map((a) => a.name)}
                    note={group.item.notes || undefined}
                    idx={idx}
                  />
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="px-5 py-3 border-b border-dashed border-gray-300 space-y-0.5">
            <Row label={t('bill.subtotal')} value={formatRupees(subtotal)} />
            {discountAmount > 0 && (
              <Row
                label={discount?.type === 'percent' ? `${t('bill.discount')} (${discount.value}%)` : t('bill.discount')}
                value={`- ${formatRupees(discountAmount)}`}
              />
            )}
            {taxBreakdown.map((tax, i) => tax.cgst === 0 && tax.sgst === 0 ? null : (
              <React.Fragment key={i}>
                <Row label={`${taxTerms.componentA} @ ${tax.rate / 2}%`} value={formatRupees(tax.cgst)} />
                <Row label={`${taxTerms.componentB} @ ${tax.rate / 2}%`} value={formatRupees(tax.sgst)} />
              </React.Fragment>
            ))}
            {roundOff !== 0 && (
              <Row label={t('bill.roundOff')} value={`${roundOff > 0 ? '+' : ''}${formatRupees(roundOff)}`} />
            )}
          </div>

          {/* Grand total */}
          <div className="px-5 py-3 border-b border-dashed border-gray-300">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">{t('bill.grandTotal')}</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">{formatRupees(grandTotal)}</span>
            </div>
          </div>

          {/* Coins */}
          {coinInfo && (coinInfo.redeemed > 0 || coinInfo.earned > 0) && (
            <div className="px-5 py-3 border-b border-dashed border-gray-300 space-y-0.5">
              {coinInfo.redeemed > 0 && <Row label={t('bill.coinsRedeemed')} value={`- ${coinInfo.redeemed}`} />}
              {coinInfo.earned > 0 && <Row label={t('bill.coinsEarned')} value={`+ ${coinInfo.earned}`} />}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-4 text-center">
            <p className="text-xs text-gray-400 italic">{t('bill.thankYou')}</p>
          </div>
          </>)}
        </div>
      </div>
    </Modal>
  );
};

export default BillPreview;
