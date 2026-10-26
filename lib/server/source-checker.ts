import type { SourceVerification } from "../types";
import { correctedSourceUrl, sourceDateExpired } from "../source-policy";

const cacheVersion = "source-check-v2";
const memory = new Map<string,{until:number;check:SourceVerification}>();
const pending = new Map<string,Promise<SourceVerification>>();
const allowedRoots = ["umich.edu","mit.edu","cornell.edu","federalreserve.gov","sec.gov","bea.gov","ycombinator.com","openai.com","google.com","blogspot.com","feedburner.com","mpowerfinancing.com","boards.greenhouse.io","job-boards.greenhouse.io","careers.duolingo.com","careers.datadoghq.com"];

/** Never probe visitor Canvas/feed/mail links, credentials, arbitrary hosts or unsafe redirects. */
export function auditableSourceUrl(value: string): URL | null {
  try {
    const url = new URL(correctedSourceUrl(value));
    if (url.protocol !== "https:" || url.username || url.password || url.port || /[%\\]/.test(url.hostname) || !allowedRoots.some(root=>url.hostname===root||url.hostname.endsWith(`.${root}`))) {
      if (url.protocol !== "https:" || url.username || url.password || url.port || !["student.interstride.com","umich.joinhandshake.com"].includes(url.hostname)) return null;
    }
    if (/\/feeds\/calendars|\/calendar\/ical|\/student-record|\/api\//i.test(url.pathname) || [...url.searchParams.keys()].some(k=>/token|secret|pass|key|auth|session|signature/i.test(k))) return null;
    url.hash="";
    return url;
  } catch { return null; }
}
const plain = (text:string) => text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ").trim();

export async function probeSource(value: string, fetcher: typeof fetch = fetch, now = new Date()): Promise<SourceVerification> {
  let url = auditableSourceUrl(value);
  const base = {checkedAt:now.toISOString(),httpStatus:null,finalUrl:null};
  const result = (status:SourceVerification["status"],reason:string,extra:Partial<SourceVerification>={}):SourceVerification=>({...base,status,reason,...extra});
  if (!url) return result("unsupported","URL is outside the reviewed public-source allowlist or contains private access information.");
  if ((url.hostname === "student.interstride.com" && /^\/jobs\/detail\/\d+$/.test(url.pathname)) || (url.hostname === "umich.joinhandshake.com" && /^\/(?:stu|edu)\/events\/\d+$/.test(url.pathname))) return result("login_required","Institutional account access is required; this is an access classification, not a live check of the listing.",{finalUrl:url.href});
  // Employer pages can be JS shells. Check the same role in its official public ATS,
  // rather than treating an HTTP 200 shell as evidence of an open listing.
  const greenhouse=url.hostname.match(/^(?:boards|job-boards)\.greenhouse\.io$/) ? url.pathname.match(/^\/(figma|duolingo|datadog)\/jobs\/(\d+)$/) : null;
  const direct=url.hostname === "careers.duolingo.com" ? url.pathname.match(/^\/jobs\/(\d+)\/?$/) : url.hostname === "careers.datadoghq.com" ? url.pathname.match(/^\/detail\/(\d+)\/?$/) : null;
  const board=greenhouse?.[1] || (direct ? url.hostname === "careers.duolingo.com" ? "duolingo" : "datadog" : null),jobId=greenhouse?.[2] || direct?.[1];
  if(board && jobId) {
    try {
      const response=await fetcher(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`,{redirect:"manual",signal:AbortSignal.timeout(4500),headers:{Accept:"application/json"}});
      const meta={httpStatus:response.status,finalUrl:url.href};
      if(response.status===404 || response.status===410)return result("not_found","The employer ATS no longer returns this role.",meta);
      if(!response.ok)return result(response.status===403 || response.status===429?"blocked":"unavailable","Employer ATS check was unsuccessful.",meta);
      const data=await response.json() as {id?:number;title?:string;absolute_url?:string};
      const original=new URL(data.absolute_url || "");
      if(String(data.id)!==jobId || !data.title || original.hostname!==url.hostname || original.pathname.replace(/\/$/,"")!==url.pathname.replace(/\/$/,""))return result("needs_review","Employer listing identity changed.",meta);
      return result("reachable","The same role is present in the employer's public ATS; personal eligibility and an unknown deadline are not inferred.",meta);
    }catch{return result("unavailable","Employer ATS could not be checked.");}
  }
  const initial = url;
  const signal = AbortSignal.timeout(4500);
  try {
    for (let hop=0;hop<4;hop++) {
      const response = await fetcher(url.href,{method:"GET",redirect:"manual",signal,headers:{Accept:"text/html,application/pdf;q=0.8,*/*;q=0.1","User-Agent":"CampusRadar-SourceCheck/1.0"}});
      const meta = {httpStatus:response.status,finalUrl:url.href};
      if (response.status>=300 && response.status<400) {
        const location=response.headers.get("location");
        await response.body?.cancel();
        if (!location) return result("needs_review","Redirect has no destination.",meta);
        const target=new URL(location,url);
        if (/login|signin|sign-in|sso|authorize|saml|oauth/i.test(`${target.hostname}${target.pathname}`)) return result("login_required","Source redirects to sign-in. Protected content was not read.",meta);
        const checked=auditableSourceUrl(target.href);
        if (!checked) return result("needs_review","Redirect leaves the reviewed source allowlist; not followed.",meta);
        if (checked.pathname === "/" && initial.pathname.split("/").filter(Boolean).length>1) return result("needs_review","A specific listing redirected to a generic homepage.",meta);
        url=checked;continue;
      }
      if (response.status===404 || response.status===410) {await response.body?.cancel();return result("not_found","HTTP page missing.",meta);}
      if (response.status===401) {await response.body?.cancel();return result("login_required","Source requires authentication.",meta);}
      if (response.status===403 || response.status===429) {await response.body?.cancel();return result("blocked","Automated request was denied or rate-limited; no missing-page conclusion.",meta);}
      if (!response.ok) {await response.body?.cancel();return result("unavailable","Source server did not return a successful response.",meta);}
      const contentType=response.headers.get("content-type") || "";
      if (/application\/pdf/i.test(contentType)) {await response.body?.cancel();return result("reachable","PDF link responded; application status was not inferred.",meta);}
      const reader=response.body?.getReader();
      if (!reader) return result("unavailable","Source returned no readable body.",meta);
      const decoder=new TextDecoder();let html="",length=0;
      try {for (;;) {const {done,value}=await reader.read();if(done)break;length+=value.byteLength;html+=decoder.decode(value,{stream:true});if(length>350000){await reader.cancel();break;}}} finally {reader.releaseLock();}
      const title=plain(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
      const headings=[...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m=>plain(m[1])).join(" | ");
      const prominent=`${title} | ${headings}`;
      if (/just a moment|checking your browser|verify (?:you are|you're) human|access denied|attention required|captcha/i.test(prominent)) return result("blocked","HTTP 200 is a bot/security interstitial, not the original content.",meta);
      if (/\b(?:404|page not found|page cannot be found|page doesn.t exist|content not found|resource not found)\b/i.test(prominent)) return result("not_found","Page-not-found content despite HTTP success.",meta);
      if (/^(?:sign in|log in|login)\b/i.test(title) || /<input[^>]*type=["']password["']/i.test(html) && /sign in|log in/i.test(headings)) return result("login_required","A login form responded, not the original listing.",meta);
      if (/^(?:applications?|registration|this (?:job|position)) (?:is |are |has |have )?(?:now |been )?(?:closed|filled|no longer available)[.!\s|]*$/i.test(headings.trim())) return result("closed","Prominent page status explicitly reports closure.",meta);
      // Only a JobPosting referring to this same URL may supply an automatic expiry.
      let sourceDeadline:string|null=null;
      for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          const json=JSON.parse(match[1]);const entries=Array.isArray(json)?json:json["@graph"]||[json];
          for(const entity of entries){
            if(entity["@type"]!=="JobPosting" || typeof entity.validThrough!=="string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(entity.validThrough))continue;
            const entityUrl=entity.url || entity["@id"];
            if(typeof entityUrl!=="string" || ![initial.href,url.href].includes(new URL(entityUrl,url).href))continue;
            sourceDeadline=entity.validThrough;
            if(sourceDateExpired(entity.validThrough,now)) return result("expired","The same listing's JobPosting.validThrough has passed.",{...meta,sourceDeadline:entity.validThrough});
          }
        } catch { /* Unparseable or unrelated metadata does not become a deadline. */ }
      }
      if (plain(html).length<60) return result("needs_review","A thin/JavaScript shell did not establish source content.",meta);
      return result("reachable","The source page responded with readable content; eligibility/open status is not guaranteed.",{...meta,sourceDeadline});
    }
    return result("needs_review","Too many redirects.");
  } catch { return result("unavailable","Network/DNS/TLS/timeout prevented a source check. No application status was inferred."); }
}

export async function checkSource(value:string):Promise<SourceVerification> {
  const url=auditableSourceUrl(value);
  if(!url) return probeSource(value);
  const key=url.href,now=Date.now(),old=memory.get(key);
  if(old && old.until>now)return old.check;
  if(pending.has(key))return pending.get(key)!;
  const work=(async()=>{
    const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key)))].map(n=>n.toString(16).padStart(2,"0")).join("");
    const request=new Request(`https://source-check-cache.invalid/${cacheVersion}/${hash}`);
    const shared=typeof caches === "undefined"?undefined:(caches as CacheStorage & {default?:Cache}).default;
    try {const cached=await shared?.match(request);if(cached){const data=await cached.json() as {until:number;check:SourceVerification};if(data.until>now){memory.set(key,data);return data.check;}}}catch{/* Cache failure never substitutes for a source check. */}
    const check=await probeSource(key);
    const data={until:now+(["reachable","login_required"].includes(check.status)?3600000:900000),check};
    memory.set(key,data);if(memory.size>300)memory.delete(memory.keys().next().value!);
    try {await shared?.put(request,new Response(JSON.stringify(data),{headers:{"content-type":"application/json","cache-control":"public,max-age=3600"}}));}catch{/* Bounded memory cache remains available. */}
    return check;
  })();
  pending.set(key,work);try{return await work;}finally{pending.delete(key);}
}
