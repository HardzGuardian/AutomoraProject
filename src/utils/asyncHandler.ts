import { Request, Response, NextFunction } from 'express';

/** Express 4 does not forward rejected promises to the error handler; this does. */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
