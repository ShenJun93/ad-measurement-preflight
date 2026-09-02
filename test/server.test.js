import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

async function withServer(options, fn) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

const report = {
  inputUrl: 'https://example.com/', finalUrl: 'https://example.com/', overall: 'WARN', score: 80,
  findings: [{ id: 'x', category: 'Pixel readiness', severity: 'WARN', evidence: 'e', why: 'w', remediation: 'r', method: 'incomplete' }],
  categories: {}, limitations: []
};

test('serves scanner static assets with security headers', async () => {
  await withServer({ scanFn: async () => report }, async (base) => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /ChatGPT Ads Tracking/i);
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const robots = await fetch(base + '/robots.txt');
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get('content-type'), /text\/plain/);
    assert.match(await robots.text(), /User-agent:\s*\*/i);
    const sitemap = await fetch(base + '/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get('content-type'), /application\/xml/);
  });
});

test('POST /api/scan accepts only a small JSON url payload', async () => {
  const seen = [];
  await withServer({ scanFn: async (url) => { seen.push(url); return report; } }, async (base) => {
    const ok = await fetch(base + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com' }) });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), report);
    assert.deepEqual(seen, ['https://example.com']);

    const badJson = await fetch(base + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(badJson.status, 400);

    const extra = await fetch(base + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com', headers: { Authorization: 'x' } }) });
    assert.equal(extra.status, 400);

    const huge = await fetch(base + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'x'.repeat(17000) }) });
    assert.equal(huge.status, 413);
  });
});

test('scan errors are normalized and unsupported methods are rejected', async () => {
  await withServer({ scanFn: async () => { throw new Error('URL must use http or https.'); } }, async (base) => {
    const res = await fetch(base + '/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'file:///x' }) });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'URL must use http or https.' });
    const get = await fetch(base + '/api/scan');
    assert.equal(get.status, 405);
  });
});

test('analytics accepts an allowlisted event name only and never URL/page payloads', async () => {
  const events = [];
  await withServer({ scanFn: async () => report, analyticsSink: (event) => events.push(event) }, async (base) => {
    const ok = await fetch(base + '/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'scan_started' }) });
    assert.equal(ok.status, 204);
    const badEvent = await fetch(base + '/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'arbitrary' }) });
    assert.equal(badEvent.status, 400);
    const leaked = await fetch(base + '/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'scan_started', url: 'https://secret.example' }) });
    assert.equal(leaked.status, 400);
  });
  assert.deepEqual(events, ['scan_started']);
});
