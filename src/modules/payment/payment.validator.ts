import { z } from 'zod';

const methodSchema = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'CARD',
  'UPI',
  'CHEQUE',
  'GATEWAY',
  'OTHER',
]);
const statusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED']);

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive().finite(),
  method: methodSchema,
  currency: z.string().trim().length(3).default('INR'),
  status: statusSchema.optional(),
  paidAt: z.coerce.date().optional(),
  gatewayName: z.string().max(100).optional(),
  gatewayPaymentId: z.string().max(200).optional(),
  gatewayReference: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  invoiceId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  status: statusSchema.optional(),
  method: methodSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const paymentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type RecordPaymentRequest = z.infer<typeof recordPaymentSchema>;
export type ListPaymentsRequest = z.infer<typeof listPaymentsQuerySchema>;
export const gatewayPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceNumber: z.string().min(1).max(100),
  amount: z.coerce.number().positive().finite(),
  currency: z.string().trim().length(3).default('INR'),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string()).optional(),
});
