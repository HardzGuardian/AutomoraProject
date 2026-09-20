import { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';

export class AuditController {
  /**
   * GET /audit
   * List audit logs with pagination and filters
   */
  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        entity,
        userId,
        startDate,
        endDate,
      } = req.query;

      const result = await auditService.list({
        page: Number(page),
        limit: Number(limit),
        action: action as string,
        entity: entity as string,
        userId: userId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /audit/:id
   * Get audit log by ID
   */
  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const log = await auditService.getById(id);

      if (!log) {
        throw ApiError.notFound('Audit log not found');
      }

      ResponseHelper.success(res, log);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /audit/user/:userId
   * Get audit logs for a specific user
   */
  async getByUserId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await auditService.getByUserId(
        userId,
        Number(page),
        Number(limit)
      );

      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /audit/entity/:entity/:entityId
   * Get audit logs for a specific entity
   */
  async getByEntity(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { entity, entityId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await auditService.getByEntity(
        entity,
        entityId,
        Number(page),
        Number(limit)
      );

      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
