import { Response } from 'express';
import { ApiResponse } from '../types';

/**
 * Standardized API response helper.
 * Ensures consistent response format across all endpoints.
 */
export class ResponseHelper {
  /**
   * Send a success response.
   *
   * @param res - Express response object
   * @param data - Response data
   * @param statusCode - HTTP status code (default: 200)
   */
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send a success response with a message.
   *
   * @param res - Express response object
   * @param message - Success message
   * @param statusCode - HTTP status code (default: 200)
   */
  static message(res: Response, message: string, statusCode: number = 200): void {
    const response: ApiResponse = {
      success: true,
      message,
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send an error response.
   *
   * @param res - Express response object
   * @param message - Error message
   * @param statusCode - HTTP status code (default: 500)
   * @param details - Additional error details
   */
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

  /**
   * Send a paginated response.
   *
   * @param res - Express response object
   * @param data - Array of items
   * @param page - Current page
   * @param limit - Items per page
   * @param total - Total number of items
   */
  static paginated<T>(
    res: Response,
    data: T[],
    page: number,
    limit: number,
    total: number
  ): void {
    const response: ApiResponse<{ data: T[]; pagination: typeof pagination }> = {
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
