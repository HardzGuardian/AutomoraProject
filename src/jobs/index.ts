import { overdueInvoiceJob } from './overdueInvoice.job';
import { Scheduler } from './scheduler';
import { logger } from '../utils/logger';

// When the contract, renewal and SLA modules are merged in, their jobs
// (contractStatusJob, renewalReminderJob, slaMonitorJob) must be added here.
// A missing job fails silently: contracts stop changing status and renewal
// reminders stop going out, with no error logged.
const scheduler = new Scheduler([overdueInvoiceJob]);

export function initializeJobs(): void {
  try {
    logger.info('Initializing background jobs...');
    scheduler.start();
    logger.info('All background jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize background jobs', error);
  }
}

export function stopJobs(): void {
  scheduler.stop();
}

export { overdueInvoiceJob, scheduler };
