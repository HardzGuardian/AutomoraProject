import { Router } from 'express';
import { uploadController } from './upload.controller';
import { auth } from '../../middleware/auth.middleware';
import { role } from '../../middleware/role.middleware';
import { uploadSingle, handleUploadError } from '../../middleware/upload.middleware';
import { uploadRateLimit } from '../../middleware/rateLimit.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * @route   POST /uploads
 * @desc    Upload a file
 * @access  Private (any authenticated user)
 */
router.post(
  '/',
  auth,
  uploadRateLimit,
  uploadSingle,
  handleUploadError,
  asyncHandler(uploadController.upload)
);

/**
 * @route   GET /uploads/user/:userId
 * @desc    List files uploaded by a user
 * @access  Private (any authenticated user)
 */
router.get(
  '/user/:userId',
  auth,
  asyncHandler(uploadController.listByUser)
);

/**
 * @route   GET /uploads/:id
 * @desc    Get file metadata
 * @access  Private (any authenticated user)
 */
router.get(
  '/:id',
  auth,
  asyncHandler(uploadController.getById)
);

/**
 * @route   GET /uploads/:id/download
 * @desc    Download a file
 * @access  Private (any authenticated user)
 */
router.get(
  '/:id/download',
  auth,
  asyncHandler(uploadController.download)
);

/**
 * @route   DELETE /uploads/:id
 * @desc    Delete a file
 * @access  Private (uploader or admin)
 */
router.delete(
  '/:id',
  auth,
  asyncHandler(uploadController.delete)
);

export default router;
