import { InvoiceSourceType, InvoiceStatus } from '@prisma/client';

export interface InvoiceActor {
  id: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES' | 'TECHNICIAN' | 'CUSTOMER';
}

export interface InvoiceItemInput {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRate?: number | string;
}

export interface CreateInvoiceInput {
  clientId?: string;
  contractId?: string;
  sourceType: InvoiceSourceType;
  sourceId?: string;
  issueDate?: Date;
  dueDate: Date;
  currency?: string;
  taxRate?: number | string;
  notes?: string;
  items: InvoiceItemInput[];
}

export interface UpdateInvoiceInput {
  dueDate?: Date;
  notes?: string;
  status?: Extract<InvoiceStatus, 'DRAFT' | 'ISSUED'>;
}

export interface ListInvoicesQuery {
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  clientId?: string;
  contractId?: string;
  sourceType?: InvoiceSourceType;
  from?: Date;
  to?: Date;
}

export interface InvoiceTotals {
  subtotal: import('@prisma/client').Prisma.Decimal;
  taxAmount: import('@prisma/client').Prisma.Decimal;
  totalAmount: import('@prisma/client').Prisma.Decimal;
}

/**
 * Read model returned by `InvoiceService.listOverdueCandidates()` for the
 * overdue invoice job. Client contact details are resolved through the
 * Person 2 client integration port, so the job never queries Person 2 tables.
 */
export interface OverdueInvoiceCandidate {
  id: string;
  invoiceNumber: string;
  dueDate: Date;
  balanceAmount: import('@prisma/client').Prisma.Decimal;
  clientName?: string;
  email?: string;
  phone?: string;
}