import { hashPassword, comparePassword } from '../../utils/password';

describe('hashPassword', () => {
  it('returns a bcrypt hash', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('produces different hashes for the same input due to salt', async () => {
    const hash1 = await hashPassword('samepassword');
    const hash2 = await hashPassword('samepassword');
    expect(hash1).not.toBe(hash2);
  });
});

describe('comparePassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await comparePassword('correctpassword', hash);
    expect(result).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correctpassword');
    const result = await comparePassword('wrongpassword', hash);
    expect(result).toBe(false);
  });
});
