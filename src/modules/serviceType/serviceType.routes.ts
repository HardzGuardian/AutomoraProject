import { Router } from 'express';
import { serviceTypeController } from './serviceType.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createServiceTypeSchema,
  updateServiceTypeSchema,
  listServiceTypesQuerySchema,
  serviceTypeIdParamSchema,
} from './serviceType.validator';

const router = Router();

/**
 * @route   POST /service-types
 * @desc    Create a new service type
 * @access  Admin, Manager
 */
router.post(
  '/',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(createServiceTypeSchema),
  asyncHandler(serviceTypeController.create)
);

/**
 * @route   GET /service-types
 * @desc    List service types
 * @access  Admin, Manager, Sales
 */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(listServiceTypesQuerySchema, 'query'),
  asyncHandler(serviceTypeController.list)
);

/**
 * @route   GET /service-types/:id
 * @desc    Get service type by ID
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(serviceTypeIdParamSchema, 'params'),
  asyncHandler(serviceTypeController.getById)
);

/**
 * @route   PATCH /service-types/:id
 * @desc    Update service type
 * @access  Admin, Manager
 */
router.patch(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(serviceTypeIdParamSchema, 'params'),
  validate(updateServiceTypeSchema),
  asyncHandler(serviceTypeController.update)
);

/**
 * @route   DELETE /service-types/:id
 * @desc    Delete service type
 * @access  Admin
 */
router.delete(
  '/:id',
  auth,
  role(['ADMIN']),
  validate(serviceTypeIdParamSchema, 'params'),
  asyncHandler(serviceTypeController.delete)
);

export default router;
