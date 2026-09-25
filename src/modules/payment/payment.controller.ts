import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ResponseHelper } from '../../utils/response';
import { paymentService } from './payment.service';
import { ListPaymentsQuery, PaymentActor } from './payment.types';

function actorFromRequest(req: Request): PaymentActor {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  return req.user as PaymentActor;
}

export class PaymentController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await paymentService.list(req.query as unknown as ListPaymentsQuery, actorFromRequest(req));
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = await paymentService.getById(req.params.id, actorFromRequest(req));
      ResponseHelper.success(res, payment);
    } catch (error) {
      next(error);
    }
  }

  async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payment = await paymentService.record(req.body, actorFromRequest(req));
      ResponseHelper.success(res, payment, 201);
    } catch (error) {
      next(error);
    }
  }

  async createGatewayPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await paymentService.createGatewayPayment(req.body, actorFromRequest(req));
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawBody = req.rawBody;
      if (!rawBody) throw ApiError.badRequest('Raw webhook body is unavailable');
      const signature = req.headers['x-gateway-signature'];
      if (typeof signature !== 'string') {
        throw ApiError.unauthorized('Missing payment gateway signature');
      }
      const result = await paymentService.processWebhook(rawBody, signature);
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();


