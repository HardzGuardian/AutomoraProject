import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../../utils/response';
import { notificationService } from './notification.service';

export class NotificationController {
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await notificationService.send(req.body);
      ResponseHelper.success(res, result, result.status === 'FAILED' ? 502 : 200);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();