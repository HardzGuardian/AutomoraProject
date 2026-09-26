import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid PostgreSQL connection string' }),

  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters' }),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' }),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(10485760), // 10MB

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_TIME_MS: z.coerce.number().int().positive().default(900000), // 15 minutes

  // Third-party integrations are optional; unconfigured providers fall back to no-op behaviour.
  NOTIFICATION_FROM_EMAIL: z.string().email().optional(),
  NOTIFICATION_FROM_PHONE: z.string().optional(),
  PAYMENT_GATEWAY_NAME: z.string().default('unconfigured'),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().optional(),
  ACCOUNTING_PROVIDER_NAME: z.string().default('unconfigured'),
  ACCOUNTING_API_URL: z.string().url().optional(),
  ACCOUNTING_API_KEY: z.string().optional(),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  // The logger depends on this module, so console is the only safe output here.
  console.error('Environment validation failed:');
  console.error(parseResult.error.format());
  process.exit(1);
}

export const env = parseResult.data;

export type Env = z.infer<typeof envSchema>;
