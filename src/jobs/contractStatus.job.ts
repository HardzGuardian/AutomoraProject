import cron from 'node-cron';
import prisma from '../config/db';
import { DateHelpers } from '../utils/dateHelpers';
import { auditService } from '../modules/audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, CONTRACT_STATUS } from '../config/constants';
import { logger } from '../utils/logger';
import { ContractStatus } from '@prisma/client';

/**
 * Contract Status Background Job
 *
 * Runs daily to update contract statuses based on date ranges:
 * - ACTIVE → EXPIRING_SOON (within 30 days of end)
 * - EXPIRING_SOON → EXPIRED (past end date)
 * - CANCELLED contracts are never modified
 *
 * Uses centralized status calculation for consistency.
 * Idempotent: running twice produces the same result.
 */
export class ContractStatusJob {
  private isRunning = false;

  /**
   * Start the cron job. Runs daily at 1:00 AM UTC.
   */
  start() {
    cron.schedule('0 1 * * *', async () => {
      await this.run();
    });

    logger.info('Contract status job scheduled: daily at 01:00 UTC');
  }

  /**
   * Run the job manually (for testing or initial execution).
   */
  async run(): Promise<{ updated: number; errors: number }> {
    if (this.isRunning) {
      logger.warn('Contract status job already running, skipping');
      return { updated: 0, errors: 0 };
    }

    this.isRunning = true;
    let updated = 0;
    let errors = 0;

    try {
      logger.info('Starting contract status job...');

      const now = new Date();
      const today = DateHelpers.startOfDay(now);
      const expiringSoonThreshold = DateHelpers.addDays(
        today,
        CONTRACT_STATUS.EXPIRING_SOON_DAYS
      );

      // 1. Find ACTIVE contracts that should become EXPIRING_SOON
      const activeToExpiring = await prisma.contract.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          endDate: {
            gte: today,
            lte: expiringSoonThreshold,
          },
        },
      });

      for (const contract of activeToExpiring) {
        try {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { status: 'EXPIRING_SOON' },
          });

          // Audit log
          await auditService.logSimple({
            action: AUDIT_ACTIONS.CONTRACT_STATUS_CHANGED,
            entity: AUDIT_ENTITIES.CONTRACT,
            entityId: contract.id,
            metadata: {
              contractNumber: contract.contractNumber,
              previousStatus: 'ACTIVE',
              newStatus: 'EXPIRING_SOON',
              triggeredBy: 'CONTRACT_STATUS_JOB',
            },
          });

          updated++;
        } catch (error) {
          errors++;
          logger.error(`Failed to update contract ${contract.id}:`, error);
        }
      }

      // 2. Find EXPIRING_SOON contracts that should become EXPIRED
      const expiringToExpired = await prisma.contract.findMany({
        where: {
          deletedAt: null,
          status: 'EXPIRING_SOON',
          endDate: {
            lt: today,
          },
        },
      });

      for (const contract of expiringToExpired) {
        try {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { status: 'EXPIRED' },
          });

          // Audit log
          await auditService.logSimple({
            action: AUDIT_ACTIONS.CONTRACT_STATUS_CHANGED,
            entity: AUDIT_ENTITIES.CONTRACT,
            entityId: contract.id,
            metadata: {
              contractNumber: contract.contractNumber,
              previousStatus: 'EXPIRING_SOON',
              newStatus: 'EXPIRED',
              triggeredBy: 'CONTRACT_STATUS_JOB',
            },
          });

          updated++;
        } catch (error) {
          errors++;
          logger.error(`Failed to update contract ${contract.id}:`, error);
        }
      }

      // 3. Also catch any ACTIVE contracts that are past their end date
      // (edge case: job was down, missed the EXPIRING_SOON window)
      const activeToExpired = await prisma.contract.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          endDate: {
            lt: today,
          },
        },
      });

      for (const contract of activeToExpired) {
        try {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { status: 'EXPIRED' },
          });

          await auditService.logSimple({
            action: AUDIT_ACTIONS.CONTRACT_STATUS_CHANGED,
            entity: AUDIT_ENTITIES.CONTRACT,
            entityId: contract.id,
            metadata: {
              contractNumber: contract.contractNumber,
              previousStatus: 'ACTIVE',
              newStatus: 'EXPIRED',
              triggeredBy: 'CONTRACT_STATUS_JOB',
              note: 'Skipped EXPIRING_SOON state',
            },
          });

          updated++;
        } catch (error) {
          errors++;
          logger.error(`Failed to update contract ${contract.id}:`, error);
        }
      }

      logger.info(
        `Contract status job completed: ${updated} updated, ${errors} errors`
      );
    } catch (error) {
      logger.error('Contract status job failed:', error);
    } finally {
      this.isRunning = false;
    }

    return { updated, errors };
  }
}

export const contractStatusJob = new ContractStatusJob();
