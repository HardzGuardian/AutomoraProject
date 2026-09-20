import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ChangePasswordInput,
} from './auth.validator';

export class AuthController {
  /**
   * POST /auth/register
   */
  async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body as RegisterInput;
      const user = await authService.register(data);
      ResponseHelper.success(res, user, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/login
   */
  async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body as LoginInput;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];
      const tokens = await authService.login(data, ipAddress, userAgent);
      ResponseHelper.success(res, tokens);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/refresh
   */
  async refresh(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      const tokens = await authService.refreshToken(refreshToken);
      ResponseHelper.success(res, tokens);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /auth/logout
   */
  async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      await authService.logout(refreshToken, req.user?.id);
      ResponseHelper.message(res, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/me
   */
  async me(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw ApiError.unauthorized('Authentication required');
      }
      const user = await authService.getMe(userId);
      ResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /auth/change-password
   */
  async changePassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw ApiError.unauthorized('Authentication required');
      }
      const data = req.body as ChangePasswordInput;
      await authService.changePassword(userId, data);
      ResponseHelper.message(res, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
