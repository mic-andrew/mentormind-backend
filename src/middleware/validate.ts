/**
 * Request validation middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { sendError, ErrorCodes } from '../utils/response.js';

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};

        error.errors.forEach((err) => {
          const path = err.path.join('.');
          if (!details[path]) {
            details[path] = [];
          }
          details[path].push(err.message);
        });

        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Validation failed', 400, details);
        return;
      }

      next(error);
    }
  };
}
