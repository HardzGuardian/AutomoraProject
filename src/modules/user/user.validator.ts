import { z } from 'zod';

// ===========================================
// USER VALIDATORS
// ===========================================

const userRoleSchema = z.enum(['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'CUSTOMER']);

/**
 * Create user schema (admin)
 */
export const createUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),
  role: userRoleSchema.optional().default('CUSTOMER'),
});

/**
 * Update user schema (admin)
 */
export const updateUserSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim()
    .optional(),
});

/**
 * Update own profile schema
 */
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim()
    .optional(),
  avatar: z
    .string()
    .url('Invalid avatar URL')
    .optional()
    .nullable(),
});

/**
 * Change user role schema
 */
export const changeRoleSchema = z.object({
  role: userRoleSchema,
});

/**
 * List users query schema
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  role: userRoleSchema.optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

/**
 * User ID param schema
 */
export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

// Export types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
