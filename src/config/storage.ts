import path from 'path';
import { env } from './env';

export const storageConfig = {
  uploadDir: path.resolve(env.UPLOAD_DIR),
  maxFileSize: env.MAX_FILE_SIZE,

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

  getStoragePath: (filename: string): string => {
    return path.join(path.resolve(env.UPLOAD_DIR), filename);
  },

  getPublicUrl: (filename: string): string => {
    return `/uploads/${filename}`;
  },
};
