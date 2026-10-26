/** Read-only audit of reviewed catalog links. No credentials or student sources are loaded. */
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { webcrypto } from "node:crypto";
function load(file,imports={},extra="") {
  const exports={};
  const source=ts.transpileModule(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8")+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:id=>imports[id]||{},Date,URL,Intl,fetch,Response,Request,AbortSignal,TextDecoder,TextEncoder,Uint8Array,crypto:webcrypto});
  return exports;
}
const policy=load("lib/source-policy.ts");
const {probeSource}=load("lib/server/source-checker.ts",{"../source-policy":policy});
const labs=load("lib/server/radar.ts",{},"\nexport const auditCatalog = RESEARCH_LAB_CATALOG;").auditCatalog;
const funds=load("lib/server/public-source-registry.ts").SCHOLARSHIP_SEEDS;
const pool=load("lib/server/career-pilot.ts");
const records=[...labs.map(item=>({...item,title:item.name})),...funds,...pool.CAREER_PILOT_JOBS,...pool.UMICH_CAREER_PILOT_EVENTS];
let index=0;const results=[];
await Promise.all(Array.from({length:6},async()=>{for(;;){const item=records[index++];if(!item)break;const url=policy.correctedSourceUrl(item.url);const verification=await probeSource(url);const expired=Boolean(item.deadline && policy.sourceDateExpired(item.deadline));results.push({id:item.id,title:item.title,url,deadline:item.deadline||null,deadlineExpired:expired,verification});}}));
results.sort((a,b)=>a.id.localeCompare(b.id));
console.log(JSON.stringify({checkedAt:new Date().toISOString(),note:"Read-only catalog audit. Account-required URLs are classified, not logged into. HTTP success alone does not prove eligibility or an open application.",counts:results.reduce((out,row)=>(out[row.verification.status]=(out[row.verification.status]||0)+1,out),{}),items:results},null,2));
