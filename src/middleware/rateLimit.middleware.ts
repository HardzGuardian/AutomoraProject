import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

export const generalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      ApiError.tooManyRequests('Too many requests, please try again later')
    );
  },
});

// Much tighter than the general limit to slow down credential brute-forcing.
export const authRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      ApiError.tooManyRequests(
        'Too many authentication attempts, please try again later'
      )
    );
  },
});

export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many file uploads, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      ApiError.tooManyRequests('Too many file uploads, please try again later')
    );
  },
});
