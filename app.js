const $ = (selector) => document.querySelector(selector);
let scanCount = 0;

function analytics(event) {
  fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event }), keepalive: true }).catch(() => {});
}

function setHidden(selector, hidden) { $(selector).classList.toggle('hidden', hidden); }
function text(selector, value) { $(selector).textContent = value; }

function findingCard(item) {
  const article = document.createElement('article');
  article.className = `finding severity-${String(item.severity).toLowerCase()}`;
  const top = document.createElement('div');
  top.className = 'finding-top';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = item.severity;
  const method = document.createElement('span');
  method.className = 'method';
  method.textContent = item.method;
  top.append(badge, method);
  const evidence = document.createElement('h4'); evidence.textContent = item.evidence;
  const why = document.createElement('p'); why.textContent = item.why;
  const fix = document.createElement('p'); fix.className = 'fix'; fix.textContent = `Fix: ${item.remediation}`;
  article.append(top, evidence, why, fix);
  return article;
}

function render(report) {
  setHidden('#report', false);
  text('#overall', report.overall);
  text('#score', report.score);
  text('#scanned-url', report.finalUrl || report.inputUrl);
  text('#duration', `${(report.durationMs / 1000).toFixed(1)}s`);
  $('#overall').className = `overall-${String(report.overall).toLowerCase()}`;

  const root = $('#categories');
  root.replaceChildren();
  for (const [name, items] of Object.entries(report.categories || {})) {
    if (!items.length) continue;
    const section = document.createElement('section'); section.className = 'category panel';
    const heading = document.createElement('h3'); heading.textContent = name;
    section.append(heading, ...items.map(findingCard));
    root.append(section);
  }
  const limitations = $('#limitations'); limitations.replaceChildren();
  for (const item of report.limitations || []) { const li = document.createElement('li'); li.textContent = item; limitations.append(li); }
  if ((report.findings || []).some((x) => x.severity !== 'PASS')) analytics('actionable_finding_viewed');
}

$('#scan-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = $('#url').value.trim();
  if (!url) return;
  scanCount += 1;
  analytics(scanCount > 1 ? 'repeat_scan' : 'scan_started');
  setHidden('#error', true); setHidden('#report', true); setHidden('#progress', false);
  $('#scan').disabled = true;
  try {
    const response = await fetch('/api/scan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Scan failed.');
    render(payload);
    analytics('scan_completed');
  } catch (error) {
    text('#error', String(error.message || error)); setHidden('#error', false);
  } finally {
    setHidden('#progress', true); $('#scan').disabled = false;
  }
});

$('#monitor-interest').addEventListener('click', () => {
  analytics('monitor_interest');
  $('#monitor-interest').disabled = true;
  $('#monitor-interest').textContent = 'Interest recorded';
});

analytics('scanner_impression');
