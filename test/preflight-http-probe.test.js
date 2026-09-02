import test from 'node:test';
import assert from 'node:assert/strict';
import { probeUrl, createPinnedLookup } from '../src/preflight/http-probe.js';

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }];

test('validates every redirect destination before fetching it', async () => {
  const resolved = [];
  const resolveHost = async (host) => {
    resolved.push(host);
    if (host === 'private.example') return [{ address: '127.0.0.1', family: 4 }];
    return [{ address: '93.184.216.34', family: 4 }];
  };
  const fetched = [];
  const fetchImpl = async (url) => {
    fetched.push(String(url));
    return new Response('', { status: 302, headers: { location: 'https://private.example/secret' } });
  };
  await assert.rejects(() => probeUrl('https://public.example/start', { fetchImpl, resolveHost }), /non-public/i);
  assert.deepEqual(resolved, ['public.example', 'private.example']);
  assert.deepEqual(fetched, ['https://public.example/start']);
});

test('follows relative redirects and returns final status/body', async () => {
  const fetchImpl = async (url) => String(url).endsWith('/start')
    ? new Response('', { status: 301, headers: { location: '/landing?oppref=x' } })
    : new Response('<html>ok</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  const result = await probeUrl('https://example.com/start', { fetchImpl, resolveHost: publicResolver });
  assert.equal(result.finalUrl, 'https://example.com/landing?oppref=x');
  assert.equal(result.status, 200);
  assert.equal(result.redirects.length, 1);
  assert.equal(result.bodyText, '<html>ok</html>');
  assert.equal(result.contentType, 'text/html');
});

test('flags excessive redirects and http failures', async () => {
  const loopingFetch = async (url) => new Response('', { status: 302, headers: { location: String(url) } });
  const loop = await probeUrl('https://example.com/x', { fetchImpl: loopingFetch, resolveHost: publicResolver, maxRedirects: 2 });
  assert.equal(loop.ok, false);
  assert.match(loop.issues.join(' '), /redirect/i);

  const failed = await probeUrl('https://example.com/down', { fetchImpl: async () => new Response('no', { status: 503 }), resolveHost: publicResolver });
  assert.equal(failed.status, 503);
  assert.equal(failed.ok, false);
  assert.match(failed.issues.join(' '), /503/);
});

test('caps retained response body bytes', async () => {
  const result = await probeUrl('https://example.com/large', {
    fetchImpl: async () => new Response('abcdefghijklmnopqrstuvwxyz'),
    resolveHost: publicResolver,
    maxBodyBytes: 10
  });
  assert.equal(Buffer.byteLength(result.bodyText), 10);
  assert.equal(result.bodyTruncated, true);
});


test('pinned DNS lookup returns only the already-validated destination address', async () => {
  const lookup = createPinnedLookup('93.184.216.34');
  const one = await new Promise((resolve, reject) => lookup('example.com', {}, (error, address, family) => error ? reject(error) : resolve({ address, family })));
  assert.deepEqual(one, { address: '93.184.216.34', family: 4 });
  const all = await new Promise((resolve, reject) => lookup('example.com', { all: true }, (error, rows) => error ? reject(error) : resolve(rows)));
  assert.deepEqual(all, [{ address: '93.184.216.34', family: 4 }]);
});
