import {
  BUSINESS_CHANNELS,
  type OpportunityPreferences,
  type BetaProfileInput,
  type OpportunityMatch,
  type PublicSignal,
} from "./types";
export const DEFAULT_PREFERENCES: OpportunityPreferences = {
  visa: "unknown",
  citizenshipRegion: "unknown",
  transferStudent: "unknown",
  stem: "unknown",
  newsEnabled: false,
  newsChannels: [],
  aiNewsEnabled: false,
  externalEventsEnabled: false,
};
/** Exact campus aliases only: Michigan State, Flint and Dearborn are not Ann Arbor. */
export function isUmichUniversity(value: string): boolean {
  return ["university of michigan", "university of michigan ann arbor", "umich", "u mich", "密歇根大学", "密歇根大学安娜堡分校", "密歇根大学安娜堡"]
    .includes(value.toLowerCase().replace(/[.,·—–-]/g, " ").replace(/\s+/g, " ").trim());
}
export function parseOpportunityPreferences(
  value: unknown,
): OpportunityPreferences {
  const data = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const pick = <T extends string>(
    key: string,
    choices: readonly T[],
    fallback: T,
  ): T => (choices.includes(data[key] as T) ? (data[key] as T) : fallback);
  return {
    ...(typeof data.universityName === "string" ? {universityName: data.universityName.replace(/\s+/g, " ").trim().slice(0, 160)} : {}),
    visa: pick(
      "visa",
      ["f1", "j1", "us_citizen_or_pr", "other", "unknown"],
      "unknown",
    ),
    citizenshipRegion: pick(
      "citizenshipRegion",
      ["asia", "africa", "other", "unknown"],
      "unknown",
    ),
    transferStudent: pick(
      "transferStudent",
      ["yes", "no", "unknown"],
      "unknown",
    ),
    stem: pick("stem", ["yes", "no", "unknown"], "unknown"),
    newsEnabled: data.newsEnabled === true,
    newsChannels: Array.isArray(data.newsChannels)
      ? [
          ...new Set(
            data.newsChannels.filter(
              (x): x is (typeof BUSINESS_CHANNELS)[number] =>
                BUSINESS_CHANNELS.includes(
                  x as (typeof BUSINESS_CHANNELS)[number],
                ),
            ),
          ),
        ].slice(0, 6)
      : [],
    aiNewsEnabled: data.aiNewsEnabled === true,
    externalEventsEnabled: data.externalEventsEnabled === true,
  };
}
export function canonicalPublicUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !url.hostname.includes(".") ||
      /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)
    )
      return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return null;
  }
}
// A date-only deadline ends on that Eastern calendar day; no next-day grace window.
function expired(value: string, now: Date) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value < new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  return !Number.isFinite(Date.parse(value)) || Date.parse(value) < now.getTime();
}
export function matchPublicSignals(
  signals: PublicSignal[],
  profile: BetaProfileInput,
  now = new Date(),
): OpportunityMatch[] {
  const pref = parseOpportunityPreferences(profile.opportunityPreferences),
    zh = profile.reportLanguage === "zh";
  const unique = new Map<string, OpportunityMatch>();
  for (const signal of signals) {
    const e = signal.eligibility;
    if (
      signal.availability === "closed" || signal.availability === "needs_review" ||
      (signal.deadline && expired(signal.deadline, now))
    )
      continue;
    if (
      (e.umichOnly && !profile.isUmichStudent) ||
      (e.academicLevel && profile.academicLevel !== e.academicLevel)
    )
      continue;
    if (e.visas && pref.visa !== "unknown" && !e.visas.includes(pref.visa))
      continue;
    if (
      e.citizenshipRegions &&
      pref.citizenshipRegion !== "unknown" &&
      !e.citizenshipRegions.includes(pref.citizenshipRegion)
    )
      continue;
    if (
      (e.transferOnly && pref.transferStudent === "no") ||
      (e.school &&
        !profile.school.toLowerCase().includes(e.school.toLowerCase()))
    )
      continue;
    if (
      signal.category === "scholarship" &&
      !profile.goals.includes("scholarship")
    )
      continue;
    if (
      signal.category === "business_news" &&
      (!pref.newsEnabled ||
        !signal.channel ||
        !pref.newsChannels.includes(signal.channel))
    )
      continue;
    if (
      (signal.category === "ai_news" && !pref.aiNewsEnabled) ||
      (signal.category === "event" && !pref.externalEventsEnabled)
    )
      continue;
    if (
      ["business_news", "ai_news"].includes(signal.category) &&
      (!(signal.publishedAt || signal.sourceId === "aihot" && signal.discoveredAt) ||
        Date.parse(signal.publishedAt || signal.discoveredAt!) > now.getTime() + 86400000 ||
        Date.parse(signal.publishedAt || signal.discoveredAt!) < now.getTime() - 7 * 86400000)
    )
      continue;
    const unknown = [...e.otherRequirements];
    if (e.visas && pref.visa === "unknown")
      unknown.push(
        zh ? "签证/身份条件未填写" : "Visa/residency status is unknown",
      );
    if (e.citizenshipRegions && pref.citizenshipRegion === "unknown")
      unknown.push(zh ? "国籍地区条件未填写" : "Citizenship region is unknown");
    if (e.transferOnly && pref.transferStudent === "unknown")
      unknown.push(
        zh ? "需确认转学生资格" : "Transfer eligibility needs confirmation",
      );
    const keywords = [profile.major, ...profile.interests]
      .map((x) => x.toLowerCase())
      .filter(Boolean);
    const hits = signal.topics
      .filter((t) =>
        keywords.some(
          (k) => k.includes(t.toLowerCase()) || t.toLowerCase().includes(k),
        ),
      )
      .slice(0, 3);
    if (
      signal.category === "event" &&
      (!signal.opensAt ||
        expired(signal.opensAt, now) ||
        Date.parse(signal.opensAt) > now.getTime() + 14 * 86400000 ||
        !hits.length)
    )
      continue;
    const score =
      30 +
      hits.length * 10 +
      (e.umichOnly ? 10 : 0) +
      (signal.availability === "open" ? 10 : 0) +
      (e.stemPreferred && pref.stem === "yes" ? 8 : 0);
    const why = zh
      ? `${signal.category === "scholarship" ? "与你选择的资助目标相关" : "与你选择的资讯方向相关"}${hits.length ? `；相关方向：${hits.join(" / ")}` : ""}。`
      : `${signal.category === "scholarship" ? "Matches your funding goal" : "Matches a topic you chose"}${hits.length ? `; topics: ${hits.join(" / ")}` : ""}.`;
    const url = canonicalPublicUrl(signal.url);
    if (!url) continue;
    const row: OpportunityMatch = {
      ...signal,
      url,
      why,
      unknownConditions: unknown,
      eligibilityStatus: unknown.length
        ? "needs_confirmation"
        : "potential_match",
      score,
      nextAction: signal.category.endsWith("news")
        ? zh
          ? "打开原始来源，记录与你目标相关的一项变化"
          : "Read the original source and note one change relevant to your goal"
        : zh
          ? "核对官方资格、开放时间与材料要求，再决定是否申请"
          : "Check official eligibility, dates and materials before applying",
    };
    const old = unique.get(url);
    if (!old || row.score > old.score || row.sourceId === "aihot" && row.score === old.score) unique.set(url, row);
  }
  return [...unique.values()].sort((a, b) => b.score - a.score || (a.category === "ai_news" && b.category === "ai_news" ? Date.parse(b.publishedAt || b.discoveredAt || "1970-01-01")-Date.parse(a.publishedAt || a.discoveredAt || "1970-01-01") : 0));
}
