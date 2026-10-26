import type { OpportunityMatch, PublicSignal, RadarPreview } from "./types";

export const AIHOT_ENDPOINT="https://aihot.news/api/v1/items?mode=selected&window=24h&by=timeline&limit=12";
export const AIHOT_TTL_MS=15*60_000;
const text=(value:unknown,max:number)=>String(value || "").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,max);
function publicUrl(value:unknown,aihot=false):string|null {
  try {const u=new URL(String(value));if(u.protocol!=="https:" || u.username || u.password || u.port || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname))return null;
    if(aihot && (u.hostname!=="aihot.news" || !/^\/items\/[a-z0-9_-]+$/i.test(u.pathname) || u.search))return null;
    return u.href;
  }catch{return null;}
}
export async function parseAihotItems(payload:unknown,checkedAt:string):Promise<PublicSignal[]> {
  const data=payload as {schemaVersion?:number;items?:Record<string,unknown>[]};
  if(data?.schemaVersion!==1 || !Array.isArray(data.items))throw new Error("AIHOT public feed schema changed");
  const rows:PublicSignal[]=[],seen=new Set<string>();
  for(const item of data.items.slice(0,12)) {
    const id=String(item.id || ""),links=item.links as {original?:string;aihot?:string};
    if(!/^[a-z0-9_-]{1,100}$/i.test(id) || item.selected!==true || ["deleted","removed","withdrawn"].includes(String(item.status)))continue;
    const url=publicUrl(links?.original),attributionUrl=publicUrl(links?.aihot,true);
    const title=text(item.title,140),summary=text(item.summary,240);
    const published=typeof item.publishedAt==="string" && Number.isFinite(Date.parse(item.publishedAt))?item.publishedAt:null;
    const discovered=typeof item.discoveredAt==="string" && Number.isFinite(Date.parse(item.discoveredAt))?item.discoveredAt:null;
    if(!url || !attributionUrl || !title || !summary || (!published && !discovered) || seen.has(id))continue;
    if(Date.parse(published || discovered!)>Date.parse(checkedAt)+86400000)continue;
    seen.add(id);
    const body=`${item.originalTitle || ""} ${title} ${summary}`.toLowerCase();
    const topics=["ai"];
    const terms:[string,RegExp][]=[["mathematics",/\bmath|数学/],["social science",/sociolog|social scien|社会学/],["policy",/polic|regulat|govern|政策|监管/],["political science",/politic|政治/],["economics",/econom|经济/],["education",/educat|student|学习|教育|学生/],["business",/business|enterprise|商业|企业/],["research",/research|研究|论文/],["health",/health|medical|医疗|健康/],["climate",/climate|energy|气候|能源/]];
    for(const [topic,pattern] of terms)if(pattern.test(body))topics.push(topic);
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([id,title,summary,url,attributionUrl,published])));
    rows.push({id:`aihot-${id}`,category:"ai_news",channel:null,title,summary,url,attributionUrl,sourceId:"aihot",sourceName:"AIHOT",
      originalSourceName:text((item.source as {name?:string})?.name,100),originalTitle:text(item.originalTitle,180),publishedAt:published,discoveredAt:discovered || undefined,
      fetchedAt:checkedAt,verifiedAt:checkedAt,deadline:null,opensAt:null,amount:null,availability:"open",eligibility:{otherRequirements:[]},topics,
      contentHash:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join(""),sourceMode:"live",
      verification:{status:"feed_verified",checkedAt,httpStatus:200,finalUrl:attributionUrl,reason:"Present in the current, bounded AIHOT selected feed; original publisher URL was not probed."}});
  }
  return rows;
}

/** Persist only IDs, content hashes and Radar's own match metadata, never AIHOT copy. */
export function stripAihotForStorage<T extends Pick<RadarPreview,"aiNews"|"aihotRefs"|"emailUpdates">>(preview:T):T {
  const current=preview.aiNews || [],refs=preview.aihotRefs || [];
  const incoming=current.filter(x=>x.sourceId==="aihot").map(({id,contentHash,why,nextAction,score})=>({id,contentHash,why,nextAction,score}));
  return {...preview,aiNews:current.filter(x=>x.sourceId!=="aihot"),aihotRefs:incoming.length?incoming:refs,
    ...(preview.emailUpdates?{emailUpdates:stripAihotForStorage(preview.emailUpdates)}:{})};
}

export function restoreAihotRows(rows:OpportunityMatch[]|undefined,refs:RadarPreview["aihotRefs"],current:PublicSignal[]):OpportunityMatch[] {
  const selected=new Map(current.map(x=>[x.id,x]));
  const references=refs?.length?refs:(rows || []).filter(x=>x.sourceId==="aihot");
  return [...(rows || []).filter(x=>x.sourceId!=="aihot"),...references.flatMap(ref=>{
    const item=selected.get(ref.id);return item?[{...item,why:ref.why,nextAction:ref.nextAction,score:ref.score,unknownConditions:[],eligibilityStatus:"potential_match" as const}]:[];
  })].sort((a,b)=>b.score-a.score).slice(0,3);
}
