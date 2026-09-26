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

router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(userController.list)
);

router.get(
  '/:id',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  asyncHandler(userController.getById)
);

router.post(
  '/',
  auth,
  role(['ADMIN']),
  validate(createUserSchema),
  asyncHandler(userController.create)
);

router.patch(
  '/:id',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(userController.update)
);

router.patch(
  '/:id/deactivate',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  asyncHandler(userController.deactivate)
);

router.patch(
  '/:id/activate',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  asyncHandler(userController.activate)
);

router.patch(
  '/:id/role',
  auth,
  role(['ADMIN']),
  validate(userIdParamSchema, 'params'),
  validate(changeRoleSchema),
  asyncHandler(userController.changeRole)
);

router.get(
  '/me/profile',
  auth,
  asyncHandler(userController.getMe)
);

router.patch(
  '/me/profile',
  auth,
  validate(updateProfileSchema),
  asyncHandler(userController.updateProfile)
);

export default router;
