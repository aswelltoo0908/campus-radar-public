import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";

function moduleAt(path, imports) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: id => imports[id], crypto: webcrypto, TextEncoder, Uint8Array, Response, Date });
  return exports;
}
const tokens = moduleAt("../lib/server/unsubscribe.ts", { "cloudflare:workers": { env: { RADAR_EMAIL_AUTOMATION_SECRET: "test-only-secret-not-a-production-key" } } });
test("unsubscribe tokens authorize only the signed delivery and reject tampering", async () => {
  const token = await tokens.unsubscribeToken(1);
  assert.equal(await tokens.verifyUnsubscribeToken(token), 1);
  assert.equal(await tokens.verifyUnsubscribeToken(token.replace(/^1/, "2")), null);
  assert.equal(await tokens.verifyUnsubscribeToken("1.bad"), null);
  assert.equal(await tokens.verifyUnsubscribeToken(""), null);
});
test("signed unsubscribe is scoped, repeatable, and does not delete any user data", async () => {
  const state = { ivy: true, other: true };
  const schema = { profiles: { email: "email" }, emailDeliveries: { id: "id" } };
  const db = {
    select: () => ({ from: () => ({ where: condition => ({ limit: async () => condition.value === 1 ? [{ userEmail: "ivy" }] : [] }) }) }),
    update: () => ({ set: changes => ({ where: condition => ({ returning: async () => { state[condition.value] = changes.emailDeliveryEnabled; return [{ email: condition.value }]; } }) }) }),
  };
  const route = moduleAt("../app/api/unsubscribe/route.ts", {
    "drizzle-orm": { eq: (field, value) => ({ field, value }) }, "../../../db": { getDb: () => db },
    "../../../db/schema": schema, "../../chatgpt-auth": { getChatGPTUser: async () => null }, "../../../lib/server/unsubscribe": tokens,
  });
  const request = token => ({ formData: async () => new Map([["token", token]]), headers: new Headers() });
  const token = await tokens.unsubscribeToken(1);
  assert.equal((await route.POST(request(token))).status, 303);
  assert.equal(state.ivy, false); assert.equal(state.other, true);
  assert.equal((await route.POST(request(token))).status, 303);
  assert.equal((await route.POST(request("1.bad"))).status, 400);
  assert.equal((await route.POST(request(""))).status, 403);
});
test("opening the confirmation page cannot unsubscribe, and emails include both footer formats", () => {
  const page = readFileSync(new URL("../app/unsubscribe/page.tsx", import.meta.url), "utf8");
  assert.ok(!page.includes(".update("));
  assert.ok(page.includes('method="post"'));
  const renderer = moduleAt("../lib/server/email-delivery.ts", {});
  const preview = { language: "en", actions: [], opportunities: [], insight: { title: "Test", detail: "Test" }, attribution: "Test" };
  const email = renderer.renderRadarEmail(preview, null, "https://example.com/unsubscribe?token=test");
  assert.match(email.html, /Unsubscribe from daily emails/);
  assert.match(email.text, /https:\/\/example.com\/unsubscribe\?token=test/);
  assert.match(renderer.renderRadarEmail({ ...preview, language: "zh" }, null).html, /取消订阅日报/);
});
