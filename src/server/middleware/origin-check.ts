import type { RequestHandler } from 'express';
import { AppError } from '../lib/app-error.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence in depth (Batch 1 §9.2): admin writes must carry an Origin header that is one of
 * the allowed origins. A missing header is rejected too.
 */
export function originCheck(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (!WRITE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.get('origin');
    if (!origin || !allowed.has(origin)) {
      next(new AppError('FORBIDDEN_ORIGIN', 'Request blocked.'));
      return;
    }
    next();
  };
}
