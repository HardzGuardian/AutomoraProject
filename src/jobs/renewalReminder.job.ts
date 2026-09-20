import cron from 'node-cron';
import prisma from '../config/db';
import { DateHelpers } from '../utils/dateHelpers';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, REMINDER_TYPES } from '../config/constants';
import { logger } from '../utils/logger';

// ===========================================
// STUBBED: Person 4's notification service
// ===========================================
// When Person 4 implements notifications, replace this stub
// with the actual service import.
interface NotificationService {
  sendRenewalReminder(params: {
    contractId: string;
    contractNumber: string;
    clientName: string;
    clientEmail: string;
    endDate: Date;
    reminderType: string;
    daysUntilExpiry: number;
  }): Promise<void>;
}

// Stub implementation — replace with real notification service
const notificationService: NotificationService = {
  async sendRenewalReminder(params) {
    logger.info('STUB: Would send renewal reminder', {
      contractNumber: params.contractNumber,
      clientName: params.clientName,
      reminderType: params.reminderType,
      daysUntilExpiry: params.daysUntilExpiry,
    });
    // When real service is available:
    // await notificationService.sendRenewalReminder(params);
  },
};

/**
 * Renewal Reminder Background Job
 *
 * Runs daily to identify contracts expiring in 30, 60, or 90 days
 * and create/send renewal reminders.
 *
 * De-duplication: Uses ReminderLog to prevent sending the same
 * reminder type for the same contract twice.
 *
 * Idempotent: running twice produces the same result.
 */
export class RenewalReminderJob {
  private isRunning = false;

  /**
   * Start the cron job. Runs daily at 8:00 AM UTC.
   */
  start() {
    cron.schedule('0 8 * * *', async () => {
      await this.run();
    });

    logger.info('Renewal reminder job scheduled: daily at 08:00 UTC');
  }

  /**
   * Run the job manually.
   */
  async run(): Promise<{ sent: number; skipped: number; errors: number }> {
    if (this.isRunning) {
      logger.warn('Renewal reminder job already running, skipping');
      return { sent: 0, skipped: 0, errors: 0 };
    }

    this.isRunning = true;
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
      logger.info('Starting renewal reminder job...');

      const reminderConfigs = [
        { days: 90, type: REMINDER_TYPES.NINETY_DAY },
        { days: 60, type: REMINDER_TYPES.SIXTY_DAY },
        { days: 30, type: REMINDER_TYPES.THIRTY_DAY },
      ];

      for (const config of reminderConfigs) {
        const result = await this.processReminders(config.days, config.type);
        sent += result.sent;
        skipped += result.skipped;
        errors += result.errors;
      }

      logger.info(
        `Renewal reminder job completed: ${sent} sent, ${skipped} skipped, ${errors} errors`
      );
    } catch (error) {
      logger.error('Renewal reminder job failed:', error);
    } finally {
      this.isRunning = false;
    }

    return { sent, skipped, errors };
  }

  /**
   * Process reminders for a specific day threshold.
   */
  private async processReminders(
    days: number,
    reminderType: string
  ): Promise<{ sent: number; skipped: number; errors: number }> {
    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const targetDate = DateHelpers.addDays(new Date(), days);
    const today = DateHelpers.startOfDay(new Date());

    // Find contracts expiring exactly in N days (within a 1-day window)
    const contracts = await prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
        endDate: {
          gte: today,
          lte: targetDate,
        },
      },
      include: {
        client: {
          select: { id: true, companyName: true, email: true },
        },
        renewal: true,
      },
    });

    for (const contract of contracts) {
      try {
        // De-duplication: Check if reminder already sent
        const existingReminder = await prisma.reminderLog.findUnique({
          where: {
            contractId_reminderType: {
              contractId: contract.id,
              reminderType,
            },
          },
        });

        if (existingReminder) {
          skipped++;
          continue;
        }

        // Calculate days until expiry
        const daysUntilExpiry = DateHelpers.differenceInDays(
          new Date(),
          contract.endDate
        );

        // Send notification (stubbed — will use Person 4's service)
        await notificationService.sendRenewalReminder({
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          clientName: contract.client.companyName,
          clientEmail: contract.client.email || '',
          endDate: contract.endDate,
          reminderType,
          daysUntilExpiry,
        });

        // Log the reminder to prevent duplicates
        await prisma.reminderLog.create({
          data: {
            contractId: contract.id,
            reminderType,
          },
        });

        sent++;
      } catch (error) {
        errors++;
        logger.error(
          `Failed to send reminder for contract ${contract.id}:`,
          error
        );
      }
    }

    return { sent, skipped, errors };
  }
}

export const renewalReminderJob = new RenewalReminderJob();
