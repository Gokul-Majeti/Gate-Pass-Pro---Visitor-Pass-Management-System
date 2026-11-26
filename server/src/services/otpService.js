import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const OTP_TTL_MINUTES = 10;

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

export async function hashOtpCode(otpCode) {
  return bcrypt.hash(String(otpCode), 8);
}

export function getOtpExpiryDate(minutes = OTP_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function verifyOtpCode(plainOtp, hashedOtp, expiresAt) {
  if (!plainOtp || !hashedOtp || !expiresAt) {
    return { valid: false, reason: 'No active OTP challenge found' };
  }
  if (new Date(expiresAt) < new Date()) {
    return { valid: false, reason: 'OTP code has expired' };
  }
  const matches = await bcrypt.compare(String(plainOtp), hashedOtp);
  if (!matches) {
    return { valid: false, reason: 'Invalid OTP code' };
  }
  return { valid: true };
}
