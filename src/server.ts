import fs from 'fs';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { logger } from './utils/logger';
import { initializeJobs, stopJobs } from './jobs';

const SHUTDOWN_TIMEOUT_MS = 30_000;

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    if (!fs.existsSync(env.UPLOAD_DIR)) {
      fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
      logger.info(`Created uploads directory: ${env.UPLOAD_DIR}`);
    }

    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
      logger.info('Created logs directory');
    }

    if (env.NODE_ENV !== 'test') {
      initializeJobs();
    }

    const server = app.listen(env.PORT, () => {
      logger.info(
        `Server listening on port ${env.PORT} (${env.NODE_ENV}), API at /api/v1, health check at /api/v1/health`
      );
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        stopJobs();
        await disconnectDatabase();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
