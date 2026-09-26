import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { HashUtils } from '../../utils/hash';
import { JwtUtils } from '../../utils/jwt';
import { DateHelpers } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';
import { RegisterInput, LoginInput, ChangePasswordInput } from './auth.validator';
import { JwtPayload, TokenPair } from '../../types';
import { Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { env } from '../../config/env';

export class AuthService {
  async register(data: RegisterInput) {
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
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    await this.logAudit({
      action: AUDIT_ACTIONS.USER_CREATED,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.id,
      metadata: { email: user.email },
    });

    return user;
  }

  async login(data: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      await this.logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entity: AUDIT_ENTITIES.USER,
        metadata: { email: data.email, reason: 'User not found' },
        ipAddress,
        userAgent,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      await this.logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entity: AUDIT_ENTITIES.USER,
        entityId: user.id,
        metadata: { reason: 'Account deactivated' },
        ipAddress,
        userAgent,
      });
      throw ApiError.unauthorized('Account is deactivated');
    }

    const isPasswordValid = await HashUtils.compare(data.password, user.password);
    if (!isPasswordValid) {
      await this.logAudit({
        userId: user.id,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entity: AUDIT_ENTITIES.USER,
        entityId: user.id,
        metadata: { reason: 'Invalid password' },
        ipAddress,
        userAgent,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokenPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = JwtUtils.generateTokenPair(tokenPayload);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: DateHelpers.addDays(new Date(), 7),
      },
    });

    await this.logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGIN,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return tokens;
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    JwtUtils.verifyRefreshToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // A revoked token being presented again means it was likely stolen,
    // so every session for this user is invalidated.
    if (storedToken.revokedAt) {
      await this.revokeAllUserTokens(storedToken.userId);
      throw ApiError.unauthorized('Token revoked - all sessions invalidated');
    }

    if (DateHelpers.isExpired(storedToken.expiresAt)) {
      throw ApiError.unauthorized('Refresh token expired');
    }

    if (!storedToken.user.isActive) {
      throw ApiError.unauthorized('Account is deactivated');
    }

    const tokenPayload: JwtPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };

    const newTokens = JwtUtils.generateTokenPair(tokenPayload);

    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    await prisma.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        userId: storedToken.userId,
        expiresAt: DateHelpers.addDays(new Date(), 7),
      },
    });

    return newTokens;
  }

  async logout(refreshToken: string, userId?: string): Promise<void> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      await this.logAudit({
        userId: storedToken.userId,
        action: AUDIT_ACTIONS.LOGOUT,
        entity: AUDIT_ENTITIES.USER,
        entityId: storedToken.userId,
      });
    }
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

  async changePassword(
    userId: string,
    data: ChangePasswordInput
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isPasswordValid = await HashUtils.compare(
      data.currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    const hashedPassword = await HashUtils.hash(data.newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Sign the user out on every other device.
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.logAudit({
      userId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      entity: AUDIT_ENTITIES.USER,
      entityId: userId,
    });
  }

  private async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    logger.warn(`All tokens revoked for user: ${userId}`);
  }

  private async logAudit(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
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
}

export const authService = new AuthService();
