import { Request, Response, NextFunction } from 'express';
import { uploadService } from './upload.service';
import { ResponseHelper } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import path from 'path';

export class UploadController {
  async upload(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw ApiError.badRequest('No file provided');
      }

      const userId = req.user?.id;
      if (!userId) {
        throw ApiError.unauthorized('Authentication required');
      }

      const result = await uploadService.saveFile(req.file, userId);
      ResponseHelper.success(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const file = await uploadService.getById(id);
      ResponseHelper.success(res, file);
    } catch (error) {
      next(error);
    }
  }

  async download(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const fileInfo = await uploadService.getFilePath(id);

      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`
      );

      res.sendFile(path.resolve(fileInfo.path), (err) => {
        if (err) {
          next(ApiError.internal('Error downloading file'));
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        throw ApiError.unauthorized('Authentication required');
      }

      await uploadService.delete(id, userId, userRole);
      ResponseHelper.message(res, 'File deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async listByUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await uploadService.listByUser(
        userId,
        Number(page),
        Number(limit)
      );

      ResponseHelper.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
