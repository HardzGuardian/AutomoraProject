import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, TokenPair } from '../types';
import { ApiError } from './ApiError';

/**
 * JWT utility for token generation and verification.
 * Handles both access and refresh tokens.
 */
export class JwtUtils {
  /**
   * Generate an access token.
   *
   * @param payload - Data to encode in the token
   * @returns Signed JWT token
   */
  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });
  }

  /**
   * Generate a refresh token.
   *
   * @param payload - Data to encode in the token
   * @returns Signed JWT token
   */
  static generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      algorithm: 'HS256',
    });
  }

  /**
   * Generate both access and refresh tokens.
   *
   * @param payload - Data to encode in the tokens
   * @returns Token pair containing access and refresh tokens
   */
  static generateTokenPair(payload: JwtPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify an access token.
   *
   * @param token - JWT token to verify
   * @returns Decoded token payload
   * @throws ApiError if token is invalid or expired
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Token expired');
      }
      throw ApiError.unauthorized('Invalid token');
    }
  }

  /**
   * Verify a refresh token.
   *
   * @param token - JWT token to verify
   * @returns Decoded token payload
   * @throws ApiError if token is invalid or expired
   */
  static verifyRefreshToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Refresh token expired');
      }
      throw ApiError.unauthorized('Invalid refresh token');
    }
  }

  /**
   * Decode a token without verification (use with caution).
   *
   * @param token - JWT token to decode
   * @returns Decoded token payload or null
   */
  static decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
