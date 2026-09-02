import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFindings } from '../src/preflight/findings.js';
import { scanLandingPage } from '../src/preflight/scan.js';

test('scores deterministic findings with fixed deductions', () => {
  assert.deepEqual(scoreFindings([]), { score: 100, overall: 'PASS' });
  assert.deepEqual(scoreFindings([{ severity: 'WARN' }]), { score: 90, overall: 'WARN' });
  assert.deepEqual(scoreFindings([{ severity: 'FAIL' }, { severity: 'WARN' }]), { score: 60, overall: 'FAIL' });
  assert.deepEqual(scoreFindings(Array.from({ length: 10 }, () => ({ severity: 'FAIL' }))), { score: 0, overall: 'FAIL' });
});

test('orchestrates landing, robots, bot simulation, oppref, and static pixel checks', async () => {
  const calls = [];
  const probe = async (url, options = {}) => {
    calls.push({ url: String(url), userAgent: options.userAgent || '' });
    if (String(url).endsWith('/robots.txt')) return { status: 200, ok: true, finalUrl: String(url), redirects: [], bodyText: 'User-agent: OAI-AdsBot\nAllow: /', issues: [] };
    if (String(url).includes('oppref=oad_test_token')) return { status: 200, ok: true, finalUrl: 'https://shop.example/landing?oppref=oad_test_token', redirects: [], bodyText: '<html></html>', issues: [] };
    return { status: 200, ok: true, finalUrl: 'https://shop.example/landing?utm_source=chatgpt', redirects: [], bodyText: '<script src="https://bzrcdn.openai.com/sdk/oaiq.min.js"></script>', issues: [] };
  };

  const report = await scanLandingPage('https://shop.example/landing?secret=value', {
    probe,
    tokenFactory: () => 'oad_test_token'
  });

  assert.equal(report.inputUrl, 'https://shop.example/landing');
  assert.equal(report.finalUrl, 'https://shop.example/landing');
  assert.equal(report.overall, 'WARN');
  assert.equal(report.categories['Landing accessibility'].length > 0, true);
  assert.equal(report.categories['OAI-AdsBot readiness'].length > 0, true);
  assert.equal(report.categories['Attribution path'].some((x) => x.id === 'oppref-preserved'), true);
  assert.equal(report.categories['Pixel readiness'].some((x) => x.method === 'incomplete'), true);
  assert.equal(report.categories['Conversion-event readiness'].some((x) => x.method === 'incomplete'), true);
  assert.equal(JSON.stringify(report).includes('secret=value'), false);
  assert.equal(calls.length, 4);
});

test('turns landing and robots failures into actionable findings without returning response bodies', async () => {
  const probe = async (url, options = {}) => {
    if (String(url).endsWith('/robots.txt')) return { status: 200, ok: true, finalUrl: String(url), redirects: [], bodyText: 'User-agent: OAI-AdsBot\nDisallow: /blocked', issues: [] };
    if (options.userAgent === 'OAI-AdsBot') return { status: 403, ok: false, finalUrl: String(url), redirects: [], bodyText: 'Access denied', issues: ['Landing request returned HTTP 403.'] };
    if (String(url).includes('oppref=')) return { status: 200, ok: true, finalUrl: 'https://example.com/blocked', redirects: [{ status: 302 }], bodyText: '', issues: [] };
    return { status: 503, ok: false, finalUrl: 'https://example.com/blocked', redirects: [], bodyText: 'internal body must not leak', issues: ['Landing request returned HTTP 503.'] };
  };
  const report = await scanLandingPage('https://example.com/blocked', { probe, tokenFactory: () => 'oad_x' });
  assert.equal(report.overall, 'FAIL');
  assert.ok(report.findings.some((x) => x.id === 'landing-unreachable'));
  assert.ok(report.findings.some((x) => x.id === 'robots-block'));
  assert.ok(report.findings.some((x) => x.id === 'bot-challenge'));
  assert.ok(report.findings.some((x) => x.id === 'oppref-dropped'));
  assert.equal(JSON.stringify(report).includes('internal body must not leak'), false);
});


test('reports a failed crawler simulation even when it is not a classic challenge status', async () => {
  const probe = async (url, options = {}) => {
    if (String(url).endsWith('/robots.txt')) return { status: 404, ok: false, finalUrl: String(url), redirects: [], bodyText: '', issues: ['Landing request returned HTTP 404.'] };
    if (options.userAgent === 'OAI-AdsBot') return { status: 503, ok: false, finalUrl: String(url), redirects: [], bodyText: '', issues: ['Landing request returned HTTP 503.'] };
    return { status: 200, ok: true, finalUrl: String(url), redirects: [], bodyText: '', issues: [] };
  };
  const report = await scanLandingPage('https://example.com/', { probe, tokenFactory: () => 'oad_x' });
  assert.ok(report.findings.some((x) => x.id === 'bot-simulation-failed' && x.severity === 'FAIL'));
});
