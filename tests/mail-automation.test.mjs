import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const code = await readFile(new URL("../scripts/gmail-automation.gs", import.meta.url), "utf8");
function fixture(messages, accept = true) {
  const properties = new Map([["RADAR_EMAIL_AUTOMATION_SECRET", "test-secret"]]);
  const requests = [];
  const sent = [];
  const context = vm.createContext({ console: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
    GmailApp: { search: () => [{ getMessages: () => messages }], sendEmail: (...args) => sent.push(args) },
    UrlFetchApp: { fetch: (url, options) => { requests.push({ url, options }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(url.endsWith("/inbound") ? { accepted: accept } : options.method === "get" ? { messages: [{ deliveryId: 7, to: "student@example.edu", subject: "Report", text: "Plain report", html: "<p>Report</p>" }] } : { ok: true }) }; } },
  });
  vm.runInContext(code, context);
  return { context, requests, sent };
}
function message(id, headers) {
  return { getId: () => id, getDate: () => new Date(), getRawContent: () => headers + "\r\n\r\nbody", getSubject: () => "Handshake opportunity", getFrom: () => "student@example.edu", getPlainBody: () => "A job link https://example.edu/jobs/1" };
}
test("routes exact private recipients and avoids duplicate ingestion", () => {
  const f = fixture([message("id12345", "To: youraccount+radar-aabbccddeeff@example.com")]);
  vm.runInContext("importForwardedEmails(); importForwardedEmails();", f.context);
  assert.equal(f.requests.length, 1);
  assert.equal(JSON.parse(f.requests[0].options.payload).alias, "aabbccddeeff");
});
test("never submits unrelated or ambiguous inbox messages", () => {
  const f = fixture([message("id12345", "To: youraccount@example.com"), message("id12346", "To: youraccount+radar-aabbccddeeff@example.com, youraccount+radar-112233445566@example.com")]);
  vm.runInContext("importForwardedEmails()", f.context);
  assert.equal(f.requests.length, 0);
});
test("supports forwarded transport headers and retries when consent is absent", () => {
  const f = fixture([message("id12345", "To: original@example.edu\r\nX-Forwarded-To:\r\n youraccount+radar-aabbccddeeff@example.com")], false);
  vm.runInContext("importForwardedEmails(); importForwardedEmails();", f.context);
  assert.equal(f.requests.length, 2);
});
test("sends to the selected delivery address and acknowledges the same delivery", () => {
  const f = fixture([]);
  vm.runInContext("sendDueRadars()", f.context);
  assert.equal(f.sent[0][0], "student@example.edu");
  assert.deepEqual(JSON.parse(f.requests[1].options.payload), { deliveryId: 7, success: true, error: "" });
});
