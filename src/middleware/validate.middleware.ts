import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

export const validate = (
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const validatedData = schema.parse(data);

      // Handlers receive the parsed value: coerced types, defaults applied, unknown keys stripped.
      req[source] = validatedData;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        next(
          ApiError.badRequest('Validation failed', { errors: formattedErrors })
        );
      } else {
        next(error);
      }
    }
  };
};

export const validateMultiple = (
  schemas: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
  }
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(
          ApiError.badRequest('Validation failed', { errors: formattedErrors })
        );
      } else {
        next(error);
      }
    }
  };
};
