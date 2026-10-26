import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {},
  version = {};
const reminders = {};
const career = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/career-matching.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:career,Date,URL});
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/course-reminders.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:reminders,Date,Intl});
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../lib/public-signal-version.ts", import.meta.url),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports: version },
);
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../lib/brief-updates.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports, require: (id) => id === "./course-reminders" ? reminders : id === "./career-matching" ? career : version, Date },
);
const item = { id: "fund-1", contentHash: "v1", availability: "upcoming" };
test("AIHOT saved references deduplicate unchanged mail without retaining copy",()=>{
  const row={id:"aihot-one",category:"ai_news",contentHash:"v1",availability:"open"};
  const history=[{aihotRefs:[{id:row.id,contentHash:"v1"}]}];
  const base={researchLabs:{matches:[]},opportunities:[]};
  assert.equal(exports.selectBriefUpdates({...base,aiNews:[row]},history).aiNews.length,0);
  assert.equal(exports.selectBriefUpdates({...base,aiNews:[{...row,contentHash:"v2"}]},history).aiNews.length,1);
});
const brief = {
  formatVersion: 2,
  scholarships: [item],
  researchLabs: { matches: [] },
  opportunities: [],
};
test("fetching or regenerating the same funding item does not resend it", () => {
  const next = exports.selectBriefUpdates(
    { ...brief, scholarships: [{ ...item, fetchedAt: "later" }] },
    [brief],
  );
  assert.equal(next.scholarships.length, 0);
  assert.equal(exports.hasBriefUpdates(next), false);
});
test("new opportunities and changed content or availability are eligible for updates", () => {
  for (const change of [
    { id: "fund-2" },
    { contentHash: "v2" },
    { availability: "open" },
  ]) {
    const next = exports.selectBriefUpdates(
      { ...brief, scholarships: [{ ...item, ...change }] },
      [brief],
    );
    assert.equal(next.scholarships.length, 1);
    assert.equal(exports.hasBriefUpdates(next), true);
  }
});
test("HTML changes, rephrased summaries and repeated reviews cannot resend the same sourced funding", () => {
  const fund = {
    ...item,
    category: "scholarship",
    url: "https://example.edu/fund",
    title: "Fund",
    deadline: "2026-12-07",
    opensAt: "2026-11-09",
    amount: "$5,000",
    eligibility: { visas: ["f1", "j1"], otherRequirements: ["Full time"] },
  };
  const current = { ...brief, scholarships: [fund] };
  assert.equal(
    exports.selectBriefUpdates(
      {
        ...current,
        scholarships: [
          {
            ...fund,
            contentHash: "different-page-hash",
            sourcePageHash: "footer-changed",
            summary: "Fresh prose",
            fetchedAt: "later",
            verifiedAt: "later",
            eligibility: {
              ...fund.eligibility,
              umichOnly: false,
              visas: ["j1", "f1"],
            },
          },
        ],
      },
      [current],
    ).scholarships.length,
    0,
  );
  assert.equal(
    exports.selectBriefUpdates(
      { ...current, scholarships: [{ ...fund, deadline: "2026-12-08" }] },
      [current],
    ).scholarships.length,
    1,
  );
});
