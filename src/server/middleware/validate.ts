import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Parses the request with shared zod schemas. A failure is a ZodError, which the error handler
 * turns into 400 VALIDATION_ERROR. Results go on req.valid because Express 5's req.query is
 * read-only.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    req.valid = {};
    if (schemas.body) req.valid.body = schemas.body.parse(req.body);
    if (schemas.query) req.valid.query = schemas.query.parse(req.query);
    if (schemas.params) req.valid.params = schemas.params.parse(req.params);
    next();
  };
}
