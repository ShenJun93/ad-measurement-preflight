import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ORIGIN = 'https://chatgpt-ads-tracking-checker.vercel.app';

test('ships crawlable robots and sitemap assets instead of SPA fallback', async () => {
  const [robots, sitemap, vercel] = await Promise.all([
    readFile(new URL('../robots.txt', import.meta.url), 'utf8'),
    readFile(new URL('../sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../vercel.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Disallow:\s*\/api\//i);
  assert.match(robots, new RegExp(`Sitemap: ${ORIGIN.replaceAll('.', '\\.')}/sitemap\\.xml`));
  assert.match(sitemap, new RegExp(`<loc>${ORIGIN.replaceAll('.', '\\.')}/<\\/loc>`));

  const buildSources = new Set(vercel.builds.map((x) => x.src));
  assert.ok(buildSources.has('robots.txt'));
  assert.ok(buildSources.has('sitemap.xml'));
  assert.deepEqual(vercel.routes.slice(0, 2), [
    { src: '/robots.txt', dest: '/robots.txt' },
    { src: '/sitemap.xml', dest: '/sitemap.xml' },
  ]);
});

test('landing page targets high-intent ChatGPT Ads measurement queries with canonical metadata', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<title>ChatGPT Ads Tracking &amp; Measurement Checker \| Free Preflight<\/title>/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN.replaceAll('.', '\\.')}\/"`));
  assert.match(html, /name="robots" content="index,follow,max-image-preview:large"/);
  assert.match(html, /property="og:title" content="ChatGPT Ads Tracking &amp; Measurement Checker"/);
  assert.match(html, /<h1>Check your ChatGPT Ads tracking before you spend<\/h1>/);
});
