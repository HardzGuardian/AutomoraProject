import { Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

export const notFound = (req: Request, res: Response): void => {
  const error = ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      path: req.originalUrl,
    },
  });
};
