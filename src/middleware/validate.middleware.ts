import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

/**
 * Validation middleware using Zod schemas.
 * Validates request body, query parameters, or URL parameters.
 *
 * @param schema - Zod schema to validate against
 * @param source - Where to get the data from (body, query, params)
 *
 * @example
 * router.post('/register', validate(registerSchema, 'body'), controller.register);
 * router.get('/users', validate(listUsersSchema, 'query'), controller.list);
 */
export const validate = (
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Get data from specified source
      const data = req[source];

      // Validate data
      const validatedData = schema.parse(data);

      // Replace original data with validated data (strips unknown fields)
      req[source] = validatedData;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod validation errors
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

/**
 * Validate multiple sources at once.
 *
 * @example
 * router.post('/users',
 *   validateMultiple({ body: createBodySchema, query: createQuerySchema }),
 *   controller.create
 * );
 */
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
