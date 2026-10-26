import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require:id=>imports[id],Date,Intl});return exports;
}
const reminder = load("lib/course-reminders.ts");
const versions = load("lib/public-signal-version.ts");
const career = load("lib/career-matching.ts");
const updates = load("lib/brief-updates.ts",{"./course-reminders":reminder,"./public-signal-version":versions,"./career-matching":career});
const mail = load("lib/server/email-delivery.ts",{"../course-reminders":reminder});
const now = new Date("2026-10-15T16:00:00Z");
const item = (title, when, source="Canvas Calendar Feed")=>({id:title,title,when,source,why:"A supplied course item",nextAction:"Check the course page",url:null,score:90,confidence:"confirmed"});
const preview = (items=[])=>({formatVersion:2,language:"en",actions:[],canvas:{connected:true,upcoming:items},academic:{connected:false,upcoming:[]},researchLabs:{matches:[]},opportunities:[],scholarships:[],businessNews:[],aiNews:[],externalEvents:[]});

test("course reminder data filters past, invalid and distant dates and collapses duplicate feed/API/manual entries",()=>{
  const due=item("Project 1","2026-10-16T20:00:00Z");
  const report={...preview([due,item("Old","2026-10-14T00:00:00Z"),item("Missing",null),item("Invalid","unknown"),item("Far","2026-12-01T00:00:00Z")]),academic:{upcoming:[{...due,id:"manual-1",source:"Course deadline"}]},actions:[{...due,id:"api-1",source:"Canvas API"},item("Interview","2026-10-16T12:00:00Z","Google Calendar")]};
  const rows=reminder.courseReminders(report,now);assert.equal(rows.length,1);assert.equal(rows[0].title,"Project 1");
});
test("an unchanged course item within 72 hours can trigger a subscribed morning brief without new opportunities",()=>{
  const current=preview([item("Project","2026-10-17T16:00:00Z")]);
  assert.equal(updates.hasBriefUpdates(updates.selectBriefUpdates(current,[current]),now),true);
  assert.equal(updates.hasBriefUpdates(preview([item("Later","2026-10-22T16:00:00Z")]),now),false);
  assert.equal(updates.hasBriefUpdates(preview([item("Passed","2026-10-14T16:00:00Z")]),now),false);
  assert.equal(updates.hasBriefUpdates(preview(),now),false);
});
test("v2 mail keeps real course reminders even when its new-only opportunity subset is empty",()=>{
  const upcoming=new Date(Date.now()+24*3_600_000).toISOString();
  for(const language of ["en","zh"]){
    const report={...preview([item("Course project <check>",upcoming)]),language,emailUpdates:{scholarships:[],researchLabs:{matches:[]},opportunities:[]}};
    const result=mail.renderRadarEmail(report,"Student");
    assert.ok(result.html.includes(language==="en"?"Course items &amp; deadlines":"课程事项与 DDL"));
    assert.ok(result.text.includes("Course project <check>"));assert.ok(result.html.includes("Course project &lt;check&gt;"));assert.ok(result.text.includes("Canvas Calendar Feed"));
    assert.ok(!result.html.includes('href=""'));assert.ok(result.html.includes(language==="en"?"Unsubscribe":"取消订阅"));
  }
});
test("displayed course time uses Eastern time across daylight-saving changes",()=>{
  assert.match(reminder.courseTime("2026-11-02T15:00:00Z","en"),/10:00/);
  assert.match(reminder.courseTime("2026-10-16T15:00:00Z","en"),/11:00/);
});
