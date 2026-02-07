import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth';
import { checkCoachCreationLimit, checkSessionLimit } from '../../middleware/subscription';

vi.mock('../../services/subscriptionService', () => ({
  subscriptionService: {
    canCreateCoach: vi.fn(),
    canStartSession: vi.fn(),
  },
}));

import { subscriptionService } from '../../services/subscriptionService';

const mockedSubscriptionService = subscriptionService as {
  canCreateCoach: ReturnType<typeof vi.fn>;
  canStartSession: ReturnType<typeof vi.fn>;
};

function createMockReq(userId: string = 'user123'): AuthenticatedRequest {
  return { userId } as unknown as AuthenticatedRequest;
}

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json } as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkCoachCreationLimit', () => {
  it('calls next() when canCreateCoach returns true', async () => {
    mockedSubscriptionService.canCreateCoach.mockResolvedValue(true);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await checkCoachCreationLimit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when canCreateCoach returns false', async () => {
    mockedSubscriptionService.canCreateCoach.mockResolvedValue(false);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await checkCoachCreationLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'COACH_LIMIT_EXCEEDED',
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when service throws', async () => {
    mockedSubscriptionService.canCreateCoach.mockRejectedValue(new Error('DB error'));
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await checkCoachCreationLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Failed to check subscription limits',
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe('checkSessionLimit', () => {
  it('calls next() when canStartSession returns true', async () => {
    mockedSubscriptionService.canStartSession.mockResolvedValue(true);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await checkSessionLimit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when canStartSession returns false', async () => {
    mockedSubscriptionService.canStartSession.mockResolvedValue(false);
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await checkSessionLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'SESSION_LIMIT_EXCEEDED',
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when service throws', async () => {
    mockedSubscriptionService.canStartSession.mockRejectedValue(new Error('DB error'));
    const req = createMockReq();
    const res = createMockRes();
    const next = createMockNext();

    await checkSessionLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(
      (res.status as ReturnType<typeof vi.fn>).mock.results[0].value.json
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Failed to check subscription limits',
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
