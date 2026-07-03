import type { TaxBreakdown, TaxSlab } from '../../shared/types/tax.types';

interface TaxableItem {
  unitPrice: number;
  quantity: number;
  taxRate: number;
}

export function calculateTax(items: TaxableItem[]): TaxBreakdown {
  const slabMap = new Map<number, { taxableAmount: number }>();

  for (const item of items) {
    const taxableAmount = item.unitPrice * item.quantity;
    const existing = slabMap.get(item.taxRate);
    if (existing) {
      existing.taxableAmount += taxableAmount;
    } else {
      slabMap.set(item.taxRate, { taxableAmount });
    }
  }

  const slabs: TaxSlab[] = [];
  let totalTaxable = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalTax = 0;

  for (const [rate, data] of slabMap) {
    const halfRate = rate / 2;
    const cgst = Math.round(data.taxableAmount * halfRate / 100);
    const sgst = Math.round(data.taxableAmount * halfRate / 100);
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

export function getTaxBreakdown(items: TaxableItem[]): TaxBreakdown {
  return calculateTax(items);
}
