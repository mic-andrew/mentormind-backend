import type { Response } from 'express';
import { sendSuccess, sendError, ErrorCodes } from '../../utils/response';

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendSuccess', () => {
  it('calls res.status(200).json with {success: true, data}', () => {
    const res = createMockRes();
    const data = { id: 1, name: 'Test' };

    sendSuccess(res, data);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith({
      success: true,
      data,
    });
  });

  it('uses custom status code when provided', () => {
    const res = createMockRes();
    const data = { created: true };

    sendSuccess(res, data, 201);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith({
      success: true,
      data,
    });
  });
});

describe('sendError', () => {
  it('calls res.status(400).json with {success: false, error: {code, message}}', () => {
    const res = createMockRes();

    sendError(res, ErrorCodes.VALIDATION_ERROR, 'Validation failed');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
  });

  it('includes details when provided', () => {
    const res = createMockRes();
    const details = { email: ['Email is required'] };

    sendError(res, ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, details);

    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
    });
  });

  it('uses custom status code when provided', () => {
    const res = createMockRes();

    sendError(res, ErrorCodes.NOT_FOUND, 'Resource not found', 404);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('ErrorCodes', () => {
  it('has all expected enum values', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
    expect(ErrorCodes.USER_EXISTS).toBe('USER_EXISTS');
    expect(ErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    expect(ErrorCodes.INVALID_TOKEN).toBe('INVALID_TOKEN');
    expect(ErrorCodes.INVALID_OTP).toBe('INVALID_OTP');
    expect(ErrorCodes.EMAIL_NOT_VERIFIED).toBe('EMAIL_NOT_VERIFIED');
    expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
    expect(ErrorCodes.OTP_COOLDOWN).toBe('OTP_COOLDOWN');
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ErrorCodes.COACH_LIMIT_EXCEEDED).toBe('COACH_LIMIT_EXCEEDED');
    expect(ErrorCodes.SESSION_LIMIT_EXCEEDED).toBe('SESSION_LIMIT_EXCEEDED');
    expect(ErrorCodes.SUBSCRIPTION_REQUIRED).toBe('SUBSCRIPTION_REQUIRED');
  });
});
