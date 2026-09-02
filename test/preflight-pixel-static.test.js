import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectStaticPixel } from '../src/preflight/pixel-static.js';

test('detects OpenAI Pixel SDK and inline initialization but remains incomplete without browser execution', () => {
  const html = `<script src="https://bzrcdn.openai.com/sdk/oaiq.min.js"></script><script>oaiq('init',{pixelId:'pix_123'})</script>`;
  const result = inspectStaticPixel(html);
  assert.equal(result.sdkReferenced, true);
  assert.equal(result.initReferenced, true);
  assert.equal(result.status, 'incomplete');
  assert.ok(result.findings.some((x) => x.method === 'incomplete'));
});

test('flags an obvious missing Pixel SDK reference', () => {
  const result = inspectStaticPixel('<html><h1>Hello</h1></html>');
  assert.equal(result.sdkReferenced, false);
  assert.ok(result.findings.some((x) => x.severity === 'WARN' && /sdk/i.test(x.evidence)));
});

test('flags obvious CSP meta that permits only self scripts', () => {
  const result = inspectStaticPixel(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">`);
  assert.ok(result.findings.some((x) => x.severity === 'WARN' && /CSP/i.test(x.evidence)));
});
