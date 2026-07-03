import { PaymentMode } from '../enums';

export interface Payment {
  id: number;
  orderId: number;
  paymentMode: PaymentMode;
  amount: number;
  referenceNo?: string;
  tipAmount: number;
  createdAt: string;
}

export interface CreatePaymentDTO {
  orderId: number;
  payments: {
    mode: PaymentMode;
    amount: number;
    referenceNo?: string;
  }[];
}
