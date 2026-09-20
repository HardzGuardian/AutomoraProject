import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { Prisma } from '@prisma/client';

/**
 * Global error handling middleware.
 * Catches all errors and sends standardized response.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle ApiError (operational errors)
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

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(err, res);
    return;
  }

  // Handle Prisma validation errors
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

  // Handle unknown errors
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

/**
 * Handle Prisma specific errors.
 */
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
      // Record not found
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
