import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import { logger } from './utils/logger';
import { initializeJobs, stopJobs } from './jobs';

// ===========================================
// SERVER STARTUP
// ===========================================

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Create uploads directory if it doesn't exist
    const fs = require('fs');
    if (!fs.existsSync(env.UPLOAD_DIR)) {
      fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
      logger.info(`Created uploads directory: ${env.UPLOAD_DIR}`);
    }

    // Create logs directory if it doesn't exist
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
      logger.info('Created logs directory');
    }

    // Start background jobs outside the test environment.
    if (env.NODE_ENV !== 'test') {
      initializeJobs();
    }
    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`
========================================
  🚀 Automora Backend Server Started
========================================
  Environment: ${env.NODE_ENV}
  Port:        ${env.PORT}
  API:         http://localhost:${env.PORT}/api/v1
  Health:      http://localhost:${env.PORT}/api/v1/health
========================================
      `);
    });

    // ===========================================
    // GRACEFUL SHUTDOWN
    // ===========================================

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        stopJobs();
        // Disconnect from database
        await disconnectDatabase();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled errors
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

// Start the server
startServer();
