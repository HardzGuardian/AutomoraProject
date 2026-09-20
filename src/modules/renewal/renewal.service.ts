import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { DateHelpers } from '../../utils/dateHelpers';
import { auditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import {
  ListRenewalsQuery,
  UpdateRenewalStatusInput,
  ProcessRenewalInput,
  NotRenewedInput,
  CreateFollowUpInput,
} from './renewal.validator';
import { Prisma, RenewalStatus } from '@prisma/client';

export class RenewalService {
  /**
   * List renewals with pagination and filters.
   */
  async list(query: ListRenewalsQuery) {
    const { page, limit, status, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.RenewalWhereInput = {};

    if (status) {
      where.status = status as any;
    }

    if (search) {
      where.OR = [
        {
          contract: {
            contractNumber: { contains: search, mode: 'insensitive' },
          },
        },
        {
          contract: {
            client: {
              companyName: { contains: search, mode: 'insensitive' },
            },
          },
        },
        { outcomeNotes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [renewals, total] = await Promise.all([
      prisma.renewal.findMany({
        where,
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              status: true,
              endDate: true,
              value: true,
              renewalDate: true,
              client: {
                select: { id: true, companyName: true },
              },
            },
          },
          followUps: {
            orderBy: { createdAt: 'desc' },
            take: 3, // Last 3 follow-ups in list view
          },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.renewal.count({ where }),
    ]);

    return {
      renewals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get renewal by ID.
   */
  async getById(id: string) {
    const renewal = await prisma.renewal.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            client: {
              select: { id: true, companyName: true, email: true, phone: true },
            },
            assets: {
              include: {
                asset: {
                  select: { id: true, serialNumber: true, model: true },
                },
              },
            },
          },
        },
        followUps: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!renewal) {
      throw ApiError.notFound('Renewal not found');
    }

    return renewal;
  }

  /**
   * Update renewal status.
   */
  async updateStatus(id: string, data: UpdateRenewalStatusInput, userId: string) {
    const renewal = await prisma.renewal.findUnique({
      where: { id },
    });

    if (!renewal) {
      throw ApiError.notFound('Renewal not found');
    }

    // Validate state transition
    this.validateStatusTransition(renewal.status, data.status as RenewalStatus);

    const updated = await prisma.renewal.update({
      where: { id },
      data: {
        status: data.status as any,
        outcomeNotes: data.outcomeNotes,
        renewedValue: data.renewedValue,
        lastContactDate: new Date(),
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.RENEWAL_STATUS_CHANGED,
      entity: AUDIT_ENTITIES.RENEWAL,
      entityId: id,
      metadata: {
        contractId: renewal.contractId,
        previousStatus: renewal.status,
        newStatus: data.status,
      },
    });

    return this.getById(id);
  }

  /**
   * Process renewal — mark as RENEWED.
   */
  async processRenewal(id: string, data: ProcessRenewalInput, userId: string) {
    const renewal = await prisma.renewal.findUnique({
      where: { id },
    });

    if (!renewal) {
      throw ApiError.notFound('Renewal not found');
    }

    if (renewal.status === 'RENEWED') {
      throw ApiError.badRequest('Renewal is already marked as renewed');
    }

    if (renewal.status === 'NOT_RENEWED') {
      throw ApiError.badRequest('Cannot renew a contract marked as not renewed');
    }

    const updated = await prisma.renewal.update({
      where: { id },
      data: {
        status: 'RENEWED',
        renewedValue: data.renewedValue,
        outcomeNotes: data.outcomeNotes,
        lastContactDate: new Date(),
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.RENEWAL_OUTCOME,
      entity: AUDIT_ENTITIES.RENEWAL,
      entityId: id,
      metadata: {
        contractId: renewal.contractId,
        outcome: 'RENEWED',
        renewedValue: data.renewedValue,
      },
    });

    return this.getById(id);
  }

  /**
   * Mark renewal as NOT RENEWED.
   */
  async markNotRenewed(id: string, data: NotRenewedInput, userId: string) {
    const renewal = await prisma.renewal.findUnique({
      where: { id },
    });

    if (!renewal) {
      throw ApiError.notFound('Renewal not found');
    }

    if (renewal.status === 'NOT_RENEWED') {
      throw ApiError.badRequest('Renewal is already marked as not renewed');
    }

    if (renewal.status === 'RENEWED') {
      throw ApiError.badRequest('Cannot mark a renewed contract as not renewed');
    }

    const updated = await prisma.renewal.update({
      where: { id },
      data: {
        status: 'NOT_RENEWED',
        outcomeNotes: data.outcomeNotes,
        lastContactDate: new Date(),
      },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.RENEWAL_OUTCOME,
      entity: AUDIT_ENTITIES.RENEWAL,
      entityId: id,
      metadata: {
        contractId: renewal.contractId,
        outcome: 'NOT_RENEWED',
        reason: data.outcomeNotes,
      },
    });

    return this.getById(id);
  }

  // ===========================================
  // FOLLOW-UPS
  // ===========================================

  /**
   * Create a follow-up for a renewal.
   */
  async createFollowUp(
    renewalId: string,
    data: CreateFollowUpInput,
    userId: string
  ) {
    const renewal = await prisma.renewal.findUnique({
      where: { id: renewalId },
    });

    if (!renewal) {
      throw ApiError.notFound('Renewal not found');
    }

    if (renewal.status === 'RENEWED' || renewal.status === 'NOT_RENEWED') {
      throw ApiError.badRequest(
        'Cannot add follow-ups to a completed renewal'
      );
    }

    const followUp = await prisma.renewalFollowUp.create({
      data: {
        renewalId,
        notes: data.notes,
        outcome: data.outcome,
        nextFollowUpDate: data.nextFollowUpDate,
      },
    });

    // Update renewal's last contact date
    await prisma.renewal.update({
      where: { id: renewalId },
      data: { lastContactDate: new Date() },
    });

    // Audit log
    await auditService.logSimple({
      userId,
      action: AUDIT_ACTIONS.RENEWAL_FOLLOW_UP,
      entity: AUDIT_ENTITIES.RENEWAL_FOLLOW_UP,
      entityId: followUp.id,
      metadata: {
        renewalId,
        contractId: renewal.contractId,
        outcome: data.outcome,
      },
    });

    return followUp;
  }

  /**
   * List follow-ups for a renewal.
   */
  async listFollowUps(renewalId: string) {
    const renewal = await prisma.renewal.findUnique({
      where: { id: renewalId },
    });

    if (!renewal) {
      throw ApiError.notFound('Renewal not found');
    }

    return prisma.renewalFollowUp.findMany({
      where: { renewalId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ===========================================
  // HELPER METHODS
  // ===========================================

  /**
   * Validate renewal status transition.
   */
  private validateStatusTransition(
    current: RenewalStatus,
    next: RenewalStatus
  ): void {
    const validTransitions: Record<RenewalStatus, RenewalStatus[]> = {
      PENDING: ['IN_DISCUSSION', 'RENEWED', 'NOT_RENEWED'],
      IN_DISCUSSION: ['PENDING', 'RENEWED', 'NOT_RENEWED'],
      RENEWED: [], // Terminal state
      NOT_RENEWED: ['PENDING', 'IN_DISCUSSION'], // Can reopen if needed
    };

    if (!validTransitions[current].includes(next)) {
      throw ApiError.badRequest(
        `Cannot transition renewal from ${current} to ${next}`
      );
    }
  }
}

export const renewalService = new RenewalService();
