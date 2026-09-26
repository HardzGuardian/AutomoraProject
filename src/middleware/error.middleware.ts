import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(err, res);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Database validation error',
        ...(env.NODE_ENV === 'development' && { details: err.message }),
      },
    });
    return;
  }

  // Internal details are only exposed in development.
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      ...(env.NODE_ENV === 'development' && {
        details: err.message,
        stack: err.stack,
      }),
    },
  });
};

function handlePrismaError(
  err: Prisma.PrismaClientKnownRequestError,
  res: Response
): void {
  switch (err.code) {
    case 'P2002': {
      // Unique constraint violation
      const field = (err.meta?.target as string[])?.join(', ') || 'field';
      res.status(409).json({
        success: false,
        error: {
          message: `A record with this ${field} already exists`,
          code: 'CONFLICT',
        },
      });
      break;
    }
    case 'P2025': {
      // Record to update or delete does not exist
      res.status(404).json({
        success: false,
        error: {
          message: 'Record not found',
          code: 'NOT_FOUND',
        },
      });
      break;
    }
    case 'P2003': {
      // Foreign key constraint violation
      res.status(400).json({
        success: false,
        error: {
          message: 'Related record not found',
          code: 'FOREIGN_KEY_ERROR',
        },
      });
      break;
    }
    default:
      res.status(500).json({
        success: false,
        error: {
          message: 'Database error',
          code: err.code,
        },
      });
  }
}
