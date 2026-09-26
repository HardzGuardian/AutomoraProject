# Automora Backend

A production-ready RESTful API backend built with Node.js, TypeScript, Express.js, PostgreSQL, and Prisma ORM.

## 🚀 Features

- **Authentication & Authorization** - JWT-based auth with refresh token rotation
- **User Management** - Full CRUD with role-based access control
- **Audit Logging** - Comprehensive audit trail for all actions
- **File Uploads** - Secure file upload with validation
- **Rate Limiting** - Protection against abuse
- **Error Handling** - Centralized error management
- **Docker Support** - Containerized deployment

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd automora-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with your database credentials and other settings.

### 4. Start database

Using Docker:
```bash
docker-compose up -d postgres
```

Or use a local PostgreSQL instance.

### 5. Run migrations

```bash
npx prisma migrate dev
```

### 6. Seed database

```bash
npm run seed
```

### 7. Start development server

```bash
npm run dev
```

## 🐳 Docker

### Development

```bash
docker-compose up
```

### Production

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📚 API Documentation

### Base URL

```
Development: http://localhost:3000/api/v1
```

### Authentication Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /auth/register | Register new user | Public |
| POST | /auth/login | Login user | Public |
| POST | /auth/refresh | Refresh access token | Public |
| POST | /auth/logout | Logout user | Private |
| GET | /auth/me | Get current user | Private |
| PATCH | /auth/change-password | Change password | Private |

### User Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /users | List users | Admin, Manager |
| GET | /users/:id | Get user by ID | Admin |
| POST | /users | Create user | Admin |
| PATCH | /users/:id | Update user | Admin |
| PATCH | /users/:id/deactivate | Deactivate user | Admin |
| PATCH | /users/:id/activate | Activate user | Admin |
| PATCH | /users/:id/role | Change user role | Admin |
| GET | /users/me/profile | Get own profile | Private |
| PATCH | /users/me/profile | Update own profile | Private |

### Audit Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /audit | List audit logs | Admin, Manager |
| GET | /audit/:id | Get audit log | Admin, Manager |
| GET | /audit/user/:userId | Get user audit logs | Admin, Manager |

### Upload Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /uploads | Upload file | Private |
| GET | /uploads/:id | Get file metadata | Private |
| GET | /uploads/:id/download | Download file | Private |
| DELETE | /uploads/:id | Delete file | Private |
| GET | /uploads/user/:userId | List user files | Private |

### Health Check

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /health | Health check | Public |

## 🔐 Authentication

### Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@automora.com",
  "password": "Admin123!"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Using Access Token

Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## 👥 Default Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@automora.com | Admin123! |
| Manager | manager@automora.com | Manager123! |
| Technician | tech@automora.com | Tech123! |
| Customer | customer@automora.com | Customer123! |

## 📁 Project Structure

```
automora-backend/
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Database migrations
│   └── seed.ts              # Database seed
├── src/
│   ├── config/              # Configuration files
│   │   ├── db.ts            # Database connection
│   │   ├── env.ts           # Environment variables
│   │   ├── constants.ts     # Application constants
│   │   └── storage.ts       # Storage configuration
│   ├── types/               # TypeScript types
│   │   ├── index.ts         # Type definitions
│   │   └── express.d.ts     # Express type extensions
│   ├── utils/               # Utility functions
│   │   ├── ApiError.ts      # Custom error class
│   │   ├── asyncHandler.ts  # Async error handler
│   │   ├── response.ts      # Response helper
│   │   ├── jwt.ts           # JWT utilities
│   │   ├── hash.ts          # Password hashing
│   │   ├── logger.ts        # Winston logger
│   │   └── dateHelpers.ts   # Date utilities
│   ├── middleware/           # Express middleware
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   ├── validate.middleware.ts
│   │   ├── upload.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   ├── notFound.middleware.ts
│   │   └── error.middleware.ts
│   ├── jobs/                # Scheduled jobs
│   │   ├── scheduler.ts     # Cron scheduler bootstrap
│   │   └── overdueInvoice.job.ts
│   ├── modules/             # Feature modules
│   │   ├── auth/            # Authentication
│   │   ├── user/            # User management
│   │   ├── audit/           # Audit logging
│   │   ├── upload/          # File uploads
│   │   ├── invoice/         # Invoicing
│   │   ├── payment/         # Payments
│   │   ├── notification/    # Notifications
│   │   ├── report/          # Reporting
│   │   ├── dashboard/       # Dashboard aggregation
│   │   ├── export/          # Excel and PDF exporters
│   │   └── integrations/    # Cross-module ports and providers
│   ├── app.ts               # Express app setup
│   └── server.ts            # Server startup
├── tests/                   # Repository-level tests
│   └── architecture.test.ts # Architecture guard
├── uploads/                 # Uploaded files
├── logs/                    # Application logs
├── .env.example             # Environment template
├── docker-compose.yml       # Docker compose
├── Dockerfile               # Docker build
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── README.md                # Documentation
```

### Architecture

The backend uses a **feature-first layout**. Application layers are organised
*inside* each feature module under `src/modules/<feature>/`, not in separate
top-level layer folders:

```
src/modules/<feature>/
├── <feature>.routes.ts      # Express router
├── <feature>.controller.ts  # Request handling
├── <feature>.service.ts     # Business logic and persistence
├── <feature>.validator.ts   # Zod request validation
├── <feature>.types.ts       # Feature-specific types
├── <feature>.utils.ts       # Feature-specific helpers
└── <feature>.*.test.ts      # Co-located unit tests
```

Each feature module contains only the layers it actually needs. Shared,
cross-cutting concerns are the only code hoisted out of the feature modules:

| Concern | Location |
|---------|----------|
| Shared configuration | `src/config/` |
| Shared middleware | `src/middleware/` |
| Shared type definitions | `src/types/` |
| Shared utility functions | `src/utils/` |
| Scheduled jobs | `src/jobs/` |
| Database schema, migrations and seed | `prisma/` |

Notification providers stay with their feature in
`src/modules/notification/providers/`. The Excel and PDF exporters stay in
`src/modules/export/`, and the ports and providers used to read other people's
tables stay in `src/modules/integrations/<concern>/` (`client/`, `contract/`,
`technician/`, `accounting/`, `payment-gateway/`, `sla/`). These modules hold no
router or controller of their own — `export/` and `integrations/` are consumed
by the feature modules that need them.

Tests follow the existing project convention: unit tests are co-located beside
the code they cover (`src/**/*.test.ts`), while repository-level tests such as
the architecture guard live in `tests/`.

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run seed` | Seed database |
| `npm test` | Run tests |
| `npm run lint` | Run linter |
| `npm run lint:fix` | Fix linting issues |

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options.

### Key Configuration

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)

## 🛡️ Security

- JWT-based authentication with refresh token rotation
- Password hashing with bcrypt (12 rounds)
- Rate limiting on all endpoints
- CORS configuration
- Helmet security headers
- Input validation with Zod
- SQL injection protection (Prisma)
- File upload validation

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support, email support@automora.com or open an issue on GitHub.
