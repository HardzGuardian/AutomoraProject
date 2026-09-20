import { z } from 'zod';

// ===========================================
// CLIENT VALIDATORS
// ===========================================

const clientCategorySchema = z.enum(['CORPORATE', 'RETAIL', 'GOVERNMENT']);

/**
 * Create client schema
 */
export const createClientSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Company name must be less than 200 characters')
    .trim(),
  industry: z
    .string()
    .max(100, 'Industry must be less than 100 characters')
    .trim()
    .optional(),
  category: clientCategorySchema.optional().default('CORPORATE'),
  taxId: z
    .string()
    .max(50, 'Tax ID must be less than 50 characters')
    .trim()
    .optional(),
  address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .trim()
    .optional(),
  city: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .trim()
    .optional(),
  state: z
    .string()
    .max(100, 'State must be less than 100 characters')
    .trim()
    .optional(),
  pincode: z
    .string()
    .max(10, 'Pincode must be less than 10 characters')
    .trim()
    .optional(),
  phone: z
    .string()
    .max(20, 'Phone must be less than 20 characters')
    .trim()
    .optional(),
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional(),
  assignedToId: z
    .string()
    .uuid('Invalid assigned user ID')
    .optional(),
});

/**
 * Update client schema
 */
export const updateClientSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Company name must be less than 200 characters')
    .trim()
    .optional(),
  industry: z
    .string()
    .max(100, 'Industry must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  category: clientCategorySchema.optional(),
  taxId: z
    .string()
    .max(50, 'Tax ID must be less than 50 characters')
    .trim()
    .optional()
    .nullable(),
  address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
  city: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  state: z
    .string()
    .max(100, 'State must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  pincode: z
    .string()
    .max(10, 'Pincode must be less than 10 characters')
    .trim()
    .optional()
    .nullable(),
  phone: z
    .string()
    .max(20, 'Phone must be less than 20 characters')
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional()
    .nullable(),
  assignedToId: z
    .string()
    .uuid('Invalid assigned user ID')
    .optional()
    .nullable(),
});

/**
 * List clients query schema
 */
export const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  category: clientCategorySchema.optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  assignedToId: z.string().uuid().optional(),
});

/**
 * Client ID param schema
 */
export const clientIdParamSchema = z.object({
  id: z.string().uuid('Invalid client ID'),
});

// ===========================================
// CONTACT VALIDATORS
// ===========================================

/**
 * Create contact schema
 */
export const createContactSchema = z.object({
  clientId: z
    .string()
    .uuid('Invalid client ID'),
  name: z
    .string()
    .min(1, 'Contact name is required')
    .max(100, 'Contact name must be less than 100 characters')
    .trim(),
  role: z
    .string()
    .max(50, 'Role must be less than 50 characters')
    .trim()
    .optional(),
  phone: z
    .string()
    .max(20, 'Phone must be less than 20 characters')
    .trim()
    .optional(),
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
  isPrimary: z.boolean().optional().default(false),
});

/**
 * Update contact schema
 */
export const updateContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Contact name is required')
    .max(100, 'Contact name must be less than 100 characters')
    .trim()
    .optional(),
  role: z
    .string()
    .max(50, 'Role must be less than 50 characters')
    .trim()
    .optional()
    .nullable(),
  phone: z
    .string()
    .max(20, 'Phone must be less than 20 characters')
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional()
    .nullable(),
  isPrimary: z.boolean().optional(),
});

/**
 * Contact ID param schema
 */
export const contactIdParamSchema = z.object({
  id: z.string().uuid('Invalid contact ID'),
});

// ===========================================
// SITE VALIDATORS
// ===========================================

/**
 * Create site schema
 */
export const createSiteSchema = z.object({
  clientId: z
    .string()
    .uuid('Invalid client ID'),
  siteName: z
    .string()
    .min(1, 'Site name is required')
    .max(200, 'Site name must be less than 200 characters')
    .trim(),
  address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .trim()
    .optional(),
  city: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .trim()
    .optional(),
  state: z
    .string()
    .max(100, 'State must be less than 100 characters')
    .trim()
    .optional(),
  pincode: z
    .string()
    .max(10, 'Pincode must be less than 10 characters')
    .trim()
    .optional(),
  phone: z
    .string()
    .max(20, 'Phone must be less than 20 characters')
    .trim()
    .optional(),
  notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .trim()
    .optional(),
});

/**
 * Update site schema
 */
export const updateSiteSchema = z.object({
  siteName: z
    .string()
    .min(1, 'Site name is required')
    .max(200, 'Site name must be less than 200 characters')
    .trim()
    .optional(),
  address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .trim()
    .optional()
    .nullable(),
  city: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  state: z
    .string()
    .max(100, 'State must be less than 100 characters')
    .trim()
    .optional()
    .nullable(),
  pincode: z
    .string()
    .max(10, 'Pincode must be less than 10 characters')
    .trim()
    .optional()
    .nullable(),
  phone: z
    .string()
    .max(20, 'Phone must be less than 20 characters')
    .trim()
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
 * Site ID param schema
 */
export const siteIdParamSchema = z.object({
  id: z.string().uuid('Invalid site ID'),
});

// ===========================================
// EXPORT TYPES
// ===========================================

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
