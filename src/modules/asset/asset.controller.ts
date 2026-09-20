import { Request, Response, NextFunction } from 'express';
import { assetService } from './asset.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import {
  CreateAssetInput,
  UpdateAssetInput,
  ListAssetsQuery,
} from './asset.validator';

export class AssetController {
  /**
   * POST /assets
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateAssetInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const asset = await assetService.create(data, userId);
      ResponseHelper.success(res, asset, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /assets
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ListAssetsQuery;
      const result = await assetService.list(query);
      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /assets/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const asset = await assetService.getById(id);
      ResponseHelper.success(res, asset);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /assets/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as UpdateAssetInput;
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Authentication required');

      const asset = await assetService.update(id, data, userId);
      ResponseHelper.success(res, asset);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /assets/:id/service-history
   */
  async getServiceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const history = await assetService.getServiceHistory(id);
      ResponseHelper.success(res, history);
    } catch (error) {
      next(error);
    }
  }
}

export const assetController = new AssetController();
