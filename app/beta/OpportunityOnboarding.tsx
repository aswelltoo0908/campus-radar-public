"use client";
import { readBetaResponse } from "../../lib/client-api";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BRIEF_SECTIONS, BRIEF_LABELS, briefPath, briefEnabled, briefCounts, parentBriefSection,
  type BriefSection,
} from "../../lib/brief-sections";
import { courseReminders, courseTime } from "../../lib/course-reminders";
import { hydrateRadarForm, radarSetupPayload, validateSetupStep, type RadarSetupForm, type SourceSummary } from "../../lib/onboarding-profile";
import { CanvasSetupFields, EmailSetupFields } from "./RadarSetupFields";
import CareerSection from "./CareerSection";
import { SourceReviewPanel, SourceStatus } from "./SourceStatus";
import NewsSection from "./NewsSection";
import {
  BUSINESS_CHANNELS,
  type BetaProfileInput,
  type OpportunityMatch,
  type RadarPreview,
  type RadarItem,
} from "../../lib/types";
import {
  DEFAULT_PREFERENCES,
  isUmichUniversity,
  parseOpportunityPreferences,
} from "../../lib/opportunity-matching";

const initial: BetaProfileInput = {
  reportLanguage: "en",
  deliveryEmail: "",
  emailDeliveryEnabled: false,
  forwardingEnabled: false,
  isUmichStudent: false,
  universityName: "",
  school: "",
  major: "",
  graduationYear: "2028",
  academicLevel: "undergraduate",
  goals: ["research", "scholarship"],
  interests: [],
  roleTracks: [],
  careerStage: "exploring",
  bottleneck: "finding",
  sponsorship: "unsure",
  paidOnly: false,
  deliveryTime: "07:30",
  weekends: false,
  opportunityPreferences: { ...DEFAULT_PREFERENCES },
  keepManualAcademicData: true,
};
function toggle(items: string[], key: string) {
  return items.includes(key) ? items.filter((x) => x !== key) : [...items, key];
}
function link(value: string | null | undefined) {
  return value && /^https:\/\//.test(value) ? value : undefined;
}
export default function OpportunityOnboarding({ email, section = "overview" }: {
  email: string;
  section?: BriefSection;
}) {
  const [form, setForm] = useState<RadarSetupForm>({ ...initial, deliveryEmail: email });
  const [sourceSummaries, setSourceSummaries] = useState<SourceSummary[]>([]);
  const [step, setStep] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<RadarPreview | null>(null),
    [runId, setRunId] = useState<number | null>(null),
    [reactions, setReactions] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<{
      answer: string;
      bullets?: string[];
      sources?: { label: string; url: string | null }[];
    } | null>(null);
  const pref = parseOpportunityPreferences(form.opportunityPreferences),
    zh = preview?.language === "zh";
  const t = (cn: string, en: string) => (zh ? cn : en);
  const courseItems = preview ? courseReminders(preview) : [];
  const language = zh ? "zh" : "en";
  const counts = preview ? briefCounts(preview) : {};
  if (preview) counts.news = (pref.newsEnabled ? preview.businessNews?.length ?? 0 : 0) + (pref.aiNewsEnabled ? preview.aiNews?.length ?? 0 : 0);
  const navigation = BRIEF_SECTIONS.filter(page => briefEnabled(page, form, pref));
  const activePage = parentBriefSection(section);
  const activeEnabled = briefEnabled(section, form, pref);
  const courseConnected = Boolean(preview?.canvas?.connected || preview?.academic?.connected);
  const goalNames: Record<string, string> = { research: "Research", scholarship: "Funding", internship: "Internships", events: "Campus events" };
  const patch = (data: Partial<BetaProfileInput>) =>
    setForm((current) => ({ ...current, ...data }));
  useEffect(() => {
    fetch("/api/beta/profile")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load your preferences.");
        return readBetaResponse(r);
      })
      .then((data) => {
        setSourceSummaries(data.sources || []);
        if (data.profile) setForm(hydrateRadarForm({ ...initial, deliveryEmail: email }, data.profile, data.sources));
        if (data.latestPreview?.preview?.formatVersion === 2) {
          setPreview(data.latestPreview.preview);
          setRunId(data.latestPreview.id);
          setStep(3);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!loading)
      void fetch("/api/beta/activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: step === 3 ? 4 : step }),
      });
  }, [step, loading]);
  useEffect(() => {
    if (!loading) document.getElementById("radar-content")?.scrollIntoView({ block: "start" });
  }, [step, loading, section]);
  useEffect(() => {
    if (error) document.querySelector(".beta-panel > .form-error")?.scrollIntoView({ block: "center" });
  }, [error]);
  async function generate() {
    for (const section of [0, 1, 2]) {
      const message = validateSetupStep(form, section);
      if (message) { setError(message); setStep(section); return; }
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/beta/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(radarSetupPayload(form)),
      });
      const data = await readBetaResponse(r);
      if (!r.ok) throw new Error(data.error);
      setPreview(data.preview);
      setRunId(data.runId);
      if (data.sources) setSourceSummaries(data.sources);
      setForm(current => ({ ...current, canvasFeedUrl: "", canvasApiToken: "", canvasIcsText: "", canvasBaseUrl: "", keepCanvasConnection: Boolean(current.canvasFeedUrl || current.canvasIcsText || current.keepCanvasConnection), keepCanvasApiConnection: Boolean(current.canvasApiToken || current.keepCanvasApiConnection) }));
      setStep(3);
      setReactions({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build your brief.");
    } finally {
      setBusy(false);
    }
  }
  async function react(id: string, reaction: string) {
    const r = await fetch("/api/beta/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, itemId: id, reaction }),
    });
    if (r.ok) setReactions((current) => ({ ...current, [id]: reaction }));
    else setError("Could not save feedback.");
  }
  function feedback(id: string) {
    return (
      <div className="feedback-buttons">
        {[
          ["useful", t("相关", "Relevant")],
          ["irrelevant", t("不适合", "Not for me")],
          ["acted", t("已行动", "I took action")],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={reactions[id] === value ? "selected" : ""}
            aria-pressed={reactions[id] === value}
            onClick={() => react(id, value)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }
  function card(item: OpportunityMatch) {
    return (
      <article className="opportunity-card" key={item.id}>
        <p className="eyebrow">
          {item.sourceId === "aihot" ? t("来源：AIHOT", "Source: AIHOT") : item.sourceName} · {item.availability.replaceAll("_", " ")}
        </p>
        <h3>{item.sourceId === "aihot" && !zh && item.originalTitle ? item.originalTitle : item.title}</h3>
        <SourceStatus check={item.verification} language={preview?.language || "en"} />
        {item.sourceId === "aihot" && <p className="field-note">{t("原始报道", "Original reporting")}: {item.originalSourceName} · {t("AIHOT 简短摘要", "AIHOT excerpt · original language")}</p>}
        <p>{item.summary}</p>
        <p>
          <strong>{t("为何推荐", "Why this fits")}:</strong> {item.why}
        </p>
        <div className="opportunity-meta">
          {item.amount && <span>{item.amount}</span>}
          {item.opensAt && (
            <span>
              {item.category === "event"
                ? t("开始", "Starts")
                : t("开放", "Opens")}
              : {item.opensAt}
            </span>
          )}
          {item.deadline && (
            <span>
              {t("截止", "Deadline")}: {item.deadline}
            </span>
          )}
          {item.publishedAt && (
            <span>
              {t("发布", "Published")}: {item.publishedAt.slice(0, 10)}
            </span>
          )}
        </div>
        {item.sourceMode === "verified_snapshot" && (
          <p className="field-note">
            {t(
              "实时获取受阻；以下为注明日期的人工核查信息，请回源确认。",
              "Live retrieval is unavailable; showing a dated, manually verified snapshot. Recheck the source.",
            )}
          </p>
        )}
        {item.unknownConditions.length > 0 && (
          <p className="field-note">
            {t("需确认", "Check before applying")}:{" "}
            {item.unknownConditions.join("; ")}
          </p>
        )}
        <div className="brief-next-action"><span>{t("下一步", "NEXT STEP")}</span><p>{item.nextAction}</p></div>
        <a href={link(item.url)} target="_blank" rel="noreferrer">
          {t("查看来源", "View original source")} ↗
        </a>
        {item.sourceId === "aihot" && item.attributionUrl && <p><a href={link(item.attributionUrl)} target="_blank" rel="noreferrer">{t("来源：AIHOT · 阅读完整摘要", "Source: AIHOT · Read on AIHOT")} ↗</a></p>}
        <p className="field-note">
          Fetched: {item.fetchedAt.slice(0, 10)}
          {item.verifiedAt && ` · Reviewed: ${item.verifiedAt}`}
        </p>
        {feedback(item.id)}
      </article>
    );
  }
  async function ask() {
    setBusy(true);
    try {
      const r = await fetch("/api/beta/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await readBetaResponse(r);
      if (!r.ok) throw new Error(data.error);
      setAnswer(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !window.confirm(
        "Delete your saved profile, reports, connections and feedback?",
      )
    )
      return;
    const r = await fetch("/api/beta/profile", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    if (r.ok) {
      setPreview(null);
      setStep(0);
      setForm({ ...initial, deliveryEmail: email });
    } else setError("Could not delete your data.");
  }
  if (loading) return <div className="radar-loading" role="status"><p className="eyebrow">CAMPUS RADAR</p><h1>Opening your workspace</h1><p>Loading your saved preferences and latest brief.</p><div className="skeleton-line" /><div className="skeleton-line short" /><div className="skeleton-card" /></div>;
  return (
    <div className="beta-app">
      <aside className="beta-sidebar">
        <p className="eyebrow">U-M OPPORTUNITY BETA</p>
        <h1>Find your next opportunity.</h1>
        <p>
          Research, funding and internships around your goals. Every
          recommendation keeps its source.
        </p>
        <ol>
          {["About you", "Goals & eligibility", "Canvas (optional)", "Your brief"].map((label, index) => (
            <li key={label} className={step === index ? "active" : ""}>
              <button
                type="button"
                aria-current={step === index ? "step" : undefined}
                disabled={busy || (index === 3 && !preview)}
                onClick={() => {
                  setError("");
                  if (index < 3 || preview) setStep(index);
                }}
              >
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>{label}
              </button>
            </li>
          ))}
        </ol>
        {step === 3 && preview && (
          <nav className="workspace-page-nav" aria-label="Radar pages">
            <p className="eyebrow">YOUR PAGES</p>
            {navigation.map(page => (
              <Link
                key={page}
                href={briefPath(page)}
                aria-current={activePage === page ? "page" : undefined}
              >
                <span>{BRIEF_LABELS[page][language]}</span>
                {counts[page] !== undefined && <span className="workspace-count">{counts[page]}</span>}
              </Link>
            ))}
          </nav>
        )}
        <div className="profile-compass" aria-live="polite">
          <p className="eyebrow">YOUR RADAR, TAKING SHAPE</p>
          <strong>{form.major.trim() || "Start with your field"}</strong>
          <p>{form.goals.map((goal) => goalNames[goal] || goal).join(" · ") || "Choose a goal to focus your brief."}</p>
          <div>{[...form.interests, ...(form.customInterest?.trim() ? [form.customInterest.trim()] : [])].slice(0, 4).map((interest) => <span key={interest}>{interest}</span>)}</div>
          <small>{form.isUmichStudent ? "U-M campus sources. Conditions checked where known; coverage varies by field." : "Public news is available. Your university’s campus sources are not connected."}</small>
        </div>
        <button type="button" className="text-button setup-shortcut" disabled={busy} onClick={() => { setError(""); setStep(2); }}>Manage Canvas ↗</button>
        <a href="/beta/settings">Advanced tools: manual DDL, calendars & forwarding ↗</a>
      </aside>
      <section className="beta-panel" id="radar-content" aria-busy={busy}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {step === 0 && (
          <div className="form-step">
            <p className="step-kicker">STEP 1 / 4 · YOUR STARTING POINT</p>
            <h2>A little about you</h2>
            <p className="step-copy">Your field gives Radar a starting point. You can refine everything later.</p>
            <div className="field-grid">
              <label>
                University
                <input
                  value={form.universityName || ""}
                  onChange={(e) => patch({universityName: e.target.value,isUmichStudent: isUmichUniversity(e.target.value)})}
                  placeholder="Full university name, e.g. University of Michigan"
                  maxLength={160}
                  aria-describedby="university-coverage-note"
                  required
                />
              </label>
              <label>
                School / college (optional)
                <input
                  value={form.school}
                  onChange={(e) => patch({ school: e.target.value })}
                  placeholder="e.g. LSA, Ross, College of Arts & Sciences"
                  maxLength={80}
                />
              </label>
              <label>
                Major
                <input
                  value={form.major}
                  onChange={(e) => patch({ major: e.target.value })}
                  placeholder="Mathematics, Political Science, Business…"
                  maxLength={100}
                />
              </label>
              <label>
                Academic level
                <select
                  value={form.academicLevel}
                  onChange={(e) =>
                    patch({
                      academicLevel: e.target
                        .value as typeof form.academicLevel,
                    })
                  }
                >
                  <option value="undergraduate">Undergraduate</option>
                  <option value="graduate">Graduate</option>
                </select>
              </label>
              <label>
                Graduation year
                <input
                  value={form.graduationYear}
                  onChange={(e) => patch({ graduationYear: e.target.value })}
                  inputMode="numeric"
                  maxLength={4}
                />
              </label>
            </div>
            <p className="field-note" id="university-coverage-note">
              Enter your full university name and campus, not just an abbreviation.
              {form.isUmichStudent ? " U-M campus sources are available." : " We'll save your school for future official-source discovery. Campus research, funding and event coverage is currently U-M only; saving a school does not connect its sources yet."}
            </p>
            <button
              className="button primary"
              onClick={() => {
                const message = validateSetupStep(form, 0);
                if (!message) {
                  setError("");
                  setStep(1);
                } else setError(message);
              }}
            >
              Next: your goals →
            </button>
          </div>
        )}
        {step === 1 && (
          <div className="form-step">
            <p className="step-kicker">STEP 2 / 4 · MATCHING, NOT GUESSING</p>
            <h2>What would you like to discover?</h2>
            <p className="step-copy">Choose a few priorities. More selections are not required for a useful brief.</p>
            <fieldset>
              <legend>Your goals</legend>
              <div className="choice-grid">
                {[
                  ["research", "Research"],
                  ["scholarship", "Scholarships & funding"],
                  ["internship", "Internships"],
                  ["events", "Campus events"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={form.goals.includes(value) ? "selected" : ""}
                    aria-pressed={form.goals.includes(value)}
                    onClick={() => patch({ goals: toggle(form.goals, value) })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {form.goals.includes("internship") && <label className="check-line"><input type="checkbox" checked={form.paidOnly} onChange={e=>patch({paidOnly:e.target.checked})}/>Only show internships with explicitly verified pay</label>}
            <fieldset>
              <legend>Interests</legend>
              <div className="choice-grid compact">
                {[
                  "Mathematics",
                  "Economics",
                  "Social science",
                  "Political science",
                  "Business",
                  "Data",
                  "Climate",
                  "Health",
                  "AI",
                  "Finance",
                  "Education",
                ].map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={form.interests.includes(value.toLowerCase())}
                    className={
                      form.interests.includes(value.toLowerCase())
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      patch({
                        interests: toggle(form.interests, value.toLowerCase()),
                      })
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              Other interest
              <input
                value={form.customInterest || ""}
                onChange={(e) => patch({ customInterest: e.target.value })}
                maxLength={60}
              />
            </label>
            <section className="setup-card eligibility-card" aria-labelledby="eligibility-title">
              <p className="eyebrow">A BETTER FIT · OPTIONAL</p>
              <h3 id="eligibility-title">Your goals, with the right context</h3>
              <p>These answers refine recommendations, not your access to Radar. Unknown is always okay.</p>
              <div className="field-grid">
                <label>Will you need employer visa sponsorship?<select value={form.sponsorship} onChange={event => patch({ sponsorship: event.target.value as BetaProfileInput["sponsorship"] })}><option value="unsure">Not sure / prefer not to say</option><option value="needed">Yes, I need sponsorship</option><option value="not_needed">No, I do not need sponsorship</option></select></label>
                <label>Where are you in your search?<select value={form.careerStage} onChange={event => patch({ careerStage: event.target.value as BetaProfileInput["careerStage"] })}><option value="exploring">Exploring my options</option><option value="preparing">Preparing my materials</option><option value="applying">Actively applying</option><option value="interviewing">Interviewing</option><option value="deciding">Comparing my options</option></select></label>
              </div>
            {form.goals.includes("scholarship") && (
              <details>
                <summary>Funding eligibility — unknown is okay</summary>
                <div className="field-grid">
                  {(
                    [
                      [
                        "visa",
                        "Visa / residency",
                        [
                          ["unknown", "Prefer not to say / unknown"],
                          ["f1", "F-1"],
                          ["j1", "J-1"],
                          [
                            "us_citizen_or_pr",
                            "U.S. citizen / permanent resident",
                          ],
                          ["other", "Other"],
                        ],
                      ],
                      [
                        "citizenshipRegion",
                        "Citizenship region",
                        [
                          ["unknown", "Prefer not to say / unknown"],
                          ["asia", "Asia"],
                          ["africa", "Africa"],
                          ["other", "Other"],
                        ],
                      ],
                      [
                        "transferStudent",
                        "Transfer student?",
                        [
                          ["unknown", "Unknown"],
                          ["yes", "Yes"],
                          ["no", "No"],
                        ],
                      ],
                      [
                        "stem",
                        "STEM program?",
                        [
                          ["unknown", "Unknown"],
                          ["yes", "Yes"],
                          ["no", "No"],
                        ],
                      ],
                    ] as const
                  ).map(([key, label, options]) => (
                    <label key={key}>
                      {label}
                      <select
                        value={pref[key]}
                        onChange={(e) =>
                          patch({
                            opportunityPreferences: {
                              ...pref,
                              [key]: e.target.value,
                            },
                          })
                        }
                      >
                        {options.map(([value, name]) => (
                          <option value={value} key={value}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <p className="field-note">
                  Used only to filter potential funding matches. We do not ask for income, documents or your exact citizenship here. Other requirements, including GPA, enrollment and financial need, still need checking on the official page. Radar does not determine award eligibility.
                </p>
              </details>
            )}
            </section>
            <section className="setup-card field-news-options" aria-labelledby="field-news-title">
              <p className="eyebrow">NEWS & INDUSTRY UPDATES</p>
              <h3 id="field-news-title">News</h3>
              <p>Choose the updates you want alongside your opportunities.</p>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={pref.newsEnabled}
                  onChange={(e) =>
                    patch({
                      opportunityPreferences: {
                        ...pref,
                        newsEnabled: e.target.checked,
                      },
                    })
                  }
                />
                Business news
              </label>
              <fieldset className="business-channel-picker" disabled={!pref.newsEnabled}>
                <legend>Business interests</legend>
                <div className="choice-grid compact">
                  {BUSINESS_CHANNELS.map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      aria-pressed={pref.newsChannels.includes(channel)}
                      className={
                        pref.newsChannels.includes(channel) ? "selected" : ""
                      }
                      onClick={() =>
                        patch({
                          opportunityPreferences: {
                            ...pref,
                            newsChannels: toggle(
                              pref.newsChannels,
                              channel,
                            ) as typeof pref.newsChannels,
                          },
                        })
                      }
                    >
                      {channel.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="field-note">
                {pref.newsEnabled
                  ? "Select at least one business interest to receive matching stories."
                  : "Turn on Business news to choose your interests."}
              </p>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={pref.aiNewsEnabled}
                  onChange={(e) =>
                    patch({
                      opportunityPreferences: {
                        ...pref,
                        aiNewsEnabled: e.target.checked,
                      },
                    })
                  }
                />
                AI news · optional updates from AIHOT and publishers
              </label>
              <p className="field-note">
                Tech currently covers AI sources. Up to 10 Business stories and three Tech updates per brief; more news categories are not available yet.
              </p>
            </section>
            <label className="check-line">
              <input
                type="checkbox"
                checked={pref.externalEventsEnabled}
                onChange={(e) =>
                  patch({
                    opportunityPreferences: {
                      ...pref,
                      externalEventsEnabled: e.target.checked,
                    },
                  })
                }
              />
              Discover relevant public events at other universities
            </label>
            <div className="onboarding-actions"><button type="button" className="text-button" onClick={() => setStep(0)}>← About you</button><button
              className="button primary"
              disabled={busy}
              onClick={() => { const message = validateSetupStep(form, 1); if (message) setError(message); else { setError(""); setStep(2); } }}
            >
              Next: optional Canvas →
            </button>
            </div>
            {busy && <p className="field-note" role="status">Checking your preferences against current source coverage. Keep this page open.</p>}
          </div>
        )}
        {step === 2 && (
          <div className="form-step setup-step">
            <p className="step-kicker">STEP 3 / 4 · OPTIONAL COURSE REMINDERS</p>
            <h2>Your Radar, your routine.</h2>
            <p className="step-copy">Keep course deadlines beside your opportunities. Leave Canvas blank if you only want your opportunity brief.</p>
            <CanvasSetupFields form={form} onChange={patch} disabled={busy} sources={sourceSummaries} />
            <label className="report-language-field">Report language<select value={form.reportLanguage} onChange={event => patch({ reportLanguage: event.target.value as "en" | "zh" })} disabled={busy}><option value="en">English</option><option value="zh">中文</option></select><span className="field-note">The website stays in English. Your brief and email follow this preference after you rebuild.</span></label>
            <div className="onboarding-actions"><button type="button" className="text-button" disabled={busy} onClick={() => { setError(""); setStep(1); }}>← Goals & eligibility</button><button className="button primary" disabled={busy} onClick={generate}>{busy ? "Saving & building…" : "Save & build my brief →"}</button></div>
            <p className="field-note" role="status">{busy ? "Checking sources and saving your preferences. Keep this page open." : "Canvas is optional. Existing connections and email preferences are kept. Manage email delivery at the end of your brief."}</p>
          </div>
        )}
        {step === 3 && preview && (
          <div className="radar-preview">
            <div className="brief-masthead">
            <div>
            <p className="step-kicker">YOUR OPPORTUNITIES</p>
            <h2>{section === "overview" ? t("你的机会总览", "Your Radar overview") : BRIEF_LABELS[section][language]}</h2>
            <p>
              {t("生成", "Generated")}:{" "}
              {new Date(preview.generatedAt).toLocaleString()} · {form.major}
            </p>
            </div><div><button type="button" className="text-button" disabled={busy} onClick={generate}>{busy ? "Refreshing…" : t("刷新简报", "Refresh brief")}</button><button className="text-button" onClick={() => setStep(1)}>
              {t("调整偏好", "Edit preferences")}
            </button><a className="button primary brief-subscribe-link" href="#brief-email">{form.emailDeliveryEnabled ? t("管理邮件订阅", "Manage morning emails") : t("订阅早间简报", "Get morning emails")}</a></div>
            </div>
            <nav className="brief-section-nav" aria-label="Brief sections">
              {navigation.map(page => (
                <Link key={page} href={briefPath(page)} aria-current={activePage === page ? "page" : undefined}>
                  {BRIEF_LABELS[page][language]}
                </Link>
              ))}
            </nav>
            <SourceReviewPanel preview={preview} />
            {section === "overview" && (
              <section className="radar-section" id="brief-overview">
                <p>{t("选择一个页面，专注查看一类机会。", "Choose a page to focus on one kind of opportunity.")}</p>
                <div className="brief-overview-grid">
                  {BRIEF_SECTIONS.filter(page => page !== "overview").map(page => {
                    const enabled = briefEnabled(page, form, pref);
                    return (
                      <article className="brief-overview-card" key={page}>
                        <h3>{BRIEF_LABELS[page][language]}</h3>
                        <p>{!enabled
                          ? t("尚未开启", "Not enabled yet")
                          : counts[page] !== undefined
                            ? t(`${counts[page]} 条结果`, `${counts[page]} available`)
                            : t("管理你的 Radar", "Manage your Radar")}</p>
                        {enabled ? (
                          <Link href={briefPath(page)}>{t("打开页面", "Open page")} →</Link>
                        ) : (
                          <button type="button" className="text-button" onClick={() => setStep(1)}>
                            {t("在偏好中开启", "Enable in preferences")} →
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {!activeEnabled && activePage !== "news" && (
              <section className="radar-section section-disabled">
                <h2>{t("此页面尚未开启", "This section is turned off")}</h2>
                <p>{t("在偏好中选择此方向，然后重新生成简报。", "Enable this interest in your preferences, then rebuild your brief.")}</p>
                <button type="button" className="button primary" onClick={() => setStep(1)}>
                  {t("调整偏好", "Edit preferences")}
                </button>
              </section>
            )}
            {section === "deadlines" && (
            <section className={courseConnected || courseItems.length ? "radar-section course-reminders" : "course-connect-note"} id="brief-deadlines">
              {courseConnected || courseItems.length ? <>
                <div className="course-section-heading"><div><p className="eyebrow">COURSES · NEXT 14 DAYS</p><h2>{t("先别错过这些课程事项", "Keep your course deadlines in view")}</h2></div><button type="button" className="text-button" onClick={() => setStep(2)}>{t("管理 Canvas / DDL", "Manage Canvas / DDL")} ↗</button></div>
                {courseItems.length ? <ol className="course-reminder-list">{courseItems.map(item => <li key={`${item.id}-${item.when}`}><time dateTime={item.when!}>{courseTime(item.when!, preview.language)}</time><div><h3>{item.title}</h3><p>{item.nextAction}</p><small>{item.source}</small>{link(item.url) && <a href={link(item.url)} target="_blank" rel="noreferrer">{t("打开来源", "Open source")} ↗</a>}</div></li>)}</ol> : <p>{t("现有数据没有可显示的近期事项；这不代表没有作业，也可能是同步不完整。请回课程页面核实。", "No upcoming item in the available data. This does not mean you have no assignments; sync may be incomplete. Recheck your course page.")}</p>}
                <p className="field-note">{t("按美东时间显示。日历事项不一定都是作业；上传 .ics 是快照，不会自动读取之后的变更。已订阅邮件时，未来 72 小时内有课程事项也会触发早间提醒（沿用你的发送时间和周末设置）。", "Times are Eastern. Calendar items are not always assignments; an uploaded .ics is a snapshot. For email subscribers, a course item within 72 hours also triggers a morning reminder at your selected time, respecting weekend preferences.")}</p>
              </> : <p>{t("还想提醒课程 DDL？", "Want course deadline reminders too?")} <button type="button" className="text-button" onClick={() => setStep(2)}>{t("连接 Canvas 或添加 DDL", "Connect Canvas or add deadlines")} ↗</button> · {t("可选，不影响机会推荐。", "Optional. Your opportunity brief works without it.")}</p>}
            </section>
            )}
            {section === "research" && form.goals.includes("research") && (
              <section className="radar-section" id="brief-research">
                <p className="eyebrow">RESEARCH</p>
                <h2>{t("研究入口与实验室", "Research pathways & labs")}</h2>
                {preview.researchLabs.matches.map((lab) => (
                  <article className="opportunity-card" key={lab.id}>
                    <p className="eyebrow">
                      {lab.department} · {lab.statusLabel}
                    </p>
                    <h3>{lab.name}</h3>
                    <SourceStatus check={lab.verification} language={preview.language} />
                    <p>{lab.why}</p>
                    <p>{lab.areas.join(" / ")}</p>
                    <div className="brief-next-action"><span>{t("下一步", "NEXT STEP")}</span><p>{lab.nextAction}</p></div>
                    <a href={link(lab.url)} target="_blank" rel="noreferrer">
                      {t("查看官方页面", "View official page")} ↗
                    </a>
                    <p className="field-note">
                      Reviewed: {lab.verifiedAt}. A directory does not establish
                      an open position.
                    </p>
                    {feedback(lab.id)}
                  </article>
                ))}
                {!preview.researchLabs.matches.length && (
                  <p>
                    {t(
                      "当前覆盖中没有匹配入口。",
                      "No research pathway matched within current coverage.",
                    )}
                  </p>
                )}
              </section>
            )}
            {section === "funding" && form.goals.includes("scholarship") && (
              <section className="radar-section" id="brief-funding">
                <p className="eyebrow">SCHOLARSHIPS & FUNDING</p>
                <h2>{t("资助机会", "Funding to explore")}</h2>
                {preview.scholarships?.length ? (
                  preview.scholarships.map(card)
                ) : (
                  <p>
                    {t(
                      "当前没有符合已知条件的资助推荐。",
                      "No funding matched your known conditions in current coverage.",
                    )}
                  </p>
                )}
                <p className="field-note">
                  Public pages are checked on Monday mornings.
                </p>
              </section>
            )}
            {section === "careers" && form.goals.includes("internship") && (
              <CareerSection preview={preview} isUmichStudent={form.isUmichStudent} feedback={feedback} onRefresh={generate} busy={busy} />
            )}
            {(section === "news" || section === "business" || section === "tech") && <NewsSection section={section} preview={preview} preferences={pref} card={card} feedback={feedback} onEdit={() => setStep(1)} />}
            {section === "events" && activeEnabled && (
              <section className="radar-section" id="brief-events">
                <p className="eyebrow">U-M CAMPUS · OFFICIAL EVENTS + HANDSHAKE</p>
                <h2>{t("你的校园活动", "Your campus events")}</h2>
                <p>{t("按你的专业、兴趣与目标筛选 U-M 官网活动，并补充注明核查日期的 U-M Handshake 活动。", "U-M official events matched to your field, interests and goals, plus dated U-M Handshake event reviews.")}</p>
                {!form.goals.includes("events") && <p>{t("在 Goals 开启 Campus events 并重新生成，才能显示 U-M 校园活动。下方外校活动是独立的可选项。", "Enable Campus events in Goals and rebuild to see U-M events. Other-university events below are a separate optional choice.")}</p>}
                {form.goals.includes("events") && <>
                  {!form.isUmichStudent ? <p>{t("校内活动目前仅覆盖 U-M，不会将 U-M 专属活动推给其他学校学生。", "Campus-event coverage is currently U-M only. U-M-only events are not recommended to other schools.")}</p> : <>
                    {preview.discoveryStatus && <p className="field-note">{preview.discoveryStatus.campus.status === "unavailable" ? t("U-M 来源读取失败；这不代表没有活动。", "U-M source retrieval failed; this does not mean there are no events.") : t("来源读取时间", "Source fetched at") + ": " + preview.discoveryStatus.campus.checkedAt}</p>}
                    {preview.campusEvents === undefined ? <p>{t("旧简报尚未包含校园活动。点击 Refresh brief 获取新活动。", "This saved brief predates campus events. Select Refresh brief to fetch current events.")}</p> : preview.campusEvents.length ? preview.campusEvents.map((item: RadarItem) => <article className="opportunity-card" key={item.id}>
                      <p className="eyebrow">{item.source}</p><h3>{item.title}</h3><SourceStatus check={item.verification} language={preview.language}/><p>{item.why}</p>
                      <p className="field-note">{item.when && courseTime(item.when, preview.language)}{item.location ? ` · ${item.location}` : ""}</p><p>{item.nextAction}</p>
                      {item.url && <a href={link(item.url)} target="_blank" rel="noreferrer">{t("查看活动", "View original event")} ↗</a>}
                      {item.registrationUrl && item.registrationUrl !== item.url && <p><a href={link(item.registrationUrl)} target="_blank" rel="noreferrer">Handshake RSVP ↗</a></p>}
                      {item.reviewedAt && <p className="field-note">{t("人工核查", "Reviewed")}: {item.reviewedAt.slice(0,10)} · {t("请用自己的账号确认参加资格", "Confirm eligibility with your own account")}</p>}{feedback(item.id)}
                    </article>) : <p>{t("当前没有通过匹配和来源检查的校园活动。可刷新重试或调整兴趣；并非学校没有活动。", "No campus event passed matching and source checks. Refresh or adjust interests; this does not mean the campus has no events.")}</p>}
                    <button type="button" className="secondary-button" disabled={busy} onClick={generate}>{busy ? "Refreshing…" : "Refresh brief"}</button>
                  </>}
                </>}
                {pref.externalEventsEnabled && <><h3>{t("可选：其他学校公开活动", "Optional: beyond U-M")}</h3>
                {preview.externalEvents?.length ? (
                  preview.externalEvents.map(card)
                ) : (
                  <p>
                    {t(
                      "当前覆盖中没有相关的近期活动。",
                      "No relevant upcoming event in current coverage.",
                    )}
                  </p>
                )}
                </>}
              </section>
            )}
            {section === "ask" && (
            <section className="radar-section brief-ask" id="brief-ask">
              <p className="eyebrow">ASK RADAR</p>
              <h2>{t("问问你的机会雷达", "Ask about your shortlist")}</h2>
              <label>
                {t("你的问题", "Your question")}
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Which scholarships might I qualify for?"
                  maxLength={500}
                />
              </label>
              <button className="button primary" disabled={busy || !question.trim()} onClick={ask}>
                {busy ? "Working…" : "Ask Radar ↗"}
              </button>
              {answer && (
                <article className="opportunity-card">
                  <p>{answer.answer}</p>
                  {answer.bullets?.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                  {answer.sources?.map((source, i) => (
                    <p key={i}>
                      <a
                        href={link(source.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.label}
                      </a>
                    </p>
                  ))}
                </article>
              )}
            </section>
            )}
            <section className="radar-section brief-email" id="brief-email" aria-labelledby="brief-subscribe-title">
              <p className="eyebrow">YOUR EMAIL BRIEF</p>
              <h2 id="brief-subscribe-title">
                {t(
                  "喜欢这份简报？订阅早间提醒",
                  "Like your brief? Get morning updates",
                )}
              </h2>
              <p>{t("看完了？把下一份与你相关的机会简报送进邮箱。填写邮箱，勾选早间邮件，再保存即可；也可以继续只用网页版。", "Done reading? Get your next opportunity brief in your inbox. Confirm your email, select Send my morning brief, then save. Prefer the web? No subscription is required.")}</p>
              <EmailSetupFields form={form} onChange={patch} disabled={busy} />
              <button className="button primary" disabled={busy} onClick={generate}>
                {busy ? t("保存中…", "Saving…") : form.emailDeliveryEnabled ? t("保存邮件订阅", "Save email subscription") : t("保存邮件偏好", "Save email preferences")}
              </button>
              <p className="field-note">
                Unsubscribe in any email. Saving a subscription does not confirm
                delivery.
              </p>
            </section>
            {section === "email" && (
            <button className="danger" disabled={busy} onClick={remove}>
              Delete all data
            </button>
            )}
            <p className="field-note">{preview.attribution}</p>
          </div>
        )}
      </section>
    </div>
  );
}
