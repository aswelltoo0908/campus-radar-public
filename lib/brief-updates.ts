import type { RadarPreview, OpportunityMatch } from "./types";
import { publicSignalVersionKey } from "./public-signal-version";
import { hasUrgentCourseReminders } from "./course-reminders";
import { careerJobVersion } from "./career-matching";
/** Compare content identity, not regenerated prose or collection timestamps. */
export function selectBriefUpdates(
  current: RadarPreview,
  previous: RadarPreview[],
): RadarPreview {
  const seen = new Set(
    previous.flatMap((report) =>
      [
        ...(report.scholarships || []),
        ...(report.businessNews || []),
        ...(report.aiNews || []),
        ...(report.externalEvents || []),
      ].map(publicSignalVersionKey),
    ),
  );
  const fresh = (items: OpportunityMatch[] | undefined) =>
    items?.filter((item) => !seen.has(publicSignalVersionKey(item)));
  for(const report of previous)for(const ref of report.aihotRefs || [])seen.add(`${ref.id}:${ref.contentHash}:open`);
  const labsSeen = new Set(
    previous.flatMap((report) =>
      (report.researchLabs?.matches || []).map(
        (lab) => `${lab.id}:${lab.verifiedAt}`,
      ),
    ),
  );
  const opportunitySeen = new Set(
    previous.flatMap((report) =>
      (report.opportunities || []).map((item) => `${item.id}:${item.when}`),
    ),
  );
  const careerSeen = new Set(previous.flatMap(report => (report.careerJobs || []).map(careerJobVersion)));
  const campusSeen = new Set(previous.flatMap(report => [...(report.umichCareerEvents || []),...(report.opportunities || [])].map(item => `${item.id}:${item.when}`)));
  const eventSeen = new Set(previous.flatMap(report => [...(report.campusEvents || []),...(report.umichCareerEvents || [])].map(item=>`${item.registrationUrl || item.url || item.id}:${item.when}`)));
  return {
    ...current,
    scholarships: fresh(current.scholarships),
    businessNews: fresh(current.businessNews),
    aiNews: fresh(current.aiNews),
    externalEvents: fresh(current.externalEvents),
    careerJobs: current.careerJobs?.filter(job => !careerSeen.has(careerJobVersion(job))),
    umichCareerEvents: current.umichCareerEvents?.filter(item => !campusSeen.has(`${item.id}:${item.when}`)),
    campusEvents: current.campusEvents?.filter(item=>!eventSeen.has(`${item.registrationUrl || item.url || item.id}:${item.when}`)),
    researchLabs: {
      ...current.researchLabs,
      matches: current.researchLabs.matches.filter(
        (lab) => !labsSeen.has(`${lab.id}:${lab.verifiedAt}`),
      ),
    },
    opportunities: current.opportunities.filter(
      (item) => !opportunitySeen.has(`${item.id}:${item.when}`),
    ),
  };
}
export function hasBriefUpdates(report: RadarPreview, now = new Date()) {
  const careerPattern = /career|intern|recruit|job|handshake|interstride|招聘|实习/i;
  const hasCareerSignal = report.umichCareerEvents === undefined
    ? report.opportunities.some(item => careerPattern.test(`${item.title} ${item.source}`))
    : (report.forwardedEmails || []).some(item => careerPattern.test(`${item.title} ${item.source}`) && report.opportunities.some(fresh => fresh.id === item.id));
  return Boolean(
    hasUrgentCourseReminders(report, now) ||
    report.careerJobs?.length ||
    report.umichCareerEvents?.length ||
    report.researchLabs.matches.length ||
    report.scholarships?.length ||
    report.businessNews?.length ||
    report.aiNews?.length ||
    report.externalEvents?.length ||
    report.campusEvents?.length ||
    hasCareerSignal,
  );
}
