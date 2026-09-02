import dns from 'node:dns/promises';
import net from 'node:net';

function ipv4Number(ip) {
  return ip.split('.').reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;
}

function inV4(ip, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(ip) & mask) === (ipv4Number(base) & mask);
}

function normalizeV6(ip) {
  return ip.toLowerCase().split('%')[0];
}

function ipv6ToBigInt(address) {
  let ip = normalizeV6(address);
  const dotted = ip.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = ipv4Number(dotted[1]);
    const replacement = `${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`;
    ip = ip.slice(0, dotted.index) + replacement;
  }
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const parts = [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  return parts.reduce((value, part) => (value << 16n) | BigInt(parseInt(part, 16)), 0n);
}

function inV6(address, base, bits) {
  const value = ipv6ToBigInt(address);
  const root = ipv6ToBigInt(base);
  if (value === null || root === null) return false;
  const shift = 128n - BigInt(bits);
  return (value >> shift) === (root >> shift);
}

export function isPublicIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const blocked = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
      ['224.0.0.0', 4], ['240.0.0.0', 4]
    ];
    return !blocked.some(([base, bits]) => inV4(address, base, bits));
  }
  if (family === 6) {
    const ip = normalizeV6(address);
    const mappedDotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedDotted) return isPublicIp(mappedDotted[1]);
    const mappedHex = ipv6ToBigInt(ip);
    if (mappedHex !== null && inV6(ip, '::ffff:0:0', 96)) {
      const v4 = Number(mappedHex & 0xffffffffn) >>> 0;
      return isPublicIp(`${v4 >>> 24}.${(v4 >>> 16) & 255}.${(v4 >>> 8) & 255}.${v4 & 255}`);
    }
    const blocked = [
      ['::', 128], ['::1', 128], ['100::', 64], ['2001:2::', 48], ['2001:10::', 28],
      ['2001:20::', 28], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
    ];
    if (blocked.some(([base, bits]) => inV6(ip, base, bits))) return false;
    return inV6(ip, '2000::', 3);
  }
  return false;
}

export function normalizePublicHttpUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('URL is required.');
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url;
  try { url = new URL(candidate); } catch { throw new Error('Enter a valid URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL must use http or https.');
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) throw new Error('localhost is not a public destination.');
  return url;
}

export async function assertPublicDestination(url, { resolveHost = (host) => dns.lookup(host, { all: true, verbatim: true }) } = {}) {
  const parsed = url instanceof URL ? url : normalizePublicHttpUrl(url);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = net.isIP(hostname);
  const rows = literalFamily ? [{ address: hostname, family: literalFamily }] : await resolveHost(hostname);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`Could not resolve ${hostname}.`);
  const addresses = rows.map((row) => typeof row === 'string' ? row : row.address).filter(Boolean);
  if (!addresses.length || addresses.some((address) => !isPublicIp(address))) {
    throw new Error(`Destination resolves to a non-public IP address: ${hostname}.`);
  }
  return { url: parsed, addresses };
}
