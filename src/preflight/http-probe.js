import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { Readable } from 'node:stream';
import { assertPublicDestination, normalizePublicHttpUrl } from './url-policy.js';

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const DEFAULT_UA = 'OpenAI-Ads-Measurement-Health-Monitor/0.1 (+preflight simulation)';

export function createPinnedLookup(address) {
  const family = net.isIP(address);
  if (!family) throw new Error('Pinned destination must be an IP address.');
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

function pinnedFetch(url, { method = 'GET', headers = {}, signal } = {}, address) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const request = transport.request(parsed, {
      method,
      headers,
      signal,
      lookup: createPinnedLookup(address),
      ...(parsed.protocol === 'https:' ? { servername: parsed.hostname } : {})
    }, (response) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) for (const item of value) responseHeaders.append(name, item);
        else if (value !== undefined) responseHeaders.set(name, String(value));
      }
      const status = response.statusCode || 500;
      const noBody = [204, 205, 304].includes(status);
      resolve(new Response(noBody ? null : Readable.toWeb(response), {
        status,
        statusText: response.statusMessage || '',
        headers: responseHeaders
      }));
    });
    request.on('error', reject);
    request.end();
  });
}

async function readLimitedBody(response, maxBodyBytes) {
  if (!response.body) return { bodyText: '', bodyTruncated: false };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBodyBytes - total;
      if (remaining <= 0) { truncated = true; break; }
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        truncated = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    if (truncated) await reader.cancel().catch(() => {});
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return { bodyText: new TextDecoder().decode(merged), bodyTruncated: truncated };
}

export async function probeUrl(input, {
  fetchImpl = null,
  resolveHost,
  userAgent = DEFAULT_UA,
  maxRedirects = 8,
  timeoutMs = 15_000,
  maxBodyBytes = 2 * 1024 * 1024
} = {}) {
  let current = normalizePublicHttpUrl(input);
  const requestedUrl = current.href;
  const redirects = [];
  const issues = [];
  const startedAt = Date.now();

  for (let hop = 0; ; hop += 1) {
    const destination = await assertPublicDestination(current, { resolveHost });
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      return { requestedUrl, finalUrl: current.href, status: null, ok: false, redirects, bodyText: '', bodyTruncated: false, contentType: '', issues: ['Request failed: timeout'] };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);
    let response;
    try {
      const options = {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1' }
      };
      response = fetchImpl
        ? await fetchImpl(current.href, options)
        : await pinnedFetch(current.href, options, destination.addresses[0]);
    } catch (error) {
      clearTimeout(timer);
      return {
        requestedUrl, finalUrl: current.href, status: null, ok: false, redirects,
        bodyText: '', bodyTruncated: false, contentType: '',
        issues: [`Request failed: ${error?.name === 'AbortError' ? 'timeout' : String(error?.message || error)}`]
      };
    }
    clearTimeout(timer);

    if (REDIRECTS.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        issues.push(`HTTP ${response.status} redirect is missing a Location header.`);
        return { requestedUrl, finalUrl: current.href, status: response.status, ok: false, redirects, bodyText: '', bodyTruncated: false, contentType: '', issues };
      }
      if (hop >= maxRedirects) {
        issues.push(`Redirect limit exceeded (${maxRedirects}).`);
        return { requestedUrl, finalUrl: current.href, status: response.status, ok: false, redirects, bodyText: '', bodyTruncated: false, contentType: '', issues };
      }
      const next = new URL(location, current);
      redirects.push({ from: current.href, status: response.status, to: next.href });
      current = next;
      continue;
    }

    const { bodyText, bodyTruncated } = await readLimitedBody(response, maxBodyBytes);
    const contentType = response.headers.get('content-type') || '';
    if (response.status < 200 || response.status >= 400) issues.push(`Landing request returned HTTP ${response.status}.`);
    return {
      requestedUrl,
      finalUrl: current.href,
      status: response.status,
      ok: issues.length === 0,
      redirects,
      bodyText,
      bodyTruncated,
      contentType,
      issues
    };
  }
}
