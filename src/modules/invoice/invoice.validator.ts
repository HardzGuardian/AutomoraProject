import { z } from 'zod';

const sourceTypeSchema = z.enum(['CONTRACT', 'VISIT', 'MILESTONE']);
const invoiceStatusSchema = z.enum([
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
]);

const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive().finite(),
  unitPrice: z.coerce.number().nonnegative().finite(),
  taxRate: z.coerce.number().min(0).max(100).finite().optional(),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  sourceType: sourceTypeSchema,
  sourceId: z.string().max(200).optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date(),
  currency: z.string().trim().length(3).default('INR'),
  taxRate: z.coerce.number().min(0).max(100).finite().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export const updateInvoiceSchema = z.object({
  dueDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'ISSUED']).optional(),
});

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: invoiceStatusSchema.optional(),
  clientId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  sourceType: sourceTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const invoiceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateInvoiceRequest = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceRequest = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesRequest = z.infer<typeof listInvoicesQuerySchema>;