function parseGroups(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  let seenRule = false;
  const flush = () => {
    if (agents.length) groups.push({ agents: [...agents], rules: [...rules] });
    agents = [];
    rules = [];
    seenRule = false;
  };

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) { if (seenRule) flush(); continue; }
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (seenRule) flush();
      agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && agents.length) {
      seenRule = true;
      rules.push({ directive: key, path: value });
    }
  }
  flush();
  return groups;
}

function matchesRule(target, rulePath) {
  if (!rulePath) return false;
  const escaped = rulePath
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\$$/, '$');
  try { return new RegExp(`^${escaped}`).test(target); } catch { return target.startsWith(rulePath); }
}

export function evaluateRobots(robotsText, targetUrl, { userAgent = 'OAI-AdsBot' } = {}) {
  const text = String(robotsText || '');
  if (!text.trim()) return { allowed: true, matchedRule: null, evidence: 'No explicit robots rule was found for this path.' };

  const groups = parseGroups(text);
  const ua = userAgent.toLowerCase();
  let selected = groups.filter((group) => group.agents.some((agent) => agent === ua));
  if (!selected.length) selected = groups.filter((group) => group.agents.includes('*'));
  if (!selected.length) return { allowed: true, matchedRule: null, evidence: `No robots group matched ${userAgent}.` };

  const url = new URL(targetUrl);
  const target = `${url.pathname}${url.search}` || '/';
  const candidates = selected.flatMap((group) => group.rules)
    .filter((rule) => matchesRule(target, rule.path))
    .sort((a, b) => b.path.length - a.path.length || (a.directive === 'allow' ? -1 : 1));

  if (!candidates.length) return { allowed: true, matchedRule: null, evidence: `No matching robots rule blocks ${target}.` };
  const matchedRule = candidates[0];
  return {
    allowed: matchedRule.directive === 'allow',
    matchedRule,
    evidence: `${matchedRule.directive === 'allow' ? 'Allow' : 'Disallow'} rule matched ${matchedRule.path || '(empty)'}.`
  };
}

export function detectBotChallenge(probe = {}) {
  const status = Number(probe.status || 0);
  const body = String(probe.bodyText || '').slice(0, 128_000).toLowerCase();
  const findings = [];
  let evidence = null;

  if ([401, 403, 429].includes(status)) evidence = `Simulated crawler request returned HTTP ${status}.`;
  else if (/captcha|cf-chl-|challenge-platform|access denied|verify you are human|bot detection|security check/.test(body)) {
    evidence = 'Simulated crawler response contains an obvious CAPTCHA, bot challenge, or access-denied signature.';
  }

  if (evidence) {
    findings.push({
      id: 'bot-challenge',
      category: 'OAI-AdsBot readiness',
      severity: 'FAIL',
      evidence,
      why: 'OpenAI states OAI-AdsBot must be able to reach ad landing pages for validation and review.',
      remediation: 'Allow OAI-AdsBot through authentication, WAF/CDN bot mitigation, CAPTCHA, geo, and rate-limit layers, then retest.',
      method: 'simulated'
    });
  }
  return findings;
}
