import { Request, Response, NextFunction } from 'express';
import { JwtUtils } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import prisma from '../config/db';
import { UserPayload } from '../types';

export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = JwtUtils.verifyAccessToken(token);

    // Look the user up on every request so a deactivated account loses access
    // immediately instead of when its token expires.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Account is deactivated');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(ApiError.unauthorized('Authentication failed'));
    }
  }
};
