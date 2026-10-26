import type { ReactNode } from "react";
import type { RadarPreview } from "../../lib/types";
import { courseTime } from "../../lib/course-reminders";
import { SourceStatus } from "./SourceStatus";

const safeLink = (value: string | null | undefined) => value && /^https:\/\//.test(value) ? value : undefined;

/** Source-read internship snapshots and U-M events are separate, not account connections. */
export default function CareerSection({ preview, isUmichStudent, feedback, onRefresh, busy }: {
  preview: RadarPreview;
  isUmichStudent: boolean;
  feedback: (id: string) => ReactNode;
  onRefresh: () => void;
  busy: boolean;
}) {
  const zh = preview.language === "zh", t = (cn: string, en: string) => zh ? cn : en;
  const language = zh ? "zh" : "en";
  const jobs = preview.careerJobs || [];
  const events = isUmichStudent ? preview.umichCareerEvents || [] : [];
  const forwarded = (preview.forwardedEmails || []).filter(item => /career|intern|recruit|job|handshake|interstride|招聘|实习/i.test(`${item.title} ${item.source}`)).slice(0, 3);
  const historical = preview.careerJobs === undefined;
  return <section className="radar-section career-section" id="brief-careers">
    <p className="eyebrow">INTERNSHIPS & CAREER SIGNALS</p>
    <h2>{t("从方向到下一步", "From your interests to your next move")}</h2>
    <p>{t("先用你的专业、兴趣和 sponsorship 偏好做初筛，不增加问卷。年级、GPA、技能和时间要求仍需本人核对。", "A first pass using your field, interests and sponsorship preference—no extra questionnaire. Year level, GPA, skills and availability still need your confirmation.")}</p>
    <div className="career-coverage"><span>{t("公司官网招聘源 + Interstride 核查快照", "Employer career feeds + reviewed Interstride snapshots")}</span><span>{t("Handshake 活动 · 仅 U-M", "Handshake events · U-M only")}</span></div>
    {preview.discoveryStatus?.careers && <div className="career-coverage-status"><p>{t("本次来源读取", "Source collection")}: {preview.discoveryStatus.careers.checkedAt} · {preview.discoveryStatus.careers.candidates} {t("条官网实习候选", "employer internship candidates before profile filtering")}</p><p className="field-note">{preview.discoveryStatus.careers.sources.map(source=>`${source.name}: ${source.status === "live" ? source.count + " internships" : "unavailable"}`).join(" · ")}</p></div>}
    <h3 className="career-lane-title">{t("值得核对的实习", "Internships worth a closer look")}</h3>
    {preview.discoveryStatus?.careers.paidOnly && <p className="field-note">{t("已开启：仅看已确认带薪。薪酬未知的岗位会被排除；可在 Goals 调整。", "Active filter: verified paid internships only. Roles with unknown pay are excluded; change this in Goals.")}</p>}
    <p className="field-note">{t("公司官网来源在生成简报时读取，最多缓存一小时；另保留 7 天内核查的 Interstride 候选。按方向、学历、sponsorship 和带薪偏好初筛，不代表覆盖所有公司或已确认全部资格。", "Employer feeds are read when building a brief, with up to one hour of shared caching; reviewed Interstride candidates remain valid for seven days. Screening uses field, degree level, sponsorship and paid-only preferences—not a full job database or a guarantee of eligibility.")}</p>
    {historical ? <div className="career-empty"><p>{t("这份已保存简报早于实习试运行。重新生成后，才能按你的现有画像初筛岗位。", "This saved brief predates the internship pilot. Rebuild it to screen the pilot listings against your existing profile.")}</p><button type="button" className="secondary-button" onClick={onRefresh} disabled={busy}>{t("更新我的简报", "Refresh my brief")}</button></div> : jobs.length ? jobs.map(job => <article className="opportunity-card career-job" key={job.id}>
      <p className="eyebrow">{job.company} · INTERNSHIP</p>
      <h3>{job.title}</h3>
      <SourceStatus check={job.verification} language={preview.language} />
      <div className="opportunity-meta"><span>{job.location}</span><span>{job.sponsorshipLabel}</span>{job.paid === true && <span>{t("带薪岗位", "Paid role")}</span>}{job.startsAt && <span>{t("开始", "Starts")}: {job.startsAt}</span>}</div>
      <p>{job.summary[language]}</p>
      <p className="career-match-reason">{job.why}</p>
      <p className="field-note">{job.sponsorshipEvidence[language]}</p>
      <details className="career-checks"><summary>{t("申请前需确认", "Check before applying")} · {job.checks.length}</summary><ul>{job.checks.map((check, index) => <li key={index}>{check}</li>)}</ul></details>
      <div className="brief-next-action"><span>{t("下一步", "NEXT STEP")}</span><p>{job.nextAction}</p></div>
      <a href={safeLink(job.url)} target="_blank" rel="noreferrer">{job.source === "Employer careers" ? t("查看雇主原岗位", "View original employer listing") : t("查看 Interstride 原岗位", "View original Interstride listing")} ↗</a>
      <p className="field-note">{job.sourceMode === "live" ? t("公司官网读取", "Employer feed fetched") : t("人工核查快照", "Reviewed snapshot")} · {job.reviewedAt.slice(0, 10)} · {t("开放状态以原岗位为准", "Recheck availability at the source")}</p>
      {feedback(job.id)}
    </article>) : <p className="career-empty">{t("当前小范围岗位池没有与你的已知方向匹配且在核查有效期内的候选。这不代表没有适合你的实习；Radar 不会为了凑数推荐。", "No recently reviewed listing in this small pilot pool matches your stated direction. This does not mean no suitable internships exist; Radar will not fill the gap with unrelated jobs.")}</p>}

    <h3 className="career-lane-title">{t("U-M 职业活动", "U-M career events")}</h3>
    <p className="field-note">{t("包含 U-M 官方活动源及注明核查日期的 U-M Handshake 活动快照，不是全量自动同步。不会读取个人收藏或申请记录，也不覆盖其他学校的 Handshake 活动。", "U-M’s official event feed plus dated, reviewed U-M Handshake event snapshots—not a full automatic sync. No saved jobs or application records are read; other schools’ Handshake events are not covered.")}</p>
    {!isUmichStudent ? <p className="career-empty">{t("当前校内职业活动仅覆盖 U-M，因此不会给你推送 U-M 专属活动。实习试运行仍可按方向初筛。", "Campus career-event coverage is U-M only, so U-M-specific events are not recommended to you. The internship pilot can still screen by your interests.")}</p> : events.length ? events.map(item => <article className="opportunity-card" key={item.id}>
      <p className="eyebrow">U-M · {safeLink(item.registrationUrl) ? "HANDSHAKE REGISTRATION" : "OFFICIAL CAREER EVENT"}</p><h3>{item.title}</h3><SourceStatus check={item.verification} language={preview.language}/><p>{item.why}</p>
      <div className="opportunity-meta">{item.when && <span>{courseTime(item.when,preview.language)}</span>}{item.location && <span>{item.location}</span>}</div><p>{item.nextAction}</p>
      <div className="hero-actions"><a href={safeLink(item.url)} target="_blank" rel="noreferrer">{safeLink(item.registrationUrl) === safeLink(item.url) ? t("查看 Handshake 活动 / 报名", "View Handshake event / RSVP") : t("查看官方活动", "View official event")} ↗</a>{safeLink(item.registrationUrl) && item.registrationUrl !== item.url && <a href={safeLink(item.registrationUrl)} target="_blank" rel="noreferrer">{t("Handshake 报名", "Handshake registration")} ↗</a>}</div>{item.sourceMode === "verified_snapshot" && <p className="field-note">{t("人工核查活动快照", "Reviewed event snapshot")} · {item.reviewedAt?.slice(0,10)} · {t("请回源确认时间与资格", "Confirm timing and eligibility at the source")}</p>}{feedback(item.id)}
    </article>) : <p className="career-empty">{preview.umichSourceMode === "unavailable" ? t("U-M 活动源暂时无法读取，因此没有可核实的活动推荐。这不代表学校没有活动。", "The U-M event source is temporarily unavailable, so there are no verified event recommendations here. This does not mean no events exist.") : t("这份简报中没有与你目标匹配的 U-M 职业活动。", "No U-M career event matched your goals in this brief.")}</p>}

    {forwarded.length > 0 && <><h3 className="career-lane-title">{t("你转发的招聘信息", "Recruiting messages you forwarded")}</h3>{forwarded.map(item => <article className="opportunity-card" key={item.id}><h3>{item.title}</h3><p>{item.why}</p><p>{item.nextAction}</p>{safeLink(item.url) && <a href={safeLink(item.url)} target="_blank" rel="noreferrer">{t("查看来源", "View source")} ↗</a>}{feedback(item.id)}</article>)}</>}
    <div className="hero-actions career-originals"><a href={isUmichStudent ? "https://umich.joinhandshake.com/" : "https://app.joinhandshake.com/"} target="_blank" rel="noreferrer">Open Handshake ↗</a><a href="https://student.interstride.com/" target="_blank" rel="noreferrer">Open Interstride ↗</a></div>
  </section>;
}
