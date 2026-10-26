import { env } from "cloudflare:workers";
import { aihotPolicy } from "../aihot-policy";
import { AIHOT_ENDPOINT,AIHOT_TTL_MS,parseAihotItems,restoreAihotRows } from "../aihot-content";
import type { PublicSignal,RadarPreview } from "../types";
type Result={items:PublicSignal[];health:NonNullable<RadarPreview["aihotStatus"]>};
type Cached={until:number;etag:string|null;items:PublicSignal[];checkedAt:string};

/** Factory exposes a deterministic, consent-first network seam for regression tests. */
export function createAihotReader(fetcher:typeof fetch=fetch,clock:()=>number=Date.now,shared?:Cache) {
  let memory:Cached|undefined,pending:Promise<Result>|undefined,retryAt=0;
  const result=(cache:Cached):Result=>({items:cache.items,health:{status:"ready",checkedAt:cache.checkedAt,expiresAt:new Date(cache.until).toISOString(),note:"Up to 12 selected items; 15-minute cache. No student data sent."}});
  return async function read(optIn:boolean,values:Record<string,unknown>):Promise<Result> {
    // Neither an enabled global source nor a shared warm cache overrides individual consent.
    if(!optIn)return {items:[],health:{status:"off",checkedAt:null,expiresAt:null,note:"AI news is off. No AIHOT request made."}};
    if(!aihotPolicy(values).active)return {items:[],health:{status:"disabled",checkedAt:null,expiresAt:null,note:"AIHOT collection is not enabled and authorized."}};
    const now=clock();
    if(memory && memory.until>now)return result(memory);
    if(pending)return pending;
    if(retryAt>now)return {items:[],health:{status:"unavailable",checkedAt:null,expiresAt:null,note:"AIHOT unavailable; waiting before retry. Expired content is hidden."}};
    pending=(async()=>{
      const key=new Request("https://aihot-cache.invalid/selected-v1");
      try {
        let hit:Response|undefined;try{hit=await shared?.match(key);}catch{/* Optional edge cache must not prevent a fresh fetch. */}
        if(hit){const cached=await hit.json() as Cached;if(cached.until>now){memory=cached;return result(cached);}}
        const headers:Record<string,string>={Accept:"application/json","Accept-Encoding":"gzip","User-Agent":"CampusRadar/2.0 AIHOT-api/2.0.0"};
        if(memory?.etag)headers["If-None-Match"]=memory.etag;
        const response=await fetcher(AIHOT_ENDPOINT,{method:"GET",headers,redirect:"manual",signal:AbortSignal.timeout(10000)});
        if(response.status===304 && memory){memory={...memory,until:now+AIHOT_TTL_MS,checkedAt:new Date(now).toISOString()};}
        else {
          if(!response.ok){const raw=response.headers.get("retry-after"),delay=raw && /^\d+$/.test(raw)?Number(raw)*1000:raw?Date.parse(raw)-now:60000;retryAt=now+Math.max(60000,Number.isFinite(delay)?delay:60000);throw new Error(`AIHOT returned HTTP ${response.status}`);}
          const reader=response.body?.getReader();if(!reader)throw new Error("AIHOT body missing");
          let body="",bytes=0;const decoder=new TextDecoder();
          try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>200_000){await reader.cancel();throw new Error("AIHOT response exceeds bounded limit");}body+=decoder.decode(part.value,{stream:true});}}finally{reader.releaseLock();}
          const checkedAt=new Date(now).toISOString();
          memory={until:now+AIHOT_TTL_MS,etag:response.headers.get("etag"),items:await parseAihotItems(JSON.parse(body),checkedAt),checkedAt};
        }
        // Replacement, not append: a withdrawn/unselected item disappears on the next refresh.
        try{await shared?.put(key,new Response(JSON.stringify(memory),{headers:{"content-type":"application/json","cache-control":"public,max-age=900"}}));}catch{/* Fresh memory remains valid if the optional edge cache fails. */}
        return result(memory!);
      }catch(error){
        memory=undefined;retryAt=Math.max(retryAt,now+60000);try{await shared?.delete(key);}catch{/* No stale fallback. */}
        return {items:[],health:{status:"unavailable",checkedAt:new Date(now).toISOString(),expiresAt:null,note:error instanceof Error?error.message:"AIHOT source unavailable"}};
      }
    })();
    try{return await pending;}finally{pending=undefined;}
  };
}
let read:ReturnType<typeof createAihotReader>|undefined;
export function readAihot(optIn:boolean) {
  read ||= createAihotReader(fetch,Date.now,typeof caches==="undefined"?undefined:(caches as CacheStorage & {default?:Cache}).default);
  return read(optIn,env as unknown as Record<string,unknown>);
}
export async function hydrateAihotPreview(preview:RadarPreview):Promise<RadarPreview> {
  const {items,health}=await readAihot(preview.aihotOptIn===true);
  const current={...preview,aihotStatus:health,aiNews:restoreAihotRows(preview.aiNews,preview.aihotRefs,items)};
  if(preview.emailUpdates)current.emailUpdates={...preview.emailUpdates,aiNews:restoreAihotRows(preview.emailUpdates.aiNews,preview.emailUpdates.aihotRefs,items)};
  return current;
}
