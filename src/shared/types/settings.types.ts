import { DaySessionStatus } from '../enums';

export interface Restaurant {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  gstin?: string;
  fssai?: string;
  logoPath?: string;
  currency: string;
}

export interface Setting {
  key: string;
  value: string;
  category: string;
}

export interface DaySession {
  id: number;
  openedBy: number;
  closedBy?: number;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  openedAt: string;
  closedAt?: string;
  notes?: string;
}
