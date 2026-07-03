export interface TaxConfig {
  rate: number;
  isInclusive: boolean;
}

export interface TaxSlab {
  rate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
}

export interface TaxBreakdown {
  slabs: TaxSlab[];
  totalTaxable: number;
  totalCGST: number;
  totalSGST: number;
  totalTax: number;
}
