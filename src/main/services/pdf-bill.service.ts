import { BrowserWindow } from 'electron';
import * as orderRepo from '../db/repositories/order.repo';
import * as paymentRepo from '../db/repositories/payment.repo';
import * as customerRepo from '../db/repositories/customer.repo';
import * as settingsRepo from '../db/repositories/settings.repo';
import { logger } from '../utils/logger';
import fs from 'fs';

export interface BillLabels {
  componentA: string;
  componentB: string;
  businessTaxId: string;
  foodLicense: string;
  tel: string;
  orderNo: string;
  type: string;
  customer: string;
  item: string;
  qty: string;
  rate: string;
  amt: string;
  note: string;
  subtotal: string;
  discount: string;
  roundOff: string;
  grandTotal: string;
  payment: string;
  tip: string;
  thankYou: string;
}

const DEFAULT_LABELS: BillLabels = {
  componentA: 'CGST',
  componentB: 'SGST',
  businessTaxId: 'GSTIN',
  foodLicense: 'FSSAI License',
  tel: 'Tel',
  orderNo: 'Order',
  type: 'Type',
  customer: 'Customer',
  item: 'Item',
  qty: 'Qty',
  rate: 'Rate',
  amt: 'Amt',
  note: 'Note',
  subtotal: 'Subtotal',
  discount: 'Discount',
  roundOff: 'Round Off',
  grandTotal: 'Grand Total',
  payment: 'Payment',
  tip: 'Tip',
  thankYou: 'Thank you! Visit again',
};

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface TaxSlab {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
}

function computeTaxSlabs(
  items: { taxRate: number; taxAmount: number; unitPrice: number; quantity: number }[],
  subtotal: number,
  discountAmount: number
): TaxSlab[] {
  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  const slabMap = new Map<number, { taxableAmount: number; totalTax: number }>();

  for (const item of items) {
    if (item.taxRate <= 0) continue;
    const itemTotal = item.unitPrice * item.quantity;
    const discountedTotal = Math.round(itemTotal * (1 - discountRatio));
    const taxOnItem = Math.round(discountedTotal * item.taxRate / 100);

    const existing = slabMap.get(item.taxRate) || { taxableAmount: 0, totalTax: 0 };
    existing.taxableAmount += discountedTotal;
    existing.totalTax += taxOnItem;
    slabMap.set(item.taxRate, existing);
  }

  const slabs: TaxSlab[] = [];
  for (const [rate, data] of slabMap) {
    const cgst = Math.round(data.totalTax / 2);
    slabs.push({
      rate,
      taxableAmount: data.taxableAmount,
      cgst,
      sgst: data.totalTax - cgst,
    });
  }
  return slabs;
}

