import type { CareerJob } from "../types";

/** Public employer-owned Greenhouse boards; never uses student cookies or tokens. */
export const EMPLOYER_BOARDS = [
  { board: "figma", company: "Figma", host: "boards.greenhouse.io" },
  { board: "duolingo", company: "Duolingo", host: "careers.duolingo.com" },
  { board: "datadog", company: "Datadog", host: "careers.datadoghq.com" },
] as const;
type Board = (typeof EMPLOYER_BOARDS)[number];
type Source = { name: string; status: "live" | "unavailable"; count: number; error?: string };
type Catalog = { checkedAt: string; jobs: CareerJob[]; sources: Source[] };
const plain = (value: string) => value.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();

export function parseEmployerJobs(data: unknown, board: Board, checkedAt: string): CareerJob[] {
  if (!data || !Array.isArray((data as { jobs?: unknown }).jobs)) throw new Error("Employer jobs schema changed");
  const jobs: CareerJob[] = [];
  for (const raw of (data as { jobs: Record<string, unknown>[] }).jobs.slice(0,1000)) {
    const title = plain(String(raw.title || ""));
    if (!/\bintern(?:ship)?\b/i.test(title) || !/^\d+$/.test(String(raw.id))) continue;
    let url: URL;
    try { url = new URL(String(raw.absolute_url)); } catch { continue; }
    if (url.protocol !== "https:" || url.username || url.password || url.port || ![board.host,"job-boards.greenhouse.io"].includes(url.hostname)) continue;
    if (url.hostname.endsWith("greenhouse.io") && !url.pathname.startsWith(`/${board.board}/jobs/`)) continue;
    const description = plain(String(raw.content || ""));
    if (!description || description.length < 80) continue;
    const titleText = title.toLowerCase();
    const tracks: string[] = [];
    const keywords: string[] = [];
    const classify = (pattern: RegExp, track: string, terms: string[]) => { if (pattern.test(titleText)) { tracks.push(track); keywords.push(...terms); } };
    classify(/software|engineer|developer|infrastructure/,"software_engineering",["computer science","software"]);
    classify(/data|analytic|scientist/,"data_analytics",["data","statistics","mathematics","analytics"]);
    classify(/\bai\b|machine learning|applied scien/,"ai_ml",["ai","machine learning"]);
    classify(/product management/,"product_management",["product","business"]);
    classify(/design|illustrat|ux|research/,"ux_design",["design","psychology","social science"]);
    classify(/financ|account|invest/,"finance",["finance","economics","accounting","business"]);
    classify(/market|business|operation|sales|recruit|people/,"consulting",["business","economics","communication"]);
    const phd = /\bph\.?d\b|doctoral/i.test(title);
    const bachelor = /bachelor|undergraduate/i.test(description);
    // Unknown compensation/visa/degree requirements stay unknown. No inference from EEO boilerplate.
    const negative = description.match(/[^.!?]*(?:will not|do not|does not|unable to|cannot)\s+(?:provide|offer|support|sponsor)[^.!?]{0,100}(?:visa|sponsor)[^.!?]*/i)?.[0];
    const quote = negative?.trim().slice(0,250);
    const requirements = description.match(/[^.!?]*(?:must be|currently enrolled|pursuing a|bachelor|master|ph\.?d|minimum gpa)[^.!?]*/gi)?.slice(0,3).map(x=>x.trim().slice(0,240)) || [];
    const payQuote = description.match(/(?:hourly(?: base)? pay|hourly base pay rate|salary range|base (?:salary|pay)|compensation range)[\s\S]{0,500}?[$£€]\s*\d[\d,.]*(?:[\s\S]{0,60})/i)?.[0];
    if(payQuote)requirements.push(payQuote.trim());
    const location = plain(String((raw.location as { name?: string })?.name || "See original listing"));
    jobs.push({ id:`employer-${board.board}-${raw.id}`,title,company:board.company,url:url.href,
      source:"Employer careers",sourceMode:"live",reviewedAt:checkedAt,status:"open",paid:payQuote?true:undefined,
      summary:{en:description.slice(0,400),zh:description.slice(0,400)},location,workMode:/remote/i.test(location)?"remote":"unspecified",
      startsAt:null,deadline:null,academicLevels:phd?["graduate"]:bachelor?["undergraduate","graduate"]:[],keywords:[...new Set(keywords)],roleTracks:[...new Set(tracks)],
      sponsorship:quote?"not_offered":"unknown",sponsorshipEvidence:{en:quote || "Role-specific sponsorship has not been verified. Check the employer's requirements.",zh:quote || "尚未核实该岗位是否支持签证赞助，请查看雇主原文。"},
      requirements:{en:requirements.length?requirements:["Confirm degree, skills, location and work authorization on the original listing."],zh:requirements.length?requirements:["请在原岗位核对学历、技能、地点和工作授权要求。"]},
    });
  }
  return jobs;
}

let memory: { until: number; value: Catalog } | undefined;
let pending: Promise<Catalog> | undefined;
export async function fetchEmployerJobs(): Promise<Catalog> {
  if (memory && memory.until > Date.now()) return memory.value;
  if (pending) return pending;
  pending = (async () => {
    const shared = typeof caches === "undefined" ? undefined : (caches as CacheStorage & {default?: Cache}).default;
    const key = new Request("https://career-cache.invalid/employer-boards-v3");
    try { const hit = await shared?.match(key); if (hit) { const cached = await hit.json() as { until:number;value:Catalog }; if(cached.until>Date.now()){memory=cached;return cached.value;} } } catch { /* Cache is optional. */ }
    const checkedAt = new Date().toISOString();
    const result = await Promise.all(EMPLOYER_BOARDS.map(async board => {
      try {
        const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board.board}/jobs?content=true`,{redirect:"manual",signal:AbortSignal.timeout(10000),headers:{Accept:"application/json"}});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // Board sizes are bounded before allocation; cancellation avoids unbounded Worker memory.
        const reader=response.body?.getReader();if(!reader)throw new Error("Missing body");
        const decoder=new TextDecoder();let body="",size=0;
        try { for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>12_000_000){await reader.cancel();throw new Error("Board exceeds 12 MB limit");}body+=decoder.decode(part.value,{stream:true});} } finally {reader.releaseLock();}
        const jobs=parseEmployerJobs(JSON.parse(body),board,checkedAt);
        return {jobs,source:{name:board.company,status:"live" as const,count:jobs.length}};
      } catch(error) { return {jobs:[],source:{name:board.company,status:"unavailable" as const,count:0,error:error instanceof Error?error.message:"Source unavailable"}}; }
    }));
    const value:Catalog={checkedAt,jobs:result.flatMap(x=>x.jobs),sources:result.map(x=>x.source)};
    memory={until:Date.now()+(value.sources.some(x=>x.status==="unavailable")?15*60_000:60*60_000),value};
    try { await shared?.put(key,new Response(JSON.stringify(memory),{headers:{"content-type":"application/json","cache-control":`public,max-age=${value.sources.some(x=>x.status==="unavailable")?900:3600}`}})); } catch { /* Keep bounded memory cache. */ }
    return value;
  })();
  try { return await pending; } finally { pending=undefined; }
}
