import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';
import type { AuthenticatedRequest } from '../../middleware/auth';

const JWT_SECRET = 'test-jwt-secret-key';

function createMockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json } as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function createValidToken(
  payload: { userId: string; email: string },
  expiresIn: string = '1h'
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function createExpiredToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticate', () => {
  const payload = { userId: 'user123', email: 'test@example.com' };

  it('calls next() with a valid Bearer token', () => {
    const token = createValidToken(payload);
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('attaches userId and email to request', () => {
    const token = createValidToken(payload);
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    const authReq = req as unknown as AuthenticatedRequest;
    expect(authReq.userId).toBe(payload.userId);
    expect(authReq.email).toBe(payload.email);
  });

  it('returns 401 when no auth header is present', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no Bearer prefix', () => {
    const token = createValidToken(payload);
    const req = createMockReq({ authorization: token });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', () => {
    const req = createMockReq({ authorization: 'Bearer invalidtokenstring' });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_TOKEN' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const token = createExpiredToken(payload);
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = createMockNext();

    authenticate(req, res, next);

    // Note: TokenExpiredError extends JsonWebTokenError, so the first
    // instanceof check in the source catches it with code 'INVALID_TOKEN'.
    expect(res.status).toHaveBeenCalledWith(401);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_TOKEN' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuthenticate', () => {
  const payload = { userId: 'user456', email: 'optional@example.com' };

  it('calls next() when no token is present', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('attaches user info when token is valid', () => {
    const token = createValidToken(payload);
    const req = createMockReq({ authorization: `Bearer ${token}` });
    const res = createMockRes();
    const next = createMockNext();

    optionalAuthenticate(req, res, next);

    const authReq = req as unknown as AuthenticatedRequest;
    expect(authReq.userId).toBe(payload.userId);
    expect(authReq.email).toBe(payload.email);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when token is invalid (no error response)', () => {
    const req = createMockReq({ authorization: 'Bearer invalidtoken' });
    const res = createMockRes();
    const next = createMockNext();

    optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
