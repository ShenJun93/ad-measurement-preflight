import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api-handler.js';

function response(){
  return {statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k.toLowerCase()]=v},status(n){this.statusCode=n;return this},json(v){this.body=JSON.stringify(v);return this},send(v=''){this.body=String(v);return this},end(v=''){this.body=String(v);return this}};
}

test('vercel handler scans with injected scan function', async () => {
  const req={method:'POST',url:'/api/scan',body:{url:'https://example.com'}};
  const res=response();
  await handler(req,res,{scanFn:async()=>({overall:'WARN',score:80}),analyticsSink:()=>{}});
  assert.equal(res.statusCode,200);
  assert.deepEqual(JSON.parse(res.body),{overall:'WARN',score:80});
});

test('vercel handler rejects extra scan fields', async () => {
  const req={method:'POST',url:'/api/scan',body:{url:'https://example.com',x:1}};
  const res=response();
  await handler(req,res,{scanFn:async()=>({}),analyticsSink:()=>{}});
  assert.equal(res.statusCode,400);
});

test('vercel handler accepts only whitelisted analytics event names', async () => {
  const seen=[]; const res=response();
  await handler({method:'POST',url:'/api/analytics',body:{event:'monitor_interest'}},res,{scanFn:async()=>({}),analyticsSink:e=>seen.push(e)});
  assert.equal(res.statusCode,204); assert.deepEqual(seen,['monitor_interest']);
});
