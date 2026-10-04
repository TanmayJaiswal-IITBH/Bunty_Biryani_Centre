import { rateLimit, type RateLimitInfo } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { RateLimitRule } from '../../shared/limits.js';
import { AppError } from '../lib/app-error.js';

interface LimiterOptions {
  /** Only requests that end in an error status use up the allowance. */
  failedOnly?: boolean;
}

/**
 * In-memory limiter (one instance, Batch 1 §9.4). Create these inside createApp so every app
 * has its own counters. Exceeding the rule is 429 RATE_LIMITED with Retry-After.
 */
export function createLimiter(rule: RateLimitRule, options: LimiterOptions = {}): RequestHandler {
  return rateLimit({
    windowMs: rule.windowMs,
    limit: rule.max,
    standardHeaders: false,
    legacyHeaders: false,
    skipSuccessfulRequests: options.failedOnly ?? false,
    handler: (req, res, next) => {
      // express-rate-limit stores its info on req.rateLimit but doesn't augment Express's types.
      const resetTime = (req as typeof req & { rateLimit?: RateLimitInfo }).rateLimit?.resetTime;
      const seconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(rule.windowMs / 1000);
      res.setHeader('Retry-After', String(seconds));
      next(new AppError('RATE_LIMITED', 'Too many attempts. Please try again in a few minutes.'));
    },
  });
}
