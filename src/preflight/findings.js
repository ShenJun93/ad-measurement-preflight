export function finding({ id, category, severity, evidence, why, remediation, method = 'direct' }) {
  return { id, category, severity, evidence, why, remediation, method };
}

export function scoreFindings(findings = []) {
  let score = 100;
  let hasFail = false;
  let hasWarn = false;
  for (const item of findings) {
    if (item?.severity === 'FAIL') { score -= 30; hasFail = true; }
    else if (item?.severity === 'WARN') { score -= 10; hasWarn = true; }
  }
  score = Math.max(0, score);
  return { score, overall: hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS' };
}

export function groupFindings(findings = []) {
  const names = ['Landing accessibility', 'OAI-AdsBot readiness', 'Attribution path', 'Pixel readiness', 'Conversion-event readiness'];
  return Object.fromEntries(names.map((name) => [name, findings.filter((item) => item.category === name)]));
}
