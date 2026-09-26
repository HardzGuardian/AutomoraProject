import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { HashUtils } from '../../utils/hash';
import { logger } from '../../utils/logger';
import { PAGINATION, AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import {
  CreateUserInput,
  UpdateUserInput,
  UpdateProfileInput,
  ChangeRoleInput,
  ListUsersQuery,
} from './user.validator';
import { Prisma, UserRole } from '@prisma/client';

export class UserService {
  async list(query: ListUsersQuery) {
    const { page, limit, role, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }

  async create(data: CreateUserInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw ApiError.conflict('Email already registered');
    }

    const hashedPassword = await HashUtils.hash(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as UserRole,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.USER_CREATED,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return user;
  }

  async update(id: string, data: UpdateUserInput) {
    const existingUser = await prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw ApiError.notFound('User not found');
    }

    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw ApiError.conflict('Email already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        avatar: true,
        updatedAt: true,
      },
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.USER_UPDATED,
      entity: AUDIT_ENTITIES.USER,
      entityId: id,
      metadata: { changes: data },
    });

    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /** Soft delete: the row is kept, marked inactive, and all sessions are revoked. */
  async deactivate(id: string) {
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user.id === id) {
      throw ApiError.badRequest('Cannot deactivate your own account');
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await prisma.refreshToken.updateMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.USER_DEACTIVATED,
      entity: AUDIT_ENTITIES.USER,
      entityId: id,
      metadata: { email: user.email },
    });
  }

  async activate(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.USER_ACTIVATED,
      entity: AUDIT_ENTITIES.USER,
      entityId: id,
      metadata: { email: user.email },
    });
  }

  async changeRole(id: string, data: ChangeRoleInput, currentUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (id === currentUserId) {
      throw ApiError.badRequest('Cannot change your own role');
    }

    await prisma.user.update({
      where: { id },
      data: { role: data.role },
    });

    await this.logAudit({
      userId: currentUserId,
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      entity: AUDIT_ENTITIES.USER,
      entityId: id,
      metadata: {
        oldRole: user.role,
        newRole: data.role,
        changedBy: currentUserId,
      },
    });
  }

  private async logAudit(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          metadata: params.metadata,
        },
      });
    } catch (error) {
      // Audit logging must never break the request it is recording.
      logger.error('Failed to create audit log:', error);
    }
  }
}

export const userService = new UserService();
