import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/server/admin.ts", import.meta.url), "utf8");
function policy(value) {
  const exports = {};
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(output, { exports, require: () => ({ env: { RADAR_ADMIN_EMAILS: value } }) });
  return exports.isAdmin;
}
test("admin authorization fails closed and only matches exact configured accounts", () => {
  assert.equal(policy(undefined)("owner@example.test"), false);
  const allowed = policy("owner@example.test");
  assert.equal(allowed("owner@example.test"), true);
  assert.equal(allowed(" OWNER@EXAMPLE.TEST "), true);
  assert.equal(allowed("student@umich.edu"), false);
  assert.equal(allowed("owner@example.test.evil.example"), false);
  assert.equal(allowed(""), false);
});
test("dashboard authorization precedes data access and excludes sensitive contents", () => {
  const page = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.ok(page.indexOf("if (!isAdmin(user.email))") < page.indexOf("const db = getDb()"));
  assert.ok(!page.includes("encryptedConfig"));
  assert.ok(!page.includes("outputJson"));
  assert.ok(!page.includes("encryptedContent"));
});
