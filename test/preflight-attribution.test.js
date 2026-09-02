import test from 'node:test';
import assert from 'node:assert/strict';
import { withSyntheticOppref, evaluateOpprefPreservation } from '../src/preflight/attribution.js';

test('adds a clearly synthetic oppref without dropping existing query parameters', () => {
  const url = withSyntheticOppref('https://example.com/p?a=1&utm_source=x', 'oad_synthetic_123');
  assert.equal(url.searchParams.get('a'), '1');
  assert.equal(url.searchParams.get('utm_source'), 'x');
  assert.equal(url.searchParams.get('oppref'), 'oad_synthetic_123');
});

test('reports whether synthetic oppref survives redirects without claiming real attribution', () => {
  const kept = evaluateOpprefPreservation({ ok: true, status: 200, finalUrl: 'https://example.com/final?oppref=oad_synthetic_123' }, 'oad_synthetic_123');
  assert.equal(kept.severity, 'PASS');
  assert.equal(kept.method, 'simulated');
  assert.match(kept.evidence, /synthetic/i);

  const dropped = evaluateOpprefPreservation({ ok: true, status: 200, finalUrl: 'https://example.com/final' }, 'oad_synthetic_123');
  assert.equal(dropped.severity, 'FAIL');
  assert.match(dropped.remediation, /redirect/i);
});


test('does not claim oppref preservation when the synthetic request itself failed', () => {
  const result = evaluateOpprefPreservation({ ok: false, status: 503, finalUrl: 'https://example.com/?oppref=oad_synthetic_123' }, 'oad_synthetic_123');
  assert.equal(result.severity, 'WARN');
  assert.equal(result.id, 'oppref-unverified');
});
