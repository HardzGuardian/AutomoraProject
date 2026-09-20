import { z } from 'zod';

// ===========================================
// ASSET VALIDATORS
// ===========================================

/**
 * Create asset schema
 */
export const createAssetSchema = z.object({
  serialNumber: z
    .string()
    .min(1, 'Serial number is required')
    .max(100, 'Serial number must be less than 100 characters')
    .trim(),
  model: z
    .string()
    .min(1, 'Model is required')
    .max(100, 'Model must be less than 100 characters')
    .trim(),
  manufacturer: z
    .string()
    .max(100, 'Manufacturer must be less than 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional(),
  installDate: z
    .string()
    .datetime({ message: 'Invalid install date format' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  warrantyExpiry: z
    .string()
    .datetime({ message: 'Invalid warranty expiry date format' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  clientId: z
    .string()
    .uuid('Invalid client ID')
    .optional(),
  siteIds: z
    .array(z.string().uuid('Invalid site ID'))
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional(),
});

/**
 * Update asset schema
 */
export const updateAssetSchema = z.object({
  serialNumber: z
    .string()
    .min(1, 'Serial number is required')
    .max(100, 'Serial number must be less than 100 characters')
    .trim()
    .optional(),
  model: z
    .string()
    .min(1, 'Model is required')
    .max(100, 'Model must be less than 100 characters')
    .trim()
    .optional(),
  manufacturer: z
    .string()
    .max(100, 'Manufacturer must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  description: z
    .string()
    .max(1000, 'Description must be less than 1000 characters')
    .trim()
    .optional()
    .nullable(),
  installDate: z
    .string()
    .datetime({ message: 'Invalid install date format' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .nullable(),
  warrantyExpiry: z
    .string()
    .datetime({ message: 'Invalid warranty expiry date format' })
    .optional()
    .transform((val) => (val ? new Date(val) : undefined))
    .nullable(),
  clientId: z
    .string()
    .uuid('Invalid client ID')
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional()
    .nullable(),
});

/**
 * List assets query schema
 */
export const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

/**
 * Asset ID param schema
 */
export const assetIdParamSchema = z.object({
  id: z.string().uuid('Invalid asset ID'),
});

/**
 * Link asset to contract schema
 */
export const linkAssetSchema = z.object({
  assetId: z
    .string()
    .uuid('Invalid asset ID'),
});

/**
 * Unlink asset from contract param schema
 */
export const unlinkAssetParamSchema = z.object({
  id: z.string().uuid('Invalid contract ID'),
  assetId: z.string().uuid('Invalid asset ID'),
});

// ===========================================
// EXPORT TYPES
// ===========================================

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
