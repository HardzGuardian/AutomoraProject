import { z } from 'zod';

// ===========================================
// SERVICE TYPE VALIDATORS
// ===========================================

/**
 * Create service type schema
 */
export const createServiceTypeSchema = z.object({
  name: z
    .string()
    .min(1, 'Service type name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional(),
  estimatedDuration: z
    .number()
    .int()
    .positive('Estimated duration must be positive')
    .optional(),
  basePrice: z
    .number()
    .positive('Base price must be positive')
    .optional(),
});

/**
 * Update service type schema
 */
export const updateServiceTypeSchema = z.object({
  name: z
    .string()
    .min(1, 'Service type name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
  estimatedDuration: z
    .number()
    .int()
    .positive('Estimated duration must be positive')
    .optional()
    .nullable(),
  basePrice: z
    .number()
    .positive('Base price must be positive')
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

/**
 * List service types query schema
 */
export const listServiceTypesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

/**
 * Service type ID param schema
 */
export const serviceTypeIdParamSchema = z.object({
  id: z.string().uuid('Invalid service type ID'),
});

// ===========================================
// EXPORT TYPES
// ===========================================

export type CreateServiceTypeInput = z.infer<typeof createServiceTypeSchema>;
export type UpdateServiceTypeInput = z.infer<typeof updateServiceTypeSchema>;
export type ListServiceTypesQuery = z.infer<typeof listServiceTypesQuerySchema>;
