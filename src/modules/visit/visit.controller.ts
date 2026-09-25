import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ResponseHelper } from '../../utils/response';
import {
  CompleteVisitInput,
  ListVisitsQuery,
  RescheduleVisitInput,
} from './visit.validator';
import { FieldOperationsActor, visitService } from './visit.service';

function getActor(req: Request): FieldOperationsActor {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }
  return req.user;
}

export class VisitController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await visitService.list(
        req.query as unknown as ListVisitsQuery,
        getActor(req)
      );
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const visit = await visitService.getById(req.params.id, getActor(req));
      ResponseHelper.success(res, visit);
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const visit = await visitService.startVisit(req.params.id, getActor(req));
      ResponseHelper.success(res, visit);
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const visit = await visitService.completeVisit(
        req.params.id,
        req.body as CompleteVisitInput,
        getActor(req)
      );
      ResponseHelper.success(res, visit);
    } catch (error) {
      next(error);
    }
  }

  async attachPhoto(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file provided');
      }
      const photo = await visitService.attachPhoto(
        req.params.id,
        req.file,
        getActor(req)
      );
      ResponseHelper.success(res, photo, 201);
    } catch (error) {
      next(error);
    }
  }

  async attachSignature(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file provided');
      }
      const visit = await visitService.attachSignature(
        req.params.id,
        req.file,
        getActor(req)
      );
      ResponseHelper.success(res, visit);
    } catch (error) {
      next(error);
    }
  }

  async reschedule(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const visit = await visitService.rescheduleVisit(
        req.params.id,
        req.body as RescheduleVisitInput,
        getActor(req)
      );
      ResponseHelper.success(res, visit);
    } catch (error) {
      next(error);
    }
  }
}

export const visitController = new VisitController();
