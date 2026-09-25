import { PaymentMethod, PaymentStatus } from '@prisma/client';

export type PaymentActor = {
  id: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'TECHNICIAN' | 'CUSTOMER';
};

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number | string;
  method: PaymentMethod;
  currency?: string;
  status?: PaymentStatus;
  paidAt?: Date;
  gatewayName?: string;
  gatewayPaymentId?: string;
  gatewayReference?: string;
  metadata?: Record<string, unknown>;
}

export interface ListPaymentsQuery {
  page?: number;
  limit?: number;
  invoiceId?: string;
  clientId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  from?: Date;
  to?: Date;
}