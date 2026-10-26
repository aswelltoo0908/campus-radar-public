import type { RadarItem, RadarPreview } from "./types";

/** Only explicitly connected/supplied course data; never infer an assignment date. */
export function courseReminders(preview: RadarPreview, now = new Date()): RadarItem[] {
  const start = now.getTime(), end = start + 14 * 86_400_000;
  const candidates = [
    ...(preview.canvas?.upcoming || []),
    ...(preview.academic?.upcoming || []),
    ...(preview.actions || []).filter(item => /^(Canvas\b|Course deadline$|课程 DDL$)/i.test(item.source)),
  ];
  const unique = new Map<string, RadarItem>();
  for (const item of candidates) {
    const due = item.when ? Date.parse(item.when) : NaN;
    if (!Number.isFinite(due) || due < start || due > end) continue;
    const key = `${item.title.trim().toLowerCase().replace(/\s+/g, " ")}|${due}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort((a,b) => Date.parse(a.when!) - Date.parse(b.when!));
}

export function hasUrgentCourseReminders(preview: RadarPreview, now = new Date()) {
  return courseReminders(preview, now).some(item => Date.parse(item.when!) <= now.getTime() + 72 * 3_600_000);
}

export function courseTime(when: string, language: "en" | "zh") {
  const date = new Date(when);
  if (!Number.isFinite(date.getTime())) return when;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date) + (language === "zh" ? "（美东）" : " ET");
}
