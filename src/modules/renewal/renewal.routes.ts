import { Router } from 'express';
import { renewalController } from './renewal.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  listRenewalsQuerySchema,
  renewalIdParamSchema,
  updateRenewalStatusSchema,
  processRenewalSchema,
  notRenewedSchema,
  createFollowUpSchema,
  followUpIdParamSchema,
} from './renewal.validator';

const router = Router();

/**
 * @route   GET /renewals/expiring
 * @desc    Get contracts expiring in N days
 * @access  Admin, Manager, Sales
 */
router.get(
  '/expiring',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  asyncHandler(renewalController.getExpiring)
);

/**
 * @route   GET /renewals
 * @desc    List renewals with pagination and filters
 * @access  Admin, Manager, Sales
 */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(listRenewalsQuerySchema, 'query'),
  asyncHandler(renewalController.list)
);

/**
 * @route   GET /renewals/:id
 * @desc    Get renewal by ID
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(renewalIdParamSchema, 'params'),
  asyncHandler(renewalController.getById)
);

/**
 * @route   PATCH /renewals/:id/status
 * @desc    Update renewal status
 * @access  Admin, Manager, Sales
 */
router.patch(
  '/:id/status',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(renewalIdParamSchema, 'params'),
  validate(updateRenewalStatusSchema),
  asyncHandler(renewalController.updateStatus)
);

/**
 * @route   POST /renewals/:id/process
 * @desc    Process renewal (mark as RENEWED)
 * @access  Admin, Manager
 */
router.post(
  '/:id/process',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(renewalIdParamSchema, 'params'),
  validate(processRenewalSchema),
  asyncHandler(renewalController.processRenewal)
);

/**
 * @route   PATCH /renewals/:id/not-renewed
 * @desc    Mark renewal as NOT RENEWED
 * @access  Admin, Manager
 */
router.patch(
  '/:id/not-renewed',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(renewalIdParamSchema, 'params'),
  validate(notRenewedSchema),
  asyncHandler(renewalController.markNotRenewed)
);

/**
 * @route   POST /renewals/:id/follow-ups
 * @desc    Create a follow-up for a renewal
 * @access  Admin, Manager, Sales
 */
router.post(
  '/:id/follow-ups',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(renewalIdParamSchema, 'params'),
  validate(createFollowUpSchema),
  asyncHandler(renewalController.createFollowUp)
);

/**
 * @route   GET /renewals/:id/follow-ups
 * @desc    List follow-ups for a renewal
 * @access  Admin, Manager, Sales
 */
router.get(
  '/:id/follow-ups',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  validate(renewalIdParamSchema, 'params'),
  asyncHandler(renewalController.listFollowUps)
);

export default router;
