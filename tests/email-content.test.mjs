import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const reminders = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/course-reminders.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:reminders,Date,Intl});
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/server/email-delivery.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: () => reminders });
const item = title => ({ title, why: "Match explanation", nextAction: "Check details", when: "2026-10-05 09:00 America/New_York", location: "Campus", source: "Official source", confidence: "confirmed", url: "https://example.com/event", score: 90 });
test("AIHOT mail keeps short copy, linked attribution and original publisher in both formats",()=>{
  const row={sourceId:"aihot",sourceName:"AIHOT",originalSourceName:"Publisher",title:"Short title",summary:"Short <excerpt>",url:"https://example.org/story",attributionUrl:"https://aihot.news/items/one",why:"Interest match",nextAction:"Read",unknownConditions:[]};
  const email=exports.renderRadarEmail({formatVersion:2,language:"en",aiNews:[row],researchLabs:{matches:[]},opportunities:[]},null);
  for(const body of [email.html,email.text]){assert.ok(body.includes("Source: AIHOT"));assert.ok(body.includes(row.url));assert.ok(body.includes(row.attributionUrl));assert.ok(body.includes("Publisher"));}
  assert.ok(email.html.includes("Short &lt;excerpt&gt;"));
});
const preview = {
  language: "en", generatedAt: "2026-10-04T12:00:00Z", attribution: "Independent recommendations",
  insight: { title: "Profile insight", detail: "Your priorities", evidence: ["AI focus"] },
  fieldInsight: { title: "Field insight", signal: "Research signal", implication: "Product implication", experiment: "Try a prototype", sources: [{ label: "Paper", url: "https://example.com/paper" }] },
  actions: [item("First action"), item("Second action")], opportunities: Array.from({ length: 6 }, (_, i) => item(`Event ${i}`)),
  academic: { connected: true, upcoming: [item("Manual deadline")] }, canvas: { connected: true, upcoming: [item("Canvas assignment")] }, googleCalendar: { connected: true, upcoming: [item("Calendar interview")] },
  forwardedEmails: [item("Forwarded confirmation")], risk: item("Conflict warning"),
  researchLabs: { enabled: true, sourceNote: "Check recruitment status", matches: [{ name: "Example lab", department: "Engineering", areas: ["AI"], statusLabel: "Contact to confirm", why: "Research match", nextAction: "Read the lab page", verifiedAt: "2026-10-04", url: "https://example.com/lab" }] },
};
test("opportunity email keeps the full current shortlist and labels only new or materially changed items",()=>{
  const fund=title=>({id:title,title,summary:"Source-backed funding",why:"Matches your funding goal",nextAction:"Check official requirements",url:"https://example.edu/funding",amount:"$5,000",opensAt:"2026-11-09",deadline:"2026-12-07",publishedAt:null,sourceName:"Official funding source",sourceMode:"verified_snapshot",verifiedAt:"2026-10-14",unknownConditions:["Full-time enrollment"],availability:"upcoming",contentHash:title});
  const full={...preview,formatVersion:2,scholarships:[fund("New fund"),fund("Previously sent fund")],researchLabs:{...preview.researchLabs,matches:[]},opportunities:[],emailUpdates:{scholarships:[fund("New fund")],researchLabs:{...preview.researchLabs,matches:[]},opportunities:[]}};
  const email=exports.renderRadarEmail(full,"Student");
  assert.ok(email.html.includes("New fund"));assert.ok(email.text.includes("New fund"));
  assert.ok(email.html.includes("Previously sent fund"));assert.ok(email.text.includes("Previously sent fund"));assert.equal(full.scholarships.length,2);
  assert.match(email.html,/NEW \/ UPDATED/);assert.match(email.text,/NEW \/ UPDATED/);
  assert.match(email.html,/currently relevant matches/i);assert.match(email.text,/currently relevant matches/i);
  assert.ok(!email.html.includes("Canvas is not connected"));assert.ok(email.html.includes("manually verified snapshot"));
  assert.ok(email.html.includes("Unsubscribe"));
});
test("full report content appears in HTML and plain text, without a four-event cap", () => {
  const email = exports.renderRadarEmail(preview, "Shawn");
  for (const value of ["Profile insight", "AI focus", "Field insight", "Research signal", "Product implication", "Try a prototype", "First action", "Event 5", "Manual deadline", "Canvas assignment", "Calendar interview", "Forwarded confirmation", "Conflict warning", "Example lab", "Contact to confirm", "2026-10-04", "https://example.com/paper"]) {
    assert.ok(email.html.includes(value), `HTML missing ${value}`);
    assert.ok(email.text.includes(value), `text missing ${value}`);
  }
  assert.ok(!email.html.includes("<ol"));
  assert.match(email.html, /1\. First action/);
  assert.ok(!email.html.includes("1. 1."));
  assert.match(email.html, /Open Radar \/ Ask Radar/);
});
test("language preference applies to email sections and missing-data notices", () => {
  for (const language of ["en", "zh"]) {
    const email = exports.renderRadarEmail({ ...preview, language, academic: { connected: false, upcoming: [] }, canvas: { connected: false, upcoming: [] }, googleCalendar: { connected: false, upcoming: [] }, risk: null }, null);
    for (const value of language === "en" ? ["Canvas is not connected", "Google Calendar is not connected", "No course schedule", "No risk flagged"] : ["Canvas 未连接", "Google Calendar 未连接", "尚未添加课表", "当前数据中没有标记风险", "取消订阅日报"]) {
      assert.ok(email.html.includes(value)); assert.ok(email.text.includes(value));
    }
  }
});
test("HTML escapes user/source content and rejects executable link schemes", () => {
  const email = exports.renderRadarEmail({ ...preview, actions: [{ ...item('<script>alert("x")</script>'), url: "javascript:alert(1)" }] }, "<img>");
  assert.ok(!email.html.includes("<script>")); assert.ok(!email.html.includes("<img>"));
  assert.ok(!email.html.includes('href="javascript:'));
  assert.match(email.html, /&lt;script&gt;/);
});
