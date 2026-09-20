import { Request, Response, NextFunction } from 'express';
import { userService } from './user.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import {
  CreateUserInput,
  UpdateUserInput,
  UpdateProfileInput,
  ChangeRoleInput,
  ListUsersQuery,
} from './user.validator';

export class UserController {
  /**
   * GET /users
   * List all users (admin/manager)
   */
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListUsersQuery;
      const result = await userService.list(query);
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/:id
   * Get user by ID (admin)
   */
  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const user = await userService.getById(id);
      ResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /users/me
   * Get own profile
   */
  async getMe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw ApiError.unauthorized('Authentication required');
      }
      const user = await userService.getById(userId);
      ResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /users
   * Create new user (admin)
   */
  async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body as CreateUserInput;
      const user = await userService.create(data);
      ResponseHelper.success(res, user, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/:id
   * Update user (admin)
   */
  async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateUserInput;
      const user = await userService.update(id, data);
      ResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/me
   * Update own profile
   */
  async updateProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw ApiError.unauthorized('Authentication required');
      }
      const data = req.body as UpdateProfileInput;
      const user = await userService.updateProfile(userId, data);
      ResponseHelper.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/:id/deactivate
   * Deactivate user (admin)
   */
  async deactivate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      await userService.deactivate(id);
      ResponseHelper.message(res, 'User deactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/:id/activate
   * Activate user (admin)
   */
  async activate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      await userService.activate(id);
      ResponseHelper.message(res, 'User activated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /users/:id/role
   * Change user role (admin)
   */
  async changeRole(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as ChangeRoleInput;
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        throw ApiError.unauthorized('Authentication required');
      }
      await userService.changeRole(id, data, currentUserId);
      ResponseHelper.message(res, 'Role changed successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
