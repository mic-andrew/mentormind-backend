import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  generateTokenPair,
} from '../../utils/jwt';

const testPayload = { userId: 'user123', email: 'test@example.com' };

describe('generateAccessToken', () => {
  it('returns a valid JWT string with 3 dot-separated parts', () => {
    const token = generateAccessToken(testPayload);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });
});

describe('generateRefreshToken', () => {
  it('returns a valid JWT string with 3 dot-separated parts', () => {
    const token = generateRefreshToken(testPayload);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });
});

describe('verifyToken', () => {
  it('correctly decodes the token payload (userId and email)', () => {
    const token = generateAccessToken(testPayload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(testPayload.userId);
    expect(decoded.email).toBe(testPayload.email);
  });

  it('throws for invalid tokens', () => {
    expect(() => verifyToken('invalid.token.string')).toThrow();
  });
});

describe('generateTokenPair', () => {
  it('returns both accessToken and refreshToken', () => {
    const pair = generateTokenPair(testPayload);
    expect(pair).toHaveProperty('accessToken');
    expect(pair).toHaveProperty('refreshToken');
    expect(typeof pair.accessToken).toBe('string');
    expect(typeof pair.refreshToken).toBe('string');
  });

  it('returns different strings for accessToken and refreshToken', () => {
    const pair = generateTokenPair(testPayload);
    expect(pair.accessToken).not.toBe(pair.refreshToken);
  });
});
