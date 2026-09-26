import prisma from '../../config/db';
import { logger } from '../../utils/logger';
import { AuditLogParams } from '../../types';
import { PAGINATION } from '../../config/constants';
import { Prisma } from '@prisma/client';

export class AuditService {
  /** Pass `tx` to write the entry inside the caller's transaction. */
  async log(params: AuditLogParams, tx?: Prisma.TransactionClient): Promise<void> {
    try {
      const client = tx || prisma;
      await client.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          metadata: params.metadata as Prisma.InputJsonValue | undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // Audit logging must never break the request it is recording.
      logger.error('Failed to create audit log:', error);
    }
  }

  async logSimple(params: AuditLogParams): Promise<void> {
    await this.log(params);
  }

  async list(query: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const {
      page = PAGINATION.DEFAULT_PAGE,
      limit = PAGINATION.DEFAULT_LIMIT,
      action,
      entity,
      userId,
      startDate,
      endDate,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.action = action;
    }

    if (entity) {
      where.entity = entity;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const log = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!log) {
      return null;
    }

    return log;
  }

  async getByUserId(userId: string, page: number = 1, limit: number = 20) {
    return this.list({ page, limit, userId });
  }

  async getByEntity(entity: string, entityId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entity,
          entityId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({
        where: {
          entity,
          entityId,
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const auditService = new AuditService();
