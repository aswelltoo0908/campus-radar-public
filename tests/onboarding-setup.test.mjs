import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(path, imports = {}, extra = "") {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8") + extra, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: id => imports[id] || (id.startsWith("react") ? require(id) : {}), Date, URL, Response, crypto: { randomUUID: () => "test-only-uuid" } });
  return exports;
}
const types = load("lib/types.ts");
const matching = load("lib/opportunity-matching.ts", { "./types": types });
const setup = load("lib/onboarding-profile.ts", { "./opportunity-matching": matching });
const fields = load("app/beta/RadarSetupFields.tsx");
const initial = { school: "LSA", major: "Mathematics", graduationYear: "2028", goals: ["scholarship"], interests: [], sponsorship: "unsure", isUmichStudent: true, academicLevel: "undergraduate", careerStage: "exploring", bottleneck: "finding", roleTracks: [], reportLanguage: "en", deliveryEmail: "student@example.edu", emailDeliveryEnabled: false, forwardingEnabled: false, paidOnly: false, weekends: false, deliveryTime: "08:30", opportunityPreferences: matching.DEFAULT_PREFERENCES };

test("profile hydration preserves opted-out email, eligibility and custom interests without re-exposing secrets", () => {
  const form = setup.hydrateRadarForm(initial, { ...initial, emailDeliveryEnabled: false, sponsorship: "needed", reportLanguage: "zh", interests: ["math", "other:public health"], opportunityPreferences: { visa: "f1", citizenshipRegion: "asia", transferStudent: "yes", stem: "yes" }, canvasApiToken: "must-not-hydrate", canvasFeedUrl: "must-not-hydrate" }, [{ type: "canvas_ics", status: "error" }, { type: "canvas_api", status: "connected" }, { type: "google_calendar_ics", status: "connected" }]);
  assert.equal(form.keepCanvasConnection, true); assert.equal(form.keepCanvasApiConnection, true); assert.equal(form.keepGoogleCalendarConnection, true); assert.equal(form.keepManualAcademicData, true);
  assert.equal(form.emailDeliveryEnabled, false); assert.equal(form.sponsorship, "needed"); assert.equal(form.opportunityPreferences.visa, "f1"); assert.equal(form.opportunityPreferences.transferStudent, "yes");
  assert.equal(form.customInterest, "public health"); assert.equal(form.reportLanguage, "zh"); assert.equal(form.canvasApiToken, ""); assert.equal(form.canvasFeedUrl, "");
});
test("step validation permits skipped Canvas and unknown eligibility but validates requested email/API input", () => {
  for (const step of [0, 1, 2]) assert.equal(setup.validateSetupStep(initial, step), null);
  assert.ok(setup.validateSetupStep({ ...initial, graduationYear: "oops" }, 0));
  assert.ok(setup.validateSetupStep({ ...initial, goals: [] }, 1));
  assert.ok(setup.validateSetupStep({ ...initial, emailDeliveryEnabled: true, deliveryEmail: "bad" }, 2));
  assert.equal(setup.radarSetupPayload({ ...initial, canvasApiToken: "test-token" }).canvasBaseUrl, "https://umich.instructure.com");
  assert.ok(setup.validateSetupStep({ ...initial, isUmichStudent: false, canvasApiToken: "test-token" }, 2));
  assert.equal(setup.radarSetupPayload({ ...initial, isUmichStudent: false, canvasApiToken: "test-token", canvasBaseUrl: "https://example.instructure.com" }).canvasBaseUrl, "https://example.instructure.com");
});
test("actual Canvas and email components render privacy, fallback and explicit opt-in controls", () => {
  const html = renderToStaticMarkup(React.createElement(fields.CanvasSetupFields, { form: initial, onChange: () => {} }));
  for (const label of ["Calendar Feed", "Canvas Access Token", "Canvas instance URL", "Upload Canvas .ics", "403", "snapshots", "course page"]) assert.ok(html.includes(label), label);
  assert.match(html, /type="password"/); assert.match(html, /accept=".ics,text\/calendar"/);
  const mail = renderToStaticMarkup(React.createElement(fields.EmailSetupFields, { form: initial, onChange: () => {} }));
  assert.ok(mail.includes("Report delivery email")); assert.ok(mail.includes("Web only")); assert.ok(!mail.includes('checked=""')); assert.ok(mail.includes("72 hours"));
  const source = readFileSync(new URL("../app/beta/OpportunityOnboarding.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/<EmailSetupFields /g) || []).length, 1, "email form remains only at the end of the brief");
  assert.ok(source.includes("Will you need employer visa sponsorship?")); assert.ok(source.includes("Funding eligibility"));
});

function previewRoute({ failFeed = false, signedIn = true } = {}) {
  const writes = [], deletions = [];
  const schema = { profiles: { email: "profile.email" }, sources: { userEmail: "source.owner", type: "source.type" }, feedback: { userEmail: "feedback.owner" }, radarRuns: {} };
  const existingSources = [{ type: "canvas_ics", status: "connected", encryptedConfig: "encrypted-feed" }, { type: "canvas_api", status: "connected", encryptedConfig: "encrypted-api" }];
  let selectCount = 0;
  const db = {
    select: () => { const count = ++selectCount; return { from: () => ({ where: () => { const rows = count === 1 ? [{ email: "owner@example.edu", inboundAlias: "existing" }] : count === 3 ? [] : existingSources; return { limit: async () => rows, then: (resolve) => Promise.resolve(rows).then(resolve) }; } }) }; },
    insert: table => ({ values: data => { writes.push({ table, data }); return { onConflictDoUpdate: async () => {}, returning: async () => [{ id: 77 }] }; } }),
    delete: table => ({ where: async condition => { deletions.push(condition); } }),
    batch: async operations => Promise.all(operations),
  };
  const radar = {
    validateCanvasFeedUrl: () => {}, validateCanvasBaseUrl: () => {}, validateGoogleCalendarFeedUrl: () => {},
    fetchCanvasDeadlines: async () => { if (failFeed) throw new Error("Canvas blocked this Feed (403). Upload .ics instead."); return []; },
    fetchCanvasApiDeadlines: async () => [], parseCanvasIcs: () => [], parseManualAcademicData: () => ({ courses: [], deadlines: [] }),
    buildRadarPreview: async () => ({ opportunities: [] }),
  };
  const route = load("app/api/beta/preview/route.ts", {
    "drizzle-orm": { eq: (field, value) => ({ field, value }), and: (...parts) => parts, count: () => 0 },
    "../../../chatgpt-auth": { getChatGPTUser: async () => signedIn ? { email: "owner@example.edu", fullName: "Student" } : null },
    "../../../../db": { getDb: () => db }, "../../../../db/schema": schema,
    "../../../../lib/server/crypto": { decryptSecret: async value => value === "encrypted-api" ? JSON.stringify({ baseUrl: "https://example.instructure.com", token: "test-only-token" }) : "https://example.instructure.com/feeds/calendars/test.ics", encryptSecret: async () => "encrypted" },
    "../../../../lib/server/radar": radar, "../../../../lib/opportunity-matching": matching,
    "../../../../lib/aihot-content": load("lib/aihot-content.ts"),
    "../../../../lib/server/email": { radarInboxAddress: () => "test@example.edu" },
    "../../../../lib/server/forwarded-email": { forwardedEmailItems: async () => [] },
  });
  return { route, writes, deletions, schema };
}
test("the existing save endpoint persists new sponsorship/funding fields and retains blank saved sources and opted-out email", async () => {
  const { route, writes, deletions, schema } = previewRoute();
  const form = setup.hydrateRadarForm(initial, { ...initial, sponsorship: "needed", opportunityPreferences: { visa: "f1", transferStudent: "yes" } }, [{ type: "canvas_ics" }, { type: "canvas_api" }]);
  const response = await route.POST({ json: async () => setup.radarSetupPayload(form) });
  assert.equal(response.status, 200);
  const saved = writes.find(write => write.table === schema.profiles).data;
  assert.equal(saved.sponsorship, "needed"); assert.equal(saved.emailDeliveryEnabled, false); assert.equal(JSON.parse(saved.opportunityPreferencesJson).visa, "f1");
  assert.ok(!JSON.stringify(deletions).includes('"value":"canvas_ics"')); assert.ok(!JSON.stringify(deletions).includes('"value":"canvas_api"'));
});
test("a rejected replacement Feed cannot change subscriptions or overwrite existing sources; unauthenticated saves are rejected", async () => {
  const blocked = previewRoute({ failFeed: true });
  const response = await blocked.route.POST({ json: async () => ({ ...initial, canvasFeedUrl: "https://example.instructure.com/feeds/calendars/test.ics" }) });
  assert.equal(response.status, 400); assert.equal(blocked.writes.length, 0); assert.equal(blocked.deletions.length, 0);
  const anonymous = previewRoute({ signedIn: false });
  assert.equal((await anonymous.route.POST({ json: async () => initial })).status, 401); assert.equal(anonymous.writes.length, 0);
});
test("university is a free-text field independent of optional college and survives hydration",()=>{
  const form={...initial,universityName:"  Michigan   State University  ",school:"",isUmichStudent:true};
  assert.equal(setup.validateSetupStep(form,0),null);
  const payload=setup.radarSetupPayload(form);
  assert.equal(payload.universityName,"Michigan State University");assert.equal(payload.isUmichStudent,false);
  assert.equal(payload.opportunityPreferences.universityName,payload.universityName);
  const saved=setup.hydrateRadarForm(initial,{...payload,universityName:undefined},[]);
  assert.equal(saved.universityName,payload.universityName);assert.equal(saved.school,"");
  assert.ok(setup.validateSetupStep({...form,universityName:"   "},0));
  assert.equal(setup.hydrateRadarForm(initial,initial,[]).universityName,"University of Michigan");
  const source=readFileSync(new URL("../app/beta/OpportunityOnboarding.tsx",import.meta.url),"utf8");
  assert.match(source,/University\s*<input/);assert.ok(source.includes("School / college (optional)"));
});
test("only exact Ann Arbor aliases enable U-M sources",()=>{
  for(const name of ["University of Michigan","UMich","密歇根大学","University of Michigan - Ann Arbor"])assert.equal(matching.isUmichUniversity(name),true,name);
  for(const name of ["Michigan State University","University of Michigan-Dearborn","University of Michigan-Flint","University of Michigan scam",""])assert.equal(matching.isUmichUniversity(name),false,name);
});
test("save endpoint persists a new school without a migration and derives campus scope server-side",async()=>{
  const {route,writes,schema}=previewRoute();
  const response=await route.POST({json:async()=>({...initial,universityName:"  New   University  ",school:"",isUmichStudent:true})});
  assert.equal(response.status,200);
  const saved=writes.find(write=>write.table===schema.profiles).data;
  assert.equal(saved.isUmichStudent,false);assert.equal(saved.school,"");
  assert.equal(JSON.parse(saved.opportunityPreferencesJson).universityName,"New University");
  assert.equal(saved.emailDeliveryEnabled,false);
  const rejected=previewRoute();assert.equal((await rejected.route.POST({json:async()=>({...initial,universityName:" "})})).status,400);assert.equal(rejected.writes.length,0);
});
