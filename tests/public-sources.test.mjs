import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { webcrypto } from "node:crypto";
const types = {},
  matching = {},
  sources = {};
const compile = (path) =>
  ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
vm.runInNewContext(compile("../lib/types.ts"), { exports: types });
vm.runInNewContext(compile("../lib/opportunity-matching.ts"), {
  exports: matching,
  require: () => types,
  URL,
  Date,
});
vm.runInNewContext(compile("../lib/server/public-signals.ts"), {
  exports: sources,
  require: (name) =>
    name.includes("opportunity-matching") ? matching : { env: {} },
  URL,
  Date,
  crypto: webcrypto,
  TextEncoder,
  Uint8Array,
});
test("RSS preserves publisher dates and original evidence; missing dates are not invented", async () => {
  const xml =
    "<rss><channel><item><title>Policy &amp; research</title><link><![CDATA[https://official.example/news?utm_source=rss]]></link><description><![CDATA[<p>A change</p>]]></description><pubDate>Tue, 13 Oct 2026 18:00:00 GMT</pubDate></item><item><title>No date</title><link>https://official.example/other</link></item></channel></rss>";
  const rows = await sources.parseNewsFeed(
    xml,
    { id: "fed", name: "Federal Reserve", channel: "finance" },
    "2026-10-14T12:00:00Z",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Policy & research");
  assert.equal(rows[0].publishedAt, "2026-10-13T18:00:00.000Z");
  assert.equal(rows[0].url, "https://official.example/news");
  assert.equal(rows[0].summary, "A change");
});
test("public school events retain actual start time and do not invent eligibility", async () => {
  const html =
    '<script type="application/ld+json">[{"@type":"Event","name":"Policy research","url":"https://events.example.edu/policy","startDate":"2026-10-20T17:00:00-04:00","description":"A public talk"}]</script>';
  const rows = await sources.parsePublicEvents(
    html,
    "school",
    "School",
    "2026-10-14T12:00:00Z",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category, "event");
  assert.equal(rows[0].publishedAt, null);
  assert.equal(rows[0].opensAt, "2026-10-20T17:00:00-04:00");
  assert.match(
    rows[0].eligibility.otherRequirements[0],
    /confirm visitor eligibility/,
  );
});
test("Localist excludes private, campus-only and past events, retaining public evidence", async () => {
  const event = {
    title: "Data research seminar",
    status: "live",
    private: false,
    localist_url: "https://calendar.mit.edu/event/data",
    experience: "virtual",
    description_text: "Register for an online research seminar.",
    event_instances: [
      { event_instance: { start: "2026-10-20T17:00:00-04:00" } },
    ],
  };
  const rows = await sources.parseLocalistEvents(
    JSON.stringify({
      events: [
        { event },
        { event: { ...event, private: true } },
        {
          event: {
            ...event,
            description_text: "This event is open the MIT Community only.",
          },
        },
        {
          event: {
            ...event,
            event_instances: [
              { event_instance: { start: "2026-10-01T10:00:00Z" } },
            ],
          },
        },
      ],
    }),
    "2026-10-14T12:00:00Z",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].opensAt, "2026-10-20T17:00:00-04:00");
  assert.match(
    rows[0].eligibility.otherRequirements[0],
    /confirm visitor eligibility/,
  );
});
