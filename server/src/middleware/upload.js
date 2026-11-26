import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const visitorsUploadDir = path.resolve(env.uploadDir, 'visitors');

export function ensureUploadDirs() {
  fs.mkdirSync(visitorsUploadDir, { recursive: true });
}

ensureUploadDirs();

const ALLOWED_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs();
    cb(null, visitorsUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_EXT[file.mimetype] || '.jpg';
    const token = crypto.randomBytes(6).toString('hex');
    cb(null, `visitor-${Date.now()}-${token}${ext}`);
  },
});

function imageFileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_EXT[file.mimetype]) {
    return cb(new AppError('Only JPEG, PNG, and WebP images are allowed for visitor photos', 400));
  }
  return cb(null, true);
}

export const uploadVisitorPhoto = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: env.maxPhotoSizeMb * 1024 * 1024,
  },
});

/**
 * Persists a webcam/canvas base64 data URL (e.g. data:image/jpeg;base64,...) safely to disk
 * and returns its public /uploads/visitors/... relative URL.
 */
export function saveBase64Photo(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return '';

  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new AppError('Invalid base64 image format. Expected JPEG, PNG, or WebP data URL.', 400);
  }

  const mime = match[1];
  const base64Data = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const maxBytes = env.maxPhotoSizeMb * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new AppError(`Photo exceeds maximum size of ${env.maxPhotoSizeMb}MB`, 400);
  }

  ensureUploadDirs();
  const ext = ALLOWED_MIME_EXT[mime] || '.jpg';
  const filename = `visitor-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const fullPath = path.join(visitorsUploadDir, filename);
  fs.writeFileSync(fullPath, buffer);

  return `/uploads/visitors/${filename}`;
}

/**
 * Extracts the saved photo URL from either multer file upload or base64 webcam payload.
 */
export function resolveUploadedPhotoUrl(req) {
  if (req.file) {
    return `/uploads/visitors/${req.file.filename}`;
  }
  if (req.body?.photoBase64) {
    return saveBase64Photo(req.body.photoBase64);
  }
  return '';
}
