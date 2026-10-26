import type { BetaProfileInput, CareerEventSnapshot, CareerJob, CareerJobMatch, RadarItem } from "./types";

const words = (text: string) => ` ${text.toLowerCase().replace(/[_:/-]+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
const includesPhrase = (text: string, phrase: string) => text.includes(words(phrase));
const roleNames: Record<string,string> = { software_engineering:"Software engineering", ai_ml:"AI / ML", data_analytics:"Data & analytics", finance:"Finance", product_management:"Product management", consulting:"Consulting", ux_design:"UX / design", policy_social_impact:"Policy & social impact" };
export function careerJobVersion(job: CareerJob): string {
  // Review timestamps and generated summaries cannot make the same job new again.
  return JSON.stringify([job.id,job.url,job.title,job.company,job.status,job.deadline,job.startsAt,job.location,job.workMode,job.paid ?? null,job.sponsorship,job.sponsorshipEvidence.en,job.academicLevels.slice().sort(),job.requirements.en.slice().sort()]);
}
export function matchCareerJobs(jobs: CareerJob[], profile: BetaProfileInput, now = new Date(), hiddenIds: string[] = []): CareerJobMatch[] {
  if (!profile.goals.includes("internship")) return [];
  const target = words([profile.major,...profile.interests,profile.customInterest || ""].join(" "));
  const unique = new Map<string,CareerJobMatch>();
  const zh = profile.reportLanguage === "zh";
  for (const job of jobs) {
    const checked = Date.parse(job.reviewedAt), due = job.deadline ? Date.parse(job.deadline) : null;
    if (hiddenIds.includes(job.id) || job.status !== "open" || !Number.isFinite(checked) || checked > now.getTime() + 3600000 || now.getTime()-checked > 7*86400000 || (due !== null && (!Number.isFinite(due) || due < now.getTime()))) continue;
    if (job.academicLevels.length && !job.academicLevels.includes(profile.academicLevel)) continue;
    if (profile.paidOnly && job.paid !== true) continue;
    if (profile.sponsorship === "needed" && job.sponsorship === "not_offered") continue;
    let url: URL;
    try { url = new URL(job.url); } catch { continue; }
    const interstride = job.source === "Interstride" && url.hostname === "student.interstride.com" && /^\/jobs\/detail\/\d+$/.test(url.pathname) && !url.search;
    const employer = job.source === "Employer careers" && job.sourceMode === "live" && (
      ["boards.greenhouse.io","job-boards.greenhouse.io"].includes(url.hostname) && /^\/(?:figma|duolingo|datadog)\/jobs\/\d+$/.test(url.pathname) ||
      url.hostname === "careers.duolingo.com" && /^\/jobs\/\d+\/?$/.test(url.pathname) ||
      url.hostname === "careers.datadoghq.com" && /^\/detail\/\d+\/?$/.test(url.pathname));
    if (url.protocol !== "https:" || (!interstride && !employer) || url.username || url.password || url.port) continue;
    const hits = job.keywords.filter(term => includesPhrase(target,term)).slice(0,3);
    const tracks = (profile.roleTracks || []).filter(track => job.roleTracks.includes(track));
    if (!hits.length && !tracks.length) continue;
    const reasons = [...tracks.map(track => roleNames[track] || track), ...hits].slice(0,3);
    const sponsorshipLabel = ({
      explicit_role: zh ? "岗位明确支持 sponsorship" : "Role explicitly supports sponsorship",
      cpt_opt_and_fulltime: zh ? "实习接受 CPT/OPT；全职支持 sponsor" : "CPT/OPT interns; sponsorship for full-time roles",
      history_only: zh ? "仅有公司赞助历史；岗位待确认" : "Company sponsorship history only; confirm this role",
      unknown: zh ? "岗位 sponsorship 未说明" : "Sponsorship not specified for this role",
      not_offered: zh ? "岗位明确不提供 sponsorship" : "Role does not offer sponsorship",
    })[job.sponsorship];
    const checks = [...job.requirements[zh ? "zh" : "en"], zh ? "地点、技能和可参加时间尚未逐项匹配。" : "Location, skills and availability have not been fully matched."];
    if (job.paid === undefined) checks.push(zh ? "本次核查未确认薪酬，请查看原岗位。" : "Compensation was not verified in this review; check the original listing.");
    if (!job.deadline) checks.push(zh ? "未核实申请截止日期；请打开原岗位确认仍在招。" : "Application deadline is unverified; confirm the role is still open.");
    if (["unknown","history_only"].includes(job.sponsorship)) checks.push(job.sponsorshipEvidence[zh ? "zh" : "en"]);
    const match: CareerJobMatch = { ...job, sponsorshipLabel, checks,
      why: zh ? `与你填写的方向相关：${reasons.join(" / ")}。这是初筛候选，不代表所有要求都已满足。` : `Related to your stated direction: ${reasons.join(" / ")}. A first-pass candidate, not a determination that you meet every requirement.`,
      nextAction: zh ? "查看原岗位，确认仍开放及标注的门槛；合适再申请。" : "Open the original listing, confirm it is open and check the requirements before applying.",
      score: Math.min(99,35+hits.length*10+tracks.length*12+(profile.sponsorship === "needed" && ["explicit_role","cpt_opt_and_fulltime"].includes(job.sponsorship)?12:0)),
    };
    const old = unique.get(url.href);
    if (!old || match.score > old.score) unique.set(url.href,match);
  }
  const ranked=[...unique.values()].sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
  const companies=new Set<string>(),first:CareerJobMatch[]=[],rest:CareerJobMatch[]=[];
  for(const job of ranked){if(companies.has(job.company))rest.push(job);else{companies.add(job.company);first.push(job);}}
  return [...first,...rest].slice(0,3);
}

export function matchUmichCareerSnapshots(snapshots: CareerEventSnapshot[], profile: BetaProfileInput, now = new Date()): RadarItem[] {
  if (!profile.isUmichStudent || !profile.goals.some(goal=>["internship","events"].includes(goal))) return [];
  const target = words([profile.major,...profile.interests,...profile.roleTracks].join(" "));
  const zh = profile.reportLanguage === "zh";
  return snapshots.filter(item => !item.keywords.length || item.keywords.some(term => includesPhrase(target,term))).map(item => ({
    id:item.id,title:item.title,url:item.url,when:item.when,location:item.location,
    source:"U-M Handshake · reviewed event",campusScope:"umich" as const,kind:"career_event" as const,
    sourceMode:"verified_snapshot" as const,reviewedAt:item.reviewedAt,registrationUrl:item.url,
    why:item.summary[zh?"zh":"en"],nextAction:zh?"打开自己的 U-M Handshake，确认活动时间和 RSVP 要求；Radar 不会代你报名。":"Open your own U-M Handshake account, confirm the time and RSVP requirements. Radar does not register you.",
    confidence:"needs_verification" as const,score:item.keywords.length?76:65,
  })).filter(item => selectUmichCareerEvents([item],true,now).length > 0);
}

/** Public U-M feed events plus bounded, dated, source-read U-M Handshake snapshots. */
export function selectUmichCareerEvents(items: RadarItem[], isUmichStudent: boolean, now = new Date()): RadarItem[] {
  if (!isUmichStudent) return [];
  const unique = new Map<string,RadarItem>();
  for (const item of items) {
    if (item.kind !== "career_event" || item.campusScope !== "umich" || !item.url) continue;
    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:" || url.username || url.password || url.port) continue;
      if (url.hostname === "umich.joinhandshake.com" && /^\/stu\/events\/\d+$/.test(url.pathname)) {
        const reviewed = Date.parse(item.reviewedAt || ""), starts = Date.parse(item.when || "");
        if (item.sourceMode !== "verified_snapshot" || !Number.isFinite(reviewed) || reviewed > now.getTime()+3600000 || now.getTime()-reviewed > 7*86400000 || !Number.isFinite(starts) || starts < now.getTime() || starts > now.getTime()+14*86400000) continue;
      } else if (url.hostname !== "events.umich.edu") continue;
    } catch { continue; }
    const registrationId = item.registrationUrl?.match(/^https:\/\/umich\.joinhandshake\.com\/(?:stu|edu)\/events\/(\d+)(?:[/?#]|$)/)?.[1];
    const key = registrationId ? `handshake-${registrationId}` : item.id;
    if (!unique.has(key)) unique.set(key,item);
  }
  return [...unique.values()].sort((a,b)=>b.score-a.score).slice(0,3);
}
