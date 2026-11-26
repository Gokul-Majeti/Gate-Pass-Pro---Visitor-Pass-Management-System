import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '../..');
const workspaceRoot = path.resolve(serverRoot, '..');

// Load server/.env first if present, then root .env without overwriting already-set vars
for (const candidate of [path.join(serverRoot, '.env'), path.join(workspaceRoot, '.env')]) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in production environment.');
}

const uploadDirRaw = process.env.UPLOAD_DIR || 'uploads';
const uploadDir = path.isAbsolute(uploadDirRaw)
  ? uploadDirRaw
  : path.resolve(serverRoot, uploadDirRaw);

export const env = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/visitor_pass_db',
  useInMemoryDb: process.env.USE_IN_MEMORY_DB === 'true',
  allowMemoryDbFallback: process.env.ALLOW_MEMORY_DB_FALLBACK !== 'false',
  jwtSecret: process.env.JWT_SECRET || 'dev_only_jwt_secret_change_in_production_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  qrSigningSecret:
    process.env.QR_SIGNING_SECRET || 'dev_only_qr_hmac_secret_change_in_production_2026',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  uploadDir,
  maxPhotoSizeMb: Number(process.env.MAX_PHOTO_SIZE_MB) || 5,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'GatePass Pro <noreply@gatepass.local>',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },
};
