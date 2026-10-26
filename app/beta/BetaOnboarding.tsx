"use client";
import { readBetaResponse } from "../../lib/client-api";

import { useEffect, useMemo, useState } from "react";
import type { BetaProfileInput, RadarItem, RadarPreview } from "../../lib/types";

const GOALS = [
  ["internship", "Internship"], ["full_time", "Full-time job"], ["research", "Research opportunities"],
  ["startup", "Startup"], ["leadership", "Campus leadership"],
  ["networking", "Networking"], ["graduate_school", "Graduate school"],
] as const;

const INTERESTS = ["AI", "Product", "Robotics", "Software", "Consulting", "Finance", "Healthcare", "Policy", "Climate", "Design"];

const ROLE_TRACKS = [
  ["software_engineering", "Software Engineering"], ["ai_ml", "AI / ML"], ["data_analytics", "Data & Analytics"],
  ["product_management", "Product Management"], ["ux_design", "UX / Product Design"], ["hardware_robotics", "Hardware / Robotics"],
  ["academic_research", "Academic Research"], ["consulting", "Consulting"], ["finance", "Finance"],
  ["biotech_health", "Biotech / Health"], ["climate_energy", "Climate / Energy"], ["policy_social_impact", "Policy / Social Impact"],
  ["entrepreneurship", "Startup / Entrepreneurship"],
] as const;

const CAREER_STAGES = [
  ["exploring", "Exploring"], ["preparing", "Preparing materials"], ["applying", "Applying"],
  ["interviewing", "Interviewing"], ["deciding", "Comparing offers"],
] as const;

const BOTTLENECKS = [
  ["direction", "Too many directions"], ["finding", "Finding high-quality opportunities"], ["resume", "Resume / portfolio needs work"],
  ["networking", "Not sure whom to contact"], ["applications", "Putting off applications"], ["interviews", "Interview preparation"], ["time", "Time and priorities"],
] as const;

const initialForm: BetaProfileInput & { keepCanvasConnection?: boolean; keepCanvasApiConnection?: boolean; keepGoogleCalendarConnection?: boolean } = {
  reportLanguage: "en", deliveryEmail: "", emailDeliveryEnabled: true, forwardingEnabled: false, isUmichStudent: true, school: "", major: "", graduationYear: "2028", academicLevel: "undergraduate",
  goals: [], interests: [], roleTracks: [], careerStage: "exploring", bottleneck: "finding",
  customGoal: "", customInterest: "", sponsorship: "unsure", paidOnly: false,
  deliveryTime: "07:30", weekends: false, canvasFeedUrl: "", canvasIcsText: "", canvasBaseUrl: "https://umich.instructure.com", canvasApiToken: "", googleCalendarFeedUrl: "",
  courseScheduleText: "", assignmentDeadlinesText: "", keepManualAcademicData: false,
  keepCanvasConnection: false, keepCanvasApiConnection: false, keepGoogleCalendarConnection: false,
};

function toggle(list: string[], value: string, limit = 8) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value].slice(0, limit);
}

function termDefaults() {
  const now = new Date();
  const year = now.getFullYear();
  const spring = now.getMonth() < 6;
  return spring ? { start: `${year}-01-05`, end: `${year}-04-30` } : { start: `${year}-08-24`, end: `${year}-12-20` };
}

function parseCourseDays(raw: string) {
  const value = raw.toUpperCase().replace(/\s+/g, "");
  const result: string[] = [];
  if (/MON|MW|MWF|\bM\b/.test(value) || value.startsWith("M")) result.push("MO");
  if (/TUE|TU|TR|TTH/.test(value)) result.push("TU");
  if (/WED|MW|MWF|W/.test(value)) result.push("WE");
  if (/THU|TH|TR|TTH/.test(value)) result.push("TH");
  if (/FRI|MWF|F/.test(value)) result.push("FR");
  return [...new Set(result)];
}

