import { Router } from 'express';
import { assetController } from './asset.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createAssetSchema,
  updateAssetSchema,
  listAssetsQuerySchema,
  assetIdParamSchema,
} from './asset.validator';

const router = Router();

/**
 * @route   POST /assets
 * @desc    Create a new asset
 * @access  Admin, Manager, Sales
 */
router.post(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(createAssetSchema),
  asyncHandler(assetController.create)
);

/**
 * @route   GET /assets
 * @desc    List assets with pagination and filters
 * @access  Admin, Manager, Sales
 */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(listAssetsQuerySchema, 'query'),
  asyncHandler(assetController.list)
);

/**
 * @route   GET /assets/:id
 * @desc    Get asset by ID
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(assetIdParamSchema, 'params'),
  asyncHandler(assetController.getById)
);

/**
 * @route   PATCH /assets/:id
 * @desc    Update asset
 * @access  Admin, Manager, Sales
 */
router.patch(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(assetIdParamSchema, 'params'),
  validate(updateAssetSchema),
  asyncHandler(assetController.update)
);

/**
 * @route   GET /assets/:id/service-history
 * @desc    Get asset service history
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id/service-history',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(assetIdParamSchema, 'params'),
  asyncHandler(assetController.getServiceHistory)
);

export default router;
