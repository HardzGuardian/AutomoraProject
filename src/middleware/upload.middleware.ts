import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { UPLOAD } from '../config/constants';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Never trust the client's filename on disk; keep only its extension.
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if ((UPLOAD.ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid file type. Allowed types: ${UPLOAD.ALLOWED_MIME_TYPES.join(', ')}`
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

export const uploadSingle = upload.single('file');

export const uploadMultiple = upload.array('files', 10);

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
