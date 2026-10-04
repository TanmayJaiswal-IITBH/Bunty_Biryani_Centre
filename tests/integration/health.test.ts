import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../src/server/db';
import { APP_ORIGIN, makeApp } from '../helpers/app';

describe('GET /api/health', () => {
  it('is 200 { status: ok } when the database answers', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('is 503 { status: error } when the database query throws', async () => {
    const broken = {
      $queryRaw: () => {
        throw new Error('db down');
      },
    } as unknown as PrismaClient;
    const { app } = makeApp({ prisma: broken });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error' });
  });
});

describe('API basics', () => {
  it('returns a JSON 404 for an unknown /api path', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  });

  it('sends Cache-Control: no-store on every /api response', async () => {
    const { app } = makeApp();
    for (const path of ['/api/health', '/api/nope', '/api/admin/me']) {
      const res = await request(app).get(path);
      expect(res.headers['cache-control'], path).toBe('no-store');
    }
  });

  it('rejects a malformed JSON body with 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/admin/login')
      .set('Origin', APP_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"username": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Invalid request.');
  });

  it('rejects an 11 KB body with 400', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/admin/login')
      .set('Origin', APP_ORIGIN)
      .send({ username: 'bunty', password: 'x'.repeat(11 * 1024) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('reports field errors for an invalid login body', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/admin/login')
      .set('Origin', APP_ORIGIN)
      .send({ username: 'ab', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual([
      'password',
      'username',
    ]);
  });

  it('hides x-powered-by and sets the content security policy outside development', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});
