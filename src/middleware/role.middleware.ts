import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../types';

/**
 * Role-based authorization middleware.
 * Checks if the authenticated user has one of the allowed roles.
 *
 * @param allowedRoles - Array of roles allowed to access the route
 *
 * @example
 * router.get('/admin', auth, role(['ADMIN']), controller.adminOnly);
 * router.get('/manager', auth, role(['ADMIN', 'MANAGER']), controller.managerOrAdmin);
 */
export const role = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated (auth middleware must run first)
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }

    // Check if user role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      next(
        ApiError.forbidden(
          `Access denied. Required roles: ${allowedRoles.join(', ')}`
        )
      );
      return;
    }

    next();
  };
};

/**
 * Higher-level role checking utilities.
 */
export const isAdmin = (role: UserRole): boolean => role === 'ADMIN';
export const isManager = (role: UserRole): boolean => role === 'MANAGER';
export const isSales = (role: UserRole): boolean => role === 'SALES';
export const isTechnician = (role: UserRole): boolean => role === 'TECHNICIAN';
export const isCustomer = (role: UserRole): boolean => role === 'CUSTOMER';

/**
 * Check if user has minimum role level.
 * Role hierarchy: CUSTOMER < TECHNICIAN < SALES < MANAGER < ADMIN
 */
export const hasMinRole = (userRole: UserRole, minRole: UserRole): boolean => {
  const hierarchy: Record<UserRole, number> = {
    CUSTOMER: 0,
    TECHNICIAN: 1,
    SALES: 2,
    MANAGER: 3,
    ADMIN: 4,
  };
  return hierarchy[userRole] >= hierarchy[minRole];
};
