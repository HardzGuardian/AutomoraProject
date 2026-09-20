import path from 'path';
import { env } from './env';

/**
 * Storage configuration for file uploads.
 */
export const storageConfig = {
  // Upload directory path
  uploadDir: path.resolve(env.UPLOAD_DIR),

  // Maximum file size in bytes
  maxFileSize: env.MAX_FILE_SIZE,

  // Allowed MIME types
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  // Allowed file extensions
  allowedExtensions: [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
  ],

  // Generate storage path for a file
  getStoragePath: (filename: string): string => {
    return path.join(path.resolve(env.UPLOAD_DIR), filename);
  },

  // Generate public URL for a file
  getPublicUrl: (filename: string): string => {
    return `/uploads/${filename}`;
  },
};
