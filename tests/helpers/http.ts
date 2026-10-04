import type { Express } from 'express';
import request from 'supertest';
import { APP_ORIGIN } from './app';
import { ADMIN_PASSWORD, ADMIN_USERNAME } from './factories';

/** Logs in and returns the `bbc_admin=…` cookie pair to send back as the Cookie header. */
export async function loginCookie(
  app: Express,
  username: string = ADMIN_USERNAME,
  password: string = ADMIN_PASSWORD,
): Promise<string> {
  const res = await request(app)
    .post('/api/admin/login')
    .set('Origin', APP_ORIGIN)
    .send({ username, password });
  if (res.status !== 200) throw new Error(`login failed in test helper: ${res.status} ${res.text}`);
  const header = res.headers['set-cookie'];
  const cookie = Array.isArray(header) ? header[0] : header;
  if (!cookie) throw new Error('login did not set a cookie');
  return cookie.split(';')[0] as string;
}
