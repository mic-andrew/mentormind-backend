import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

function createMockReq(body: unknown = {}): Request {
  return { body } as unknown as Request;
}

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json } as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const testSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validate', () => {
  it('calls next() when body matches schema', () => {
    const middleware = validate(testSchema);
    const req = createMockReq({ email: 'test@example.com', password: 'password123' });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with VALIDATION_ERROR when body is invalid', () => {
    const middleware = validate(testSchema);
    const req = createMockReq({ email: 'not-an-email', password: '123' });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('error details contain field-level messages', () => {
    const middleware = validate(testSchema);
    const req = createMockReq({ email: 'bad', password: '12' });
    const res = createMockRes();
    const next = createMockNext();

    middleware(req, res, next);

    const jsonCall = (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json;
    const response = jsonCall.mock.calls[0][0];

    expect(response.error.details).toBeDefined();
    expect(response.error.details.email).toEqual(expect.arrayContaining(['Invalid email address']));
    expect(response.error.details.password).toEqual(
      expect.arrayContaining(['Password must be at least 6 characters'])
    );
  });
});
