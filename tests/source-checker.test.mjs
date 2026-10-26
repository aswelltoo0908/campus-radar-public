import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {webcrypto} from "node:crypto";
import {createRequire} from "node:module";
import {renderToStaticMarkup} from "react-dom/server";
const nativeRequire=createRequire(import.meta.url);
function load(file,imports={},jsx=false,globals={}){const exports={};const source=ts.transpileModule(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:jsx?ts.JsxEmit.ReactJSX:undefined}}).outputText;vm.runInNewContext(source,{exports,require:id=>imports[id]||(id.startsWith("react")?nativeRequire(id):{}),URL,Date,Intl,Response,Request,AbortSignal,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,...globals});return exports;}
const policy=load("lib/source-policy.ts");
const checker=load("lib/server/source-checker.ts",{"../source-policy":policy});
const guard=load("lib/server/verify-preview.ts",{"../source-policy":policy,"./source-checker":checker});
const reminders=load("lib/course-reminders.ts");
const mail=load("lib/server/email-delivery.ts",{"../course-reminders":reminders,"../source-policy":policy});
const statuses=load("app/beta/SourceStatus.tsx",{"../../lib/source-policy":policy},true);
const now=new Date("2026-10-18T15:00:00Z");
const url="https://lsa.umich.edu/urop/prospective-students/fall-winter-programs.html";
const html='<html><title>Undergraduate research programs</title><h1>Undergraduate research programs</h1><p>Explore the current program directory and review individual eligibility conditions. Current openings and requirements must be checked separately.</p></html>';
const fixture=(body=html,status=200,headers={})=>new Response(body,{status,headers:{"content-type":"text/html",...headers}});
const check=(status="reachable",extra={})=>({status,checkedAt:now.toISOString(),httpStatus:status==="reachable"?200:null,finalUrl:url,reason:"fixture",...extra});
const item=(id,extra={})=>({id,title:id,name:id,url,why:"Match",nextAction:"Check source",source:"Original",when:null,score:80,...extra});
const brief=(extra={})=>({formatVersion:2,language:"en",actions:[],opportunities:[],researchLabs:{matches:[],enabled:true},canvas:{connected:true,upcoming:[]},academic:{upcoming:[]},fieldInsight:{sources:[]},...extra});

