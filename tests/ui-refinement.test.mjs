import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

test("hero demo renders real sourced funding with an explicit example boundary", () => {
  const compiled = ts.transpileModule(read("app/OpportunityDemo.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require });
  const html = renderToStaticMarkup(require("react").createElement(exports.default));
  assert.match(html, /S&amp;S Scholarship Fund/);
  assert.match(html, /internationalcenter.umich.edu\/resources\/student-funding\/ss-fund/);
  assert.match(html, /Not a personal match or a guarantee of eligibility/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /\b\d{2,3}%/);
});

test("opportunity UI retains consent controls and exposes keyboard-readable steps and feedback", () => {
  const source = read("app/beta/OpportunityOnboarding.tsx");
  for (const marker of ["aria-current", "aria-pressed", "profile-compass", "brief-section-nav", "brief-research", "brief-funding", "brief-email", "<EmailSetupFields", "Save email preferences", "Delete all data"]) assert.ok(source.includes(marker), marker);
  const fields = read("app/beta/RadarSetupFields.tsx");
  assert.ok(fields.includes("checked={form.emailDeliveryEnabled}"));
  assert.ok(fields.includes("Send my morning brief"));
  assert.doesNotMatch(source, /emailDeliveryEnabled:\s*true/);
  assert.match(source, /form\.goals\.map/);
});

test("editorial styles are scoped, support mobile and respect reduced motion", () => {
  const css = read("app/radar-ui.css");
  assert.match(css, /\.radar-home/);
  assert.match(css, /\.opportunity-ui/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  assert.match(css, /max-width:620px/);
  assert.match(read("app/layout.tsx"), /radar-ui\.css/);
});
