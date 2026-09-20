// ===========================================
// APPLICATION CONSTANTS
// ===========================================

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// User roles
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES: 'SALES',
  TECHNICIAN: 'TECHNICIAN',
  CUSTOMER: 'CUSTOMER',
} as const;

// Role hierarchy (for authorization)
export const ROLE_HIERARCHY: Record<string, number> = {
  CUSTOMER: 0,
  TECHNICIAN: 1,
  SALES: 2,
  MANAGER: 3,
  ADMIN: 4,
} as const;

// Audit actions
export const AUDIT_ACTIONS = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  TOKEN_REFRESH: 'TOKEN_REFRESH',

  // User management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  ROLE_CHANGED: 'ROLE_CHANGED',

  // File operations
  FILE_UPLOADED: 'FILE_UPLOADED',
  FILE_DELETED: 'FILE_DELETED',

  // Client management
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',
  CLIENT_DELETED: 'CLIENT_DELETED',
  CONTACT_CREATED: 'CONTACT_CREATED',
  CONTACT_UPDATED: 'CONTACT_UPDATED',
  CONTACT_DELETED: 'CONTACT_DELETED',
  SITE_CREATED: 'SITE_CREATED',
  SITE_UPDATED: 'SITE_UPDATED',
  SITE_DELETED: 'SITE_DELETED',

  // Contract management
  CONTRACT_CREATED: 'CONTRACT_CREATED',
  CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  CONTRACT_ACTIVATED: 'CONTRACT_ACTIVATED',
  CONTRACT_CANCELLED: 'CONTRACT_CANCELLED',
  CONTRACT_STATUS_CHANGED: 'CONTRACT_STATUS_CHANGED',
  CONTRACT_ASSET_LINKED: 'CONTRACT_ASSET_LINKED',
  CONTRACT_ASSET_UNLINKED: 'CONTRACT_ASSET_UNLINKED',
  CONTRACT_DOCUMENT_ADDED: 'CONTRACT_DOCUMENT_ADDED',
  CONTRACT_DOCUMENT_REMOVED: 'CONTRACT_DOCUMENT_REMOVED',
  CONTRACT_SLA_UPDATED: 'CONTRACT_SLA_UPDATED',

  // Asset management
  ASSET_CREATED: 'ASSET_CREATED',
  ASSET_UPDATED: 'ASSET_UPDATED',
  ASSET_DELETED: 'ASSET_DELETED',

  // Service type management
  SERVICE_TYPE_CREATED: 'SERVICE_TYPE_CREATED',
  SERVICE_TYPE_UPDATED: 'SERVICE_TYPE_UPDATED',
  SERVICE_TYPE_DELETED: 'SERVICE_TYPE_DELETED',

  // Renewal management
  RENEWAL_CREATED: 'RENEWAL_CREATED',
  RENEWAL_STATUS_CHANGED: 'RENEWAL_STATUS_CHANGED',
  RENEWAL_QUOTE_SENT: 'RENEWAL_QUOTE_SENT',
  RENEWAL_FOLLOW_UP: 'RENEWAL_FOLLOW_UP',
  RENEWAL_OUTCOME: 'RENEWAL_OUTCOME',

  // Generic CRUD
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
} as const;

// Audit entities
export const AUDIT_ENTITIES = {
  USER: 'User',
  REFRESH_TOKEN: 'RefreshToken',
  AUDIT_LOG: 'AuditLog',
  UPLOADED_FILE: 'UploadedFile',
  CLIENT: 'Client',
  CLIENT_CONTACT: 'ClientContact',
  CLIENT_SITE: 'ClientSite',
  ASSET: 'Asset',
  SERVICE_TYPE: 'ServiceType',
  CONTRACT: 'Contract',
  CONTRACT_ASSET: 'ContractAsset',
  CONTRACT_DOCUMENT: 'ContractDocument',
  CONTRACT_SLA: 'ContractSLA',
  RENEWAL: 'Renewal',
  RENEWAL_FOLLOW_UP: 'RenewalFollowUp',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// File upload
export const UPLOAD = {
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  STORAGE_PATH: './uploads',
} as const;

// JWT
export const JWT = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  ALGORITHM: 'HS256',
} as const;

// Regex patterns
export const PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// ===========================================
// CONTRACT STATUS THRESHOLDS
// ===========================================

export const CONTRACT_STATUS = {
  EXPIRING_SOON_DAYS: 30,
  RENEWALReminder_DAYS: [30, 60, 90],
} as const;

// Renewal reminder types
export const REMINDER_TYPES = {
  THIRTY_DAY: '30_DAY',
  SIXTY_DAY: '60_DAY',
  NINETY_DAY: '90_DAY',
} as const;
