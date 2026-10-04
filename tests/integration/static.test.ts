import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeApp } from '../helpers/app';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'bbc-client-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><title>BBC</title><div id="root"></div>',
  );
  writeFileSync(path.join(dir, 'assets', 'app-abc123.js'), 'console.log("hi")');
  writeFileSync(path.join(dir, 'favicon-32.png'), 'png');
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('built client (production-style static serving)', () => {
  const html = { Accept: 'text/html,application/xhtml+xml' };

  it('serves index.html for a deep link and never caches it', async () => {
    const { app } = makeApp({ clientDir: dir });
    const res = await request(app).get('/admin/stock').set(html);
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('serves hashed assets as immutable', async () => {
    const { app } = makeApp({ clientDir: dir });
    const res = await request(app).get('/assets/app-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('caches other static files for an hour', async () => {
    const { app } = makeApp({ clientDir: dir });
    const res = await request(app).get('/favicon-32.png');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });

  it('keeps unknown /api paths as JSON 404, even when asking for HTML', async () => {
    const { app } = makeApp({ clientDir: dir });
    const res = await request(app).get('/api/unknown').set(html);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('keeps a missing asset a 404 instead of returning index.html', async () => {
    const { app } = makeApp({ clientDir: dir });
    const res = await request(app).get('/assets/missing.js').set('Accept', '*/*');
    expect(res.status).toBe(404);
  });

  it('mounts nothing when the build folder has no index.html', async () => {
    const { app } = makeApp({ clientDir: path.join(dir, 'does-not-exist') });
    const res = await request(app).get('/').set(html);
    expect(res.status).toBe(404);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('serves no client at all when clientDir is null (pnpm dev)', async () => {
    const { app } = makeApp({ clientDir: null });
    expect((await request(app).get('/').set(html)).status).toBe(404);
  });
});
