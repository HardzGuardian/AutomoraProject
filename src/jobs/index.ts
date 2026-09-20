import { contractStatusJob } from './contractStatus.job';
import { renewalReminderJob } from './renewalReminder.job';
import { logger } from '../utils/logger';

/**
 * Initialize all background jobs.
 * Called from server.ts on startup.
 */
export function initializeJobs(): void {
  try {
    logger.info('Initializing background jobs...');

    // Contract status job — runs daily at 1:00 AM UTC
    contractStatusJob.start();

    // Renewal reminder job — runs daily at 8:00 AM UTC
    renewalReminderJob.start();

    logger.info('All background jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize background jobs:', error);
    // Don't crash the server — jobs are non-critical
  }
}

export { contractStatusJob, renewalReminderJob };
