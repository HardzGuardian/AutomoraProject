import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { HashUtils } from '../../utils/hash';
import { JwtUtils } from '../../utils/jwt';
import { DateHelpers } from '../../utils/dateHelpers';
import { logger } from '../../utils/logger';
import { RegisterInput, LoginInput, ChangePasswordInput } from './auth.validator';
import { TokenPair, UserPayload } from '../../types';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { env } from '../../config/env';

export class AuthService {
  /**
   * Register a new user.
   */
  async register(data: RegisterInput) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw ApiError.conflict('Email already registered');
    }

    // Hash password
    const hashedPassword = await HashUtils.hash(data.password);

    // Create user
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

    // Log audit
    await this.logAudit({
      action: AUDIT_ACTIONS.USER_CREATED,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.id,
      metadata: { email: user.email },
    });

    return user;
  }

  /**
   * Login user and return tokens.
   */
  async login(data: LoginInput, ipAddress?: string, userAgent?: string) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      // Log failed attempt
      await this.logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entity: AUDIT_ENTITIES.USER,
        metadata: { email: data.email, reason: 'User not found' },
        ipAddress,
        userAgent,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if user is active
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

    // Verify password
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

    // Generate tokens
    const tokenPayload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = JwtUtils.generateTokenPair(tokenPayload);

    // Store refresh token in database
    const decodedRefreshToken = JwtUtils.decode(tokens.refreshToken);
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: DateHelpers.addDays(new Date(), 7),
      },
    });

    // Log successful login
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

  /**
   * Refresh access token using refresh token.
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const decoded = JwtUtils.verifyRefreshToken(refreshToken);

    // Find refresh token in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      // Token reuse detected - revoke all user tokens
      await this.revokeAllUserTokens(storedToken.userId);
      throw ApiError.unauthorized('Token revoked - all sessions invalidated');
    }

    // Check if token is expired
    if (DateHelpers.isExpired(storedToken.expiresAt)) {
      throw ApiError.unauthorized('Refresh token expired');
    }

    // Check if user is still active
    if (!storedToken.user.isActive) {
      throw ApiError.unauthorized('Account is deactivated');
    }

    // Generate new tokens
    const tokenPayload: UserPayload = {
      id: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };

    const newTokens = JwtUtils.generateTokenPair(tokenPayload);

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Store new refresh token
    const decodedNewRefreshToken = JwtUtils.decode(newTokens.refreshToken);
    await prisma.refreshToken.create({
      data: {
        token: newTokens.refreshToken,
        userId: storedToken.userId,
        expiresAt: DateHelpers.addDays(new Date(), 7),
      },
    });

    return newTokens;
  }

  /**
   * Logout user by revoking refresh token.
   */
  async logout(refreshToken: string, userId?: string): Promise<void> {
    // Find and revoke the refresh token
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      // Log logout
      await this.logAudit({
        userId: storedToken.userId,
        action: AUDIT_ACTIONS.LOGOUT,
        entity: AUDIT_ENTITIES.USER,
        entityId: storedToken.userId,
      });
    }
  }

  /**
   * Get current user profile.
   */
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

  /**
   * Change user password.
   */
  async changePassword(
    userId: string,
    data: ChangePasswordInput
  ): Promise<void> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Verify current password
    const isPasswordValid = await HashUtils.compare(
      data.currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await HashUtils.hash(data.newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all existing refresh tokens (force re-login on other devices)
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Log password change
    await this.logAudit({
      userId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      entity: AUDIT_ENTITIES.USER,
      entityId: userId,
    });
  }

  /**
   * Revoke all user tokens (for security incidents).
   */
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

  /**
   * Log audit event.
   */
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
}

export const authService = new AuthService();
