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

router.post(
  '/register',
  authRateLimit,
  validate(registerSchema),
  asyncHandler(authController.register)
);

router.post(
  '/login',
  authRateLimit,
  validate(loginSchema),
  asyncHandler(authController.login)
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(authController.refresh)
);

router.post(
  '/logout',
  auth,
  asyncHandler(authController.logout)
);

router.get(
  '/me',
  auth,
  asyncHandler(authController.me)
);

router.patch(
  '/change-password',
  auth,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword)
);

export default router;
