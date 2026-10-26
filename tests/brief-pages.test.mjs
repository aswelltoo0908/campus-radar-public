import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
function load(file, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date, URL,
    require: id => imports[id] ?? (id.startsWith("react") ? require(id) : {}),
  });
  return exports;
}
const sections = load("lib/brief-sections.ts");
const types = load("lib/types.ts");
const matching = load("lib/opportunity-matching.ts", { "./types": types });
const business = load("app/beta/BusinessSection.tsx").default;
const sourcePolicy = load("lib/source-policy.ts");
const sourceStatus = load("app/beta/SourceStatus.tsx", { "../../lib/source-policy": sourcePolicy });
const link = ({ children, ...props }) => React.createElement("a", props, children);
const news = load("app/beta/NewsSection.tsx", {
  "next/link": { default: link }, "../../lib/brief-sections": sections,
  "./BusinessSection": { default: business },
}).default;
const preferences = { ...matching.DEFAULT_PREFERENCES, newsEnabled: true, newsChannels: ["finance"], aiNewsEnabled: true, externalEventsEnabled: true };
const profile = {
  major: "Computer Science", school: "LSA", graduationYear: "2028",
  goals: ["research", "scholarship", "internship"], interests: [], roleTracks: [],
  isUmichStudent: true, reportLanguage: "en", sponsorship: "unsure",
  opportunityPreferences: preferences,
};
const preview = {
  language: "en", generatedAt: "2026-10-17T12:00:00Z", formatVersion: 2,
  researchLabs: { matches: [] }, scholarships: [], businessNews: [], aiNews: [], externalEvents: [],
  careerJobs: [], umichCareerEvents: [], canvas: { connected: false, upcoming: [] },
  academic: { connected: false, upcoming: [] }, attribution: "Original sources retained.",
};

function renderPage(section, { form = profile, report = preview, step = 3 } = {}) {
  const values = [form, [], step, false, false, "", report, 1, {}, "", null];
  let index = 0;
  const component = load("app/beta/OpportunityOnboarding.tsx", {
    react: { ...React, useState: () => [values[index++], () => {}], useEffect: () => {} },
    "next/link": { default: link },
    "../../lib/brief-sections": sections,
    "../../lib/types": types,
    "../../lib/opportunity-matching": matching,
    "../../lib/course-reminders": { courseReminders: () => [] },
    "./NewsSection": { default: news },
    "./SourceStatus": sourceStatus,
    "./CareerSection": { default: () => React.createElement("section", { id: "brief-careers" }, "Careers") },
    "./RadarSetupFields": {
      CanvasSetupFields: () => React.createElement("div", null, "Canvas settings"),
      EmailSetupFields: () => React.createElement("div", null, "Email settings"),
    },
  }).default;
  return renderToStaticMarkup(React.createElement(component, { email: "test@example.edu", section }));
}

test("each enabled section renders only its own content and marks its URL active", () => {
  const expected = { research: "brief-research", funding: "brief-funding", careers: "brief-careers", news: "brief-news", events: "brief-events", deadlines: "brief-deadlines", ask: "brief-ask", email: "brief-email" };
  for (const [page, id] of Object.entries(expected)) {
    const html = renderPage(page);
    assert.ok(html.includes(`id="${id}"`), page);
    for (const other of Object.values(expected).filter(value => value !== id && value !== "brief-email")) assert.ok(!html.includes(`id="${other}"`), `${page} must omit ${other}`);
    assert.match(html, new RegExp(`href="/beta/${page}" aria-current="page"`));
    assert.equal(html.includes("Delete all data"), page === "email");
  }
});
test("every report ends with explicit email preferences and has a prominent jump-to-subscribe button",()=>{
  for(const page of ["overview","research","funding","careers","news","events","deadlines","ask","email"]){
    const html=renderPage(page);
    assert.equal((html.match(/id="brief-email"/g)||[]).length,1,page);
    assert.ok(html.includes('href="#brief-email"'),page);
    assert.ok(html.includes('id="brief-subscribe-title"'),page);
    assert.ok(html.includes("No subscription is required"),page);
    assert.ok(html.indexOf('id="brief-email"')>html.indexOf('class="brief-masthead"'),page);
  }
});

