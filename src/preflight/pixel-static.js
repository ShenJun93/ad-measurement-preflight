const SDK_RE = /https:\/\/bzrcdn\.openai\.com\/sdk\/oaiq\.min\.js/i;
const INIT_RE = /\boaiq\s*\(\s*['"]init['"]/i;

export function inspectStaticPixel(html) {
  const text = String(html || '').slice(0, 2 * 1024 * 1024);
  const sdkReferenced = SDK_RE.test(text);
  const initReferenced = INIT_RE.test(text);
  const findings = [];

  if (!sdkReferenced) {
    findings.push({
      id: 'pixel-sdk-not-seen', category: 'Pixel readiness', severity: 'WARN', method: 'incomplete',
      evidence: 'Static HTML did not contain the OpenAI Pixel SDK reference.',
      why: 'The Pixel may be injected later by JavaScript or a tag manager, so static absence is not conclusive.',
      remediation: 'Confirm the OpenAI Pixel SDK loads at runtime on relevant landing and conversion pages.'
    });
  }

  if (sdkReferenced && !initReferenced) {
    findings.push({
      id: 'pixel-init-not-seen', category: 'Pixel readiness', severity: 'WARN', method: 'incomplete',
      evidence: 'The OpenAI Pixel SDK was referenced, but static HTML did not show an oaiq init call.',
      why: 'Initialization may be injected dynamically; static inspection cannot prove runtime state.',
      remediation: 'Verify oaiq("init", { pixelId }) executes once at runtime.'
    });
  }

  const cspMetaTags = [...text.matchAll(/<meta\b[^>]*http-equiv\s*=\s*['"]content-security-policy['"][^>]*>/ig)]
    .map((match) => match[0]);
  if (cspMetaTags.some((tag) => /script-src/i.test(tag) && /'self'/i.test(tag) && !/bzrcdn\.openai\.com/i.test(tag))) {
    findings.push({
      id: 'pixel-csp-static-risk', category: 'Pixel readiness', severity: 'WARN', method: 'incomplete',
      evidence: 'Static CSP meta appears to restrict scripts to self without explicitly allowing the OpenAI Pixel CDN.',
      why: 'A restrictive CSP can prevent the measurement SDK from loading.',
      remediation: 'Review effective CSP headers/meta and allow the documented OpenAI measurement domains where required.'
    });
  }

  findings.push({
    id: 'pixel-runtime-not-executed', category: 'Pixel readiness', severity: 'WARN', method: 'incomplete',
    evidence: 'Pixel readiness was inspected statically; browser runtime execution was not performed.',
    why: 'Static HTML cannot prove SDK execution, consent behavior, runtime CSP/network success, or conversion events.',
    remediation: 'Use browser-assisted verification when deeper Pixel readiness is needed.'
  });

  return { status: 'incomplete', sdkReferenced, initReferenced, findings };
}
