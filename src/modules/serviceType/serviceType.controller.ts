import { Request, Response, NextFunction } from 'express';
import { serviceTypeService } from './serviceType.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import {
  CreateServiceTypeInput,
  UpdateServiceTypeInput,
  ListServiceTypesQuery,
} from './serviceType.validator';

export class ServiceTypeController {
  /**
   * POST /service-types
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateServiceTypeInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const serviceType = await serviceTypeService.create(data, userId);
      ResponseHelper.success(res, serviceType, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /service-types
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListServiceTypesQuery;
      const result = await serviceTypeService.list(query);
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /service-types/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const serviceType = await serviceTypeService.getById(id);
      ResponseHelper.success(res, serviceType);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /service-types/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateServiceTypeInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const serviceType = await serviceTypeService.update(id, data, userId);
      ResponseHelper.success(res, serviceType);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /service-types/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      await serviceTypeService.delete(id, userId);
      ResponseHelper.message(res, 'Service type deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const serviceTypeController = new ServiceTypeController();
