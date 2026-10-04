declare global {
  namespace Express {
    interface Request {
      /** Request id, also sent as the X-Request-Id response header. */
      id: string;
      /** Set by requireAdmin. */
      admin?: { id: number; username: string };
      /** Parsed by the validate() middleware (Express 5's req.query is read-only). */
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
