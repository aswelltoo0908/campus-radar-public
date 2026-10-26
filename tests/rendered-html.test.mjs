import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("landing includes the evidence-backed sample and beta entry", async () => {
  const source = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(source, /Campus Radar/);
  assert.match(source, /Find my opportunities/);
  assert.match(source, /S&S Scholarship Fund/);
  assert.match(source, /href="\/beta"/);
  assert.match(source, /Sign in with ChatGPT/);
  assert.match(source, /Questions you may have/);
  assert.match(source, /No calendar connection required/);
  assert.match(source, /Research, scholarships, and internships/);
  assert.match(source, /Not an official University of Michigan\s+product/);
});

test("optional legacy settings retain existing source, calendar, feedback, and deletion controls", async () => {
  const source = await readFile(new URL("app/beta/LegacySources.tsx", root), "utf8");
  assert.match(source, /Connect Canvas and add your key deadlines/);
  assert.match(source, /Calendar Feed \(recommended\)/);
  assert.match(source, /Canvas API \(optional\)/);
  assert.match(source, /canvasFeedUrl/);
  assert.match(source, /Upload Canvas \.ics/);
  assert.match(source, /Feed shows 403/);
  assert.match(source, /canvasApiToken/);
  assert.match(source, /courseScheduleText/);
  assert.match(source, /assignmentDeadlinesText/);
  assert.match(source, /encrypted and never shown again/);
  assert.match(source, /Google Calendar/);
  assert.match(source, /upload a schedule screenshot/);
  assert.match(source, /Create \.ics/);
  assert.match(source, /Open Handshake/);
  assert.match(source, /Open Interstride/);
  assert.match(source, /Other goal \(optional\)/);
  assert.match(source, /Other interest/);
  assert.match(source, /HIGH-SIGNAL CALIBRATION/);
  assert.match(source, /AI \/ ML/);
  assert.match(source, /biggest bottleneck this week/);
  assert.match(source, /MUST DO/);
  assert.match(source, /EVENTS & OPPORTUNITIES/);
  assert.match(source, /UNDERGRAD RESEARCH RADAR/);
  assert.match(source, /Labs accepting undergraduates/);
  assert.match(source, /FIELD INSIGHT/);
  assert.match(source, /ASK RADAR/);
  assert.match(source, /Build my first Radar/);
  assert.match(source, /Not relevant/);
  assert.match(source, /Delete all data/);
  assert.match(source, /Report language/);
  assert.match(source, /Report delivery email/);
  assert.match(source, /Email my Radar/);
  assert.match(source, /send you a fresh Radar every morning/);
  assert.match(source, /Forwarded email/);
  assert.match(source, /private Radar inbox/);
  assert.match(source, /Are you a University of Michigan student/);
  assert.match(source, /Canvas instance URL/);
  assert.match(source, /app\.joinhandshake\.com/);
  assert.match(source, /Radar fills this address automatically/);
});

test("daily email automation refreshes reports and records delivery", async () => {
  const route = await readFile(new URL("app/api/internal/email/route.ts", root), "utf8");
  const script = await readFile(new URL("scripts/gmail-automation.gs", root), "utf8");
  const schema = await readFile(new URL("db/schema.ts", root), "utf8");
  assert.match(route, /refreshedPreview/);
  assert.match(route, /RADAR_EMAIL_AUTOMATION_SECRET/);
  assert.match(route, /renderRadarEmail/);
  assert.match(script, /everyMinutes\(15\)/);
  assert.match(script, /GmailApp\.sendEmail/);
  assert.match(schema, /emailDeliveries/);
});

test("research radar uses a curated, status-labeled official-source catalog", async () => {
  const source = await readFile(new URL("lib/server/radar.ts", root), "utf8");
  assert.match(source, /RESEARCH_LAB_CATALOG/);
  assert.match(source, /explicitly_recruiting/);
  assert.match(source, /official_undergrad_pathway/);
  assert.match(source, /contact_to_confirm/);
  assert.match(source, /cse\.engin\.umich\.edu/);
  assert.match(source, /midas\.umich\.edu/);
  assert.match(source, /robotics\.umich\.edu/);
  assert.match(source, /verifiedAt: "2026-09-30"/);
});

test("login transition explains the ChatGPT authentication handoff", async () => {
  const source = await readFile(new URL("app/login/page.tsx", root), "utf8");
  assert.match(source, /Why you will be redirected to ChatGPT/);
  assert.match(source, /do not need an API key/);
  assert.match(source, /auth\.openai\.com/);
});

test("privacy page states current beta limits", async () => {
  const source = await readFile(new URL("app/privacy/page.tsx", root), "utf8");
  assert.match(source, /Morning email\s+subscriptions and unsubscribe are available/);
  assert.match(source.replace(/\s+/g," "), /do not sell personal data/);
});

test("report language is persisted in the profile schema", async () => {
  const schema = await readFile(new URL("db/schema.ts", root), "utf8");
  const types = await readFile(new URL("lib/types.ts", root), "utf8");
  assert.match(schema, /reportLanguage/);
  assert.match(types, /reportLanguage: "en" \| "zh"/);
  assert.match(schema, /deliveryEmail/);
  assert.match(schema, /inboundAlias/);
  assert.match(schema, /isUmichStudent/);
  assert.match(types, /language: "en" \| "zh"/);
});
