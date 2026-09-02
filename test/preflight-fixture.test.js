import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

test('public HTTP surface returns the Slice 1 report contract end-to-end', async () => {
  const deterministicReport = {
    inputUrl: 'https://shop.example/landing', finalUrl: 'https://shop.example/final', overall: 'WARN', score: 80, durationMs: 12,
    findings: [{ id: 'pixel-runtime-not-executed', category: 'Pixel readiness', severity: 'WARN', evidence: 'Static only.', why: 'Runtime unknown.', remediation: 'Use browser probe.', method: 'incomplete' }],
    categories: {
      'Landing accessibility': [], 'OAI-AdsBot readiness': [], 'Attribution path': [],
      'Pixel readiness': [{ id: 'pixel-runtime-not-executed', severity: 'WARN', method: 'incomplete' }],
      'Conversion-event readiness': []
    },
    limitations: ['OAI-AdsBot readiness is simulated.']
  };
  const server = createServer({ scanFn: async () => deterministicReport, analyticsSink: () => {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/scan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://shop.example/landing' }) });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.overall, 'WARN');
    assert.equal(report.score, 80);
    assert.equal(report.findings[0].method, 'incomplete');
    assert.ok(report.categories['Pixel readiness']);
    assert.ok(Array.isArray(report.limitations));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
