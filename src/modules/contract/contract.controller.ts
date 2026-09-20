import { Request, Response, NextFunction } from 'express';
import { contractService } from './contract.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import {
  CreateContractInput,
  UpdateContractInput,
  ListContractsQuery,
  ContractDocumentInput,
  ContractSLAInput,
} from './contract.validator';

export class ContractController {
  // ===========================================
  // CONTRACT ENDPOINTS
  // ===========================================

  /**
   * POST /contracts
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateContractInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const contract = await contractService.create(data, userId);
      ResponseHelper.success(res, contract, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /contracts
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListContractsQuery;
      const result = await contractService.list(query);
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /contracts/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const contract = await contractService.getById(id);
      ResponseHelper.success(res, contract);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /contracts/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateContractInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const contract = await contractService.update(id, data, userId);
      ResponseHelper.success(res, contract);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /contracts/:id/activate
   */
  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const contract = await contractService.activate(id, userId);
      ResponseHelper.success(res, contract);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /contracts/:id/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const contract = await contractService.cancel(id, userId);
      ResponseHelper.success(res, contract);
    } catch (error) {
      next(error);
    }
  }

  // ===========================================
  // CONTRACT ASSETS
  // ===========================================

  /**
   * POST /contracts/:id/assets
   */
  async linkAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { assetId } = req.body;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      await contractService.linkAsset(id, assetId, userId);
      ResponseHelper.message(res, 'Asset linked to contract successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /contracts/:id/assets/:assetId
   */
  async unlinkAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, assetId } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      await contractService.unlinkAsset(id, assetId, userId);
      ResponseHelper.message(res, 'Asset unlinked from contract successfully');
    } catch (error) {
      next(error);
    }
  }

  // ===========================================
  // CONTRACT DOCUMENTS
  // ===========================================

  /**
   * POST /contracts/:id/documents
   */
  async addDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as ContractDocumentInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const document = await contractService.addDocument(id, data, userId);
      ResponseHelper.success(res, document, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /contracts/:id/documents
   */
  async listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const documents = await contractService.listDocuments(id);
      ResponseHelper.success(res, documents);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /contracts/:id/documents/:docId
   */
  async removeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, docId } = req.params;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      await contractService.removeDocument(id, docId, userId);
      ResponseHelper.message(res, 'Document removed successfully');
    } catch (error) {
      next(error);
    }
  }

  // ===========================================
  // CONTRACT SLA
  // ===========================================

  /**
   * GET /contracts/:id/sla
   */
  async getSLA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const sla = await contractService.getSLA(id);
      ResponseHelper.success(res, sla);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /contracts/:id/sla
   */
  async upsertSLA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as ContractSLAInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const sla = await contractService.upsertSLA(id, data, userId);
      ResponseHelper.success(res, sla);
    } catch (error) {
      next(error);
    }
  }
}

export const contractController = new ContractController();
