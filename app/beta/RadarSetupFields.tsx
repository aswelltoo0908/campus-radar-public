"use client";
import { useState } from "react";
import type { BetaProfileInput } from "../../lib/types";
import type { RadarSetupForm, SourceSummary } from "../../lib/onboarding-profile";

type Props = { form: RadarSetupForm; onChange: (value: Partial<BetaProfileInput>) => void; disabled?: boolean };

export function CanvasSetupFields({ form, onChange, disabled, sources = [] }: Props & { sources?: SourceSummary[] }) {
  const [fileNote, setFileNote] = useState("");
  const [fileError, setFileError] = useState("");
  const stored = sources.filter(source => ["canvas_ics", "canvas_ics_upload", "canvas_api"].includes(source.type));
  const hasStored = Boolean(form.keepCanvasConnection || form.keepCanvasApiConnection);
  async function importCalendar(file?: File) {
    setFileError(""); setFileNote("");
    if (!file) return;
    if (file.size > 2_000_000) { setFileError("Choose a Canvas .ics file smaller than 2 MB."); return; }
    try {
      const text = await file.text();
      if (!text.includes("BEGIN:VCALENDAR")) throw new Error("This is not an .ics calendar file. Download the original Calendar Feed from Canvas.");
      onChange({ canvasIcsText: text, canvasFeedUrl: "" });
      setFileNote("Calendar selected. It will be checked when you save and build your brief.");
    } catch (error) { setFileError(error instanceof Error ? error.message : "Could not read this file."); }
  }
  return <section className="setup-card" aria-labelledby="canvas-setup-title">
    <div className="setup-card-heading"><span className="setup-icon" aria-hidden="true">C</span><div><p className="eyebrow">OPTIONAL · COURSE DEADLINES</p><h3 id="canvas-setup-title">Keep your DDL in the picture</h3></div><span className="setup-status">{hasStored ? "Saved connection" : "Optional"}</span></div>
    <p>Your opportunities work without Canvas. Connect it for real course items alongside your shortlist.</p>
    {hasStored && <div className="setup-saved"><strong>Your saved Canvas connection will be kept.</strong><p>Leave the fields below blank to keep it. Private links and tokens are encrypted and never displayed again.</p>{stored.map(source => <p key={source.type}>{source.type === "canvas_api" ? "API" : source.type === "canvas_ics_upload" ? ".ics snapshot" : "Calendar Feed"} · {source.displayLabel || "Saved source"}{source.status !== "connected" ? " · Needs a refresh" : " · Last saved successfully"}</p>)}</div>}
    <details open={!hasStored}>
      <summary>{hasStored ? "Add or replace Calendar Feed" : "Calendar Feed · recommended"}</summary>
      <div className="setup-detail-body">
        <label>Canvas Calendar Feed link<input type="password" name="canvasFeedUrl" autoComplete="off" spellCheck={false} value={form.canvasFeedUrl || ""} onChange={event => { onChange({ canvasFeedUrl: event.target.value, canvasIcsText: "" }); setFileNote(""); }} placeholder="https://your-school.instructure.com/feeds/calendars/….ics" disabled={disabled} /></label>
        <p className="field-note">Canvas → Calendar → Calendar Feed → copy the complete .ics link. No API token or download needed. It is a private access link: don't share it publicly.</p>
        <details className="setup-help"><summary>Feed blocked (403)? Upload an .ics instead</summary><p className="field-note">Open the Feed link yourself, download the .ics file, then choose it below. Uploads are snapshots; upload again when deadlines change. A file replaces a pasted Feed only after a successful save.</p><label>Upload Canvas .ics<input type="file" accept=".ics,text/calendar" disabled={disabled} onChange={event => void importCalendar(event.target.files?.[0])} /></label>{fileNote && <p className="field-note" role="status">{fileNote}</p>}{fileError && <p className="form-error" role="alert">{fileError}</p>}</details>
      </div>
    </details>
    <details>
      <summary>Canvas API · alternative for supported schools</summary>
      <div className="setup-detail-body"><p className="field-note">Use an Access Token only if your school permits it. The instance URL tells Radar which Canvas to read. Radar never submits work or modifies Canvas.</p><label>Canvas instance URL<input type="url" value={form.canvasBaseUrl || (form.isUmichStudent ? "https://umich.instructure.com" : "")} onChange={event => onChange({ canvasBaseUrl: event.target.value })} placeholder="https://your-school.instructure.com" disabled={disabled} /></label><label>Canvas Access Token<input type="password" name="canvasApiToken" autoComplete="off" spellCheck={false} value={form.canvasApiToken || ""} onChange={event => onChange({ canvasApiToken: event.target.value })} placeholder={form.keepCanvasApiConnection ? "Leave blank to keep saved token" : "Paste your Canvas token"} disabled={disabled} /></label></div>
    </details>
    <p className="field-note">Only available course items are shown; feeds can omit assignments or fail to refresh. Always confirm the final deadline on your course page.</p>
  </section>;
}

export function EmailSetupFields({ form, onChange, disabled }: Props) {
  return <section className="setup-card" aria-labelledby="email-setup-title">
    <div className="setup-card-heading"><span className="setup-icon" aria-hidden="true">↗</span><div><p className="eyebrow">YOUR MORNING BRIEF</p><h3 id="email-setup-title">A useful start to your day</h3></div><span className="setup-status">{form.emailDeliveryEnabled ? "Emails on" : "Web only"}</span></div>
    <p>Choose where and when your brief should arrive. Email delivery is opt-in; you can keep using the web version.</p>
    <div className="field-grid"><label>Report delivery email<input type="email" autoComplete="email" value={form.deliveryEmail} onChange={event => onChange({ deliveryEmail: event.target.value })} placeholder="you@example.com" disabled={disabled} /></label><label>Report time (Eastern Time)<input type="time" value={form.deliveryTime} onChange={event => onChange({ deliveryTime: event.target.value })} disabled={disabled} /></label></div>
    <div className="setup-checks"><label className="check-line"><input type="checkbox" checked={form.emailDeliveryEnabled} onChange={event => onChange({ emailDeliveryEnabled: event.target.checked })} disabled={disabled} />Send my morning brief</label><label className="check-line"><input type="checkbox" checked={form.weekends} onChange={event => onChange({ weekends: event.target.checked })} disabled={disabled} />Include weekends</label></div>
    <p className="field-note">Unsubscribe in any email. Morning briefs are sent when there are new opportunities or course items due within 72 hours, not necessarily every day. Saving preferences does not confirm delivery.</p>
  </section>;
}
