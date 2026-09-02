import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanLandingPage } from './src/preflight/scan.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/robots.txt', ['robots.txt', 'text/plain; charset=utf-8']],
  ['/sitemap.xml', ['sitemap.xml', 'application/xml; charset=utf-8']]
]);
const ANALYTICS_EVENTS = new Set(['scanner_impression', 'scan_started', 'scan_completed', 'actionable_finding_viewed', 'repeat_scan', 'monitor_interest']);
const JSON_LIMIT = 16 * 1024;

function setSecurityHeaders(res) {
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('cache-control', 'no-store');
}

function sendJson(res, status, value) {
  setSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > JSON_LIMIT) { tooLarge = true; return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function createServer({ scanFn = scanLandingPage, analyticsSink = (event) => console.log(JSON.stringify({ type: 'analytics', event, at: Date.now() })) } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/api/scan') {
        if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
        const body = await readJson(req);
        if (!isPlainObject(body) || Object.keys(body).length !== 1 || typeof body.url !== 'string' || !body.url.trim()) {
          return sendJson(res, 400, { error: 'Body must contain only a non-empty url string.' });
        }
        try {
          const report = await scanFn(body.url);
          return sendJson(res, 200, report);
        } catch (error) {
          const message = String(error?.message || error);
          const clientError = /url|http|https|credentials|localhost|non-public|resolve/i.test(message);
          return sendJson(res, clientError ? 400 : 502, { error: message });
        }
      }

      if (url.pathname === '/api/analytics') {
        if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return sendJson(res, 405, { error: 'Method not allowed.' }); }
        const body = await readJson(req);
        if (!isPlainObject(body) || Object.keys(body).length !== 1 || !ANALYTICS_EVENTS.has(body.event)) {
          return sendJson(res, 400, { error: 'Invalid analytics event.' });
        }
        analyticsSink(body.event);
        setSecurityHeaders(res);
        res.statusCode = 204;
        return res.end();
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' });
      const asset = STATIC.get(url.pathname);
      if (!asset) return sendJson(res, 404, { error: 'Not found.' });
      const [file, contentType] = asset;
      const content = await readFile(join(ROOT, file));
      setSecurityHeaders(res);
      res.statusCode = 200;
      res.setHeader('content-type', contentType);
      res.setHeader('content-length', content.length);
      if (req.method === 'HEAD') return res.end();
      res.end(content);
    } catch (error) {
      sendJson(res, error?.statusCode || 500, { error: error?.statusCode ? error.message : 'Internal server error.' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  createServer().listen(port, '0.0.0.0', () => console.log(`Ad Measurement Preflight: http://localhost:${port}`));
}
