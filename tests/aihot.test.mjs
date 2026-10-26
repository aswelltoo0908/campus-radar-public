import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
function load(path,imports={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:id=>imports[id]||{},URL,Request,Response,AbortSignal,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,Date,fetch});
  return exports;
}
const content=load('lib/aihot-content.ts'), policy=load('lib/aihot-policy.ts');
const api=load('lib/server/aihot.ts',{'../aihot-content':content,'../aihot-policy':policy,'cloudflare:workers':{env:{}}});
const enabled={RADAR_AIHOT_ENABLED:'true',RADAR_AIHOT_AUTHORIZED:'true'};
const now=Date.parse('2026-10-23T12:00:00Z');
const item=(id='one',extra={})=>({id,selected:true,title:'AI policy research',summary:'An update for students',source:{name:'Original publisher'},links:{original:'https://example.org/story',aihot:'https://aihot.news/items/'+id},publishedAt:'2026-10-23T10:00:00Z',...extra});
const response=(items=[item()])=>new Response(JSON.stringify({schemaVersion:1,items}),{headers:{etag:'W/"feed1"'}});
test('consent-first: no upstream request for opt-out or disabled source, including warm cache',async()=>{
  const calls=[];const read=api.createAihotReader(async(...args)=>{calls.push(args);return response();},()=>now);
  assert.equal((await read(false,enabled)).health.status,'off');
  assert.equal((await read(true,{})).health.status,'disabled');assert.equal(calls.length,0);
  assert.equal((await read(true,enabled)).items.length,1);
  assert.equal((await read(false,enabled)).items.length,0);assert.equal(calls.length,1);
  assert.equal(calls[0][0],content.AIHOT_ENDPOINT);assert.equal(calls[0][1].body,undefined);
  assert.deepEqual(Object.keys(calls[0][1].headers).sort(),['Accept','Accept-Encoding','User-Agent'].sort());
});
test('bounded short excerpts, safe links, selected only, real discovered date fallback',async()=>{
  const rows=await content.parseAihotItems({schemaVersion:1,items:[item('long',{title:'x'.repeat(200),summary:'s'.repeat(500)}),item('off',{selected:false}),item('gone',{status:'withdrawn'}),item('private',{links:{original:'https://127.0.0.1/a',aihot:'https://aihot.news/items/private'}}),item('discovered',{publishedAt:null,discoveredAt:'2026-10-23T09:00:00Z'}),item('bad')]},new Date(now).toISOString());
  assert.equal(rows.length,3);assert.equal(rows[0].title.length,140);assert.equal(rows[0].summary.length,240);
  assert.equal(rows[1].publishedAt,null);assert.equal(rows[1].discoveredAt,'2026-10-23T09:00:00Z');
  assert.equal(rows[0].verification.status,'feed_verified');
  assert.equal((await content.parseAihotItems({schemaVersion:1,items:Array.from({length:30},(_,i)=>item('i'+i))},new Date(now).toISOString())).length,12);
});
test('15-minute cache, conditional revalidation and withdrawn items disappear on replacement',async()=>{
  let time=now,calls=0;const headers=[];
  const read=api.createAihotReader(async(_url,options)=>{headers.push(options.headers);calls++;return calls===2?new Response(null,{status:304}):calls===3?response([]):response();},()=>time);
  await Promise.all([read(true,enabled),read(true,enabled)]);assert.equal(calls,1);
  time+=content.AIHOT_TTL_MS-1;assert.equal((await read(true,enabled)).items.length,1);assert.equal(calls,1);
  time+=2;assert.equal((await read(true,enabled)).items.length,1);assert.equal(headers[1]['If-None-Match'],'W/"feed1"');
  time+=content.AIHOT_TTL_MS+1;assert.equal((await read(true,enabled)).items.length,0);
});
test('expired failures fail closed and honor Retry-After without serving stale content',async()=>{
  let time=now,calls=0;const read=api.createAihotReader(async()=>++calls===1?response():new Response('',{status:429,headers:{'retry-after':'120'}}),()=>time);
  await read(true,enabled);time+=content.AIHOT_TTL_MS+1;
  assert.equal((await read(true,enabled)).items.length,0);time+=60001;
  assert.equal((await read(true,enabled)).health.status,'unavailable');assert.equal(calls,2);
  time+=60001;await read(true,enabled);assert.equal(calls,3);
});
test('optional cache errors do not discard a successfully fetched feed',async()=>{
  const read=api.createAihotReader(async()=>response(),()=>now,{match:async()=>{throw Error('cache');},put:async()=>{throw Error('cache');}});
  assert.equal((await read(true,enabled)).items.length,1);
});
test('saved reports retain IDs and local ranking, not AIHOT copy; missing items cannot be restored',async()=>{
  const [signal]=await content.parseAihotItems({schemaVersion:1,items:[item()]},new Date(now).toISOString());
  const row={...signal,score:42,why:'Matches an interest',nextAction:'Read original'};
  const saved=content.stripAihotForStorage({aiNews:[row],emailUpdates:{aiNews:[row]}});
  const serialized=JSON.stringify(saved);
  for(const forbidden of [signal.title,signal.summary,signal.url,signal.attributionUrl])assert.ok(!serialized.includes(forbidden));
  assert.equal(saved.aihotRefs[0].id,signal.id);assert.equal(saved.emailUpdates.aihotRefs.length,1);
  assert.equal(content.restoreAihotRows([],saved.aihotRefs,[]).length,0);
  assert.equal(content.restoreAihotRows([],saved.aihotRefs,[signal])[0].score,42);
});
