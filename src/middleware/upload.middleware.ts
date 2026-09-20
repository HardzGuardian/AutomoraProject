import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { UPLOAD } from '../config/constants';

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with UUID
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

// File filter
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Check MIME type
  if (UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type. Allowed types: ${UPLOAD.ALLOWED_MIME_TYPES.join(', ')}`
      )
    );
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

/**
 * Single file upload middleware.
 * Field name: 'file'
 */
export const uploadSingle = upload.single('file');

/**
 * Multiple files upload middleware.
 * Field name: 'files'
 * Max 10 files.
 */
export const uploadMultiple = upload.array('files', 10);

/**
 * Error handling middleware for multer errors.
 */
export const handleUploadError = (
  err: any,
  req: Request,
  res: any,
  next: any
): void => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        next(ApiError.tooLarge('File too large'));
        break;
      case 'LIMIT_FILE_COUNT':
        next(ApiError.badRequest('Too many files'));
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        next(ApiError.badRequest('Unexpected field name'));
        break;
      default:
        next(ApiError.badRequest('Upload error'));
    }
  } else if (err) {
    next(err);
  } else {
    next();
  }
};

export default upload;
