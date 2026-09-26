import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../types';

/** Must be mounted after `auth`, which populates `req.user`. */
export const role = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }

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

export const isAdmin = (role: UserRole): boolean => role === 'ADMIN';
export const isManager = (role: UserRole): boolean => role === 'MANAGER';
export const isSales = (role: UserRole): boolean => role === 'SALES';
export const isTechnician = (role: UserRole): boolean => role === 'TECHNICIAN';
export const isCustomer = (role: UserRole): boolean => role === 'CUSTOMER';

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
