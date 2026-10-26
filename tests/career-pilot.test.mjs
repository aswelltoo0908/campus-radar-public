import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
const nativeRequire = createRequire(import.meta.url);
function load(file, imports={}, jsx=false) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:jsx?ts.JsxEmit.ReactJSX:undefined}}).outputText,{exports,require:id=>imports[id]||nativeRequire(id),Date,URL,Intl});
  return exports;
}
const career=load("lib/career-matching.ts");
const {CAREER_PILOT_JOBS:pool,UMICH_CAREER_PILOT_EVENTS:eventsPool}=load("lib/server/career-pilot.ts");
const reminders=load("lib/course-reminders.ts");
const versions=load("lib/public-signal-version.ts");
const updates=load("lib/brief-updates.ts",{"./career-matching":career,"./course-reminders":reminders,"./public-signal-version":versions});
const policy=load("lib/source-policy.ts");
const mail=load("lib/server/email-delivery.ts",{"../course-reminders":reminders,"../source-policy":policy});
const sourceStatus=load("app/beta/SourceStatus.tsx",{"../../lib/source-policy":policy},true);
const Section=load("app/beta/CareerSection.tsx",{"../../lib/course-reminders":reminders,"./SourceStatus":sourceStatus},true).default;
const now=new Date("2026-10-16T16:00:00Z");
const profile={major:"Business",interests:["finance"],goals:["internship"],roleTracks:[],academicLevel:"undergraduate",sponsorship:"needed",reportLanguage:"en"};
const event={id:"umich-123",title:"U-M employer career conversation",url:"https://events.umich.edu/event/123",when:"2026-10-20",source:"Happening @ Michigan",kind:"career_event",campusScope:"umich",score:80,why:"Matches career interests",nextAction:"Check the event page",location:"Campus"};
const brief=(extra={})=>({formatVersion:2,language:"en",canvas:{upcoming:[]},academic:{upcoming:[]},actions:[],opportunities:[],researchLabs:{matches:[]},careerJobs:[],umichCareerEvents:[],...extra});

