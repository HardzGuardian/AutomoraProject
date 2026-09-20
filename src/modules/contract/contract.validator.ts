import { z } from 'zod';

// ===========================================
// CONTRACT VALIDATORS
// ===========================================

const contractTypeSchema = z.enum(['COMPREHENSIVE', 'NON_COMPREHENSIVE']);
const contractStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED']);
const paymentFrequencySchema = z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL']);

/**
 * Create contract schema
 */
export const createContractSchema = z.object({
  clientId: z
    .string()
    .uuid('Invalid client ID'),
  contractNumber: z
    .string()
    .min(1, 'Contract number is required')
    .max(50, 'Contract number must be less than 50 characters')
    .trim(),
  type: contractTypeSchema.optional().default('COMPREHENSIVE'),
  serviceTypeId: z
    .string()
    .uuid('Invalid service type ID')
    .optional(),
  startDate: z
    .string()
    .min(1, 'Start date is required')
    .datetime({ message: 'Invalid start date format' })
    .transform((val) => new Date(val)),
  endDate: z
    .string()
    .min(1, 'End date is required')
    .datetime({ message: 'Invalid end date format' })
    .transform((val) => new Date(val)),
  value: z
    .number()
    .positive('Contract value must be positive')
    .optional(),
  paymentTerms: z
    .string()
    .max(500, 'Payment terms must be less than 500 characters')
    .trim()
    .optional(),
  billingFrequency: paymentFrequencySchema.optional(),
  includedVisits: z
    .number()
    .int()
    .nonnegative('Included visits must be non-negative')
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional(),
  assetIds: z
    .array(z.string().uuid('Invalid asset ID'))
    .optional(),
  sla: z
    .object({
      responseTimeHours: z.number().int().positive('Response time must be positive'),
      resolutionTimeHours: z.number().int().positive('Resolution time must be positive'),
      penaltyClause: z
        .string()
        .max(1000, 'Penalty clause must be less than 1000 characters')
        .trim()
        .optional(),
    })
    .optional(),
}).refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

/**
 * Update contract schema
 */
export const updateContractSchema = z.object({
  type: contractTypeSchema.optional(),
  serviceTypeId: z
    .string()
    .uuid('Invalid service type ID')
    .optional()
    .nullable(),
  startDate: z
    .string()
    .datetime({ message: 'Invalid start date format' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .datetime({ message: 'Invalid end date format' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  value: z
    .number()
    .positive('Contract value must be positive')
    .optional()
    .nullable(),
  paymentTerms: z
    .string()
    .max(500, 'Payment terms must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
  billingFrequency: paymentFrequencySchema.optional().nullable(),
  includedVisits: z
    .number()
    .int()
    .nonnegative('Included visits must be non-negative')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * List contracts query schema
 */
export const listContractsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  status: contractStatusSchema.optional(),
  type: contractTypeSchema.optional(),
  expiringInDays: z.coerce.number().int().positive().optional(),
});

/**
 * Contract ID param schema
 */
export const contractIdParamSchema = z.object({
  id: z.string().uuid('Invalid contract ID'),
});

/**
 * Contract asset link schema
 */
export const contractAssetLinkSchema = z.object({
  assetId: z.string().uuid('Invalid asset ID'),
});

/**
 * Contract asset unlink param schema
 */
export const contractAssetUnlinkParamSchema = z.object({
  id: z.string().uuid('Invalid contract ID'),
  assetId: z.string().uuid('Invalid asset ID'),
});

/**
 * Contract document upload schema
 */
export const contractDocumentSchema = z.object({
  uploadedFileId: z.string().uuid('Invalid file ID'),
  documentType: z.enum(['CONTRACT', 'AMENDMENT', 'ADDENDUM']).optional().default('CONTRACT'),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .trim()
    .optional(),
});

/**
 * Contract SLA schema
 */
export const contractSLASchema = z.object({
  responseTimeHours: z
    .number()
    .int()
    .positive('Response time must be positive'),
  resolutionTimeHours: z
    .number()
    .int()
    .positive('Resolution time must be positive'),
  penaltyClause: z
    .string()
    .max(1000, 'Penalty clause must be less than 1000 characters')
    .trim()
    .optional(),
});

/**
 * Document ID param schema
 */
export const documentIdParamSchema = z.object({
  id: z.string().uuid('Invalid contract ID'),
  docId: z.string().uuid('Invalid document ID'),
});

// ===========================================
// EXPORT TYPES
// ===========================================

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
export type ContractDocumentInput = z.infer<typeof contractDocumentSchema>;
export type ContractSLAInput = z.infer<typeof contractSLASchema>;
