import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePublicHttpUrl, assertPublicDestination, isPublicIp } from '../src/preflight/url-policy.js';

test('normalizes public http/https URLs and rejects unsafe URL forms', () => {
  assert.equal(normalizePublicHttpUrl('example.com/path').href, 'https://example.com/path');
  assert.equal(normalizePublicHttpUrl('http://example.com').href, 'http://example.com/');
  assert.throws(() => normalizePublicHttpUrl('file:///etc/passwd'), /http or https/i);
  assert.throws(() => normalizePublicHttpUrl('https://user:pass@example.com'), /credentials/i);
  assert.throws(() => normalizePublicHttpUrl('http://localhost/test'), /localhost/i);
  assert.equal(normalizePublicHttpUrl('https://[2606:4700:4700::1111]/').hostname, '[2606:4700:4700::1111]');
});

test('classifies public and non-public IP addresses conservatively', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.1.1','0.0.0.0','100.64.0.1','224.0.0.1','255.255.255.255','::1','fe80::1','fc00::1','ff02::1','2001:db8::1','2002:0a00:0001::1','::ffff:127.0.0.1','::ffff:0a00:1']) {
    assert.equal(isPublicIp(ip), false, ip);
  }
  for (const ip of ['8.8.8.8','1.1.1.1','93.184.216.34','2606:4700:4700::1111']) {
    assert.equal(isPublicIp(ip), true, ip);
  }
});

test('resolves hostnames and rejects any private/reserved destination', async () => {
  const resolveHost = async (host) => host === 'good.example'
    ? [{ address: '93.184.216.34', family: 4 }]
    : [{ address: '127.0.0.1', family: 4 }];

  const literal = await assertPublicDestination(new URL('https://[2606:4700:4700::1111]/'), { resolveHost });
  assert.deepEqual(literal.addresses, ['2606:4700:4700::1111']);
  const ok = await assertPublicDestination(new URL('https://good.example/path'), { resolveHost });
  assert.deepEqual(ok.addresses, ['93.184.216.34']);
  await assert.rejects(() => assertPublicDestination(new URL('https://bad.example/path'), { resolveHost }), /non-public/i);
});
