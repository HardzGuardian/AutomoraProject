import cron from 'node-cron';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/ApiError';
import {
  slaService,
  type EscalatedTicket,
} from '../modules/sla/sla.service';

export type { EscalatedTicket };

export interface SlaBreachNotification {
  ticketId: string;
  assignedTechnicianId: string;
  resolutionDeadline: Date;
  escalatedAt: Date;
}

export interface SlaNotificationGateway {
  send(notification: SlaBreachNotification): Promise<void>;
}

export interface SlaMonitorResult {
  escalated: number;
  notificationsSent: number;
  errors: number;
}

export interface SlaEscalationService {
  escalateBreachedTickets(now?: Date): Promise<EscalatedTicket[]>;
}

export class SlaMonitorJob {
  private isRunning = false;
  private isScheduled = false;

  constructor(
    private readonly slaService: SlaEscalationService,
    private readonly notificationService: SlaNotificationGateway,
    private readonly now: () => Date = () => new Date(),
    private readonly cronExpression: string = '0 * * * *'
  ) {}

  /**
   * Schedule the monitor using the project's node-cron architecture.
   * The default runs hourly at minute zero.
   */
  start(): void {
    if (this.isScheduled) {
      logger.warn('SLA monitor job is already scheduled');
      return;
    }

    cron.schedule(this.cronExpression, async () => {
      await this.run();
    });
    this.isScheduled = true;
    logger.info(`SLA monitor job scheduled: ${this.cronExpression}`);
  }

  async run(): Promise<SlaMonitorResult> {
    if (this.isRunning) {
      logger.warn('SLA monitor job already running, skipping');
      return { escalated: 0, notificationsSent: 0, errors: 0 };
    }

    this.isRunning = true;
    let escalatedCount = 0;
    let notificationsSent = 0;
    let errors = 0;

    try {
      const escalated = await this.slaService.escalateBreachedTickets(this.now());
      escalatedCount = escalated.length;

      for (const item of escalated) {
        try {
          await this.notificationService.send({
            ticketId: item.ticket.id,
            assignedTechnicianId: item.ticket.assignedTechnicianId,
            resolutionDeadline: item.resolutionDeadline,
            escalatedAt: item.escalatedAt,
          });
          notificationsSent++;
        } catch (error) {
          errors++;
          logger.error(
            `Failed to send SLA breach notification for ticket ${item.ticket.id}:`,
            error
          );
        }
      }

      logger.info(
        `SLA monitor job completed: ${escalatedCount} escalated, ${notificationsSent} notifications sent, ${errors} errors`
      );
    } catch (error) {
      errors++;
      logger.error('SLA monitor job failed:', error);
    } finally {
      this.isRunning = false;
    }

    return { escalated: escalatedCount, notificationsSent, errors };
  }
}

/**
 * Person 4 integration stub. No notification provider is implemented here.
 */
class PendingSlaNotificationGateway implements SlaNotificationGateway {
  async send(): Promise<void> {
    throw ApiError.internal(
      'DEPENDENCY — waiting for Person 4: notificationService.send is not available'
    );
  }
}

export const slaMonitorJob = new SlaMonitorJob(
  // The production SLA service remains blocked until Person 1 supplies the
  // ticket SLA persistence adapter.
  slaService,
  new PendingSlaNotificationGateway()
);
