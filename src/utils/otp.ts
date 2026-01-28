/**
 * OTP generation utilities
 */

import * as crypto from 'crypto';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export function generateOTP(): string {
  // Generate a random 6-digit code
  const otp = crypto.randomInt(0, Math.pow(10, OTP_LENGTH));
  return otp.toString().padStart(OTP_LENGTH, '0');
}

export function getOTPExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);
  return expiry;
}
