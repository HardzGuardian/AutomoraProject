import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { dashboardController } from './dashboard.controller';

const router = Router();

router.get(
  '/summary',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  asyncHandler(dashboardController.summary)
);

router.get(
  '/',
  auth,
  role(['ADMIN', 'MANAGER', 'SALES']),
  asyncHandler(dashboardController.summary)
);

export default router;