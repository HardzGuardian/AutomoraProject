import { Request, Response, NextFunction } from 'express';
import { clientService } from './client.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import {
  CreateClientInput,
  UpdateClientInput,
  ListClientsQuery,
  CreateContactInput,
  UpdateContactInput,
  CreateSiteInput,
  UpdateSiteInput,
} from './client.validator';

export class ClientController {
  // ===========================================
  // CLIENT ENDPOINTS
  // ===========================================

  /**
   * POST /clients
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateClientInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const client = await clientService.create(data, userId);
      ResponseHelper.success(res, client, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /clients
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListClientsQuery;
      const userRole = req.user?.role as any;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const result = await clientService.list(query, userRole, userId);
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /clients/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const client = await clientService.getById(id);
      ResponseHelper.success(res, client);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /clients/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateClientInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const client = await clientService.update(id, data, userId);
      ResponseHelper.success(res, client);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /clients/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      await clientService.delete(id, userId);
      ResponseHelper.message(res, 'Client deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /clients/:id/history
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const history = await clientService.getHistory(id);
      ResponseHelper.success(res, history);
    } catch (error) {
      next(error);
    }
  }

  // ===========================================
  // CONTACT ENDPOINTS
  // ===========================================

  /**
   * POST /contacts
   */
  async createContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateContactInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const contact = await clientService.createContact(data, userId);
      ResponseHelper.success(res, contact, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /contacts/:id
   */
  async getContactById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const contact = await clientService.getContactById(id);
      ResponseHelper.success(res, contact);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /contacts/:id
   */
  async updateContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateContactInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const contact = await clientService.updateContact(id, data, userId);
      ResponseHelper.success(res, contact);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /contacts/:id
   */
  async deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      await clientService.deleteContact(id, userId);
      ResponseHelper.message(res, 'Contact deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ===========================================
  // SITE ENDPOINTS
  // ===========================================

  /**
   * POST /sites
   */
  async createSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateSiteInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const site = await clientService.createSite(data, userId);
      ResponseHelper.success(res, site, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /sites/:id
   */
  async getSiteById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const site = await clientService.getSiteById(id);
      ResponseHelper.success(res, site);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /sites/:id/assets
   */
  async getSiteAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const assets = await clientService.getSiteAssets(id);
      ResponseHelper.success(res, assets);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /sites/:id
   */
  async updateSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateSiteInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const site = await clientService.updateSite(id, data, userId);
      ResponseHelper.success(res, site);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /sites/:id
   */
  async deleteSite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      await clientService.deleteSite(id, userId);
      ResponseHelper.message(res, 'Site deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const clientController = new ClientController();
