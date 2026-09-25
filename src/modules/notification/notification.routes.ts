import { Router } from 'express';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { notificationController } from './notification.controller';
import { sendNotificationSchema } from './notification.validator';

const router = Router();

router.post(
  '/send',
  auth,
  role(['ADMIN', 'MANAGER']),
  validate(sendNotificationSchema),
  asyncHandler(notificationController.send)
);

export default router;