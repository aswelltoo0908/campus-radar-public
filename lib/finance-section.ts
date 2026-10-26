import type { PublicSignal } from "./types";
import { canonicalPublicUrl } from "./opportunity-matching";

/** Public company and stock information; never connect brokerage accounts. */
export type FinancePreferences = {
  companies: string[];
  industries: string[];
  maxItems?: number;
};
export function buildFinanceSection(
  signals: PublicSignal[],
  preferences: FinancePreferences,
  now = new Date(),
) {
  const terms = [...preferences.companies, ...preferences.industries]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  return signals
    .filter(
      (signal) =>
        signal.category === "business_news" &&
        signal.channel === "finance" &&
        signal.publishedAt &&
        Date.parse(signal.publishedAt) <= now.getTime() &&
        Date.parse(signal.publishedAt) >= now.getTime() - 7 * 86400000,
    )
    .map((signal) => ({
      ...signal,
      url: canonicalPublicUrl(signal.url),
      relevance: terms.filter((term) =>
        `${signal.title} ${signal.summary} ${signal.topics.join(" ")}`
          .toLowerCase()
          .includes(term),
      ).length,
    }))
    .filter((signal) => {
      if (!signal.url || seen.has(signal.url)) return false;
      seen.add(signal.url);
      return !terms.length || signal.relevance > 0;
    })
    .sort(
      (a, b) =>
        b.relevance - a.relevance ||
        Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!),
    )
    .slice(0, Math.min(10, Math.max(1, preferences.maxItems ?? 3)));
}