test("overview links to the separate pages and keeps disabled sections discoverable", () => {
  const html = renderPage("overview", { form: { ...profile, opportunityPreferences: matching.DEFAULT_PREFERENCES } });
  assert.ok(html.includes('href="/beta/research"'));
  assert.ok(html.includes('href="/beta/funding"'));
  assert.ok(html.includes("Not enabled yet"));
  assert.ok(html.includes("Enable in preferences"));
  assert.ok(!html.includes('href="/beta/business"'));
  assert.ok(html.includes('href="/beta/news"'));
  assert.ok(!html.includes('id="brief-research"'));
});

test("separate brief pages retain the source-check review boundary", () => {
  const html = renderPage("research", { report: { ...preview, sourceChecks: {
    policyVersion: 1, checkedAt: "2026-10-18T12:00:00Z", withheld: [{
      id: "blocked-lab", title: "Lab awaiting verification", url: "https://lsa.umich.edu/research.html",
      verification: { status: "blocked", checkedAt: "2026-10-18T12:00:00Z", httpStatus: 403, finalUrl: null, reason: "Denied" },
    }],
  } } });
  assert.match(html, /1 items withheld/);
  assert.match(html, /not that the page is missing/);
  assert.match(html, /Check original source manually/);
});

test("disabled direct links show an explicit enable action and no business content", () => {
  const html = renderPage("business", { form: { ...profile, opportunityPreferences: matching.DEFAULT_PREFERENCES } });
  assert.ok(html.includes("Updates for this topic are turned off"));
  assert.ok(html.includes("Edit preferences"));
  assert.ok(!html.includes('id="brief-business"'));
});

test("news preferences are visible without expanding details, including disabled topic choices", () => {
  const html = renderPage("overview", { form: { ...profile, opportunityPreferences: matching.DEFAULT_PREFERENCES }, step: 1 });
  assert.ok(html.includes('aria-labelledby="field-news-title"'));
  assert.ok(html.includes('id="field-news-title">News'));
  assert.ok(html.includes("AI news · optional updates from AIHOT and publishers"));
  assert.ok(html.includes('<fieldset class="business-channel-picker" disabled="">'));
  assert.ok(!html.includes("<summary>Optional field news"));
});

test("visiting a section without a saved brief keeps the setup flow available", () => {
  assert.ok(renderPage("business", { report: null, step: 0 }).includes("A little about you"));
});

test("section routes validate slugs and preserve login return destinations", async () => {
  const notFound = () => { throw new Error("NOT_FOUND"); };
  const redirect = value => { throw new Error(`REDIRECT:${value}`); };
  const route = load("app/beta/[section]/page.tsx", {
    "next/navigation": { notFound, redirect }, "../../../lib/brief-sections": sections,
    "../BetaWorkspace": { default: () => null },
  }).default;
  const result = await route({ params: Promise.resolve({ section: "news" }) });
  assert.equal(result.props.section, "news");
  await assert.rejects(() => route({ params: Promise.resolve({ section: "business" }) }), /REDIRECT:\/beta\/news\/business/);
  await assert.rejects(() => route({ params: Promise.resolve({ section: "ai" }) }), /REDIRECT:\/beta\/news\/tech/);
  for (const value of ["missing", "overview", "settings"]) await assert.rejects(() => route({ params: Promise.resolve({ section: value }) }), /NOT_FOUND/);
  const shell = load("app/beta/BetaWorkspace.tsx", {
    "next/navigation": { redirect: value => { throw new Error(value); } },
    "../chatgpt-auth": { getChatGPTUser: async () => null },
    "../../lib/brief-sections": sections,
  }).default;
  await assert.rejects(() => shell({ section: "business" }), /\/login\?return_to=%2Fbeta%2Fnews%2Fbusiness/);
  const topicRoute = load("app/beta/news/[topic]/page.tsx", {
    "next/navigation": { notFound }, "../../../../lib/brief-sections": sections,
    "../../BetaWorkspace": { default: () => null },
  }).default;
  for (const topic of ["tech", "business"]) assert.equal((await topicRoute({ params: Promise.resolve({ topic }) })).props.section, topic);
  for (const topic of ["missing", "policy", "ai"]) await assert.rejects(() => topicRoute({ params: Promise.resolve({ topic }) }), /NOT_FOUND/);
});

