import type { BetaProfileInput, RadarPreview } from "./types";
type SourceSummary = {
  type: string;
  status: string;
  displayLabel: string;
  eventCount: number;
  label: string;
  url: string | null;
};
/** Typed responses from the same-origin Beta API; route authorization remains server-side. */
export type BetaApiResponse = {
  error: string;
  answer: string;
  bullets: string[];
  sources: SourceSummary[];
  profile: BetaProfileInput | null;
  latestPreview: { id: number; preview: RadarPreview } | null;
  preview: RadarPreview;
  runId: number;
  mailerReady: boolean;
  forwardingEnabled: boolean;
  radarInboxAddress: string | null;
  radarInboxConfigured: boolean;
  forwardingConfirmationUrl: string | null;
};
export async function readBetaResponse(
  response: Response,
): Promise<BetaApiResponse> {
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Unexpected Campus Radar response.");
  return data as BetaApiResponse;
}
