import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const out = {},
  status = {};
const compile = (path) =>
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
vm.runInNewContext(compile("../lib/server/funding-page-watch.ts"), {
  exports: out,
  Date,
});
vm.runInNewContext(compile("../lib/public-status.ts"), { exports: status });
const seed = {
  id: "fund",
  category: "scholarship",
  title: "Fund cycle 2",
  opensAt: "2026-11-09",
  deadline: "2026-12-07",
  availability: "upcoming",
};
test("a funding watcher preserves reviewed dates and qualifications instead of restoring its seed", () => {
  const reviewed = {
    ...seed,
    title: "Fund cycle 3",
    opensAt: "2027-01-11",
    deadline: "2027-02-08",
    sourceMode: "live",
    sourcePageHash: "page-v2",
    contentHash: "facts-v3",
    eligibility: { otherRequirements: ["Reviewed conditions"] },
  };
  const next = out.reconcileFundingPage(
    seed,
    reviewed,
    "page-v2",
    "2027-01-12T12:00:00Z",
  );
  assert.equal(next.title, "Fund cycle 3");
  assert.equal(next.deadline, "2027-02-08");
  assert.equal(next.availability, "open");
  assert.equal(next.eligibility.otherRequirements[0], "Reviewed conditions");
  assert.equal(
    out.reconcileFundingPage(seed, reviewed, "page-v4", "2027-01-12T12:00:00Z")
      .availability,
    "needs_review",
  );
});
test("legacy raw-page hashes migrate without declaring a false update", () => {
  assert.equal(
    out.reconcileFundingPage(
      seed,
      { ...seed, contentHash: "old-page" },
      "old-page",
      "2026-10-14T12:00:00Z",
    ).availability,
    "upcoming",
  );
});
test("public tool reads default to funding and have bounded category-specific pagination", () => {
  const rows = [
    seed,
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `event-${i}`,
      category: "event",
    })),
  ];
  assert.equal(status.selectPublicStatusItems(rows).items.length, 1);
  const events = status.selectPublicStatusItems(rows, {
    category: "event",
    limit: 10,
  });
  assert.equal(events.items.length, 10);
  assert.equal(events.nextOffset, 10);
  assert.throws(() => status.selectPublicStatusItems(rows, { limit: 10000 }));
  assert.throws(() =>
    status.selectPublicStatusItems(rows, { category: "students" }),
  );
});
