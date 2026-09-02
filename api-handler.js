import { scanLandingPage } from './src/preflight/scan.js';

const EVENTS = new Set(['scanner_impression','scan_started','scan_completed','actionable_finding_viewed','repeat_scan','monitor_interest']);

function securityHeaders(res){
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('x-content-type-options','nosniff');
  res.setHeader('referrer-policy','no-referrer');
  res.setHeader('permissions-policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('cache-control','no-store');
}

function sendJson(res,status,value){
  securityHeaders(res);
  res.status(status);
  return res.json(value);
}

function plain(value){ return value && typeof value === 'object' && !Array.isArray(value); }

export default async function handler(req,res,{scanFn=scanLandingPage,analyticsSink=(event)=>console.log(JSON.stringify({type:'analytics',event,at:Date.now()}))}={}){
  const url = new URL(req.url || '/', 'https://local.invalid');
  if (url.pathname === '/api/scan') {
    if (req.method !== 'POST') { res.setHeader('allow','POST'); return sendJson(res,405,{error:'Method not allowed.'}); }
    const body = req.body;
    if (!plain(body) || Object.keys(body).length !== 1 || typeof body.url !== 'string' || !body.url.trim()) return sendJson(res,400,{error:'Body must contain only a non-empty url string.'});
    try { return sendJson(res,200,await scanFn(body.url)); }
    catch(error){ const message=String(error?.message||error); return sendJson(res,/url|http|https|credentials|localhost|non-public|resolve/i.test(message)?400:502,{error:message}); }
  }
  if (url.pathname === '/api/analytics') {
    if (req.method !== 'POST') { res.setHeader('allow','POST'); return sendJson(res,405,{error:'Method not allowed.'}); }
    const body=req.body;
    if (!plain(body) || Object.keys(body).length !== 1 || !EVENTS.has(body.event)) return sendJson(res,400,{error:'Invalid analytics event.'});
    analyticsSink(body.event); securityHeaders(res); res.status(204); return res.end();
  }
  return sendJson(res,404,{error:'Not found.'});
}
