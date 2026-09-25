import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ResponseHelper } from '../../utils/response';
import { TicketActor, ticketService } from './ticket.service';
import { ticketMessageService } from './ticketMessage.service';
import {
  AssignTicketInput,
  CreateTicketInput,
  ListTicketMessagesQuery,
  ListTicketsQuery,
  TicketMessageInput,
  UpdateTicketStatusInput,
} from './ticket.validator';

function getActor(req: Request): TicketActor {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }
  return req.user;
}

export class TicketController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await ticketService.create(
        req.body as CreateTicketInput,
        getActor(req)
      );
      ResponseHelper.success(res, ticket, 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ticketService.list(
        req.query as unknown as ListTicketsQuery,
        getActor(req)
      );
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await ticketService.getById(req.params.id, getActor(req));
      ResponseHelper.success(res, ticket);
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await ticketService.assignTechnician(
        req.params.id,
        req.body as AssignTicketInput,
        getActor(req)
      );
      ResponseHelper.success(res, ticket);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ticket = await ticketService.updateStatus(
        req.params.id,
        req.body as UpdateTicketStatusInput,
        getActor(req)
      );
      ResponseHelper.success(res, ticket);
    } catch (error) {
      next(error);
    }
  }

  async addMessage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const message = await ticketMessageService.addMessage(
        req.params.id,
        req.body as TicketMessageInput,
        getActor(req)
      );
      ResponseHelper.success(res, message, 201);
    } catch (error) {
      next(error);
    }
  }

  async listMessages(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await ticketMessageService.listMessages(
        req.params.id,
        req.query as unknown as ListTicketMessagesQuery,
        getActor(req)
      );
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const ticketController = new TicketController();
