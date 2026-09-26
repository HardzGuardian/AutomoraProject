import { Router } from 'express';
import { uploadController } from './upload.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { uploadSingle, handleUploadError } from '../../middleware/upload.middleware';
import { uploadRateLimit } from '../../middleware/rateLimit.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.post(
  '/',
  auth,
  uploadRateLimit,
  uploadSingle,
  handleUploadError,
  asyncHandler(uploadController.upload)
);

router.get(
  '/user/:userId',
  auth,
  asyncHandler(uploadController.listByUser)
);

router.get(
  '/:id',
  auth,
  asyncHandler(uploadController.getById)
);

router.get(
  '/:id/download',
  auth,
  asyncHandler(uploadController.download)
);

router.delete(
  '/:id',
  auth,
  asyncHandler(uploadController.delete)
);

export default router;
