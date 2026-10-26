import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../lib/security.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports, URL, Headers, Response },
);
const req = (headers = {}, path = "/api/beta/feedback") =>
  new Request(`https://radar.example${path}`, { method: "POST", headers });
test("Markdown negotiation respects positive quality and explicit HTML preferences", () => {
  assert.equal(
    exports.wantsMarkdown(
      new Request("https://radar.example/", {
        headers: { accept: "text/markdown;q=0.5" },
      }),
    ),
    true,
  );
  assert.equal(
    exports.wantsMarkdown(
      new Request("https://radar.example/", {
        headers: { accept: "text/markdown;q=0" },
      }),
    ),
    false,
  );
  assert.equal(
    exports.wantsMarkdown(
      new Request("https://radar.example/", {
        headers: { accept: "text/html;q=1, text/markdown;q=0.5" },
      }),
    ),
    false,
  );
});
test("agent 404s retain the status with helpful Markdown; browser responses stay HTML", async () => {
  const response = exports.errorRepresentation(
    new Request("https://radar.example/missing", {
      headers: { accept: "text/markdown" },
    }),
    new Response("<h1>Missing</h1>", {
      status: 404,
      headers: { "content-type": "text/html", "content-length": "16" },
    }),
  );
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /text\/markdown/);
  assert.match(await response.text(), /product guide/);
  assert.equal(response.headers.has("content-length"), false);
  const html = new Response("<h1>Missing</h1>", {
    status: 404,
    headers: { "content-type": "text/html" },
  });
  assert.equal(
    exports.errorRepresentation(
      new Request("https://radar.example/missing"),
      html,
    ),
    html,
  );
});
test("unknown API routes return JSON 404 rather than an HTML page", async () => {
  const response = exports.errorRepresentation(
    new Request("https://radar.example/api/missing"),
    new Response("html", { status: 404 }),
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "NOT_FOUND");
});
test("student writes reject foreign or missing origin and non-JSON bodies", () => {
  assert.equal(exports.requestViolation(req())?.status, 403);
  assert.equal(
    exports.requestViolation(req({ origin: "https://evil.example" }))?.status,
    403,
  );
  assert.equal(
    exports.requestViolation(req({ origin: "https://radar.example" }))?.status,
    415,
  );
  assert.equal(
    exports.requestViolation(
      req({
        origin: "https://radar.example",
        "content-type": "application/json",
      }),
    ),
    null,
  );
});
test("custom domains use their own origin and internal writers retain their separate authentication", () => {
  assert.equal(
    exports.requestViolation(
      req({ "content-type": "application/json" }, "/api/internal/email"),
    ),
    null,
  );
  assert.equal(
    exports.requestViolation(
      req({
        origin: "https://radar.example",
        "content-type": "application/json",
        "content-length": "70000",
      }),
    )?.status,
    413,
  );
});
test("private responses cannot be cached and carry browser hardening", () => {
  const response = exports.secureResponse(
    new Response("ok"),
    "/api/beta/profile",
  );
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-security-policy"),
    /object-src 'none'/,
  );
});
test("owner MCP accepts machine JSON, rejects foreign browser origins and stays private", () => {
  assert.equal(
    exports.requestViolation(
      req({ "content-type": "application/json" }, "/mcp"),
    ),
    null,
  );
  assert.equal(
    exports.requestViolation(
      req(
        { "content-type": "application/json", origin: "https://evil.example" },
        "/mcp",
      ),
    )?.status,
    403,
  );
  assert.equal(
    exports
      .secureResponse(new Response("ok"), "/mcp")
      .headers.get("cache-control"),
    "private, no-store",
  );
});
