import { Router } from 'express';
import { auditController } from './audit.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.list)
);

router.get(
  '/:id',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.getById)
);

router.get(
  '/user/:userId',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.getByUserId)
);

router.get(
  '/entity/:entity/:entityId',
  auth,
  role(['ADMIN', 'MANAGER']),
  asyncHandler(auditController.getByEntity)
);

export default router;
