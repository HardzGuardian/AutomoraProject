import { Router } from 'express';
import { auditController } from './audit.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /audit
 * @desc    List audit logs with pagination and filters
 * @access  Admin, Manager
 */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.list)
);

/**
 * @route   GET /audit/:id
 * @desc    Get audit log by ID
 * @access  Admin, Manager
 */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.getById)
);

/**
 * @route   GET /audit/user/:userId
 * @desc    Get audit logs for a specific user
 * @access  Admin, Manager
 */
router.get(
  '/user/:userId',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.getByUserId)
);

/**
 * @route   GET /audit/entity/:entity/:entityId
 * @desc    Get audit logs for a specific entity
 * @access  Admin, Manager
 */
router.get(
  '/entity/:entity/:entityId',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.getByEntity)
);

export default router;
