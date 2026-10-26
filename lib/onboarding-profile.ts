import type { BetaProfileInput } from "./types";
import { isUmichUniversity, parseOpportunityPreferences } from "./opportunity-matching";

export type RadarSetupForm = BetaProfileInput & {
  keepCanvasConnection?: boolean;
  keepCanvasApiConnection?: boolean;
  keepGoogleCalendarConnection?: boolean;
};
export type SourceSummary = { type: string; status: string; displayLabel?: string; eventCount?: number; lastSyncedAt?: string | null };

/** Never hydrate secrets into the browser; source metadata only establishes retention. */
export function hydrateRadarForm(initial: RadarSetupForm, saved: Partial<BetaProfileInput> | null, sources: SourceSummary[] = []): RadarSetupForm {
  const has = (...types: string[]) => sources.some(source => types.includes(source.type));
  const goals = saved?.goals || initial.goals;
  const interests = saved?.interests || initial.interests;
  return {
    ...initial, ...saved,
    universityName: saved?.universityName ?? saved?.opportunityPreferences?.universityName ?? (saved?.isUmichStudent ? "University of Michigan" : saved ? saved.school || "" : initial.universityName || ""),
    goals: goals.filter(value => !value.startsWith("other:")),
    interests: interests.filter(value => !value.startsWith("other:")),
    customGoal: goals.find(value => value.startsWith("other:"))?.slice(6) || saved?.customGoal || "",
    customInterest: interests.find(value => value.startsWith("other:"))?.slice(6) || saved?.customInterest || "",
    opportunityPreferences: parseOpportunityPreferences(saved?.opportunityPreferences || initial.opportunityPreferences),
    canvasFeedUrl: "", canvasIcsText: "", canvasApiToken: "", canvasBaseUrl: "",
    googleCalendarFeedUrl: "", courseScheduleText: "", assignmentDeadlinesText: "",
    keepCanvasConnection: has("canvas_ics", "canvas_ics_upload"),
    keepCanvasApiConnection: has("canvas_api"),
    keepGoogleCalendarConnection: has("google_calendar_ics"),
    keepManualAcademicData: true,
  };
}

/** A new token needs an instance URL; tokens do not encode the student's school. */
export function radarSetupPayload(form: RadarSetupForm): RadarSetupForm {
  const universityName=form.universityName?.replace(/\s+/g, " ").trim();
  const isUmichStudent=universityName === undefined ? form.isUmichStudent : isUmichUniversity(universityName);
  return {
    ...form,
    ...(universityName === undefined ? {} : {universityName,opportunityPreferences:{...parseOpportunityPreferences(form.opportunityPreferences),universityName}}),
    isUmichStudent,
    canvasBaseUrl: form.canvasApiToken?.trim()
      ? form.canvasBaseUrl?.trim() || (isUmichStudent ? "https://umich.instructure.com" : "")
      : undefined,
  };
}

export function validateSetupStep(form: RadarSetupForm, step: number): string | null {
  if (step === 0 && (!form.major.trim() || !(form.universityName === undefined ? form.school.trim() : form.universityName.trim()) || !/^20\d{2}$/.test(form.graduationYear)))
    return "Add your university's full name, major and a four-digit graduation year.";
  if (step === 1 && !form.goals.length && !form.customGoal?.trim()) return "Choose at least one goal.";
  if (step === 2) {
    if (form.emailDeliveryEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.deliveryEmail.trim())) return "Enter a valid report delivery email, or turn off morning emails.";
    if (form.canvasApiToken?.trim() && !radarSetupPayload(form).canvasBaseUrl) return "Add your school's Canvas instance URL for API access.";
  }
  return null;
}
