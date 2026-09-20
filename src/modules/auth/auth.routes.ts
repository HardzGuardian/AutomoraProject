import { Router } from 'express';
import { authController } from './auth.controller';
import { auth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authRateLimit } from '../../middleware/rateLimit.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from './auth.validator';

const router = Router();

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  asyncHandler(authController.register)
);

/**
 * @route   POST /auth/login
 * @desc    Login user and return tokens
 * @access  Public
 */
router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  asyncHandler(authController.login)
);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(authController.refresh)
);

/**
 * @route   POST /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  auth,
  asyncHandler(authController.logout)
);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  auth,
  asyncHandler(authController.me)
);

/**
 * @route   PATCH /auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.patch(
  '/change-password',
  auth,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

export default router;
