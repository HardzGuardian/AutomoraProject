import prisma from '../../config/db';
import { logger } from '../../utils/logger';
import { AuditLogParams } from '../../types';
import { PAGINATION } from '../../config/constants';
import { Prisma } from '@prisma/client';

/**
 * Audit service for logging and querying audit logs.
 * Logs are written within database transactions for consistency.
 */
export class AuditService {
  /**
   * Create an audit log entry within a transaction.
   * Use this method when you need audit logs to be part of a transaction.
   *
   * @param params - Audit log parameters
   * @param tx - Prisma transaction client (optional)
   */
  async log(params: AuditLogParams, tx?: Prisma.TransactionClient): Promise<void> {
    try {
      const client = tx || prisma;
      await client.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          metadata: params.metadata,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      // Don't let audit logging failure break the main flow
      logger.error('Failed to create audit log:', error);
    }
  }

  /**
   * Create an audit log entry outside of a transaction.
   * Use this for standalone operations that don't need transactional guarantees.
   *
   * @param params - Audit log parameters
   */
  async logSimple(params: AuditLogParams): Promise<void> {
    await this.log(params);
  }

  /**
   * List audit logs with pagination and filters.
   *
   * @param query - Query parameters
   * @returns Paginated audit logs
   */
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

    // Build where clause
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

    // Get logs and total count
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

  /**
   * Get audit log by ID.
   *
   * @param id - Audit log ID
   * @returns Audit log with user info
   */
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

  /**
   * Get audit logs for a specific user.
   *
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated audit logs for the user
   */
  async getByUserId(userId: string, page: number = 1, limit: number = 20) {
    return this.list({ page, limit, userId });
  }

  /**
   * Get audit logs for a specific entity.
   *
   * @param entity - Entity type
   * @param entityId - Entity ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated audit logs for the entity
   */
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
