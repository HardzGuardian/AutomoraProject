import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

export class ResponseHelper {
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };
    res.status(statusCode).json(response);
  }

  static message(res: Response, message: string, statusCode: number = 200): void {
    const response: ApiResponse = {
      success: true,
      message,
    };
    res.status(statusCode).json(response);
  }

  static noContent(res: Response): void {
    res.status(204).end();
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    details?: unknown
  ): void {
    const response: ApiResponse = {
      success: false,
      error: {
        message,
        details,
      },
    };
    res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number
  ): void {
    const response: ApiResponse<PaginatedResponse<T>> = {
      success: true,
      data: {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
    res.status(200).json(response);
  }
}
