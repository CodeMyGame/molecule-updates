export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyPoints: number;
  totalSpent: number;
  totalVisits: number;
  notes?: string;
}

export interface LoyaltyTransaction {
  id: number;
  customerId: number;
  orderId?: number;
  points: number;
  description: string;
  createdAt: string;
}