test("only verified official UROP alias is corrected; unsafe/private URLs and redirect targets are not fetched",async()=>{
  assert.equal(policy.correctedSourceUrl("https://urop.umich.edu/"),url);
  assert.equal(policy.correctedSourceUrl("https://urop.umich.edu/guessed-page"),"https://urop.umich.edu/guessed-page");
  for(const input of ["http://lsa.umich.edu/","https://127.0.0.1/","https://172.16.0.1/","https://evil.test/","https://lsa.umich.edu.evil.test/","https://key@lsa.umich.edu/","https://lsa.umich.edu/?token=secret","https://umich.instructure.com/feeds/calendars/private.ics","https://calendar.google.com/calendar/ical/private-feed/basic.ics"]){let calls=0;const result=await checker.probeSource(input,async()=>{calls++;return fixture();},now);assert.equal(result.status,"unsupported",input);assert.equal(calls,0);}
  let calls=0;const result=await checker.probeSource(url,async()=>{calls++;return fixture("",302,{location:"https://169.254.169.254/latest/meta-data"});},now);
  assert.equal(result.status,"needs_review");assert.equal(calls,1);
});
test("401/sign-in, 403/rate limits, 404/410 and timeouts are different outcomes",async()=>{
  for(const [status,expected]of [[401,"login_required"],[403,"blocked"],[429,"blocked"],[404,"not_found"],[410,"not_found"],[500,"unavailable"]])assert.equal((await checker.probeSource(url,async()=>fixture("error",status),now)).status,expected);
  assert.equal((await checker.probeSource(url,async()=>{throw new Error("DNS failure")},now)).status,"unavailable");
  assert.equal((await checker.probeSource(url,async()=>fixture("",302,{location:"https://sso.umich.edu/login"}),now)).status,"login_required");
  for(const input of ["https://student.interstride.com/jobs/detail/201714614","https://umich.joinhandshake.com/stu/events/2025773"]){let calls=0;const result=await checker.probeSource(input,async()=>{calls++;return fixture();},now);assert.equal(result.status,"login_required");assert.equal(calls,0);assert.match(result.reason,/not a live check/);}
});
test("HTTP 200 soft errors, login forms, bot checks and thin shells cannot pass as readable opportunities",async()=>{
  for(const [body,expected]of [['<title>404: Page not found</title>',"not_found"],['<title>Just a moment...</title>',"blocked"],['<title>Log in to your account</title><input type="password">',"login_required"],['<div id="root"></div><script src="app.js"></script>',"needs_review"],['<h1>Applications are closed</h1><p>Thank you for your interest in the application. This application is closed.</p>',"closed"]])assert.equal((await checker.probeSource(url,async()=>fixture(body),now)).status,expected);
  assert.equal((await checker.probeSource(url,async()=>fixture(),now)).status,"reachable");
  assert.equal((await checker.probeSource(url,async()=>fixture("",302,{location:"/"}),now)).status,"needs_review");
});
test("only same-listing JobPosting metadata can establish expiry; generic old dates are not guessed",async()=>{
  const metadata=(entityUrl,deadline)=>`${html}<script type="application/ld+json">${JSON.stringify({"@type":"JobPosting",url:entityUrl,validThrough:deadline})}</script>`;
  assert.equal((await checker.probeSource(url,async()=>fixture(metadata(url,"2026-10-17")),now)).status,"expired");
  assert.equal((await checker.probeSource(url,async()=>fixture(metadata("https://lsa.umich.edu/other-job","2025-01-01")),now)).status,"reachable");
  assert.equal((await checker.probeSource(url,async()=>fixture(html+"<p>Our 2025 cycle closed in September. See our upcoming 2027 cycle.</p>"),now)).status,"reachable");
  assert.equal((await checker.probeSource(url,async()=>fixture(metadata(url,"2026-10-20")),now)).sourceDeadline,"2026-10-20");
});
test("date-only expiry uses Eastern date without next-day grace, across DST",()=>{
  assert.equal(policy.sourceDateExpired("2026-10-17",new Date("2026-10-18T03:59:59Z")),false);
  assert.equal(policy.sourceDateExpired("2026-10-17",new Date("2026-10-18T04:00:00Z")),true);
  assert.equal(policy.sourceDateExpired("2026-11-02",new Date("2026-11-03T04:59:59Z")),false);
  assert.equal(policy.sourceDateExpired("2026-11-02",new Date("2026-11-03T05:00:00Z")),true);
  assert.equal(policy.sourceDateExpired("2026-10-18T14:00:00Z",now),true);
});
test("concurrent/cached public checks reuse one fetch without creating model requests",async()=>{
  let calls=0;const cached=load("lib/server/source-checker.ts",{"../source-policy":policy},false,{fetch:async()=>{calls++;return fixture();}});
  await Promise.all(Array.from({length:20},()=>cached.checkSource(url)));
  await cached.checkSource(url);assert.equal(calls,1);
});
test("old saved briefs are verified before sending the full shortlist without mutating saved data",async()=>{
  const bad=item("bad",{url:"https://lsa.umich.edu/missing",status:"official_undergrad_pathway",verifiedAt:"2026-10-14"});
  const good=item("good",{status:"official_undergrad_pathway",verifiedAt:"2026-10-14"});
  const expired=item("expired",{deadline:"2026-10-17",availability:"open",unknownConditions:[]});
  const course=item("course",{url:"https://umich.instructure.com/private-course",when:"2026-10-19T16:00:00Z",source:"Canvas Calendar Feed"});
  const forwarded=item("forwarded",{url:"https://private.example.com/mail"});
  const report=brief({researchLabs:{matches:[bad,good]},scholarships:[expired],actions:[course,{...bad,id:"research-bad"}],opportunities:[forwarded],forwardedEmails:[forwarded],canvas:{upcoming:[course]},emailUpdates:{researchLabs:{matches:[bad]},scholarships:[],opportunities:[]}});
  const calls=[];const verify=async input=>{calls.push(input);return input.endsWith("missing")?check("not_found"):check();};
  const result=await guard.verifyRadarPreview(report,now,verify);
  assert.equal(report.researchLabs.matches.length,2);assert.equal(result.researchLabs.matches.length,1);assert.equal(result.researchLabs.matches[0].id,"good");
  assert.equal(result.emailUpdates.researchLabs.matches.length,0);assert.equal(result.scholarships.length,0);
  assert.equal(result.actions.length,1);assert.equal(result.actions[0].id,"course");assert.equal(result.opportunities.length,1);
  assert.ok(calls.every(input=>!input.includes("private-course")&&!input.includes("private.example.com")));
  const email=mail.renderRadarEmail(result,"Student");assert.ok(!email.html.includes("bad"));assert.ok(email.text.includes("good"));assert.ok(!email.text.includes("expired"));
});
test("blocked/unreviewed items are withheld, sign-in candidates remain explicit, stale recruitment is not an apply-now instruction",async()=>{
  const lab=item("lab",{status:"explicitly_recruiting",verifiedAt:"2026-09-30",nextAction:"Apply now"});
  const job=item("job",{url:"https://student.interstride.com/jobs/detail/123",status:"open",reviewedAt:"2026-10-16",deadline:null});
  const result=await guard.verifyRadarPreview(brief({researchLabs:{matches:[lab]},careerJobs:[job],scholarships:[item("review",{availability:"needs_review"})]}),now,async input=>input.includes("interstride")?check("login_required"):check());
  assert.equal(result.researchLabs.matches[0].status,"contact_to_confirm");assert.doesNotMatch(result.researchLabs.matches[0].nextAction,/Apply now/);
  assert.equal(result.careerJobs[0].verification.status,"login_required");assert.equal(result.scholarships.length,0);
  const blocked=await guard.verifyRadarPreview(brief({researchLabs:{matches:[lab]}}),now,async()=>check("blocked"));assert.equal(blocked.researchLabs.matches.length,0);assert.equal(blocked.sourceChecks.withheld[0].verification.status,"blocked");
  const html=renderToStaticMarkup(nativeRequire("react").createElement(statuses.SourceReviewPanel,{preview:blocked}));assert.match(html,/items withheld/);assert.match(html,/not that the page is missing/);
});
test("every serving path applies the guard, including email retries, without changing consent or business implementation",()=>{
  for(const file of ["lib/server/radar.ts","app/api/beta/profile/route.ts","app/api/beta/ask/route.ts","app/api/internal/email/route.ts"])assert.match(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),/verifyRadarPreview/);
  const mailRoute=fs.readFileSync(new URL("../app/api/internal/email/route.ts",import.meta.url),"utf8");assert.match(mailRoute,/selectBriefUpdates/);assert.doesNotMatch(mailRoute,/if \(!hasBriefUpdates\(updates\)\) continue/);
});
