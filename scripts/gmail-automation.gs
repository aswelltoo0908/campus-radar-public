// Replace both placeholders with your own deployment and dedicated inbox.
const RADAR_API = "https://YOUR-RADAR-DOMAIN.example/api/internal/email";
const RADAR_INBOX_ALIAS_PATTERN = /youraccount\+radar-([a-f0-9]{12})@example\.com/gi;

function setupCampusRadar() {
  if (!ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === "runCampusRadar")) {
    ScriptApp.newTrigger("runCampusRadar").timeBased().everyMinutes(15).create();
  }
  runCampusRadar();
}

function runCampusRadar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    importForwardedEmails(); sendDueRadars();
    const secret = PropertiesService.getScriptProperties().getProperty("RADAR_EMAIL_AUTOMATION_SECRET");
    const response = UrlFetchApp.fetch(RADAR_API, { method: "post", contentType: "application/json", headers: { "x-radar-secret": secret }, payload: JSON.stringify({ heartbeat: true }), muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) throw new Error("Radar status API returned " + response.getResponseCode());
  }
  finally { lock.releaseLock(); }
}

function importForwardedEmails() {
  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty("RADAR_EMAIL_AUTOMATION_SECRET");
  if (!secret) throw new Error("Set RADAR_EMAIL_AUTOMATION_SECRET first.");
  const processed = JSON.parse(properties.getProperty("RADAR_PROCESSED_EMAILS") || "{}");
  const cutoff = Date.now() - 14 * 86400000;
  Object.keys(processed).forEach((id) => { if (processed[id] < cutoff) delete processed[id]; });
  let imported = 0;
  // This script runs only in the dedicated Radar inbox. Read bodies only after
  // an exact per-student recipient is found in the transport headers.
  const threads = GmailApp.search('in:anywhere newer_than:14d', 0, 100);
  threads.forEach((thread) => thread.getMessages().forEach((message) => {
    const id = message.getId();
    if (processed[id] || message.getDate().getTime() < cutoff) return;
    const headers = message.getRawContent().split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, " ");
    const recipients = headers.split(/\r?\n/).filter((line) => /^(To|Delivered-To|X-Forwarded-To|X-Original-To):/i.test(line)).join(" ");
    const aliases = Array.from(new Set(Array.from(recipients.matchAll(RADAR_INBOX_ALIAS_PATTERN), (match) => match[1].toLowerCase())));
    if (aliases.length !== 1) return;
    const response = UrlFetchApp.fetch(RADAR_API.replace(/\/email$/, "/inbound"), {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { "x-radar-secret": secret },
      payload: JSON.stringify({ alias: aliases[0], messageId: id, subject: message.getSubject(), sender: message.getFrom(), text: message.getPlainBody().slice(0, 24000), receivedAt: message.getDate().toISOString() }),
    });
    if (response.getResponseCode() !== 200) throw new Error("Radar inbox API returned " + response.getResponseCode());
    const result = JSON.parse(response.getContentText());
    if (result.accepted) { processed[id] = Date.now(); imported++; }
  }));
  properties.setProperty("RADAR_PROCESSED_EMAILS", JSON.stringify(processed));
  console.log("Forwarded messages imported: " + imported);
}

function sendDueRadars() {
  const secret = PropertiesService.getScriptProperties().getProperty("RADAR_EMAIL_AUTOMATION_SECRET");
  if (!secret) throw new Error("Add RADAR_EMAIL_AUTOMATION_SECRET in Project Settings → Script properties.");
  const response = UrlFetchApp.fetch(RADAR_API, { method: "get", headers: { "x-radar-secret": secret }, muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error(`Campus Radar API returned ${response.getResponseCode()}: ${response.getContentText()}`);
  const payload = JSON.parse(response.getContentText());
  payload.messages.forEach((message) => {
    let success = false;
    let error = "";
    try {
      GmailApp.sendEmail(message.to, message.subject, message.text, { htmlBody: message.html, name: "Campus Radar" });
      success = true;
    } catch (sendError) {
      error = String(sendError);
    }
    UrlFetchApp.fetch(RADAR_API, { method: "post", contentType: "application/json", headers: { "x-radar-secret": secret }, payload: JSON.stringify({ deliveryId: message.deliveryId, success, error }), muteHttpExceptions: true });
  });
  console.log("Reports processed: " + payload.messages.length);
}
