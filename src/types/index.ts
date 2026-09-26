export { Env } from '../config/env';

export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES' | 'TECHNICIAN' | 'CUSTOMER';

export interface UserPayload {
  id: string;
  email: string;
  role: UserRole;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string | null;
  createdAt: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface AuditLogParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface UploadResult {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user: UserPayload;
  ip?: string;
  headers: {
    'user-agent'?: string;
    [key: string]: string | string[] | undefined;
  };
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
