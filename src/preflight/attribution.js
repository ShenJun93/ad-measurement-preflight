import { normalizePublicHttpUrl } from './url-policy.js';

export function withSyntheticOppref(input, token = `oad_synthetic_${Date.now()}`) {
  const url = input instanceof URL ? new URL(input.href) : normalizePublicHttpUrl(input);
  url.searchParams.set('oppref', token);
  return url;
}

export function evaluateOpprefPreservation(probe, token) {
  if (!probe?.ok) {
    return {
      id: 'oppref-unverified', category: 'Attribution path', severity: 'WARN', method: 'incomplete',
      evidence: probe?.status ? `The synthetic oppref request returned HTTP ${probe.status}, so preservation could not be verified.` : 'The synthetic oppref request did not complete, so preservation could not be verified.',
      why: 'A failed synthetic request cannot establish whether redirect infrastructure preserves the OpenAI click reference.',
      remediation: 'Fix landing reachability first, then rerun the synthetic redirect check.'
    };
  }
  let retained = false;
  try { retained = new URL(probe.finalUrl).searchParams.get('oppref') === token; } catch {}
  if (retained) {
    return {
      id: 'oppref-preserved', category: 'Attribution path', severity: 'PASS', method: 'simulated',
      evidence: 'The synthetic oppref test value survived the redirect chain.',
      why: 'OpenAI recommends preserving oppref through redirects and landing-page navigation for click attribution.',
      remediation: 'No redirect-layer remediation detected for this simulated test.'
    };
  }
  return {
    id: 'oppref-dropped', category: 'Attribution path', severity: 'FAIL', method: 'simulated',
    evidence: 'The synthetic oppref test value was missing from the final URL after redirects.',
    why: 'Dropping oppref can reduce the ability to connect conversion events to eligible ad clicks.',
    remediation: 'Update redirect/canonicalization rules to preserve the oppref query parameter end-to-end.'
  };
}
