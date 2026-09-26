import prisma from '../../config/db';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../config/constants';
import { UploadResult } from '../../types';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';

export class UploadService {
  async saveFile(file: Express.Multer.File, userId: string): Promise<UploadResult> {
    if (!file) {
      throw ApiError.badRequest('No file provided');
    }

    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        originalName: file.originalname,
        filename: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        uploaderId: userId,
      },
    });

    await this.logAudit({
      userId,
      action: AUDIT_ACTIONS.FILE_UPLOADED,
      entity: AUDIT_ENTITIES.UPLOADED_FILE,
      entityId: uploadedFile.id,
      metadata: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });

    return {
      id: uploadedFile.id,
      originalName: uploadedFile.originalName,
      filename: uploadedFile.filename,
      mimeType: uploadedFile.mimeType,
      size: uploadedFile.size,
      url: `/uploads/${uploadedFile.filename}`,
    };
  }

  async getById(id: string) {
    const file = await prisma.uploadedFile.findUnique({
      where: { id },
      include: {
        uploader: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!file) {
      throw ApiError.notFound('File not found');
    }

    return file;
  }

  async delete(id: string, userId: string, userRole: string): Promise<void> {
    const file = await prisma.uploadedFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw ApiError.notFound('File not found');
    }

    if (file.uploaderId !== userId && userRole !== 'ADMIN') {
      throw ApiError.forbidden('You can only delete your own files');
    }

    try {
      await fs.unlink(file.path);
    } catch (error) {
      // The file may already be gone from disk; the database row is still removed.
    }

    await prisma.uploadedFile.delete({
      where: { id },
    });

    await this.logAudit({
      userId,
      action: AUDIT_ACTIONS.FILE_DELETED,
      entity: AUDIT_ENTITIES.UPLOADED_FILE,
      entityId: id,
      metadata: {
        filename: file.filename,
        originalName: file.originalName,
      },
    });
  }

  async getFilePath(id: string): Promise<{ path: string; filename: string; mimeType: string }> {
    const file = await prisma.uploadedFile.findUnique({
      where: { id },
    });

    if (!file) {
      throw ApiError.notFound('File not found');
    }

    return {
      path: file.path,
      filename: file.originalName,
      mimeType: file.mimeType,
    };
  }

  async listByUser(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      prisma.uploadedFile.findMany({
        where: { uploaderId: userId },
        select: {
          id: true,
          originalName: true,
          filename: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.uploadedFile.count({
        where: { uploaderId: userId },
      }),
    ]);

    return {
      files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private async logAudit(params: {
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          metadata: params.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      logger.error('Failed to create audit log:', error);
    }
  }
}

export const uploadService = new UploadService();
