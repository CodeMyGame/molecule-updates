import type { TaxBreakdown, TaxSlab } from '../../shared/types/tax.types';

interface TaxableItem {
  unitPrice: number;
  quantity: number;
  taxRate: number;
}

export function calculateTax(
  items: TaxableItem[],
  discount?: { type: 'percentage' | 'flat' | 'percent'; value: number } | number
): TaxBreakdown {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.unitPrice * item.quantity;
  }

  let discountAmount = 0;
  if (typeof discount === 'number') {
    discountAmount = Math.min(discount, subtotal);
  } else if (discount) {
    const discType = discount.type === 'percent' ? 'percentage' : discount.type;
    if (discType === 'percentage') {
      discountAmount = Math.round((subtotal * discount.value) / 100);
    } else {
      discountAmount = Math.min(discount.value, subtotal);
    }
  }

  // Tax is calculated on post-discount amounts (proportional reduction per item)
  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  const slabMap = new Map<number, { taxableAmount: number }>();

  for (const item of items) {
    const itemTotal = item.unitPrice * item.quantity;
    const discountedItemTotal = Math.round(itemTotal * (1 - discountRatio));
    const existing = slabMap.get(item.taxRate);
    if (existing) {
      existing.taxableAmount += discountedItemTotal;
    } else {
      slabMap.set(item.taxRate, { taxableAmount: discountedItemTotal });
    }
  }

  const slabs: TaxSlab[] = [];
  let totalTaxable = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalTax = 0;

  for (const [rate, data] of slabMap) {
    const halfRate = rate / 2;
    const cgst = Math.round((data.taxableAmount * halfRate) / 100);
    const sgst = Math.round((data.taxableAmount * halfRate) / 100);
    const slabTax = cgst + sgst;

    slabs.push({
      rate,
      taxableAmount: data.taxableAmount,
      cgst,
      sgst,
    });

    totalTaxable += data.taxableAmount;
    totalCGST += cgst;
    totalSGST += sgst;
    totalTax += slabTax;
  }

  // Sort slabs by rate
  slabs.sort((a, b) => a.rate - b.rate);

  return {
    slabs,
    totalTaxable,
    totalCGST,
    totalSGST,
    totalTax,
  };
}

export function getTaxBreakdown(
  items: TaxableItem[],
  discount?: { type: 'percentage' | 'flat' | 'percent'; value: number } | number
): TaxBreakdown {
  return calculateTax(items, discount);
}
