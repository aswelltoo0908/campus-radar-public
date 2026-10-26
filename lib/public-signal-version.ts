import type { PublicSignal } from "./types";

/** Opportunity identity ignores collection times, page chrome and generated prose. */
export function publicSignalVersionKey(item: PublicSignal): string {
  if (
    !["scholarship", "event"].includes(item.category) ||
    !item.url ||
    !item.eligibility
  )
    return `${item.id}:${item.contentHash}:${item.availability}`;
  const e = item.eligibility;
  const clean = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  const sorted = (value: string[] | undefined) =>
    [...new Set((value || []).map(clean))].sort();
  return JSON.stringify({
    id: item.id,
    url: item.url,
    category: item.category,
    title: clean(item.title),
    availability: item.availability,
    deadline: item.deadline,
    opensAt: item.opensAt,
    amount: item.amount,
    eligibility: {
      umichOnly: e.umichOnly === true,
      academicLevel: e.academicLevel || null,
      visas: sorted(e.visas),
      regions: sorted(e.citizenshipRegions),
      transferOnly: e.transferOnly === true,
      stemPreferred: e.stemPreferred === true,
      school: e.school ? clean(e.school) : null,
      requirements: sorted(e.otherRequirements),
    },
  });
}
