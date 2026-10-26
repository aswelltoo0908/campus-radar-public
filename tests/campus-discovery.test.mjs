import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
const nativeRequire=createRequire(import.meta.url);
function load(path,imports={},globals={}) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>imports[id] || (id.startsWith(".")?{}:nativeRequire(id)),Date,URL,Intl,Response,Request,AbortSignal,Map,Set,fetch,...globals});
  return exports;
}
const careers=load("lib/career-matching.ts"),sections=load("lib/brief-sections.ts"),employers=load("lib/server/employer-jobs.ts");
const radar=load("lib/server/radar.ts");
const policy=load("lib/source-policy.ts"),checker=load("lib/server/source-checker.ts",{"../source-policy":policy});
const verify=load("lib/server/verify-preview.ts",{"../source-policy":policy});
const reminders=load("lib/course-reminders.ts"),versions=load("lib/public-signal-version.ts");
const updates=load("lib/brief-updates.ts",{"./career-matching":careers,"./course-reminders":reminders,"./public-signal-version":versions});
const mail=load("lib/server/email-delivery.ts",{"../course-reminders":reminders,"../source-policy":policy});
const now=new Date("2026-10-22T18:00:00Z");
const profile={major:"Computer Science",interests:["AI"],roleTracks:["software_engineering"],goals:["events","internship"],isUmichStudent:true,reportLanguage:"en",academicLevel:"undergraduate",sponsorship:"needed"};
const event={id:"umich-test",title:"U-M research seminar",url:"https://events.umich.edu/event/123",kind:"event",campusScope:"umich",when:"2026-10-26T16:00:00-04:00",source:"Happening @ Michigan",score:60,why:"Matches research interest",nextAction:"Check registration"};
const brief={formatVersion:2,language:"en",generatedAt:now.toISOString(),actions:[],opportunities:[],careerJobs:[],umichCareerEvents:[],campusEvents:[event],researchLabs:{matches:[]},academic:{upcoming:[]},canvas:{upcoming:[]}};
const row={id:123,title:"Software Engineer Intern",absolute_url:"https://boards.greenhouse.io/figma/jobs/123?gh_jid=123",content:"Currently enrolled in a bachelor degree. Build software products and APIs with a team. Check the original listing for work authorization, availability and location.",location:{name:"New York, NY"}};

test("Campus events is an independent goal; external events remain optional",()=>{
  assert.equal(sections.briefEnabled("events",profile,{externalEventsEnabled:false}),true);
  assert.equal(sections.briefEnabled("events",{goals:["research"]},{externalEventsEnabled:false}),false);
  assert.equal(sections.briefCounts(brief).events,1);
  const source=readFileSync(new URL("../app/api/beta/preview/route.ts",import.meta.url),"utf8");
  assert.match(source,/new Set\(\["internship", "events"/);
  assert.match(readFileSync(new URL("../app/beta/OpportunityOnboarding.tsx",import.meta.url),"utf8"),/\["events", "Campus events"\]/);
});
test("U-M feed retains local-time future events and removes already-started/cancelled records",async()=>{
  let request;
  const data=[{id:"1",combined_title:"Research workshop",date_start:"2026-10-22",time_start:"16:00:00",permalink:"https://events.umich.edu/event/1"},{id:"2",combined_title:"Research workshop",date_start:"2026-10-22",time_start:"10:00:00"},{id:"3",combined_title:"Cancelled research workshop",date_start:"2026-10-26",time_start:"16:00:00"}];
  const result=await radar.fetchUmichOpportunities(profile,now,async url=>{request=new URL(url);return Response.json(data)});
  assert.equal(result.length,1);assert.equal(result[0].when,"2026-10-22T16:00:00-04:00");assert.equal(request.searchParams.get("max-results"),"500");
  assert.equal(radar.easternEventTime("2026-12-01","16:00:00"),"2026-12-01T16:00:00-05:00");
  await assert.rejects(()=>radar.fetchUmichOpportunities(profile,now,async()=>Response.json({error:"wrong shape"})),/schema/);
});
test("official employer parser accepts internships only, retains unknown sponsor/pay and excludes unsafe sources",()=>{
  const jobs=employers.parseEmployerJobs({jobs:[row,{...row,id:456,title:"Staff Software Engineer"},{...row,absolute_url:"https://evil.example/jobs/123"}]},employers.EMPLOYER_BOARDS[0],now.toISOString());
  assert.equal(jobs.length,1);assert.equal(jobs[0].source,"Employer careers");assert.equal(jobs[0].sponsorship,"unknown");assert.equal(jobs[0].paid,undefined);
  const matched=careers.matchCareerJobs(jobs,profile,now);assert.equal(matched.length,1);assert.match(matched[0].checks.join(" "),/deadline is unverified/);
  assert.equal(careers.matchCareerJobs(jobs,{...profile,paidOnly:true},now).length,0);
  assert.equal(careers.matchCareerJobs(jobs,{...profile,major:"Political Science",interests:[],roleTracks:[]},now).length,0);
  assert.throws(()=>employers.parseEmployerJobs({},employers.EMPLOYER_BOARDS[0],now.toISOString()),/schema/);
});
test("paid-only admits an explicit employer rate but not an assumed paid internship",()=>{
  const paid=employers.parseEmployerJobs({jobs:[{...row,content:row.content+" The hourly base pay rate stated below. Internship $46 USD."}]},employers.EMPLOYER_BOARDS[0],now.toISOString());
  assert.equal(paid[0].paid,true);assert.equal(careers.matchCareerJobs(paid,{...profile,paidOnly:true},now).length,1);
  assert.match(paid[0].requirements.en.join(" "),/\$46/);
});
test("employer role check verifies same ATS identity and does not accept missing or substituted roles",async()=>{
  const url=row.absolute_url;
  let endpoint;
  const checked=await checker.probeSource(url,async (target,options)=>{endpoint=target;assert.equal(options.redirect,"manual");return Response.json(row)},now);
  assert.equal(checked.status,"reachable");assert.equal(endpoint,"https://boards-api.greenhouse.io/v1/boards/figma/jobs/123");
  assert.equal((await checker.probeSource(url,async()=>new Response(null,{status:404}),now)).status,"not_found");
  assert.equal((await checker.probeSource(url,async()=>Response.json({...row,id:999}),now)).status,"needs_review");
});
test("campus updates trigger subscribed mail once, survive HTML/plain text, and expired sources stay withheld",async()=>{
  const fresh=updates.selectBriefUpdates(brief,[]);assert.equal(updates.hasBriefUpdates(fresh,now),true);
  const email=mail.renderRadarEmail({...brief,emailUpdates:fresh},"Test");assert.match(email.html,/U-M campus events/);assert.match(email.text,/U-M research seminar/);
  const again=updates.selectBriefUpdates(brief,[brief]);assert.equal(again.campusEvents.length,0);assert.equal(updates.hasBriefUpdates(again,now),false);
  const safe=await verify.verifyRadarPreview({...brief,campusEvents:[{...event,when:"2026-10-21T12:00:00-04:00"}]},now,async()=>({status:"reachable",checkedAt:now.toISOString(),httpStatus:200,finalUrl:event.url,reason:"Test source"}));
  assert.equal(safe.campusEvents.length,0);assert.equal(safe.sourceChecks.withheld[0].verification.status,"expired");
});