function buildBillHtml(
  order: ReturnType<typeof orderRepo.getById>,
  payments: ReturnType<typeof paymentRepo.getByOrder>,
  restaurant: ReturnType<typeof settingsRepo.getRestaurant>,
  labels: BillLabels,
  customer?: { name: string; phone?: string }
): string {
  if (!order) throw new Error('Order not found');

  let logoDataUri = '';
  if (restaurant?.logoPath) {
    if (restaurant.logoPath.startsWith('data:')) {
      logoDataUri = restaurant.logoPath;
    } else {
      try {
        const logoBuffer = fs.readFileSync(restaurant.logoPath);
        const ext = restaurant.logoPath.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        logoDataUri = `data:${mime};base64,${logoBuffer.toString('base64')}`;
      } catch {
        // Logo file not found, skip
      }
    }
  }

  // Item amounts: show pre-tax (unitPrice * quantity)
  const itemsHtml = order.items
    .map((item) => {
      const addonsHtml = item.addons?.length
        ? item.addons
            .map((a) => `<div class="addon">+ ${escapeHtml(a.name)} (₹${formatRupees(a.price)})</div>`)
            .join('')
        : '';
      const notesHtml = item.notes
        ? `<div class="notes">${escapeHtml(labels.note)}: ${escapeHtml(item.notes)}</div>`
        : '';
      const lineTotal = item.unitPrice * item.quantity;
      return `
        <tr>
          <td class="item-name">
            ${escapeHtml(item.name)}
            ${addonsHtml}
            ${notesHtml}
          </td>
          <td class="qty">${item.quantity}</td>
          <td class="price">₹${formatRupees(item.unitPrice)}</td>
          <td class="amount">₹${formatRupees(lineTotal)}</td>
        </tr>`;
    })
    .join('');

  // Tax breakdown: CGST / SGST per slab
  const taxSlabs = computeTaxSlabs(order.items, order.subtotal, order.discountAmount);
  const taxHtml = taxSlabs
    .map(
      (slab) =>
        `<div class="row"><span>${escapeHtml(labels.componentA)} @ ${slab.rate / 2}%</span><span>₹${formatRupees(slab.cgst)}</span></div>
         <div class="row"><span>${escapeHtml(labels.componentB)} @ ${slab.rate / 2}%</span><span>₹${formatRupees(slab.sgst)}</span></div>`
    )
    .join('');

  const paymentsHtml = payments
    .map(
      (p) =>
        `<div class="payment-row">
          <span>${p.paymentMode.toUpperCase()}${p.referenceNo ? ` (${escapeHtml(p.referenceNo)})` : ''}</span>
          <span>₹${formatRupees(p.amount)}</span>
        </div>`
    )
    .join('');

  const tipTotal = payments.reduce((sum, p) => sum + p.tipAmount, 0);

  // Customer display name: use name unless it's same as phone (auto-created customer)
  const customerDisplay = customer
    ? customer.name !== customer.phone
      ? `${escapeHtml(customer.name)} (${customer.phone})`
      : customer.phone
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Segoe UI', Arial, sans-serif;
    font-size: ${({ small: '11px', medium: '14px', large: '17px', 'x-large': '22px', 'xx-large': '28px', max: '36px' } as Record<string, string>)[settingsRepo.get('bill_font_size') ?? 'medium'] ?? '14px'};
    color: #222;
    background: #fff;
    width: 400px;
    padding: 20px;
  }
  .header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #222; }
  .logo { max-width: 120px; max-height: 120px; margin-bottom: 8px; display: block; margin-left: auto; margin-right: auto; }
  .restaurant-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .restaurant-detail { font-size: 11px; color: #555; line-height: 1.5; }
  .order-info { margin-bottom: 12px; font-size: 12px; color: #444; }
  .order-info .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { text-align: left; border-bottom: 1px solid #888; padding: 6px 4px; font-size: 11px; text-transform: uppercase; color: #666; }
  td { padding: 6px 4px; vertical-align: top; border-bottom: 1px dashed #ddd; font-size: 13px; }
  .qty, .price, .amount { text-align: right; white-space: nowrap; }
  .addon { font-size: 11px; color: #777; padding-left: 10px; }
  .notes { font-size: 11px; color: #999; font-style: italic; padding-left: 10px; }
  .totals { border-top: 1px solid #888; padding-top: 8px; margin-bottom: 12px; }
  .totals .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
  .totals .grand-total { font-size: 16px; font-weight: 700; border-top: 2px solid #222; padding-top: 6px; margin-top: 6px; }
  .payment-section { border-top: 1px dashed #888; padding-top: 8px; margin-bottom: 12px; }
  .payment-section .title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 6px; }
  .payment-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
  .footer { text-align: center; color: #777; border-top: 1px dashed #888; padding-top: 12px; margin-top: 12px; }
  .footer .thankyou { font-size: 15px; font-weight: 700; color: #222; margin-bottom: 4px; }
  .footer .visit { font-size: 11px; }
</style>
</head>
<body>

  <div class="header">
    ${logoDataUri ? `<img class="logo" src="${logoDataUri}" />` : ''}
    <div class="restaurant-name">${escapeHtml(restaurant?.name || 'Restaurant')}</div>
    ${restaurant?.address ? `<div class="restaurant-detail">${escapeHtml(restaurant.address)}</div>` : ''}
    ${restaurant?.phone ? `<div class="restaurant-detail">${escapeHtml(labels.tel)}: ${escapeHtml(restaurant.phone)}</div>` : ''}
    ${restaurant?.gstin ? `<div class="restaurant-detail">${escapeHtml(labels.businessTaxId)}: ${escapeHtml(restaurant.gstin)}</div>` : ''}
    ${restaurant?.fssai ? `<div class="restaurant-detail">${escapeHtml(labels.foodLicense)}: ${escapeHtml(restaurant.fssai)}</div>` : ''}
  </div>

  <div class="order-info">
    <div class="row"><span>${escapeHtml(labels.orderNo)} #${escapeHtml(order.orderNumber)}</span><span>${formatDateTime(order.completedAt || order.createdAt)}</span></div>
    <div class="row"><span>${escapeHtml(labels.type)}: ${order.orderType.replace('_', ' ').toUpperCase()}</span></div>
    ${customerDisplay ? `<div class="row"><span>${escapeHtml(labels.customer)}: ${customerDisplay}</span></div>` : ''}
  </div>

  <table>
    <thead>
      <tr><th>${escapeHtml(labels.item)}</th><th class="qty">${escapeHtml(labels.qty)}</th><th class="price">${escapeHtml(labels.rate)}</th><th class="amount">${escapeHtml(labels.amt)}</th></tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="row"><span>${escapeHtml(labels.subtotal)}</span><span>₹${formatRupees(order.subtotal)}</span></div>
    ${order.discountAmount > 0 ? `<div class="row"><span>${escapeHtml(labels.discount)}</span><span>-₹${formatRupees(order.discountAmount)}</span></div>` : ''}
    ${taxHtml}
    ${order.roundOff !== 0 ? `<div class="row"><span>${escapeHtml(labels.roundOff)}</span><span>${order.roundOff > 0 ? '+' : ''}₹${formatRupees(order.roundOff)}</span></div>` : ''}
    ${tipTotal > 0 ? `<div class="row"><span>${escapeHtml(labels.tip)}</span><span>₹${formatRupees(tipTotal)}</span></div>` : ''}
    <div class="row grand-total"><span>${escapeHtml(labels.grandTotal)}</span><span>₹${formatRupees(order.grandTotal)}</span></div>
  </div>

  <div class="payment-section">
    <div class="title">${escapeHtml(labels.payment)}</div>
    ${paymentsHtml}
  </div>

  <div class="footer">
    <div class="thankyou">${escapeHtml(labels.thankYou)}</div>
  </div>

</body>
</html>`;
}

/**
 * Generates a bill as a PNG image buffer for the given order.
 */
export async function generate(orderId: number, labels?: Partial<BillLabels>): Promise<Buffer> {
  const order = orderRepo.getById(orderId);
  if (!order) throw new Error(`Order ${orderId} not found`);

  const payments = paymentRepo.getByOrder(orderId);
  const restaurant = settingsRepo.getRestaurant();
  const mergedLabels: BillLabels = { ...DEFAULT_LABELS, ...labels };

  let customer: { name: string; phone?: string } | undefined;
  if (order.customerId) {
    const c = customerRepo.getById(order.customerId);
    if (c) customer = { name: c.name, phone: c.phone };
  }

  const html = buildBillHtml(order, payments, restaurant, mergedLabels, customer);

  const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      width: 400,
      height: 900,
      webPreferences: { nodeIntegration: false, contextIsolation: true, offscreen: true },
    });

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    win.webContents.on('did-finish-load', async () => {
      try {
        // Wait for rendering to complete
        await new Promise((r) => setTimeout(r, 300));

        // Get actual content height
        const contentHeight = await win.webContents.executeJavaScript(
          'document.body.scrollHeight'
        );

        // Resize window to fit content exactly
        win.setSize(400, Math.min(contentHeight + 40, 2000));

        // Wait for resize to take effect
        await new Promise((r) => setTimeout(r, 200));

        // Capture the page as PNG
        const image = await win.webContents.capturePage();
        const png = image.toPNG();

        win.destroy();
        resolve(Buffer.from(png));
      } catch (err) {
        win.destroy();
        reject(err);
      }
    });

    win.webContents.on('did-fail-load', () => {
      win.destroy();
      reject(new Error('Failed to load bill HTML for image generation'));
    });
  });

  logger.info(`Bill image generated for order ${orderId} (${imageBuffer.length} bytes)`);
  return imageBuffer;
}
