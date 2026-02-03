import { generateOTP, getOTPExpiry, OTP_RESEND_COOLDOWN_SECONDS } from '../../utils/otp';

describe('generateOTP', () => {
  it('returns a 6-character string', () => {
    const otp = generateOTP();
    expect(otp).toHaveLength(6);
  });

  it('returns only digits', () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('returns different values on multiple calls (at least 2 out of 10 are unique)', () => {
    const otps = new Set<string>();
    for (let i = 0; i < 10; i++) {
      otps.add(generateOTP());
    }
    expect(otps.size).toBeGreaterThanOrEqual(2);
  });
});

describe('getOTPExpiry', () => {
  it('returns a Date approximately 10 minutes in the future', () => {
    const before = Date.now();
    const expiry = getOTPExpiry();
    const after = Date.now();

    const tenMinutesMs = 10 * 60 * 1000;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + tenMinutesMs - 1000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + tenMinutesMs + 1000);
  });
});

describe('OTP_RESEND_COOLDOWN_SECONDS', () => {
  it('equals 60', () => {
    expect(OTP_RESEND_COOLDOWN_SECONDS).toBe(60);
  });
});
