import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  handleUploadError,
  uploadSingle,
} from '../../middleware/upload.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { visitController } from './visit.controller';
import {
  completeVisitSchema,
  listVisitsQuerySchema,
  rescheduleVisitSchema,
  visitIdParamSchema,
} from './visit.validator';

const router = Router();

/**
 * Person 3 route integration shell.
 * This router is intentionally not registered in src/app.ts until the
 * Person 1 Visit models and production repository adapter are available.
 */

/** GET /visits */
router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(listVisitsQuerySchema, 'query'),
  asyncHandler(visitController.list)
);

/** GET /visits/:id */
router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(visitIdParamSchema, 'params'),
  asyncHandler(visitController.getById)
);

/** PATCH /visits/:id/start */
router.patch(
  '/:id/start',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(visitIdParamSchema, 'params'),
  asyncHandler(visitController.start)
);

/** PATCH /visits/:id/complete */
router.patch(
  '/:id/complete',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(visitIdParamSchema, 'params'),
  validate(completeVisitSchema),
  asyncHandler(visitController.complete)
);

/** POST /visits/:id/photo */
router.post(
  '/:id/photo',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(visitIdParamSchema, 'params'),
  uploadSingle,
  handleUploadError,
  asyncHandler(visitController.attachPhoto)
);

/** POST /visits/:id/signature */
router.post(
  '/:id/signature',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(visitIdParamSchema, 'params'),
  uploadSingle,
  handleUploadError,
  asyncHandler(visitController.attachSignature)
);

/** PATCH /visits/:id/reschedule */
router.patch(
  '/:id/reschedule',
  auth,
  role(['ADMIN', 'MANAGER', 'TECHNICIAN']),
  validate(visitIdParamSchema, 'params'),
  validate(rescheduleVisitSchema),
  asyncHandler(visitController.reschedule)
);

export default router;