test("News groups Tech and Business without enabling either subscription or inventing future feeds", () => {
  const report = { ...preview, businessNews: [{ id: "business-story", title: "Business only" }], aiNews: [{ id: "tech-story", title: "Tech only" }] };
  const html = renderPage("news", { report });
  assert.match(html, /href="\/beta\/news\/tech"/);
  assert.match(html, /href="\/beta\/news\/business"/);
  assert.match(html, /More topics/);
  assert.match(html, /Not available yet/);
  assert.doesNotMatch(html, /href="\/beta\/(business|ai)"/);
  assert.ok(!html.includes("Business only") && !html.includes("Tech only"));
  const optedOut = renderPage("news", { report, form: { ...profile, opportunityPreferences: matching.DEFAULT_PREFERENCES } });
  assert.match(optedOut, /Updates are turned off/);
  assert.equal((optedOut.match(/1 available updates/g) || []).length, 0);
  assert.deepEqual(profile.opportunityPreferences, preferences);
});

test("login handoff preserves exact News destinations and rejects external or unknown returns", async () => {
  for (const value of [undefined, ["/beta/news"], "https://evil.test", "//evil.test", "/\\evil.test", "/beta/news/../../callback", "/beta/news?return_to=evil", "/beta/news/policy"]) assert.equal(sections.briefReturnPath(value), "/beta");
  for (const value of ["/beta/news", "/beta/news/tech", "/beta/news/business", "/beta/settings"]) assert.equal(sections.briefReturnPath(value), value);
  const login = load("app/login/page.tsx", {
    "next/link": { default: link }, "../../lib/brief-sections": sections,
    "next/navigation": { redirect: value => { throw new Error(`REDIRECT:${value}`); } },
    "../chatgpt-auth": { getChatGPTUser: async () => null, chatGPTSignInPath: value => `/signin-with-chatgpt?return_to=${encodeURIComponent(value)}` },
  }).default;
  const html = renderToStaticMarkup(await login({ searchParams: Promise.resolve({ return_to: "/beta/news/tech" }) }));
  assert.match(html, /return_to=%2Fbeta%2Fnews%2Ftech/);
});

test("Tech and Business share the News parent but render isolated, opt-in content", () => {
  for (const [topic, expected, other] of [["tech", "brief-tech", "brief-business"], ["business", "brief-business", "brief-tech"]]) {
    const html = renderPage(topic);
    assert.match(html, /href="\/beta\/news" aria-current="page"/);
    assert.match(html, new RegExp(`href="/beta/news/${topic}" aria-current="page"`));
    assert.ok(html.includes(`id="${expected}"`));
    assert.ok(!html.includes(`id="${other}"`));
    const off = renderPage(topic, { form: { ...profile, opportunityPreferences: matching.DEFAULT_PREFERENCES } });
    assert.ok(!off.includes(`id="${expected}"`));
    assert.match(off, /not changed automatically/);
  }
  assert.match(renderPage("tech"), /not whole-sector technology coverage/);
});

test("workspace and News navigation override legacy global nav layout", () => {
  const css = read("app/radar-ui.css");
  assert.match(css, /\.opportunity-ui \.workspace-page-nav\s*\{[^}]*display:block/);
  assert.match(css, /\.opportunity-ui \.news-topic-nav\s*\{[^}]*display:flex/);
  assert.match(css, /\.opportunity-ui \.workspace-page-nav\s*\{\s*display:none/);
});

test("business rendering caps both lists, orders fresh stories first, retains feedback and leaves input intact", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({
    id: `story-${i}`, title: `Story ${i}`, sourceName: "Publisher", channel: "finance", url: `https://example.com/${i}`,
    publishedAt: i === 0 ? null : i === 1 ? "invalid" : `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
    score: 40, summary: "Summary", why: "Your interest", nextAction: "Read source",
  }));
  const before = JSON.stringify(items);
  const html = renderToStaticMarkup(React.createElement(business, {
    items, selectedChannels: ["finance"], language: "en", generatedAt: preview.generatedAt,
    feedback: id => React.createElement("button", { "data-feedback": id }, "Relevant"),
  }));
  assert.equal((html.match(/class="business-feed-item"/g) || []).length, 10);
  assert.equal((html.match(/class="business-rank"/g) || []).length, 3);
  assert.equal((html.match(/data-feedback=/g) || []).length, 10);
  const latest = html.slice(html.indexOf('class="business-latest"'));
  assert.ok(latest.indexOf("Story 11") < latest.indexOf("Story 10"));
  assert.match(html, /target="_blank" rel="noreferrer"/);
  assert.equal(JSON.stringify(items), before);
  const empty = renderToStaticMarkup(React.createElement(business, { items: [], selectedChannels: [], language: "zh", generatedAt: "invalid", feedback: () => null }));
  assert.ok(empty.includes("暂无近期商业资讯"));
});
