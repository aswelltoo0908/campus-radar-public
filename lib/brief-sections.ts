import type { BetaProfileInput, OpportunityPreferences, RadarPreview } from "./types";

export const BRIEF_SECTIONS = [
  "overview", "research", "funding", "careers", "news",
  "events", "deadlines", "ask", "email",
] as const;

export const NEWS_SECTIONS = ["tech", "business"] as const;
export type NewsSection = (typeof NEWS_SECTIONS)[number];
export type BriefSection = (typeof BRIEF_SECTIONS)[number] | NewsSection;

export const BRIEF_LABELS: Record<BriefSection, { en: string; zh: string }> = {
  overview: { en: "Overview", zh: "总览" },
  research: { en: "Research", zh: "研究" },
  funding: { en: "Funding", zh: "资助" },
  careers: { en: "Careers", zh: "实习" },
  news: { en: "News", zh: "资讯" },
  business: { en: "Business", zh: "商业" },
  tech: { en: "Tech", zh: "科技" },
  events: { en: "Events", zh: "活动" },
  deadlines: { en: "Course deadlines", zh: "课程与 DDL" },
  ask: { en: "Ask Radar", zh: "问问 Radar" },
  email: { en: "Email preferences", zh: "邮件偏好" },
};

export function isBriefSection(value: string): value is BriefSection {
  return BRIEF_SECTIONS.some(section => section === value);
}

export function briefPath(section: BriefSection): string {
  if (isNewsSection(section)) return `/beta/news/${section}`;
  return section === "overview" ? "/beta" : `/beta/${section}`;
}

export function isNewsSection(value: string): value is NewsSection {
  return NEWS_SECTIONS.some(section => section === value);
}

export function parentBriefSection(section: BriefSection): BriefSection {
  return isNewsSection(section) ? "news" : section;
}

/** Login handoff accepts known workspace destinations only, never arbitrary URLs. */
export function briefReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/beta";
  const allowed = [...BRIEF_SECTIONS.map(briefPath), ...NEWS_SECTIONS.map(briefPath), "/beta/settings", "/admin"];
  return allowed.includes(value) ? value : "/beta";
}

export function briefEnabled(
  section: BriefSection,
  profile: Pick<BetaProfileInput, "goals">,
  preferences: OpportunityPreferences,
): boolean {
  switch (section) {
    case "research": return profile.goals.includes("research");
    case "funding": return profile.goals.includes("scholarship");
    case "careers": return profile.goals.includes("internship");
    case "business": return preferences.newsEnabled;
    case "tech": return preferences.aiNewsEnabled;
    case "events": return profile.goals.includes("events") || preferences.externalEventsEnabled;
    default: return true;
  }
}

export function briefCounts(preview: RadarPreview): Partial<Record<BriefSection, number>> {
  return {
    research: preview.researchLabs.matches.length,
    funding: preview.scholarships?.length ?? 0,
    careers: (preview.careerJobs?.length ?? 0) + (preview.umichCareerEvents?.length ?? 0),
    news: (preview.businessNews?.length ?? 0) + (preview.aiNews?.length ?? 0),
    events: (preview.campusEvents?.length ?? 0) + (preview.externalEvents?.length ?? 0),
  };
}
