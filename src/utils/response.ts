/**
 * Response utility functions
 * Provides consistent API response format
 */

import type { Response } from 'express';

export enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INVALID_OTP = 'INVALID_OTP',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  CONFLICT = 'CONFLICT',
  OTP_COOLDOWN = 'OTP_COOLDOWN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  COACH_LIMIT_EXCEEDED = 'COACH_LIMIT_EXCEEDED',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  code: ErrorCodes,
  message: string,
  statusCode: number = 400,
  details?: Record<string, string[]>
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
  res.status(statusCode).json(response);
}
