import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { Pass } from '../models/index.js';
import { AppError } from '../utils/errors.js';

export function generatePassCode() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomInt(100000, 999999);
  return `VP-${year}-${suffix}`;
}

export function createQrSignature(passCode, organizationId, appointmentId) {
  const orgId = String(organizationId?._id || organizationId);
  const aptId = String(appointmentId?._id || appointmentId);
  return crypto
    .createHmac('sha256', env.qrSigningSecret)
    .update(`${passCode}:${orgId}:${aptId}`)
    .digest('hex')
    .slice(0, 32);
}

export function signQrToken(passCode, organizationId, appointmentId) {
  const sig = createQrSignature(passCode, organizationId, appointmentId);
  return `VPM1:${passCode}:${sig}`;
}

/**
 * Parses a scanned QR string or manual pass code into passCode and optional signature.
 */
export function parseScannedPayload(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new AppError('QR token or pass code is required', 400);
  }

  const trimmed = rawInput.trim();
  if (trimmed.startsWith('VPM1:')) {
    const parts = trimmed.split(':');
    if (parts.length !== 3 || !parts[1] || !parts[2]) {
      throw new AppError('Malformed QR token format', 400);
    }
    return {
      isSignedQr: true,
      passCode: parts[1].toUpperCase(),
      signature: parts[2],
      rawToken: trimmed,
    };
  }

  // Fallback for JSON-encoded QR or plain VP-YYYY-NNNNNN manual code
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.qrToken) return parseScannedPayload(parsed.qrToken);
      if (parsed.passCode) {
        return {
          isSignedQr: false,
          passCode: String(parsed.passCode).trim().toUpperCase(),
          signature: null,
          rawToken: trimmed,
        };
      }
    } catch {
      throw new AppError('Invalid QR JSON payload', 400);
    }
  }

  return {
    isSignedQr: false,
    passCode: trimmed.toUpperCase(),
    signature: null,
    rawToken: trimmed,
  };
}

export function verifyPassQrSignature(pass, scannedSignature) {
  const expected = createQrSignature(pass.passCode, pass.organizationId, pass.appointmentId);
  const a = Buffer.from(String(scannedSignature || ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function generateQrDataUrl(qrToken) {
  return QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: 'M',
    width: 320,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export async function generateQrPngBuffer(qrToken) {
  return QRCode.toBuffer(qrToken, {
    errorCorrectionLevel: 'M',
    width: 240,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

/**
 * Ensures a pass has a rendered qrDataUrl (useful for seeded passes or older docs).
 */
export async function ensurePassQrDataUrl(pass) {
  if (!pass) return pass;
  if (!pass.qrDataUrl) {
    const token = pass.qrToken || signQrToken(pass.passCode, pass.organizationId, pass.appointmentId);
    pass.qrDataUrl = await generateQrDataUrl(token);
    if (!pass.qrToken) pass.qrToken = token;
    await pass.save();
  }
  return pass;
}

/**
 * Generates a unique passCode that does not collide with existing passes.
 */
export async function generateUniquePassCode() {
  for (let i = 0; i < 6; i += 1) {
    const candidate = generatePassCode();
    const exists = await Pass.exists({ passCode: candidate });
    if (!exists) return candidate;
  }
  return `VP-${Date.now().toString().slice(-8)}`;
}
