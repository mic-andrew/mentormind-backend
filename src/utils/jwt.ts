/**
 * JWT utilities
 */

import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { env } from '../config/env.js';

interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwt.secret!, {
    expiresIn: env.jwt.expiresIn as StringValue,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwt.secret!, {
    expiresIn: env.jwt.refreshExpiresIn as StringValue,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwt.secret!) as unknown as TokenPayload;
}

export function generateTokenPair(payload: TokenPayload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
