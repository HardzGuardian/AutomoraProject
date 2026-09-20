import { z } from 'zod';

// ===========================================
// RENEWAL VALIDATORS
// ===========================================

const renewalStatusSchema = z.enum(['PENDING', 'IN_DISCUSSION', 'RENEWED', 'NOT_RENEWED']);

/**
 * List renewals query schema
 */
export const listRenewalsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: renewalStatusSchema.optional(),
  search: z.string().optional(),
});

/**
 * Renewal ID param schema
 */
export const renewalIdParamSchema = z.object({
  id: z.string().uuid('Invalid renewal ID'),
});

/**
 * Update renewal status schema
 */
export const updateRenewalStatusSchema = z.object({
  status: renewalStatusSchema,
  outcomeNotes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional(),
  renewedValue: z
    .number()
    .positive('Renewed value must be positive')
    .optional(),
});

/**
 * Process renewal (mark as RENEWED) schema
 */
export const processRenewalSchema = z.object({
  renewedValue: z
    .number()
    .positive('Renewed value must be positive')
    .optional(),
  outcomeNotes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional(),
});

/**
 * Mark as NOT RENEWED schema
 */
export const notRenewedSchema = z.object({
  outcomeNotes: z
    .string()
    .min(1, 'Reason for not renewing is required')
    .max(2000, 'Notes must be less than 2000 characters')
    .trim(),
});

/**
 * Create follow-up schema
 */
export const createFollowUpSchema = z.object({
  notes: z
    .string()
    .min(1, 'Follow-up notes are required')
    .max(2000, 'Notes must be less than 2000 characters')
    .trim(),
  outcome: z
    .string()
    .max(100, 'Outcome must be less than 100 characters')
    .trim()
    .optional(),
  nextFollowUpDate: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

/**
 * Follow-up ID param schema
 */
export const followUpIdParamSchema = z.object({
  id: z.string().uuid('Invalid renewal ID'),
  followUpId: z.string().uuid('Invalid follow-up ID'),
});

/**
 * Get expiring renewals query schema
 */
export const expiringRenewalsQuerySchema = z.object({
  days: z.coerce.number().int().positive().default(30),
});

// ===========================================
// EXPORT TYPES
// ===========================================

export type ListRenewalsQuery = z.infer<typeof listRenewalsQuerySchema>;
export type UpdateRenewalStatusInput = z.infer<typeof updateRenewalStatusSchema>;
export type ProcessRenewalInput = z.infer<typeof processRenewalSchema>;
export type NotRenewedInput = z.infer<typeof notRenewedSchema>;
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
