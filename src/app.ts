import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';

import { env } from './config/env';
import { generalRateLimit } from './middleware/rateLimit.middleware';
import { notFound } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import auditRoutes from './modules/audit/audit.routes';
import uploadRoutes from './modules/upload/upload.routes';
import invoiceRoutes from './modules/invoice/invoice.routes';
import paymentRoutes from './modules/payment/payment.routes';
import notificationRoutes from './modules/notification/notification.routes';
import reportRoutes from './modules/report/report.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(
  express.json({
    limit: '10mb',
    // Payment gateway webhooks are verified against the exact raw bytes.
    verify: (req, _res, buffer) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

app.use(generalRateLimit);

app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/audit', auditRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/invoices', invoiceRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

app.use('/api/v1', apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
