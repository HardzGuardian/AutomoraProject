import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ResponseHelper } from '../../utils/response';
import { dashboardService } from './dashboard.service';
import { DashboardActor } from './dashboard.types';

export class DashboardController {
  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw ApiError.unauthorized('Authentication required');
      const actor = req.user as DashboardActor;
      ResponseHelper.success(res, await dashboardService.getSummary(actor));
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();