test("existing profile coarsely matches finance and CS without promising GPA or skill eligibility",()=>{
  const business=career.matchCareerJobs(pool,profile,now);
  assert.equal(business.length,1);assert.equal(business[0].company,"Enact Holdings");
  assert.match(business[0].checks.join(" "),/3\.2\/4\.0/);assert.match(business[0].checks.join(" "),/rising junior or senior/);
  assert.match(business[0].why,/first-pass candidate/);assert.match(business[0].sponsorshipLabel,/explicitly supports/);
  const cs=career.matchCareerJobs(pool,{...profile,major:"Computer Science",interests:["AI"],sponsorship:"unsure"},now);
  assert.equal(cs.length,2);assert.ok(cs.every(job=>job.company!=="Enact Holdings"));
  const dell=cs.find(job=>job.company==="Dell Technologies");assert.match(dell.sponsorshipLabel,/not specified/);
  const paid=career.matchCareerJobs(pool,{...profile,major:"Computer Science",interests:["AI"],paidOnly:true},now);
  assert.equal(paid.length,1);assert.equal(paid[0].company,"Dell Technologies");assert.equal(paid[0].paid,true);
  assert.match(cs.find(job=>job.company==="Jump Trading").sponsorshipLabel,/full-time roles/);
  assert.equal(career.matchCareerJobs(pool,{...profile,goals:["research"]},now).length,0);
  assert.equal(career.matchCareerJobs(pool,{...profile,paidOnly:true},now).length,0);
  assert.equal(career.matchCareerJobs(pool,{...profile,major:"Paid media",interests:[]},now).length,0);
});
test("freshness, degree, explicit no-sponsor, hidden jobs, duplicate URLs and unsafe links are respected",()=>{
  const j=pool[2],match=change=>career.matchCareerJobs([{...j,...change}],profile,now);
  for(const change of [{reviewedAt:"2026-10-01T00:00:00Z"},{reviewedAt:"invalid"},{reviewedAt:"2026-10-18T00:00:00Z"},{deadline:"2026-10-15"},{deadline:"invalid"},{status:"closed"},{status:"needs_review"},{academicLevels:["graduate"]},{sponsorship:"not_offered"},{url:"https://student.interstride.com.evil.test/jobs/detail/123"},{url:"http://student.interstride.com/jobs/detail/123"},{url:"https://secret@student.interstride.com/jobs/detail/123"}])assert.equal(match(change).length,0,JSON.stringify(change));
  assert.equal(career.matchCareerJobs(pool,profile,now,[j.id]).length,0);
  assert.equal(career.matchCareerJobs([j,{...j,id:"duplicate"}],profile,now).length,1);
  assert.equal(career.matchCareerJobs(pool,profile,new Date("2026-10-24T12:00:00Z")).length,0);
});
test("only explicit official U-M career events enter the campus lane",()=>{
  assert.equal(career.selectUmichCareerEvents([event],true).length,1);
  assert.equal(career.selectUmichCareerEvents([event],false).length,0);
  for(const changed of [{campusScope:undefined},{kind:"event"},{url:"https://events.other.edu/event/123"},{url:"javascript:alert(1)"},{url:"https://private@events.umich.edu/event/123"}])assert.equal(career.selectUmichCareerEvents([{...event,...changed}],true).length,0);
  assert.equal(career.selectUmichCareerEvents([event,event],true).length,1);
});
test("reviewed Handshake events are U-M-scoped, dated, expire before start and respect interests",()=>{
  const matched=career.matchUmichCareerSnapshots(eventsPool,{...profile,isUmichStudent:true},now);
  assert.equal(matched.length,2);assert.ok(matched.some(item=>item.title==="Internship Lab"));
  assert.equal(career.matchUmichCareerSnapshots(eventsPool,{...profile,isUmichStudent:false},now).length,0);
  const cs=career.matchUmichCareerSnapshots(eventsPool,{...profile,isUmichStudent:true,major:"Computer Science",interests:["AI"]},now);
  assert.equal(cs.length,1);assert.equal(cs[0].title,"Internship Lab");
  assert.equal(career.matchUmichCareerSnapshots(eventsPool,{...profile,isUmichStudent:true},new Date("2026-10-22T00:00:00Z")).length,0);
  const snapshot=matched[0];
  for(const change of [{reviewedAt:"2026-09-01"},{reviewedAt:undefined},{sourceMode:"live"},{url:"https://other.joinhandshake.com/stu/events/123"}])assert.equal(career.selectUmichCareerEvents([{...snapshot,...change}],true,now).length,0);
  assert.equal(career.selectUmichCareerEvents([snapshot,{...snapshot,id:"same-event"}],true,now).length,1);
});
test("rechecks and rephrased matches do not resend jobs; new facts do",()=>{
  const job=career.matchCareerJobs(pool,profile,now)[0],report=brief({careerJobs:[job],umichCareerEvents:[event],opportunities:[event]});
  const same=updates.selectBriefUpdates(brief({...report,careerJobs:[{...job,reviewedAt:"2026-10-17",why:"Reworded",summary:{en:"New prose",zh:"新文案"}}]}),[report]);
  assert.equal(same.careerJobs.length,0);assert.equal(same.umichCareerEvents.length,0);assert.equal(updates.hasBriefUpdates(same,now),false);
  for(const changed of [{deadline:"2026-11-01"},{sponsorship:"unknown"},{requirements:{en:["Minimum GPA 3.5"],zh:[]}},{id:"new-job"}]){
    const fresh=updates.selectBriefUpdates(brief({careerJobs:[{...job,...changed}]}),[report]);assert.equal(fresh.careerJobs.length,1);assert.equal(updates.hasBriefUpdates(fresh,now),true);
  }
  const legacy=brief({opportunities:[event]});delete legacy.umichCareerEvents;
  assert.equal(updates.selectBriefUpdates(report,[legacy]).umichCareerEvents.length,0);
});
test("web and HTML/plaintext mail expose evidence and checks in the selected report language",()=>{
  for(const reportLanguage of ["en","zh"]){
    const job=career.matchCareerJobs(pool,{...profile,reportLanguage},now)[0];
    const report=brief({language:reportLanguage,careerJobs:[job],umichCareerEvents:[event]});
    const result=mail.renderRadarEmail(report,"<Student>");
    for(const content of [job.title,job.sponsorshipEvidence[reportLanguage],"3.2/4.0",job.url,event.url])assert.ok(result.text.includes(content),content);
    assert.ok(result.html.includes("&lt;Student&gt;"));assert.ok(!result.html.includes("<Student>"));assert.ok(result.html.includes("3.2/4.0"));
    const html=renderToStaticMarkup(nativeRequire("react").createElement(Section,{preview:report,isUmichStudent:true,feedback:()=>null,onRefresh:()=>{},busy:false}));
    assert.ok(html.includes("3.2/4.0"));assert.ok(html.includes(job.url));assert.ok(html.includes('target="_blank"'));assert.ok(html.includes("<details"));assert.doesNotMatch(html,/\b\d{2,3}%/);
  }
});
test("full shortlist emails retain prior matches even when the new-item subset is empty",()=>{
  const jobs=career.matchCareerJobs(pool,{...profile,major:"Computer Science",interests:["AI"]},now);
  const report=brief({careerJobs:jobs,umichCareerEvents:[event],emailUpdates:{careerJobs:[],umichCareerEvents:[],opportunities:[],researchLabs:{matches:[]}}});
  const email=mail.renderRadarEmail(report,"Student");
  assert.ok(email.text.includes(jobs[0].title));assert.ok(!email.text.includes(`\nNEW / UPDATED\n${jobs[0].company} · ${jobs[0].title}`));
  const render=(preview,isUmichStudent=true)=>renderToStaticMarkup(nativeRequire("react").createElement(Section,{preview,isUmichStudent,feedback:()=>null,onRefresh:()=>{},busy:false}));
  const old=brief();delete old.careerJobs;
  assert.match(render(old),/Refresh my brief/);
  assert.match(render(brief({umichSourceMode:"unavailable"})),/temporarily unavailable/);
  assert.match(render(brief({umichCareerEvents:[event]}),false),/U-M-specific events are not recommended/);
  assert.ok(!render(brief({umichCareerEvents:[event]}),false).includes(event.title));
  assert.match(render(brief()),/No recently reviewed listing/);
});
test("unused public career items cannot trigger an empty new-format email",()=>{
  const report=brief({opportunities:[event]});
  assert.equal(updates.hasBriefUpdates(report,now),false);
  const forwarded={...event,id:"forward-1",title:"Forwarded internship invitation",source:"Forwarded email"};
  assert.equal(updates.hasBriefUpdates(brief({opportunities:[forwarded],forwardedEmails:[forwarded]}),now),true);
  assert.equal(updates.hasBriefUpdates(brief({opportunities:[],forwardedEmails:[forwarded]}),now),false);
});
