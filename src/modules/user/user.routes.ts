import { Router } from 'express';
import { userController } from './user.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
  changeRoleSchema,
  listUsersQuerySchema,
  userIdParamSchema,
} from './user.validator';
import { UserRole } from '../../types';

const router = Router();

// ===========================================
// ADMIN ROUTES
// ===========================================

/**
 * @route   GET /users
 * @desc    List all users with pagination and filters
 * @access  Admin, Manager
 */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(userController.list)
);

/**
 * @route   GET /users/:id
 * @desc    Get user by ID
 * @access  Admin
 */
router.get(
  '/:id',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  asyncHandler(userController.getById)
);

/**
 * @route   POST /users
 * @desc    Create new user
 * @access  Admin
 */
router.post(
  '/',
  auth,
  role(['ADMIN']),
  validate(createUserSchema),
  asyncHandler(userController.create)
);

/**
 * @route   PATCH /users/:id
 * @desc    Update user
 * @access  Admin
 */
router.patch(
  '/:id',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(userController.update)
);

/**
 * @route   PATCH /users/:id/deactivate
 * @desc    Deactivate user
 * @access  Admin
 */
router.patch(
  '/:id/deactivate',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  asyncHandler(userController.deactivate)
);

/**
 * @route   PATCH /users/:id/activate
 * @desc    Activate user
 * @access  Admin
 */
router.patch(
  '/:id/activate',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  asyncHandler(userController.activate)
);

/**
 * @route   PATCH /users/:id/role
 * @desc    Change user role
 * @access  Admin
 */
router.patch(
  '/:id/role',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  validate(changeRoleSchema),
  asyncHandler(userController.changeRole)
);

// ===========================================
// SELF ROUTES
// ===========================================

/**
 * @route   GET /users/me
 * @desc    Get own profile
 * @access  Private (any authenticated user)
 */
router.get(
  '/me/profile',
  auth,
  asyncHandler(userController.getMe)
);

/**
 * @route   PATCH /users/me
 * @desc    Update own profile
 * @access  Private (any authenticated user)
 */
router.patch(
  '/me/profile',
  auth,
  validate(updateProfileSchema),
  asyncHandler(userController.updateProfile)
);

export default router;
