import crypto from 'node:crypto';
import { normalizePublicHttpUrl } from './url-policy.js';
import { probeUrl } from './http-probe.js';
import { evaluateRobots, detectBotChallenge } from './robots.js';
import { withSyntheticOppref, evaluateOpprefPreservation } from './attribution.js';
import { inspectStaticPixel } from './pixel-static.js';
import { finding, groupFindings, scoreFindings } from './findings.js';

function safeUrl(input) {
  const url = input instanceof URL ? new URL(input.href) : new URL(String(input));
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/$/, url.pathname === '/' ? '' : '/');
}

export async function scanLandingPage(input, {
  probe = probeUrl,
  tokenFactory = () => `oad_synthetic_${crypto.randomUUID()}`,
  probeOptions = { timeoutMs: 6000 }
} = {}) {
  const startedAt = Date.now();
  const initial = normalizePublicHttpUrl(input);
  const landing = await probe(initial.href, probeOptions);
  const finalForOrigin = landing.finalUrl || initial.href;
  let finalUrl;
  try { finalUrl = new URL(finalForOrigin); } catch { finalUrl = initial; }

  const token = tokenFactory();
  const synthetic = withSyntheticOppref(initial, token);
  const robotsUrl = new URL('/robots.txt', finalUrl.origin);

  const [robotsProbe, botProbe, opprefProbe] = await Promise.all([
    probe(robotsUrl.href, probeOptions),
    probe(initial.href, { ...probeOptions, userAgent: 'OAI-AdsBot' }),
    probe(synthetic.href, probeOptions)
  ]);

  const findings = [];
  if (landing.ok && landing.status >= 200 && landing.status < 400) {
    findings.push(finding({
      id: 'landing-reachable', category: 'Landing accessibility', severity: 'PASS', method: 'direct',
      evidence: `Landing page returned HTTP ${landing.status}${landing.redirects?.length ? ` after ${landing.redirects.length} redirect(s)` : ''}.`,
      why: 'Ads review and measurement require a valid reachable web landing page.',
      remediation: 'No landing reachability fix detected.'
    }));
  } else {
    findings.push(finding({
      id: 'landing-unreachable', category: 'Landing accessibility', severity: 'FAIL', method: 'direct',
      evidence: landing.status ? `Landing page returned HTTP ${landing.status}.` : 'Landing page request did not complete successfully.',
      why: 'An unreachable landing page can prevent ad review and user conversion.',
      remediation: 'Fix DNS, redirects, origin availability, authentication, or HTTP errors before launch.'
    }));
  }

  let robotsText = '';
  if (robotsProbe.status === 404) {
    findings.push(finding({
      id: 'robots-not-present', category: 'OAI-AdsBot readiness', severity: 'PASS', method: 'direct',
      evidence: 'robots.txt returned HTTP 404, so no explicit robots rule was observed.',
      why: 'OAI-AdsBot follows robots.txt rules when present.',
      remediation: 'No robots.txt change is required for this specific result.'
    }));
  } else if (robotsProbe.ok) {
    robotsText = robotsProbe.bodyText || '';
    const robots = evaluateRobots(robotsText, finalUrl.href);
    findings.push(finding({
      id: robots.allowed ? 'robots-allow' : 'robots-block',
      category: 'OAI-AdsBot readiness', severity: robots.allowed ? 'PASS' : 'FAIL', method: 'direct',
      evidence: robots.evidence,
      why: 'OpenAI requires OAI-AdsBot to be allowed to access ad landing pages.',
      remediation: robots.allowed ? 'No explicit robots block detected.' : 'Update robots.txt so OAI-AdsBot can access the submitted landing path.'
    }));
  } else {
    findings.push(finding({
      id: 'robots-unverified', category: 'OAI-AdsBot readiness', severity: 'WARN', method: 'incomplete',
      evidence: robotsProbe.status ? `robots.txt returned HTTP ${robotsProbe.status}.` : 'robots.txt could not be checked.',
      why: 'Without a successful robots check, crawler readiness cannot be fully verified.',
      remediation: 'Make robots.txt publicly reachable or verify the crawler rules manually.'
    }));
  }

  const botChallenges = detectBotChallenge(botProbe);
  if (botChallenges.length) findings.push(...botChallenges);
  else if (botProbe.ok) {
    findings.push(finding({
      id: 'bot-simulation-reachable', category: 'OAI-AdsBot readiness', severity: 'PASS', method: 'simulated',
      evidence: `An external request using an OAI-AdsBot-like user agent returned HTTP ${botProbe.status}.`,
      why: 'This is a useful preflight signal for WAF/CDN/authentication behavior, but it is not proof of real OpenAI crawler access.',
      remediation: 'No obvious simulated crawler block detected; keep real crawler logs as the authoritative runtime evidence.'
    }));
  } else {
    findings.push(finding({
      id: 'bot-simulation-failed', category: 'OAI-AdsBot readiness', severity: 'FAIL', method: 'simulated',
      evidence: botProbe.status ? `The OAI-AdsBot-like request returned HTTP ${botProbe.status}.` : 'The OAI-AdsBot-like request did not complete successfully.',
      why: 'OpenAI requires the ad landing page to return successfully to OAI-AdsBot; a failed simulation is a strong readiness warning even though it is not proof of real crawler behavior.',
      remediation: 'Check origin health, WAF/CDN rules, authentication, geo controls, and rate limits for crawler-like requests.'
    }));
  }

  findings.push(evaluateOpprefPreservation(opprefProbe, token));
  findings.push(...inspectStaticPixel(landing.bodyText || '').findings);
  findings.push(finding({
    id: 'conversion-events-not-executed', category: 'Conversion-event readiness', severity: 'WARN', method: 'incomplete',
    evidence: 'Slice 1 does not execute a browser conversion journey or inspect server-side CAPI events.',
    why: 'A URL-only preflight cannot prove event firing, consent behavior, or Pixel/CAPI deduplication.',
    remediation: 'Use the deep diagnostic adapter when conversion-event verification is required.'
  }));

  const scoring = scoreFindings(findings);
  return {
    inputUrl: safeUrl(initial),
    finalUrl: safeUrl(finalUrl),
    overall: scoring.overall,
    score: scoring.score,
    durationMs: Date.now() - startedAt,
    findings,
    categories: groupFindings(findings),
    limitations: [
      'OAI-AdsBot readiness is externally simulated; only OpenAI crawler logs can confirm real crawler access.',
      'Pixel readiness is static-only in Slice 1 and cannot prove runtime SDK/event behavior.'
    ]
  };
}
