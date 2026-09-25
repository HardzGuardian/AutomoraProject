import { overdueInvoiceJob } from './overdueInvoice.job';
import { Scheduler } from './scheduler';
import { logger } from '../utils/logger';

/**
 * Background job registry.
 *
 * OWNERSHIP / INTEGRATION NOTE
 * ---------------------------
 * This file currently registers Person 4 jobs only. The remaining jobs are
 * owned by other people and are NOT duplicated or forked here:
 *
 *   contractStatusJob    -> Person 2 (src/jobs/contractStatus.job.ts)
 *   renewalReminderJob   -> Person 2 (src/jobs/renewalReminder.job.ts)
 *   slaMonitorJob        -> Person 3 (src/jobs/slaMonitor.job.ts)
 *
 * They do not exist on the Person 4 branch, so registering them here is not
 * possible yet. At integration time all four jobs must be registered together
 * — omitting `contractStatusJob` or `renewalReminderJob` silently disables
 * contract status transitions and renewal reminders with no error, so the
 * merged registry needs an explicit review.
 *
 * `Scheduler` is Person 4 owned: it only depends on the `BackgroundJob`
 * interface, never on another person's job implementation.
 */
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
