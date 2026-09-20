export { Env } from '../config/env';

// ===========================================
// USER TYPES
// ===========================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'CUSTOMER';

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

// ===========================================
// JWT TYPES
// ===========================================

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ===========================================
// API TYPES
// ===========================================

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

// ===========================================
// AUDIT TYPES
// ===========================================

export interface AuditLogParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ===========================================
// UPLOAD TYPES
// ===========================================

export interface UploadResult {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

// ===========================================
// REQUEST TYPES
// ===========================================

export interface AuthenticatedRequest extends Express.Request {
  user: UserPayload;
  ip?: string;
  headers: {
    'user-agent'?: string;
    [key: string]: string | string[] | undefined;
  };
}

// ===========================================
// SERVICE TYPES
// ===========================================

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
