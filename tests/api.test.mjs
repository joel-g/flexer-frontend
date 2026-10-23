import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../src/services/api.ts';
test('authenticated client denies requests before centralized initialization', async()=>{
  const client = new ApiClient(); await assert.rejects(client.get('/history'),/Sign in/);
});
test('history requests carry token after initialization and fail closed on account switch', async()=>{
  const original=globalThis.fetch;const client=new ApiClient();let seen;
  try {
    client.setTokenGetter(async()=> 'synthetic-token');
    globalThis.fetch=async(_url,init)=>{seen=init; return new Response(JSON.stringify({success:true,data:{ok:true}}))};
    const result=await client.get('/history'); assert.equal(result.success,true);assert.equal(seen.headers.Authorization,'Bearer synthetic-token');
    let release;globalThis.fetch=async()=>{await new Promise(r=>{release=r});return new Response(JSON.stringify({success:true,data:{owner:'old'}}))};
    const pending=client.get('/history'); await new Promise(r=>setImmediate(r));
    client.setTokenGetter(null);release();await assert.rejects(pending,/Account changed/);
  } finally {globalThis.fetch=original}
});
test('non-success HTTP cannot be treated as a successful save',async()=>{
  const original=globalThis.fetch;const client=new ApiClient();client.setTokenGetter(async()=> 'synthetic');
  try {globalThis.fetch=async()=>new Response(JSON.stringify({success:true}),{status:500}); assert.equal((await client.put('/progress',{})).success,false)}
  finally{globalThis.fetch=original}
});
