import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const types = {},
  matching = {};
const transpile = (path) =>
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
vm.runInNewContext(transpile("../lib/types.ts"), { exports: types });
vm.runInNewContext(transpile("../lib/opportunity-matching.ts"), {
  exports: matching,
  require: () => types,
  URL,
  Date,
});
const profile = {
  reportLanguage: "en",
  major: "Mathematics",
  school: "LSA",
  academicLevel: "undergraduate",
  isUmichStudent: true,
  goals: ["scholarship"],
  interests: ["math"],
  opportunityPreferences: {
    visa: "f1",
    citizenshipRegion: "asia",
    transferStudent: "yes",
    stem: "yes",
  },
};
const signal = {
  id: "ss",
  category: "scholarship",
  channel: null,
  title: "S&S",
  summary: "Funding",
  url: "https://example.edu/fund?utm_source=mail",
  sourceId: "ic",
  sourceName: "IC",
  publishedAt: null,
  fetchedAt: "2026-10-14T12:00:00Z",
  verifiedAt: "2026-10-14",
  deadline: "2026-12-07",
  opensAt: "2026-11-09",
  amount: "$5,000–$12,000",
  availability: "upcoming",
  eligibility: {
    umichOnly: true,
    visas: ["f1", "j1"],
    citizenshipRegions: ["asia", "africa"],
    stemPreferred: true,
    otherRequirements: ["Full-time enrollment"],
  },
  topics: ["math"],
  contentHash: "a",
};
const now = new Date("2026-10-14T12:00:00Z");
test("known visa and region mismatches are excluded; non-STEM is only a preference", () => {
  assert.equal(matching.matchPublicSignals([signal], profile, now).length, 1);
  assert.equal(
    matching.matchPublicSignals(
      [signal],
      {
        ...profile,
        opportunityPreferences: {
          ...profile.opportunityPreferences,
          visa: "us_citizen_or_pr",
        },
      },
      now,
    ).length,
    0,
  );
  assert.equal(
    matching.matchPublicSignals(
      [signal],
      {
        ...profile,
        opportunityPreferences: {
          ...profile.opportunityPreferences,
          citizenshipRegion: "other",
        },
      },
      now,
    ).length,
    0,
  );
  assert.equal(
    matching.matchPublicSignals(
      [signal],
      {
        ...profile,
        opportunityPreferences: {
          ...profile.opportunityPreferences,
          stem: "no",
        },
      },
      now,
    ).length,
    1,
  );
});
test("unknown conditions remain visible and URL duplicates are collapsed", () => {
  const rows = matching.matchPublicSignals(
    [
      signal,
      {
        ...signal,
        id: "duplicate",
        url: "https://example.edu/fund?utm_campaign=test",
      },
    ],
    { ...profile, opportunityPreferences: {} },
    now,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eligibilityStatus, "needs_confirmation");
  assert.ok(
    rows[0].unknownConditions.includes("Visa/residency status is unknown"),
  );
  assert.equal(rows[0].url, "https://example.edu/fund");
});
test("past opportunities and private URL schemes cannot enter the shortlist", () => {
  assert.equal(
    matching.matchPublicSignals(
      [{ ...signal, deadline: "2026-10-12" }],
      profile,
      now,
    ).length,
    0,
  );
  assert.equal(
    matching.matchPublicSignals(
      [{ ...signal, url: "javascript:alert(1)" }],
      profile,
      now,
    ).length,
    0,
  );
  assert.equal(
    matching.matchPublicSignals(
      [signal],
      { ...profile, isUmichStudent: false },
      now,
    ).length,
    0,
  );
});
test("news requires an explicit subscription and a real recent publication date", () => {
  const item = {
    ...signal,
    category: "business_news",
    channel: "finance",
    deadline: null,
    publishedAt: "2026-10-13T12:00:00Z",
    eligibility: { otherRequirements: [] },
  };
  assert.equal(matching.matchPublicSignals([item], profile, now).length, 0);
  const interested = {
    ...profile,
    opportunityPreferences: {
      ...profile.opportunityPreferences,
      newsEnabled: true,
      newsChannels: ["finance"],
    },
  };
  assert.equal(matching.matchPublicSignals([item], interested, now).length, 1);
  assert.equal(
    matching.matchPublicSignals(
      [{ ...item, publishedAt: null }],
      interested,
      now,
    ).length,
    0,
  );
  assert.equal(
    matching.matchPublicSignals(
      [{ ...item, publishedAt: "2026-09-01T12:00:00Z" }],
      interested,
      now,
    ).length,
    0,
  );
});
