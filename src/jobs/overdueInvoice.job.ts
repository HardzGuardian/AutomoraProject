import cron from 'node-cron';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../config/constants';
import { logger } from '../utils/logger';
import { auditService } from '../modules/audit/audit.service';
import { invoiceService } from '../modules/invoice/invoice.service';
import { notificationService } from '../modules/notification/notification.service';

export class OverdueInvoiceJob {
  private isRunning = false;

  start(): void {
    cron.schedule('0 9 * * *', async () => {
      await this.run();
    });
    logger.info('Overdue invoice job scheduled: daily at 09:00 UTC');
  }

  async run(): Promise<{ marked: number; reminders: number; skipped: number; errors: number }> {
    if (this.isRunning) {
      logger.warn('Overdue invoice job already running, skipping');
      return { marked: 0, reminders: 0, skipped: 0, errors: 0 };
    }

    this.isRunning = true;
    let marked = 0;
    let reminders = 0;
    let skipped = 0;
    let errors = 0;
    try {
      const invoices = await invoiceService.listOverdueCandidates();

      for (const invoice of invoices) {
        try {
          await invoiceService.markOverdue(invoice.id);
          marked++;
          const result = await notificationService.sendPaymentReminder({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.clientName,
            email: invoice.email,
            phone: invoice.phone,
            amount: invoice.balanceAmount.toString(),
            dueDate: invoice.dueDate,
            eventKey: `invoice-overdue:${invoice.id}`,
          });
          reminders += result.sent;
          skipped += result.skipped;
          errors += result.failed;
        } catch (error) {
          errors++;
          logger.error(`Failed to process overdue invoice ${invoice.id}`, error);
        }
      }

      await auditService.logSimple({
        action: AUDIT_ACTIONS.JOB_EXECUTED,
        entity: AUDIT_ENTITIES.INVOICE,
        metadata: { job: 'OVERDUE_INVOICE', marked, reminders, skipped, errors },
      });
    } catch (error) {
      errors++;
      logger.error('Overdue invoice job failed', error);
    } finally {
      this.isRunning = false;
    }

    return { marked, reminders, skipped, errors };
  }
}

export const overdueInvoiceJob = new OverdueInvoiceJob();