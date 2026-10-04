import type { RequestHandler } from 'express';
import type { AdminSession } from '../../../shared/api-types.js';
import type { LoginInput } from '../../../shared/schemas/auth.js';
import type { Clock } from '../../../shared/time.js';
import type { PrismaClient } from '../../db.js';
import {
  clearSessionCookie,
  issueToken,
  login,
  setSessionCookie,
} from '../../services/auth.service.js';

interface Deps {
  prisma: PrismaClient;
  clock: Clock;
  jwtSecret: string;
  isProduction: boolean;
}

export function adminAuthHandlers({ prisma, clock, jwtSecret, isProduction }: Deps) {
  const loginHandler: RequestHandler = async (req, res) => {
    const { username, password } = req.valid.body as LoginInput;
    const admin = await login(prisma, username, password);
    const token = await issueToken(admin, { secret: jwtSecret, clock });
    setSessionCookie(res, token, isProduction);
    const session: AdminSession = { username: admin.username };
    res.json(session);
  };

  const logoutHandler: RequestHandler = (_req, res) => {
    clearSessionCookie(res, isProduction);
    res.status(204).end();
  };

  const meHandler: RequestHandler = (req, res) => {
    const session: AdminSession = { username: req.admin?.username ?? '' };
    res.json(session);
  };

  return { loginHandler, logoutHandler, meHandler };
}
