import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { webcrypto } from "node:crypto";
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../lib/server/rate-limit.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports, URL, crypto: webcrypto, TextEncoder, Uint8Array },
);
test("preview limits persist by hashed visitor/window; a new window can proceed", async () => {
  const counts = new Map(),
    ids = [];
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          ids.push(args[0]);
          const hits = (counts.get(args[0]) || 0) + 1;
          counts.set(args[0], hits);
          return { hits };
        },
        run: async () => ({ success: true }),
      }),
    }),
  };
  const request = new Request("https://radar.example/api/beta/preview", {
    method: "POST",
    headers: { "oai-authenticated-user-email": "student@example.edu" },
  });
  for (let i = 0; i < 12; i++)
    assert.equal(await exports.withinApiLimit(request, db, 300000), true);
  assert.equal(await exports.withinApiLimit(request, db, 300000), false);
  assert.equal(await exports.withinApiLimit(request, db, 600000), true);
  assert.ok(ids.every((id) => /^[a-f0-9]{64}$/.test(id)));
});