function parseClock(hourValue: string, minuteValue: string | undefined, meridiemValue: string | undefined) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue ?? 0);
  const meridiem = meridiemValue?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function icsDate(date: Date, hour: number, minute: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(hour)}${pad(minute)}00`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function downloadScheduleIcs(text: string, termStart: string, termEnd: string) {
  const weekdayNumber: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const events: string[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const course = line.match(/\b([A-Z]{2,8})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/i);
    const days = line.match(/\b(MWF|MW|TR|TTH|TU(?:E)?TH|MON(?:DAY)?(?:\s*[/,&-]\s*WED(?:NESDAY)?)?(?:\s*[/,&-]\s*FRI(?:DAY)?)?|TUE(?:SDAY)?(?:\s*[/,&-]\s*THU(?:RSDAY)?)?)\b/i);
    const range = line.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (!course || !days || !range || !termStart || !termEnd) continue;
    const byDay = parseCourseDays(days[0]);
    if (!byDay.length) continue;
    const sharedMeridiem = range[6] || range[3];
    const startClock = parseClock(range[1], range[2], range[3] || sharedMeridiem);
    const endClock = parseClock(range[4], range[5], range[6] || sharedMeridiem);
    const first = new Date(`${termStart}T12:00:00`);
    const offset = (weekdayNumber[byDay[0]] - first.getDay() + 7) % 7;
    first.setDate(first.getDate() + offset);
    const until = termEnd.replace(/-/g, "") + "T235959Z";
    const title = `${course[1].toUpperCase()} ${course[2].toUpperCase()}`;
    events.push([
      "BEGIN:VEVENT", `UID:campus-radar-${index}-${termStart}@local`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `SUMMARY:${escapeIcs(title)}`, `DTSTART;TZID=America/New_York:${icsDate(first, startClock.hour, startClock.minute)}`,
      `DTEND;TZID=America/New_York:${icsDate(first, endClock.hour, endClock.minute)}`, `RRULE:FREQ=WEEKLY;BYDAY=${byDay.join(",")};UNTIL=${until}`,
      "DESCRIPTION:Imported from Campus Radar after your review.", "END:VEVENT",
    ].join("\r\n"));
  }
  if (!events.length) return 0;
  const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Campus Radar//Course Schedule//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "campus-radar-courses.ics"; link.click(); URL.revokeObjectURL(url);
  return events.length;
}

function ItemCard({ item, onFeedback, language }: { item: RadarItem; onFeedback: (itemId: string, reaction: string) => void; language: "en" | "zh" }) {
  const zh = language === "zh";
  return (
    <article className="radar-result-card">
      <div className="result-meta"><span>{item.source}</span><span>{item.score}% match</span></div>
      <h3>{item.title}</h3>
      <p>{item.why}</p>
      <div className="result-facts">{item.when && <span>{item.when}</span>}{item.location && <span>{item.location}</span>}</div>
      <strong>{zh ? "下一步：" : "Next step: "}{item.nextAction}</strong>
      <div className="result-actions">
        {item.url && <a href={item.url} target="_blank" rel="noreferrer">{zh ? "官方来源" : "Official source"} ↗</a>}
        <button onClick={() => onFeedback(item.id, "useful")}>{zh ? "有用" : "Useful"}</button>
        <button onClick={() => onFeedback(item.id, "acted")}>{zh ? "已行动" : "Done"}</button>
        <button onClick={() => onFeedback(item.id, "irrelevant")}>{zh ? "不相关" : "Not relevant"}</button>
      </div>
    </article>
  );
}

export default function BetaOnboarding({ email }: { email: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<RadarPreview | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [canvasFeedConnected, setCanvasFeedConnected] = useState(false);
  const [canvasApiConnected, setCanvasApiConnected] = useState(false);
  const [academicConnected, setAcademicConnected] = useState(false);
  const [academicSummary, setAcademicSummary] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const defaults = useMemo(() => termDefaults(), []);
  const [termStart, setTermStart] = useState(defaults.start);
  const [termEnd, setTermEnd] = useState(defaults.end);
  const [ocrStatus, setOcrStatus] = useState("");
  const [calendarMessage, setCalendarMessage] = useState("");
  const [canvasImportMessage, setCanvasImportMessage] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [radarInboxAddress, setRadarInboxAddress] = useState<string | null>(null);
  const [radarInboxConfigured, setRadarInboxConfigured] = useState(false);
  const [mailerReady, setMailerReady] = useState(false);
  const [forwardingConfirmation, setForwardingConfirmation] = useState<string | null>(null);
  const [askMessages, setAskMessages] = useState<Array<{ role: "user" | "assistant"; text: string; bullets?: string[]; sources?: Array<{ label: string; url: string | null }> }>>([]);
  const reportIsZh = form.reportLanguage === "zh";

  useEffect(() => {
    fetch("/api/beta/profile")
      .then((res) => res.ok ? readBetaResponse(res) : Promise.reject())
      .then((data) => {
        setMailerReady(Boolean(data.mailerReady));
        if (data.profile) {
          const savedGoals = data.profile.goals as string[];
          const savedInterests = data.profile.interests as string[];
          const hasSource = (type: string, status: string) => data.sources.some((source: { type: string; status: string }) => source.type === type && source.status === status);
          const academicSource = data.sources.find((source: { type: string }) => source.type === "manual_academic");
          setForm({
            reportLanguage: data.profile.reportLanguage === "zh" ? "zh" : "en",
            deliveryEmail: data.profile.deliveryEmail || email,
            emailDeliveryEnabled: Boolean(data.profile.emailDeliveryEnabled),
            forwardingEnabled: Boolean(data.profile.forwardingEnabled),
            isUmichStudent: data.profile.isUmichStudent !== false,
            school: data.profile.school,
            major: data.profile.major,
            graduationYear: data.profile.graduationYear,
            academicLevel: data.profile.academicLevel,
            goals: savedGoals.filter((value) => !value.startsWith("other:")),
            interests: savedInterests.filter((value) => !value.startsWith("other:")),
            roleTracks: data.profile.roleTracks ?? [],
            careerStage: data.profile.careerStage ?? "exploring",
            bottleneck: data.profile.bottleneck ?? "finding",
            customGoal: savedGoals.find((value) => value.startsWith("other:"))?.slice(6) ?? "",
            customInterest: savedInterests.find((value) => value.startsWith("other:"))?.slice(6) ?? "",
            sponsorship: data.profile.sponsorship,
            paidOnly: Boolean(data.profile.paidOnly),
            deliveryTime: data.profile.deliveryTime,
            weekends: Boolean(data.profile.weekends),
            canvasFeedUrl: "",
            canvasIcsText: "",
            canvasBaseUrl: "https://umich.instructure.com",
            canvasApiToken: "",
            googleCalendarFeedUrl: "",
            courseScheduleText: "",
            assignmentDeadlinesText: "",
            keepManualAcademicData: hasSource("manual_academic", "connected"),
            keepCanvasConnection: hasSource("canvas_ics", "connected") || hasSource("canvas_ics_upload", "connected"),
            keepCanvasApiConnection: hasSource("canvas_api", "connected"),
            keepGoogleCalendarConnection: hasSource("google_calendar_ics", "connected"),
          });
          setGoogleCalendarConnected(hasSource("google_calendar_ics", "connected"));
          setCanvasFeedConnected(hasSource("canvas_ics", "connected") || hasSource("canvas_ics_upload", "connected"));
          setCanvasApiConnected(hasSource("canvas_api", "connected"));
          setAcademicConnected(hasSource("manual_academic", "connected"));
          setAcademicSummary(academicSource?.displayLabel ?? "");
          setSaved(true);
          setRadarInboxAddress(data.radarInboxAddress ?? null);
          setForwardingConfirmation(data.forwardingConfirmationUrl ?? null);
          setRadarInboxConfigured(Boolean(data.radarInboxConfigured));
          if (data.latestPreview?.preview?.language === (data.profile.reportLanguage === "zh" ? "zh" : "en")) {
            setPreview(data.latestPreview.preview);
            setRunId(data.latestPreview.id);
            setStep(4);
          }
        } else {
          setForm((current) => ({ ...current, deliveryEmail: email }));
          setRadarInboxConfigured(Boolean(data.radarInboxConfigured));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const progress = useMemo(() => Math.min(100, ((step + 1) / 5) * 100), [step]);

  useEffect(() => {
    if (loading) return;
    void fetch("/api/beta/activity", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step }) }).catch(() => {});
  }, [step, loading]);

  function next() {
    setError("");
    if (step === 0 && (!form.school || !form.major || !form.graduationYear)) return setError("Complete your school, major, and graduation year.");
    if (step === 1 && form.goals.length === 0 && !form.customGoal?.trim()) return setError("Choose or enter at least one goal.");
    if (step === 1 && form.roleTracks.length === 0) return setError("Choose at least one role direction so Radar can personalize your results.");
    setStep((value) => Math.min(4, value + 1));
  }

  async function generatePreview() {
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/beta/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = await readBetaResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not generate your preview.");
      setPreview(data.preview); setRunId(data.runId); setSaved(true); setStep(4);
      setRadarInboxAddress(data.radarInboxAddress ?? null);
      setGoogleCalendarConnected(Boolean(data.preview.googleCalendar.connected));
      setCanvasFeedConnected(Boolean(form.canvasFeedUrl) || Boolean(form.canvasIcsText) || Boolean(form.keepCanvasConnection));
      setCanvasApiConnected(Boolean(form.canvasApiToken) || Boolean(form.keepCanvasApiConnection));
      setAcademicConnected(Boolean(data.preview.academic?.connected));
      setAcademicSummary(data.preview.academic?.connected ? `${data.preview.academic.courseCount} courses · ${data.preview.academic.deadlineCount} deadlines` : "");
      setForm((current) => ({
        ...current,
        canvasFeedUrl: "",
        canvasIcsText: "",
        canvasApiToken: "",
        googleCalendarFeedUrl: "",
        courseScheduleText: "",
        assignmentDeadlinesText: "",
        keepManualAcademicData: Boolean(data.preview.academic?.connected),
        keepCanvasConnection: Boolean(form.canvasFeedUrl) || Boolean(form.canvasIcsText) || Boolean(form.keepCanvasConnection),
        keepCanvasApiConnection: Boolean(form.canvasApiToken) || Boolean(form.keepCanvasApiConnection),
        keepGoogleCalendarConnection: Boolean(data.preview.googleCalendar.connected),
      }));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not generate your preview."); }
    finally { setSubmitting(false); }
  }

  async function importCanvasIcs(file: File | undefined) {
    if (!file) return;
    setError(""); setCanvasImportMessage("");
    if (file.size > 2 * 1024 * 1024) return setError("Upload a Canvas .ics file smaller than 2 MB.");
    const text = await file.text();
    if (!text.includes("BEGIN:VCALENDAR") || !text.includes("END:VCALENDAR")) return setError("That file is not a valid Canvas calendar (.ics).");
    setForm((current) => ({ ...current, canvasIcsText: text, canvasFeedUrl: "", keepCanvasConnection: false }));
    setCanvasImportMessage(`${file.name} is ready. Radar will save and parse it when you build the preview.`);
  }

  async function setForwarding(enabled: boolean) {
    if (!saved) { setForm((current) => ({ ...current, forwardingEnabled: enabled })); return; }
    const response = await fetch("/api/beta/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ forwardingEnabled: enabled }) });
    const data = await readBetaResponse(response);
    if (!response.ok) return setError(data.error || "Could not save forwarding preference.");
    setForm((current) => ({ ...current, forwardingEnabled: data.forwardingEnabled }));
    setRadarInboxAddress(data.radarInboxAddress);
  }

  async function checkForwardingConfirmation() {
    const response = await fetch("/api/beta/profile");
    if (!response.ok) return setError("Could not check for Gmail confirmation. Try again.");
    const data = await readBetaResponse(response);
    setForwardingConfirmation(data.forwardingConfirmationUrl ?? null);
    setMailerReady(Boolean(data.mailerReady));
    if (!data.forwardingConfirmationUrl) setFeedbackMessage("Gmail confirmation has not arrived yet. Try again after the next 15-minute inbox check.");
  }

  async function sendFeedback(itemId: string, reaction: string) {
    const response = await fetch("/api/beta/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId, itemId, reaction }) });
    setFeedbackMessage(response.ok ? "Feedback saved. Thank you." : "Feedback could not be saved. Please try again.");
  }

  async function recognizeScreenshot(file: File | undefined, target: "schedule" | "deadlines") {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return setError("Upload a PNG, JPG, or HEIC screenshot smaller than 10 MB.");
    setError(""); setOcrStatus("Reading the screenshot on your device… 0%");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, { logger: (message) => {
        if (message.status === "recognizing text") setOcrStatus(`Reading the screenshot on your device… ${Math.round((message.progress ?? 0) * 100)}%`);
      } });
      const result = await worker.recognize(file);
      await worker.terminate();
      const text = result.data.text.trim();
      if (!text) throw new Error("No text was found. Try a clearer screenshot.");
      setForm((current) => target === "schedule" ? { ...current, courseScheduleText: text } : { ...current, assignmentDeadlinesText: text });
      setOcrStatus("Done. Review the text below before saving. The image was not uploaded to Campus Radar.");
    } catch (error) {
      setOcrStatus(""); setError(error instanceof Error ? error.message : "Screenshot recognition failed. Paste the text instead.");
    }
  }

  function exportCalendar() {
    const count = downloadScheduleIcs(form.courseScheduleText ?? "", termStart, termEnd);
    setCalendarMessage(count ? `Created a .ics file for ${count} course${count === 1 ? "" : "s"}. Import it in Google Calendar → Settings → Import & export.` : "No exportable course lines were found. Include a course number, meeting days, and start/end time on each line.");
  }

  async function askRadar(questionOverride?: string) {
    const question = (questionOverride ?? askQuestion).trim();
    if (!question || askLoading) return;
    setAskMessages((items) => [...items, { role: "user", text: question }]); setAskQuestion(""); setAskLoading(true);
    try {
      const response = await fetch("/api/beta/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await readBetaResponse(response);
      setAskMessages((items) => [...items, { role: "assistant", text: response.ok ? data.answer : data.error, bullets: data.bullets, sources: data.sources }]);
    } catch { setAskMessages((items) => [...items, { role: "assistant", text: reportIsZh ? "Ask Radar 暂时无法回答，请稍后再试。" : "Ask Radar is temporarily unavailable. Please try again." }]); }
    finally { setAskLoading(false); }
  }

  async function deleteData() {
    if (!window.confirm("Delete your Beta profile, source connections, Radar history, and feedback? This cannot be undone.")) return;
    const response = await fetch("/api/beta/profile", { method: "DELETE" });
    if (response.ok) { setForm(initialForm); setPreview(null); setRunId(null); setGoogleCalendarConnected(false); setCanvasFeedConnected(false); setCanvasApiConnected(false); setAcademicConnected(false); setAcademicSummary(""); setSaved(false); setStep(0); }
  }

  if (loading) return <div className="beta-loading" role="status">Loading your Beta setup…</div>;

  return (
    <div className="beta-app">
      <aside className="beta-sidebar">
        <p className="eyebrow">10-STUDENT PILOT</p>
        <h1>{saved ? "Your Campus Radar" : "Calibrate your Radar in one minute"}</h1>
        <p>We only read what is needed to build your daily actions. Radar never applies, sends messages, or edits calendars for you.</p>
        <div className="beta-progress"><span style={{ width: `${progress}%` }} /></div>
        <ol>
          {["About you", "Goals & interests", "Preferences", "Courses & calendar", "Radar preview"].map((label, index) => (
            <li key={label} className={index === step ? "active" : index < step ? "done" : ""} onClick={() => index < 4 && setStep(index)}>
              <span>{index < step ? "✓" : index + 1}</span>{label}
            </li>
          ))}
        </ol>
        <div className="privacy-mini"><strong>Read-only by default</strong><span>Pause or delete all data anytime</span></div>
      </aside>

      <section className="beta-panel">
        {step === 0 && <div className="form-step">
          <p className="step-kicker">STEP 1 / 5</p><h2>First, tell us about you</h2><p className="step-copy">This helps Radar filter out opportunities that do not fit you.</p>
          <label>Login email<input value={email} disabled /></label>
          <fieldset><legend>Are you a University of Michigan student?</legend><div className="choice-grid compact language-grid"><button type="button" className={form.isUmichStudent ? "selected" : ""} onClick={() => setForm({ ...form, isUmichStudent: true, school: "" , canvasBaseUrl: "https://umich.instructure.com" })}>Yes, I&apos;m at U-M</button><button type="button" className={!form.isUmichStudent ? "selected" : ""} onClick={() => setForm({ ...form, isUmichStudent: false, school: "", canvasBaseUrl: "" })}>No, another school</button></div><p className="field-note">U-M students receive Michigan campus events and undergraduate research matches. Other students receive schedule, deadline, field, and public career signals without U-M-only recommendations.</p></fieldset>
          <div className="field-grid">
            {form.isUmichStudent ? <label>U-M School / College<select value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })}><option value="">Choose one</option><option>Engineering</option><option>LSA</option><option>Ross</option><option>Information</option><option>Stamps</option><option>Other</option></select></label> : <label>University / school<input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="e.g. Michigan State University" maxLength={80} /></label>}
            <label>Major<input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} placeholder="e.g. Computer Science" maxLength={100} /></label>
            <label>Graduation year<select value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })}>{[2026,2027,2028,2029,2030,2031].map((year) => <option key={year}>{year}</option>)}</select></label>
            <label>Academic level<select value={form.academicLevel} onChange={(e) => setForm({ ...form, academicLevel: e.target.value as BetaProfileInput["academicLevel"] })}><option value="undergraduate">Undergraduate</option><option value="graduate">Graduate</option></select></label>
          </div>
        </div>}

        {step === 1 && <div className="form-step">
          <p className="step-kicker">STEP 2 / 5 · HIGH-SIGNAL CALIBRATION</p><h2>Four choices that make Radar feel personal</h2><p className="step-copy">No long personality test—only the answers that materially change your recommendations.</p>
          <fieldset><legend>Your most important outcome this term (choose up to two)</legend><div className="choice-grid">{GOALS.map(([value,label]) => <button type="button" key={value} className={form.goals.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, goals: toggle(form.goals, value, 2) })}>{label}</button>)}</div></fieldset>
          <label className="other-field">Other goal (optional)<input value={form.customGoal ?? ""} onChange={(e) => setForm({ ...form, customGoal: e.target.value })} placeholder="e.g. campus project or scholarship" maxLength={60} /></label>
          <fieldset><legend>Role directions (choose up to three)</legend><div className="choice-grid compact role-grid">{ROLE_TRACKS.map(([value,label]) => <button type="button" key={value} className={form.roleTracks.includes(value) ? "selected" : ""} onClick={() => setForm({ ...form, roleTracks: toggle(form.roleTracks, value, 3) })}>{label}</button>)}</div></fieldset>
          <fieldset><legend>Where are you right now?</legend><div className="choice-grid compact stage-grid">{CAREER_STAGES.map(([value,label]) => <button type="button" key={value} className={form.careerStage === value ? "selected" : ""} onClick={() => setForm({ ...form, careerStage: value })}>{label}</button>)}</div></fieldset>
          <fieldset><legend>What is your biggest bottleneck this week?</legend><div className="choice-grid bottleneck-grid">{BOTTLENECKS.map(([value,label]) => <button type="button" key={value} className={form.bottleneck === value ? "selected" : ""} onClick={() => setForm({ ...form, bottleneck: value })}>{label}</button>)}</div></fieldset>
          <details className="advanced-profile"><summary>Optional: add interest keywords</summary>
            <fieldset><legend>Topic interests</legend><div className="choice-grid compact">{INTERESTS.map((value) => <button type="button" key={value} className={form.interests.includes(value.toLowerCase()) ? "selected" : ""} onClick={() => setForm({ ...form, interests: toggle(form.interests, value.toLowerCase(), 4) })}>{value}</button>)}</div></fieldset>
            <label className="other-field">Other interest<input value={form.customInterest ?? ""} onChange={(e) => setForm({ ...form, customInterest: e.target.value })} placeholder="e.g. Music Tech" maxLength={60} /></label>
          </details>
        </div>}

        {step === 2 && <div className="form-step">
          <p className="step-kicker">STEP 3 / 5</p><h2>Eligibility and report preferences</h2><p className="step-copy">Eligibility filters are guidance only. Always confirm details on the official page.</p>
          <label>Do you need employer visa sponsorship?<select value={form.sponsorship} onChange={(e) => setForm({ ...form, sponsorship: e.target.value as BetaProfileInput["sponsorship"] })}><option value="needed">Yes, I need sponsorship</option><option value="not_needed">No</option><option value="unsure">Not sure</option></select></label>
          <label>Preferred report time<input type="time" value={form.deliveryTime} onChange={(e) => setForm({ ...form, deliveryTime: e.target.value })} /></label>
          <fieldset><legend>Report language</legend><div className="choice-grid compact language-grid"><button type="button" className={form.reportLanguage === "en" ? "selected" : ""} onClick={() => { setForm({ ...form, reportLanguage: "en" }); setPreview(null); }}>English</button><button type="button" className={form.reportLanguage === "zh" ? "selected" : ""} onClick={() => { setForm({ ...form, reportLanguage: "zh" }); setPreview(null); }}>中文</button></div><p className="field-note">Changing this regenerates the complete report, including Insight, Must Do, events, and research.</p></fieldset>
          <label>Report delivery email<input type="email" value={form.deliveryEmail} onChange={(e) => setForm({ ...form, deliveryEmail: e.target.value })} placeholder="you@umich.edu" autoComplete="email" /><span className="field-note">This can be different from your login email.</span></label>
          <label className="check-line"><input type="checkbox" checked={form.paidOnly} onChange={(e) => setForm({ ...form, paidOnly: e.target.checked })} /><span>Prioritize paid positions</span></label>
          <label className="check-line"><input type="checkbox" checked={form.weekends} onChange={(e) => setForm({ ...form, weekends: e.target.checked })} /><span>Include weekend Radars</span></label>
          <label className="check-line"><input type="checkbox" checked={form.emailDeliveryEnabled} onChange={(e) => setForm({ ...form, emailDeliveryEnabled: e.target.checked })} /><span>Email my Radar at the selected time</span></label>
        </div>}

        {step === 3 && <div className="form-step source-step">
          <p className="step-kicker">STEP 4 / 5 · CONNECT OR PASTE</p><h2>Connect Canvas and add your key deadlines</h2><p className="step-copy">Calendar Feed is the easiest option. If your account can create a token, you may also use the read-only Canvas API. You can always paste text or upload screenshots instead.</p>
          <div className="source-connect-grid">
            <section className="source-connect-card available canvas-connect-card">
              <div className="source-card-head"><span className="source-logo canvas">C</span><div><h3>Canvas</h3><p>Read course items for the next 14 days</p></div><strong>{canvasFeedConnected || canvasApiConnected ? "Connected" : "Recommended"}</strong></div>
              <div className="canvas-method-grid">
                <details open={!canvasFeedConnected}>
                  <summary>Calendar Feed (recommended)</summary>
                  <p className="source-explainer">No API token required. The private link keeps updating, and Radar reads it again whenever you refresh your report.</p>
                  <ol><li>Canvas → Calendar</li><li>Click Calendar Feed on the right</li><li>Copy the link ending in <b>.ics</b></li></ol>
                  <label>Canvas Calendar Feed<input type="password" value={form.canvasFeedUrl ?? ""} onChange={(e) => { setForm({ ...form, canvasFeedUrl: e.target.value, canvasIcsText: "" }); setCanvasImportMessage(""); }} placeholder="https://umich.instructure.com/feeds/calendars/user_….ics" autoComplete="off" /></label>
                  <div className="canvas-upload-fallback"><strong>Feed shows 403?</strong><p>Open the Feed link in your browser, save the calendar file, then upload it here. This avoids your school&apos;s server block.</p><label className="upload-label">Upload Canvas .ics<input type="file" accept=".ics,text/calendar" onChange={(event) => importCanvasIcs(event.target.files?.[0])} /></label>{canvasImportMessage && <p className="calendar-message" role="status">{canvasImportMessage}</p>}</div>
                  {canvasFeedConnected && <label className="source-request"><input type="checkbox" checked={Boolean(form.keepCanvasConnection)} onChange={(e) => setForm({ ...form, keepCanvasConnection: e.target.checked })} /><span>Keep the current Calendar Feed connection</span></label>}
                </details>
                <details>
                  <summary>Canvas API (optional)</summary>
                  <p className="source-explainer">Reads unfinished Planner items. Use this only if your Canvas settings allow you to create an Access Token.</p>
                  {form.isUmichStudent ? <div className="canvas-instance"><span>Canvas instance</span><strong>University of Michigan · umich.instructure.com</strong><small>Radar fills this address automatically.</small></div> : <label>Canvas instance URL<input type="url" value={form.canvasBaseUrl ?? ""} onChange={(e) => setForm({ ...form, canvasBaseUrl: e.target.value })} placeholder="https://yourschool.instructure.com" /></label>}
                  <label>Access Token<input type="password" value={form.canvasApiToken ?? ""} onChange={(e) => setForm({ ...form, canvasApiToken: e.target.value, canvasBaseUrl: form.isUmichStudent ? "https://umich.instructure.com" : form.canvasBaseUrl })} placeholder="Paste your Canvas Access Token" autoComplete="off" /></label>
                  {canvasApiConnected && <label className="source-request"><input type="checkbox" checked={Boolean(form.keepCanvasApiConnection)} onChange={(e) => setForm({ ...form, keepCanvasApiConnection: e.target.checked })} /><span>Keep the current Canvas API connection</span></label>}
                  <p className="token-warning">A token is equivalent to a Canvas password. If your school does not offer token creation, use Calendar Feed instead.</p>
                </details>
              </div>
            </section>
            <section className="source-connect-card available academic-paste-card">
              <div className="source-card-head"><span className="source-logo academic">D</span><div><h3>Courses and deadlines</h3><p>Paste text without connecting an account</p></div><strong>{academicConnected ? "Saved" : "Recommended"}</strong></div>
              {academicConnected && <div className="saved-source-summary"><span>Currently saved</span><strong>{academicSummary}</strong></div>}
              <div className="academic-paste-grid">
                <label>Weekly class schedule (optional)<textarea value={form.courseScheduleText ?? ""} onChange={(e) => setForm({ ...form, courseScheduleText: e.target.value })} placeholder={"One course per line, for example:\nEECS 485 | MW 10:30 AM–12:00 PM\nSI 339 | TTh 2:30–4:00 PM"} rows={6} /><span className="upload-label">or upload a schedule screenshot<input type="file" accept="image/png,image/jpeg,image/webp,image/heic" onChange={(event) => recognizeScreenshot(event.target.files?.[0], "schedule")} /></span></label>
                <label>Assignment / exam deadlines (recommended)<textarea value={form.assignmentDeadlinesText ?? ""} onChange={(e) => setForm({ ...form, assignmentDeadlinesText: e.target.value })} placeholder={"One deadline per line, for example:\n2026-10-02 11:59 PM | EECS 485 Project 1\nOct 6 5:00 PM | SI 339 Midterm"} rows={6} /><span className="upload-label">or upload a syllabus / deadline screenshot<input type="file" accept="image/png,image/jpeg,image/webp,image/heic" onChange={(event) => recognizeScreenshot(event.target.files?.[0], "deadlines")} /></span></label>
              </div>
              {ocrStatus && <p className="ocr-status" role="status">{ocrStatus}</p>}
              <p className="paste-tip"><strong>You can paste:</strong> a Schedule / Assignments table from your syllabus, dates copied from a course page, or your own list. Radar automatically detects lines containing dates.</p>
              <div className="calendar-export">
                <div><strong>Turn classes into Google Calendar events</strong><p>After reviewing the extracted text, create a .ics file with weekly recurring classes.</p></div>
                <label>Term starts<input type="date" value={termStart} onChange={(event) => setTermStart(event.target.value)} /></label>
                <label>Term ends<input type="date" value={termEnd} onChange={(event) => setTermEnd(event.target.value)} /></label>
                <button type="button" onClick={exportCalendar}>Create .ics</button>
              </div>
              {calendarMessage && <p className="calendar-message">{calendarMessage}</p>}
              {academicConnected && <label className="source-request"><input type="checkbox" checked={Boolean(form.keepManualAcademicData)} onChange={(e) => setForm({ ...form, keepManualAcademicData: e.target.checked })} /><span>Keep saved courses and deadlines; new pasted content replaces them</span></label>}
            </section>

            <section className="source-connect-card available">
              <div className="source-card-head"><span className="source-logo google">G</span><div><h3>Google Calendar</h3><p>Interviews, meetings, and personal plans</p></div><strong>{googleCalendarConnected ? "Connected" : "Available"}</strong></div>
              <details open={!googleCalendarConnected}><summary>{googleCalendarConnected ? "Replace connection" : "Connect private iCal"}</summary>
                <ol><li>Google Calendar → Settings</li><li>Select your calendar</li><li>Copy “Secret address in iCal format”</li></ol>
                <label>Google Calendar iCal<input type="password" value={form.googleCalendarFeedUrl ?? ""} onChange={(e) => setForm({ ...form, googleCalendarFeedUrl: e.target.value })} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoComplete="off" /></label>
                {googleCalendarConnected && <label className="source-request"><input type="checkbox" checked={Boolean(form.keepGoogleCalendarConnection)} onChange={(e) => setForm({ ...form, keepGoogleCalendarConnection: e.target.checked })} /><span>Keep the current Google Calendar connection</span></label>}
              </details>
            </section>

            <section className="source-connect-card public-resource">
              <div className="source-card-head"><span className="source-logo handshake">H</span><div><h3>Handshake</h3><p>{form.isUmichStudent ? "U-M student jobs and career events" : "Jobs and career events from your institution"}</p></div><strong>Public entry</strong></div>
              <p className="source-explainer">Open your own Handshake account. Campus Radar does not read passwords, saved jobs, or applications.</p>
              <a className="resource-link" href={form.isUmichStudent ? "https://umich.joinhandshake.com/" : "https://app.joinhandshake.com/"} target="_blank" rel="noreferrer">Open Handshake ↗</a>
            </section>

            <section className="source-connect-card available gmail-forward-card">
              <div className="source-card-head"><span className="source-logo gmail">M</span><div><h3>Forwarded email</h3><p>Handshake, Interstride, recruiting, and registration confirmations</p></div><strong>{radarInboxAddress ? "Address ready" : "Pilot setup"}</strong></div>
              <label className="check-line"><input type="checkbox" checked={Boolean(form.forwardingEnabled)} onChange={(event) => setForwarding(event.target.checked)} /><span>Allow Radar to process emails I forward to my private Radar inbox</span></label>
              <p className="source-explainer">Your report goes to <b>{form.deliveryEmail || "your report delivery email"}</b>. Your forwarding destination below is a separate address owned by Radar.</p>
              {!mailerReady && <p className="token-warning">Email processing is awaiting pilot-owner activation. You can save your preferences now; forwarding confirmation appears once the inbox script is running.</p>}
              {radarInboxAddress ? <>
                <p className="source-explainer">Forward only messages you want Radar to read. After one filter setup, new matching messages forward automatically; no daily forwarding is needed.</p>
                <div className="radar-inbox-address"><span>Your private Radar inbox</span><strong>{radarInboxAddress}</strong></div>
                {!form.forwardingEnabled && <p className="token-warning">Forwarding is off. Enable the checkbox before sending mail to this address.</p>}
                <details><summary>Set up a Gmail filter</summary><ol><li>Enable the checkbox above, then open Gmail → Settings → See all settings → Forwarding and POP/IMAP.</li><li>Add the Radar address above. Gmail sends a confirmation message to Radar.</li><li>Check for the confirmation below and complete Google&apos;s confirmation step yourself.</li><li>Create a filter for Handshake, Interstride, or the recruiters you choose, then select “Forward it to”. Leave whole-inbox forwarding disabled.</li></ol><button type="button" className="text-button" onClick={checkForwardingConfirmation}>Check Gmail confirmation</button>{forwardingConfirmation && <a className="resource-link" href={forwardingConfirmation} target="_blank" rel="noreferrer">Open Google forwarding confirmation</a>}</details>
              </> : <p className="source-explainer">Save your first Radar to create your private forwarding address. Then return to this step to set up your Gmail filter.</p>}
              {!radarInboxConfigured && <p className="token-warning">Owner setup required: connect one dedicated Gmail address before inviting students to use forwarding.</p>}
            </section>

            <section className="source-connect-card public-resource">
              <div className="source-card-head"><span className="source-logo interstride">I</span><div><h3>Interstride</h3><p>International student jobs and sponsorship resources</p></div><strong>Public entry</strong></div>
              <p className="source-explainer">Open Interstride with your own access. Radar does not read personal account data in the background.</p>
              <a className="resource-link" href="https://web.interstride.com/" target="_blank" rel="noreferrer">Open Interstride ↗</a>
            </section>
          </div>
          <p className="security-note">Private Canvas and Google Calendar links and Canvas tokens are encrypted and never shown again. Radar makes read-only requests and never submits work or changes Canvas.</p>
        </div>}

        {step === 4 && <div className="preview-step">
          <div className="preview-heading"><div><p className="step-kicker">YOUR FIRST RADAR</p><h2>{preview ? (reportIsZh ? "你的个性化预览" : "Your personalized preview") : (reportIsZh ? "准备生成预览" : "Ready to build your preview")}</h2></div>{saved && <div className="preview-heading-actions"><button className="text-button" onClick={() => setStep(0)}>Edit setup</button><button className="button primary" onClick={generatePreview} disabled={submitting}>{submitting ? "Refreshing…" : "Regenerate"}</button></div>}</div>
          {!preview && <div className="empty-preview"><strong>Everything is ready</strong><p>Radar will combine the next seven days of U-M opportunities with your selected calendar signals and produce up to three actions.</p><button className="button primary" onClick={generatePreview} disabled={submitting}>{submitting ? "Connecting and filtering…" : "Build my first Radar"}</button></div>}
          {preview && <>
            <section className="email-delivery-banner">
              {!mailerReady && <p>{reportIsZh ? "邮件设置已保存；发送服务尚待项目方激活。" : "Your email settings are saved. Sending is awaiting pilot-owner activation."}</p>}
              <div><span>{reportIsZh ? "每日邮件 · BETA" : "DAILY EMAIL · BETA"}</span><strong>{reportIsZh ? "如果您对这份简报满意，我们会每天早上发送一份新的日报。" : "Happy with this brief? We’ll send you a fresh Radar every morning."}</strong><p>{form.emailDeliveryEnabled ? (reportIsZh ? `将于每天 ${form.deliveryTime} 发送至 ${form.deliveryEmail}` : `Scheduled for ${form.deliveryTime} at ${form.deliveryEmail}`) : (reportIsZh ? "在配置中开启邮件发送即可接收。" : "Enable email delivery in your settings to receive it.")}</p></div>
              <button type="button" onClick={() => setStep(2)}>{reportIsZh ? "邮件设置" : "Email settings"}</button>
              {saved && form.emailDeliveryEnabled && <a href="/unsubscribe">{reportIsZh ? "取消订阅日报" : "Unsubscribe"}</a>}
            </section>
            <div className="preview-status-row"><span>{reportIsZh ? "生成于" : "Generated"} {new Date(preview.generatedAt).toLocaleString()}</span><span>{preview.academic?.connected ? (reportIsZh ? `${preview.academic.courseCount} 门课 · ${preview.academic.deadlineCount} 个 DDL` : `${preview.academic.courseCount} courses · ${preview.academic.deadlineCount} deadlines`) : (reportIsZh ? "课表尚未添加" : "No course schedule added")}</span><span>{preview.googleCalendar?.connected ? `Google Calendar · ${preview.googleCalendar.eventCount}` : (reportIsZh ? "Google Calendar 未连接" : "Google Calendar not connected")}</span>{form.isUmichStudent && <span>{preview.umichSourceMode === "live" ? (reportIsZh ? "U-M 实时源" : "Live U-M source") : preview.umichSourceMode === "verified_fallback" ? (reportIsZh ? "U-M 已核验备用源" : "Verified U-M fallback") : (reportIsZh ? "U-M 源暂不可用" : "U-M source unavailable")}</span>}<span>{reportIsZh ? "每天" : "Daily at"} {form.deliveryTime}</span></div>
            {preview.insight && <section className="personal-insight">
              <p className="step-kicker">INSIGHT · WHY THIS RADAR LOOKS DIFFERENT</p>
              <h3>{preview.insight.title}</h3>
              <p>{preview.insight.detail}</p>
              <div>{preview.insight.evidence.map((item) => <span key={item}>{item}</span>)}</div>
            </section>}
            <div className="result-section-heading"><span>01</span><div><p className="step-kicker">MUST DO</p><h3>{reportIsZh ? "今天真正值得推进的事" : "What is truly worth moving forward today"}</h3></div></div>
            {preview.actions.length ? preview.actions.map((item) => <ItemCard key={item.id} item={item} onFeedback={sendFeedback} language={form.reportLanguage} />) : <p className="no-results">{reportIsZh ? "今天没有足够高匹配的行动。Radar 不会为了凑数编造建议。" : "Nothing clears the relevance threshold today. Radar will not invent filler."}</p>}
            {preview.risk && <div className="beta-risk"><span>WATCH OUT</span><h3>{preview.risk.title}</h3><p>{preview.risk.nextAction}</p></div>}
            <div className="result-section-heading"><span>02</span><div><p className="step-kicker">EVENTS & OPPORTUNITIES</p><h3>{reportIsZh ? "与你现在阶段匹配的机会" : "Opportunities that match your current stage"}</h3></div></div>
            {preview.opportunities.length ? <div className="result-grid">{preview.opportunities.map((item) => <ItemCard key={item.id} item={item} onFeedback={sendFeedback} language={form.reportLanguage} />)}</div> : <p className="no-results">{reportIsZh ? "当前没有通过匹配阈值的公开机会；可以调整岗位方向后重新生成。" : "No public opportunity currently clears your match threshold. Adjust your role directions and regenerate."}</p>}
            {preview.researchLabs?.enabled && <section className="research-radar">
              <div className="result-section-heading"><span>03</span><div><p className="step-kicker">UNDERGRAD RESEARCH RADAR</p><h3>{reportIsZh ? "正在接受本科生的实验室与官方入口" : "Labs accepting undergraduates and official entry points"}</h3></div></div>
              <div className="research-grid">{preview.researchLabs.matches.map((lab) => <article key={lab.id} className="research-card">
                <div className="research-card-top"><span>{lab.department}</span><strong>{lab.score}% match</strong></div>
                <h4>{lab.name}</h4>
                <div className={`research-status ${lab.status}`}>{lab.statusLabel}</div>
                <div className="research-areas">{lab.areas.map((area) => <span key={area}>{area}</span>)}</div>
                <p>{lab.why}</p>
                <b>{reportIsZh ? "下一步：" : "Next step: "}{lab.nextAction}</b>
                <footer><a href={lab.url} target="_blank" rel="noreferrer">{reportIsZh ? "查看 U-M 官方页面" : "View official U-M page"} ↗</a><span>{reportIsZh ? "核验" : "Verified"} {lab.verifiedAt}</span></footer>
              </article>)}</div>
              <p className="research-note">{preview.researchLabs.sourceNote}</p>
            </section>}
            {preview.fieldInsight && <section className="field-insight">
              <div className="result-section-heading"><span>{preview.researchLabs?.enabled ? "04" : "03"}</span><div><p className="step-kicker">FIELD INSIGHT</p><h3>{reportIsZh ? "来自你专业方向的一条判断" : "One useful judgment from your field"}</h3></div></div>
              <h4>{preview.fieldInsight.title}</h4>
              <dl><div><dt>SIGNAL</dt><dd>{preview.fieldInsight.signal}</dd></div><div><dt>SO WHAT</dt><dd>{preview.fieldInsight.implication}</dd></div><div><dt>THIS WEEK</dt><dd>{preview.fieldInsight.experiment}</dd></div></dl>
              <div className="field-sources">{preview.fieldInsight.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</div>
            </section>}
            <section className="ask-radar">
              <div className="ask-heading"><div><p className="step-kicker">ASK RADAR · BETA</p><h3>{reportIsZh ? "问你的日程、DDL 和活动取舍" : "Ask about your schedule, deadlines, and event tradeoffs"}</h3></div><span>{reportIsZh ? "只使用你的 Radar 数据" : "Uses only your Radar data"}</span></div>
              <div className="ask-prompts">{(reportIsZh ? ["我今天怎么安排？", "接下来有什么活动？", "我最该参加哪个活动？"] : ["How should I plan today?", "What events are coming up?", "Which event should I attend?"]).map((question) => <button type="button" key={question} onClick={() => askRadar(question)}>{question}</button>)}</div>
              {askMessages.length > 0 && <div className="ask-thread">{askMessages.map((message, index) => <div key={`${message.role}-${index}`} className={`ask-message ${message.role}`}><strong>{message.role === "user" ? "YOU" : "RADAR"}</strong><p>{message.text}</p>{message.bullets?.length ? <ul>{message.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}{message.sources?.length ? <div>{message.sources.map((source) => source.url ? <a key={`${source.label}-${source.url}`} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a> : <span key={source.label}>{source.label}</span>)}</div> : null}</div>)}</div>}
              <form onSubmit={(event) => { event.preventDefault(); askRadar(); }}><input value={askQuestion} onChange={(event) => setAskQuestion(event.target.value)} placeholder={reportIsZh ? "例如：EECS 485 这周有什么 due？" : "e.g. What is due for EECS 485 this week?"} maxLength={500} /><button type="submit" disabled={askLoading}>{askLoading ? (reportIsZh ? "思考中…" : "Thinking…") : (reportIsZh ? "问 Radar" : "Ask Radar")}</button></form>
              <p className="ask-boundary">{reportIsZh ? "不会代写作业或编造未核验时间；没有数据时会直接说明。" : "Radar will not write assignments or invent unverified times. It tells you when the data is missing."}</p>
            </section>
            <p className="attribution">{preview.attribution}</p>
            {feedbackMessage && <p className="feedback-message">{feedbackMessage}</p>}
          </>}
        </div>}

        {error && <div className="form-error" role="alert">{error}</div>}
        {step < 4 && <div className="form-nav"><button className="button secondary dark" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</button>{step < 3 ? <button className="button primary" onClick={next}>Continue</button> : <><button className="text-button" onClick={() => { setForm({ ...form, courseScheduleText: "", assignmentDeadlinesText: "", canvasFeedUrl: "", canvasIcsText: "", canvasApiToken: "", googleCalendarFeedUrl: "", keepManualAcademicData: academicConnected, keepCanvasConnection: canvasFeedConnected, keepCanvasApiConnection: canvasApiConnected, keepGoogleCalendarConnection: googleCalendarConnected }); setStep(4); }}>Skip for now</button><button className="button primary" onClick={generatePreview} disabled={submitting}>{submitting ? "Parsing and filtering…" : "Save and build preview"}</button></>}</div>}
        {saved && <div className="danger-zone"><div><strong>You control your data</strong><p>Delete your profile, source connections, Radar history, and feedback at any time during the pilot.</p></div><button onClick={deleteData}>Delete all data</button></div>}
      </section>
    </div>
  );
}
