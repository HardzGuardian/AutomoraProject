import { Request, Response, NextFunction } from 'express';
import { renewalService } from './renewal.service';
import { contractService } from '../contract/contract.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import {
  ListRenewalsQuery,
  UpdateRenewalStatusInput,
  ProcessRenewalInput,
  NotRenewedInput,
  CreateFollowUpInput,
} from './renewal.validator';

export class RenewalController {
  /**
   * GET /renewals
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListRenewalsQuery;
      const result = await renewalService.list(query);
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /renewals/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const renewal = await renewalService.getById(id);
      ResponseHelper.success(res, renewal);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /renewals/expiring
   */
  async getExpiring(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = Number(req.query.days) || 30;
      const contracts = await contractService.getExpiringContracts(days);
      ResponseHelper.success(res, { contracts, days });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /renewals/:id/status
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateRenewalStatusInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const renewal = await renewalService.updateStatus(id, data, userId);
      ResponseHelper.success(res, renewal);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /renewals/:id/process
   */
  async processRenewal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as ProcessRenewalInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const renewal = await renewalService.processRenewal(id, data, userId);
      ResponseHelper.success(res, renewal);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /renewals/:id/not-renewed
   */
  async markNotRenewed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as NotRenewedInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const renewal = await renewalService.markNotRenewed(id, data, userId);
      ResponseHelper.success(res, renewal);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /renewals/:id/follow-ups
   */
  async createFollowUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as CreateFollowUpInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const followUp = await renewalService.createFollowUp(id, data, userId);
      ResponseHelper.success(res, followUp, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /renewals/:id/follow-ups
   */
  async listFollowUps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const followUps = await renewalService.listFollowUps(id);
      ResponseHelper.success(res, followUps);
    } catch (error) {
      next(error);
    }
  }
}

export const renewalController = new RenewalController();
