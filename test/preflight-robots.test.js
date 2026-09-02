import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRobots, detectBotChallenge } from '../src/preflight/robots.js';

test('uses OAI-AdsBot-specific rules before wildcard rules', () => {
  const robots = `User-agent: *\nDisallow: /\n\nUser-agent: OAI-AdsBot\nAllow: /ads/\nDisallow: /ads/private/`;
  assert.equal(evaluateRobots(robots, 'https://example.com/ads/product').allowed, true);
  const blocked = evaluateRobots(robots, 'https://example.com/ads/private/x');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.matchedRule.directive, 'disallow');
});

test('falls back to wildcard group and applies longest matching rule with Allow winning ties', () => {
  const robots = `User-agent: *\nDisallow: /shop\nAllow: /shop/public\nDisallow: /same\nAllow: /same`;
  assert.equal(evaluateRobots(robots, 'https://example.com/shop/x').allowed, false);
  assert.equal(evaluateRobots(robots, 'https://example.com/shop/public/a').allowed, true);
  assert.equal(evaluateRobots(robots, 'https://example.com/same').allowed, true);
});

test('missing or empty robots content is treated as no explicit robots block', () => {
  const result = evaluateRobots('', 'https://example.com/path');
  assert.equal(result.allowed, true);
  assert.match(result.evidence, /no explicit/i);
});

test('detects obvious bot challenge, authentication, and rate-limit responses', () => {
  for (const status of [401, 403, 429]) {
    const findings = detectBotChallenge({ status, bodyText: '' });
    assert.equal(findings.length > 0, true);
    assert.equal(findings[0].severity, 'FAIL');
  }
  for (const bodyText of ['Please complete the CAPTCHA', '<div id="cf-chl-widget">challenge</div>', 'Access denied by security policy']) {
    const findings = detectBotChallenge({ status: 200, bodyText });
    assert.equal(findings.length > 0, true, bodyText);
  }
  assert.deepEqual(detectBotChallenge({ status: 200, bodyText: '<h1>Product</h1>' }), []);
});
