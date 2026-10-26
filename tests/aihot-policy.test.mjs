import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const out = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../lib/aihot-policy.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports: out },
);
test("AIHOT stays skipped by default and a permission reply alone cannot enable collection", () => {
  assert.equal(out.aihotPolicy({}).active, false);
  assert.equal(out.aihotPolicy({}).status, "disabled");
  assert.equal(
    out.aihotPolicy({ RADAR_AIHOT_AUTHORIZED: "true" }).active,
    false,
  );
});
test("an explicit enable request still requires confirmed permitted use", () => {
  assert.equal(out.aihotPolicy({ RADAR_AIHOT_ENABLED: "true" }).active, false);
  assert.equal(
    out.aihotPolicy({
      RADAR_AIHOT_ENABLED: "true",
      RADAR_AIHOT_AUTHORIZED: "true",
    }).active,
    true,
  );
});
