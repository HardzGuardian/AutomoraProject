# Automora Backend — Architecture Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema](#4-database-schema)
5. [Authentication System](#5-authentication-system)
6. [Authorization & Roles](#6-authorization--roles)
7. [API Reference](#7-api-reference)
8. [Middleware Architecture](#8-middleware-architecture)
9. [Utility Functions](#9-utility-functions)
10. [Audit System](#10-audit-system)
11. [File Upload System](#11-file-upload-system)
12. [Environment Configuration](#12-environment-configuration)
13. [Error Handling](#13-error-handling)
14. [Security Measures](#14-security-measures)
15. [Development Guide](#15-development-guide)

---

## 1. Project Overview

Automora Backend is a RESTful API service built with Node.js, TypeScript, Express.js, PostgreSQL, and Prisma ORM. It provides the foundational infrastructure for authentication, user management, audit logging, and file uploads.

### Responsibilities (Person 1)

| Area | Description |
|------|-------------|
| Project Setup | package.json, tsconfig.json, Docker, app.ts, server.ts |
| Database | Prisma schema, migrations, seed data |
| Configuration | Environment variables, constants, storage config |
| Types | Shared TypeScript type definitions |
| Middleware | Auth, role, validation, upload, rate limiting, error handling |
| Utilities | ApiError, asyncHandler, response, jwt, hash, logger, dateHelpers |
| Authentication | Login, register, refresh tokens, password management |
| Users | CRUD operations, role management |
| Audit | Audit logging service and endpoints |
| Uploads | File upload, storage, management |

---

## 2. Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS | Runtime environment |
| TypeScript | 5.x | Type-safe JavaScript |
| Express.js | 4.x | Web framework |
| PostgreSQL | 16+ | Relational database |
| Prisma | Latest | ORM and database toolkit |
| Zod | Latest | Runtime validation |
| jsonwebtoken | Latest | JWT authentication |
| bcrypt | Latest | Password hashing |
| Multer | Latest | File upload handling |
| Helmet | Latest | Security headers |
| express-rate-limit | Latest | Rate limiting |
| Winston/Pino | Latest | Structured logging |
| Docker | Latest | Containerization |

---

## 3. Architecture Overview

### Request Flow

```
Client Request
    │
    ▼
┌─────────────────────────────────────┐
│         Security Layer              │
│  (Helmet, CORS, Rate Limiting)      │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Body Parsing                │
│  (JSON, URL-encoded)                │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Request Logging             │
│  (Morgan/Winston)                   │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Authentication              │
│  (JWT verification → req.user)      │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Authorization               │
│  (Role checking)                    │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Validation                  │
│  (Zod schema validation)            │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Route Handler               │
│  (Controller → Service → Database)  │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│         Response                    │
│  (Standardized JSON format)         │
└─────────────────┬───────────────────┘
                  │
                  ▼
          Client Response
```

### Module Structure

```
src/
├── config/          # Configuration files
├── types/           # TypeScript type definitions
├── utils/           # Shared utility functions
├── middleware/       # Express middleware
├── modules/         # Feature modules
│   ├── auth/        # Authentication
│   ├── user/        # User management
│   ├── audit/       # Audit logging
│   └── upload/      # File uploads
├── app.ts           # Express app setup
└── server.ts        # HTTP server startup
```

---

## 4. Database Schema

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │       │ RefreshToken │       │   AuditLog   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (UUID)    │──┐    │ id (UUID)    │       │ id (UUID)    │
│ email        │  │    │ token        │       │ userId       │
│ password     │  │    │ userId (FK)  │◄──────│ action       │
│ firstName    │  │    │ expiresAt    │       │ entity       │
│ lastName     │  │    │ createdAt    │       │ entityId     │
│ role         │  │    │ revokedAt    │       │ metadata     │
│ isActive     │  │    └──────────────┘       │ ipAddress    │
│ avatar       │  │                           │ userAgent    │
│ createdAt    │  │                           │ createdAt    │
│ updatedAt    │  │                           └──────────────┘
│ deletedAt    │  │
└──────────────┘  │    ┌──────────────┐
                  │    │ UploadedFile │
                  │    ├──────────────┤
                  └───►│ id (UUID)    │
                       │ originalName │
                       │ filename     │
                       │ mimeType     │
                       │ size         │
                       │ path         │
                       │ uploaderId   │
                       │ createdAt    │
                       └──────────────┘
```

### User Entity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, default uuid() | Unique identifier |
| email | String | Unique, indexed | User email address |
| password | String | Not null | Hashed password (bcrypt) |
| firstName | String | Not null | User first name |
| lastName | String | Not null | User last name |
| role | Enum | Default CUSTOMER | User role (ADMIN, MANAGER, TECHNICIAN, CUSTOMER) |
| isActive | Boolean | Default true | Account active status |
| avatar | String? | Nullable | Profile picture URL |
| createdAt | DateTime | Default now() | Record creation time |
| updatedAt | DateTime | Auto-updated | Last modification time |
| deletedAt | DateTime? | Nullable | Soft delete timestamp |

**Indexes:**
- `email` (unique)
- `role`
- `isActive`

### RefreshToken Entity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| token | String | Unique, indexed | Refresh token value |
| userId | UUID | FK → User | Token owner |
| expiresAt | DateTime | Not null | Token expiration |
| createdAt | DateTime | Default now() | Creation time |
| revokedAt | DateTime? | Nullable | Revocation time |

**Indexes:**
- `token` (unique)
- `userId`
- `expiresAt`

### AuditLog Entity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| userId | UUID? | FK → User, Nullable | Actor (null for system actions) |
| action | String | Indexed | Action type (e.g., USER_LOGIN) |
| entity | String | Not null | Entity type (e.g., User) |
| entityId | String? | Nullable | Affected record ID |
| metadata | JSON? | Nullable | Additional context |
| ipAddress | String? | Nullable | Client IP address |
| userAgent | String? | Nullable | Client user agent |
| createdAt | DateTime | Default now() | When action occurred |

**Indexes:**
- `userId`
- `action`
- `entity + entityId` (composite)
- `createdAt`

### UploadedFile Entity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| originalName | String | Not null | Original filename |
| filename | String | Unique | Stored filename (UUID-based) |
| mimeType | String | Not null | File MIME type |
| size | Integer | Not null | File size in bytes |
| path | String | Not null | Storage path |
| uploaderId | UUID | FK → User | Upload user |
| createdAt | DateTime | Default now() | Upload time |

**Indexes:**
- `uploaderId`
- `mimeType`

---

## 5. Authentication System

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      LOGIN FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client                        Server                      │
│    │                             │                          │
│    │  POST /auth/login           │                          │
│    │  { email, password }        │                          │
│    │ ──────────────────────────► │                          │
│    │                             │  Validate credentials    │
│    │                             │  Check account status    │
│    │                             │  Generate tokens         │
│    │  { accessToken,             │                          │
│    │    refreshToken }           │                          │
│    │ ◄────────────────────────── │                          │
│    │                             │                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    REFRESH FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client                        Server                      │
│    │                             │                          │
│    │  POST /auth/refresh         │                          │
│    │  { refreshToken }           │                          │
│    │ ──────────────────────────► │                          │
│    │                             │  Validate refresh token  │
│    │                             │  Check if revoked        │
│    │                             │  Generate new tokens     │
│    │                             │  Revoke old token        │
│    │  { accessToken,             │                          │
│    │    newRefreshToken }        │                          │
│    │ ◄────────────────────────── │                          │
│    │                             │                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     LOGOUT FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client                        Server                      │
│    │                             │                          │
│    │  POST /auth/logout          │                          │
│    │  { refreshToken }           │                          │
│    │ ──────────────────────────► │                          │
│    │                             │  Revoke refresh token    │
│    │  200 OK                     │                          │
│    │ ◄────────────────────────── │                          │
│    │                             │                          │
└─────────────────────────────────────────────────────────────┘
```

### Token Configuration

| Token | Expiration | Storage | Purpose |
|-------|------------|---------|---------|
| Access Token | 15 minutes | Client memory | API authentication |
| Refresh Token | 7 days | Database + HTTP-only cookie | Token renewal |

### Token Rotation Strategy

1. Client sends refresh token to `/auth/refresh`
2. Server validates token against database
3. Server checks if token is revoked
4. Server generates new access token + new refresh token
5. Server marks old refresh token as revoked
6. Server saves new refresh token to database
7. If revoked token reuse detected → revoke ALL user tokens

### Password Security

- **Hashing Algorithm:** bcrypt
- **Salt Rounds:** 12
- **Minimum Length:** 8 characters
- **Requirements:** At least 1 uppercase, 1 lowercase, 1 number

### Security Measures

- Refresh tokens stored as HTTP-only, Secure, SameSite=Strict cookies
- Rate limiting: 5 attempts per 15 minutes on auth endpoints
- Account lockout after 5 failed attempts (15 minute lockout)
- JWT secret rotation support with grace period
- No sensitive data in JWT payload

---

## 6. Authorization & Roles

### Role Hierarchy

```
ADMIN (Full Access)
    │
    ▼
MANAGER (Team Management)
    │
    ▼
TECHNICIAN (Ticket Handling)
    │
    ▼
CUSTOMER (Basic Access)
```

### Role Definitions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| ADMIN | System administrator | Full access to all resources and settings |
| MANAGER | Team manager | Manage technicians, view reports, manage tickets |
| TECHNICIAN | Support technician | View assigned tickets, update ticket status |
| CUSTOMER | End customer | Create tickets, view own tickets |

### Permission Matrix

| Operation | Admin | Manager | Technician | Customer |
|-----------|-------|---------|------------|----------|
| **Authentication** |
| Login | ✅ | ✅ | ✅ | ✅ |
| Register | ✅ | ✅ | ✅ | ✅ |
| Refresh Token | ✅ | ✅ | ✅ | ✅ |
| Change Password | ✅ | ✅ | ✅ | ✅ |
| **Users** |
| List Users | ✅ | ✅ | ❌ | ❌ |
| View Any User | ✅ | ✅ | ❌ | ❌ |
| Create User | ✅ | ❌ | ❌ | ❌ |
| Update User | ✅ | ❌ | ❌ | ❌ |
| Deactivate User | ✅ | ❌ | ❌ | ❌ |
| Change User Role | ✅ | ❌ | ❌ | ❌ |
| View Own Profile | ✅ | ✅ | ✅ | ✅ |
| Update Own Profile | ✅ | ✅ | ✅ | ✅ |
| **Audit** |
| View Audit Logs | ✅ | ✅ | ❌ | ❌ |
| **Files** |
| Upload File | ✅ | ✅ | ✅ | ✅ |
| Delete Own File | ✅ | ✅ | ✅ | ✅ |
| Delete Any File | ✅ | ❌ | ❌ | ❌ |

---

## 7. API Reference

### Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://api.automora.com/api/v1
```

### Authentication Endpoints

#### Register
```
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CUSTOMER"
  }
}
```

**Errors:**
- `400` - Validation error
- `409` - Email already exists

#### Login
```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

**Errors:**
- `400` - Validation error
- `401` - Invalid credentials
- `423` - Account locked

#### Refresh Token
```
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token"
  }
}
```

**Errors:**
- `401` - Invalid or revoked refresh token

#### Logout
```
POST /auth/logout
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### Get Current User
```
GET /auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CUSTOMER",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Change Password
```
PATCH /auth/change-password
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### User Endpoints (Admin)

#### List Users
```
GET /users?page=1&limit=10&role=ADMIN&search=john
Authorization: Bearer <token>
Required Role: ADMIN, MANAGER
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `role` - Filter by role
- `search` - Search by name or email
- `isActive` - Filter by active status

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

#### Get User by ID
```
GET /users/:id
Authorization: Bearer <token>
Required Role: ADMIN
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "TECHNICIAN",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Create User
```
POST /users
Authorization: Bearer <token>
Required Role: ADMIN
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "TECHNICIAN"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "newuser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "TECHNICIAN"
  }
}
```

#### Update User
```
PATCH /users/:id
Authorization: Bearer <token>
Required Role: ADMIN
```

**Request Body:**
```json
{
  "firstName": "Updated",
  "lastName": "Name"
}
```

#### Deactivate User
```
PATCH /users/:id/deactivate
Authorization: Bearer <token>
Required Role: ADMIN
```

**Response (200):**
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

#### Change User Role
```
PATCH /users/:id/role
Authorization: Bearer <token>
Required Role: ADMIN
```

**Request Body:**
```json
{
  "role": "MANAGER"
}
```

### User Endpoints (Self)

#### Get Own Profile
```
GET /users/me
Authorization: Bearer <token>
```

#### Update Own Profile
```
PATCH /users/me
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "firstName": "Updated",
  "lastName": "Name"
}
```

### Audit Endpoints

#### List Audit Logs
```
GET /audit?page=1&limit=50&action=USER_LOGIN&entity=User&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
Required Role: ADMIN, MANAGER
```

**Query Parameters:**
- `page` - Page number
- `limit` - Items per page
- `action` - Filter by action type
- `entity` - Filter by entity type
- `userId` - Filter by user
- `startDate` - Start date filter
- `endDate` - End date filter

### Upload Endpoints

#### Upload File
```
POST /uploads
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` - The file to upload

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "originalName": "document.pdf",
    "filename": "550e8400-e29b-41d4-a716-446655440000.pdf",
    "mimeType": "application/pdf",
    "size": 1024,
    "url": "/uploads/550e8400-e29b-41d4-a716-446655440000.pdf"
  }
}
```

**Errors:**
- `400` - Invalid file type or size
- `413` - File too large

#### Delete File
```
DELETE /uploads/:id
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

#### Download File
```
GET /uploads/:id/download
Authorization: Bearer <token>
```

**Response:** Binary file stream

### Health Check

```
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.678
}
```

---

## 8. Middleware Architecture

### Middleware Stack Order

```
1. Helmet
   └── Sets security HTTP headers

2. CORS
   └── Handles cross-origin requests

3. Body Parser
   ├── JSON (limit: 10mb)
   └── URL-encoded (limit: 10mb)

4. Request Logger
   └── Logs incoming requests

5. Global Rate Limiter
   └── 100 requests per 15 minutes

6. Auth Middleware (protected routes only)
   ├── Extracts Bearer token
   ├── Verifies JWT
   └── Populates req.user

7. Role Middleware (role-restricted routes)
   └── Checks user role against allowed roles

8. Validation Middleware
   └── Validates request with Zod schema

9. Route Handler
   └── Executes controller logic

10. 404 Handler
    └── Catches unmatched routes

11. Error Handler
    └── Global error handling middleware
```

### Middleware Specifications

#### auth.middleware

**Purpose:** Verify JWT access token and populate `req.user`

**Input:** `Authorization: Bearer <token>` header

**Output:**
```typescript
req.user = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'TECHNICIAN' | 'CUSTOMER';
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid token
- `401 Unauthorized` - Token expired

**Dependencies:** jwt utility, Prisma client

---

#### role.middleware

**Purpose:** Restrict access to specific roles

**Input:** Array of allowed roles

**Output:** Passes or denies request

**Error Responses:**
- `403 Forbidden` - User role not authorized

**Dependencies:** auth middleware (must run first)

**Usage:**
```typescript
router.get('/admin-only', auth, role(['ADMIN']), controller.method);
router.get('/manager-or-admin', auth, role(['ADMIN', 'MANAGER']), controller.method);
```

---

#### validate.middleware

**Purpose:** Validate request data against Zod schema

**Input:** Zod schema for body, query, or params

**Output:** Sanitized and typed data on request object

**Error Responses:**
- `400 Bad Request` - Validation failed with detailed errors

**Dependencies:** Zod

**Usage:**
```typescript
router.post('/register', validate(registerSchema), controller.register);
```

---

#### upload.middleware

**Purpose:** Handle multipart file uploads

**Input:** `multipart/form-data` with file

**Output:** `req.file` or `req.files`

**Error Responses:**
- `400 Bad Request` - Invalid file type
- `413 Payload Too Large` - File exceeds size limit

**Dependencies:** Multer, upload configuration

---

#### rateLimit.middleware

**Purpose:** Prevent abuse by limiting request rate

**Configuration:**
- Global: 100 requests per 15 minutes
- Auth endpoints: 5 requests per 15 minutes

**Output:** Passes or rate limits

**Error Responses:**
- `429 Too Many Requests` - Rate limit exceeded

**Dependencies:** express-rate-limit

---

#### notFound.middleware

**Purpose:** Catch unmatched routes

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Route not found",
    "path": "/invalid/path"
  }
}
```

---

#### error.middleware

**Purpose:** Global error handler

**Input:** Error object (ApiError or unexpected)

**Output:** Standardized JSON error response

**Behavior:**
- Logs error with stack trace
- Returns appropriate status code
- Hides stack trace in production
- Handles Prisma errors specifically

---

## 9. Utility Functions

### ApiError

**Purpose:** Consistent error representation across the application

**Interface:**
```typescript
class ApiError extends Error {
  statusCode: number;
  details?: unknown;
  
  constructor(statusCode: number, message: string, details?: unknown);
}
```

**Usage:**
```typescript
throw new ApiError(404, 'User not found');
throw new ApiError(400, 'Validation failed', { field: 'email', message: 'Invalid format' });
```

**Who Uses:** All services and middleware

**Should NOT:** Handle logging (that's the error middleware's job)

---

### asyncHandler

**Purpose:** Eliminate repetitive try/catch in async route handlers

**Interface:**
```typescript
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>):
  (req: Request, res: Response, next: NextFunction) => void;
```

**Usage:**
```typescript
router.post('/login', asyncHandler(authController.login));
```

**Who Uses:** All controllers

**Should NOT:** Handle business logic

---

### response

**Purpose:** Consistent API response format

**Interface:**
```typescript
class Response {
  static success(res: Response, data: any, statusCode?: number): Response;
  static error(res: Response, message: string, statusCode?: number): Response;
}
```

**Usage:**
```typescript
Response.success(res, { id: user.id, email: user.email }, 201);
Response.error(res, 'User not found', 404);
```

**Who Uses:** All controllers

**Should NOT:** Handle error creation (use ApiError for that)

---

### jwt

**Purpose:** Encapsulate token generation and verification

**Interface:**
```typescript
function generateAccessToken(payload: JwtPayload): string;
function generateRefreshToken(payload: JwtPayload): string;
function verifyAccessToken(token: string): JwtPayload;
function verifyRefreshToken(token: string): JwtPayload;
```

**Who Uses:** Auth service, auth middleware

**Should NOT:** Handle token storage (that's the service's job)

**Security:** Uses strong secrets from environment variables

---

### hash

**Purpose:** Consistent password hashing

**Interface:**
```typescript
async function hash(data: string): Promise<string>;
async function compare(data: string, hashed: string): Promise<boolean>;
```

**Who Uses:** Auth service

**Should NOT:** Handle password validation rules

**Security:** Uses bcrypt with 12 rounds

---

### logger

**Purpose:** Structured logging for debugging and audit

**Interface:**
```typescript
logger.info(message: string, metadata?: object);
logger.error(message: string, metadata?: object);
logger.warn(message: string, metadata?: object);
logger.debug(message: string, metadata?: object);
```

**Who Uses:** All modules

**Should NOT:** Log sensitive data (passwords, tokens)

**Security:** Sanitizes log output

---

### dateHelpers

**Purpose:** Consistent date manipulation

**Interface:**
```typescript
function addDays(date: Date, days: number): Date;
function isExpired(date: Date): boolean;
function formatDate(date: Date, format?: string): string;
function toUTC(date: Date): Date;
```

**Who Uses:** Services, audit logging

**Should NOT:** Handle timezone conversion (use UTC everywhere)

---

## 10. Audit System

### Audit Log Pattern

```
Database Transaction Start
        │
        ▼
Business Operation
        │
        ▼
Audit Log Creation (within transaction)
        │
        ▼
Transaction Commit
```

### Transaction-Aware Audit

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Perform business operation
  const user = await tx.user.create({ data: userData });
  
  // 2. Create audit log within same transaction
  await auditService.log({
    tx,
    userId: currentUser.id,
    action: 'USER_CREATED',
    entity: 'User',
    entityId: user.id,
    metadata: { email: user.email },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  
  // 3. If anything fails, both operations roll back
});
```

### What Gets Audited

| Category | Actions |
|----------|---------|
| Authentication | LOGIN, LOGOUT, LOGIN_FAILED, PASSWORD_CHANGE |
| User Management | USER_CREATED, USER_UPDATED, USER_DEACTIVATED, ROLE_CHANGED |
| File Operations | FILE_UPLOADED, FILE_DELETED |
| CRUD Operations | CREATE, UPDATE, DELETE (for key entities) |

### Audit Log Fields

| Field | Purpose | Example |
|-------|---------|---------|
| userId | Who performed the action | `uuid` |
| action | What was done | `USER_CREATED` |
| entity | Which entity was affected | `User` |
| entityId | Which specific record | `uuid` |
| metadata | Additional context | `{ email: "user@example.com" }` |
| ipAddress | Security tracking | `192.168.1.1` |
| userAgent | Security tracking | `Mozilla/5.0...` |
| createdAt | When it happened | `2024-01-01T00:00:00.000Z` |

### What NOT to Audit

- Passwords (hashed or plaintext)
- JWT tokens
- File contents
- Sensitive personal data (unless explicitly required)

### Failure Behavior

- If business transaction fails → audit log is NOT written (rolls back)
- If audit logging fails → business operation also fails (consistent state)

---

## 11. File Upload System

### Upload Flow

```
Client Request (multipart/form-data)
        │
        ▼
Upload Middleware (Multer)
        │
        ▼
File Validation
├── MIME type check (magic bytes)
├── Extension check
├── Size limit check
└── Filename sanitization
        │
        ▼
Upload Service
├── Generate UUID filename
├── Determine storage path
├── Write file to disk
└── Create database record
        │
        ▼
Response
{ id, url, originalName, mimeType, size }
```

### Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| Max file size | 10 MB | Configurable per route |
| Allowed MIME types | image/*, application/pdf | Configurable |
| Storage path | `./uploads/` | Configurable via env |
| Filename strategy | UUID + original extension | Prevents conflicts |

### Security Measures

1. **MIME Type Validation:** Check magic bytes, not just extension
2. **Filename Sanitization:** Remove special characters, prevent path traversal
3. **Random Filenames:** Use UUID to prevent guessing
4. **Size Limits:** Configurable per route
5. **Storage Location:** Outside web root

### Storage Abstraction

```typescript
interface StorageService {
  upload(buffer: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(filename: string): Promise<void>;
  getUrl(filename: string): string;
}
```

**Initial Implementation:** Local filesystem
**Future:** S3-compatible storage (AWS S3, MinIO)

---

## 12. Environment Configuration

### Required Variables

```bash
# DATABASE
DATABASE_URL=postgresql://user:password@localhost:5432/dbname?schema=public

# JWT
JWT_SECRET=<random-64-char-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<random-64-char-string>
JWT_REFRESH_EXPIRES_IN=7d

# SERVER
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# UPLOADS
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# RATE LIMITING
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# LOGGING
LOG_LEVEL=info
```

### Optional Variables

```bash
# PASSWORD
BCRYPT_ROUNDS=12

# ACCOUNT SECURITY
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME_MS=900000

# DATABASE POOL
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

### Environment Validation

All environment variables are validated at startup using Zod. If required variables are missing, the application fails fast with a clear error message.

```typescript
// config/env.ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  // ... other variables
});

export const env = envSchema.parse(process.env);
```

---

## 13. Error Handling

### Error Categories

| Category | Status Code | Example |
|----------|-------------|---------|
| Validation | 400 | Missing required field |
| Authentication | 401 | Invalid token |
| Authorization | 403 | Insufficient permissions |
| Not Found | 404 | Resource doesn't exist |
| Conflict | 409 | Email already exists |
| Payload Too Large | 413 | File exceeds size limit |
| Rate Limited | 429 | Too many requests |
| Server Error | 500 | Unexpected error |

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {
      "field": "email",
      "reason": "Invalid format"
    }
  }
}
```

### Error Flow

```
Controller
    │
    ▼
Service
    │
    ▼
Error Thrown (ApiError or unexpected)
    │
    ▼
Error Middleware
    │
    ▼
Log Error
    │
    ▼
Send Response
```

### Prisma Error Handling

```typescript
if (error instanceof Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      throw new ApiError(409, 'Resource already exists');
    case 'P2025':
      // Record not found
      throw new ApiError(404, 'Resource not found');
    default:
      throw new ApiError(500, 'Database error');
  }
}
```

---

## 14. Security Measures

### Authentication Security

- [x] Passwords hashed with bcrypt (12 rounds)
- [x] JWT tokens have appropriate expiration
- [x] Refresh tokens stored in database (revocable)
- [x] Refresh token rotation implemented
- [x] Rate limiting on auth endpoints
- [x] Account lockout after failed attempts

### Input Validation

- [x] All endpoints validated with Zod
- [x] SQL injection prevented (Prisma parameterized queries)
- [x] XSS prevented (input sanitization)

### Transport Security

- [x] CORS configured with explicit origins
- [x] Helmet security headers enabled
- [x] HTTPS enforced in production

### File Upload Security

- [x] MIME type validation (magic bytes)
- [x] Size limits enforced
- [x] Path traversal prevention
- [x] Random filenames (UUID)

### Data Security

- [x] Environment variables validated at startup
- [x] No secrets in code or logs
- [x] Error messages don't expose internals in production

### Monitoring

- [x] Audit logging for sensitive operations
- [x] Request logging for debugging
- [x] Error tracking

---

## 15. Development Guide

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Update `.env` with your database credentials
4. Run `npm install`
5. Run `npx prisma migrate dev`
6. Run `npm run seed`
7. Run `npm run dev`

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run seed         # Seed database
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run lint         # Run linter
npm run migrate      # Run migrations
npm run migrate:dev  # Run migrations in development
```

### Project Structure

```
src/
├── config/          # Configuration files
├── types/           # TypeScript type definitions
├── utils/           # Shared utility functions
├── middleware/       # Express middleware
├── modules/         # Feature modules
├── app.ts           # Express app setup
└── server.ts        # HTTP server startup
```

### Code Style

- Use TypeScript strict mode
- Use async/await over callbacks
- Use Zod for runtime validation
- Use ApiError for all errors
- Use asyncHandler in controllers
- Use response helpers for consistent responses
- Log sensitive operations with audit service
- Never log passwords or tokens

### Adding New Modules

1. Create module directory: `src/modules/yourmodule/`
2. Add files:
   - `yourmodule.controller.ts`
   - `yourmodule.routes.ts`
   - `yourmodule.service.ts`
   - `yourmodule.validator.ts`
3. Register routes in `app.ts`
4. Add Prisma schema changes if needed
5. Run migration

### Testing

- Unit tests: `src/**/*.test.ts`
- Integration tests: `tests/integration/`
- Use Jest or Vitest
- Use Supertest for HTTP testing
- Use separate test database

---

*Last Updated: 2026-09-20*
