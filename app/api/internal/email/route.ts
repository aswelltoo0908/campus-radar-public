import { env } from "cloudflare:workers";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { emailDeliveries, profiles, radarRuns, sources, feedback } from "../../../../db/schema";
import { decryptSecret } from "../../../../lib/server/crypto";
import { renderRadarEmail } from "../../../../lib/server/email-delivery";
import { buildRadarPreview, fetchCanvasApiDeadlines, fetchCanvasDeadlines, fetchGoogleCalendarItems, parseCanvasIcs, type ManualAcademicData } from "../../../../lib/server/radar";
import type { BetaProfileInput, RadarItem, RadarPreview } from "../../../../lib/types";
import { forwardedEmailItems } from "../../../../lib/server/forwarded-email";
import { unsubscribeUrl } from "../../../../lib/server/unsubscribe";
import { refreshPublicSignals } from "../../../../lib/server/public-signals";
import { parseOpportunityPreferences } from "../../../../lib/opportunity-matching";
import { selectBriefUpdates } from "../../../../lib/brief-updates";
import { verifyRadarPreview } from "../../../../lib/server/verify-preview";
import { stripAihotForStorage } from "../../../../lib/aihot-content";

function authorized(request: Request) {
  const expected = String((env as unknown as Record<string, unknown>).RADAR_EMAIL_AUTOMATION_SECRET ?? "");
  const received = request.headers.get("x-radar-secret") ?? "";
  return expected.length >= 24 && received === expected;
}

function easternNow() {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekend: parts.weekday === "Sat" || parts.weekday === "Sun" };
}

function profileInput(profile: typeof profiles.$inferSelect): BetaProfileInput {
  const goals = JSON.parse(profile.goalsJson) as string[];
  const interests = JSON.parse(profile.interestsJson) as string[];
  return {
    reportLanguage: profile.reportLanguage === "zh" ? "zh" : "en",
    deliveryEmail: profile.deliveryEmail,
    emailDeliveryEnabled: profile.emailDeliveryEnabled,
    forwardingEnabled: profile.forwardingEnabled,
    isUmichStudent: profile.isUmichStudent,
    school: profile.school,
    universityName: parseOpportunityPreferences(JSON.parse(profile.opportunityPreferencesJson)).universityName,
    major: profile.major,
    graduationYear: profile.graduationYear,
    academicLevel: profile.academicLevel === "graduate" ? "graduate" : "undergraduate",
    goals,
    interests,
    roleTracks: JSON.parse(profile.roleTracksJson) as string[],
    opportunityPreferences: parseOpportunityPreferences(JSON.parse(profile.opportunityPreferencesJson)),
    careerStage: profile.careerStage as BetaProfileInput["careerStage"],
    bottleneck: profile.bottleneck as BetaProfileInput["bottleneck"],
    customGoal: goals.find((value) => value.startsWith("other:"))?.slice(6),
    customInterest: interests.find((value) => value.startsWith("other:"))?.slice(6),
    sponsorship: profile.sponsorship as BetaProfileInput["sponsorship"],
    paidOnly: profile.paidOnly,
    deliveryTime: profile.deliveryTime,
    weekends: profile.weekends,
  };
}

async function refreshedPreview(profile: typeof profiles.$inferSelect): Promise<RadarPreview> {
  const db = getDb();
  const sourceRows = await db.select().from(sources).where(eq(sources.userEmail, profile.email));
  const byType = new Map(sourceRows.map((source) => [source.type, source]));
  let canvasItems: RadarItem[] = [];
  let googleItems: RadarItem[] = [];
  let academic: ManualAcademicData = { courses: [], deadlines: [] };
  const canvasFeed = byType.get("canvas_ics");
  if (canvasFeed?.encryptedConfig) try { canvasItems.push(...await fetchCanvasDeadlines(await decryptSecret(canvasFeed.encryptedConfig))); } catch { /* keep the report useful with remaining sources */ }
  const canvasUpload = byType.get("canvas_ics_upload");
  if (canvasUpload?.encryptedConfig) try { canvasItems.push(...parseCanvasIcs(await decryptSecret(canvasUpload.encryptedConfig))); } catch { /* keep the report useful with remaining sources */ }
  const canvasApi = byType.get("canvas_api");
  if (canvasApi?.encryptedConfig) try {
    const config = JSON.parse(await decryptSecret(canvasApi.encryptedConfig)) as { baseUrl: string; token: string };
    canvasItems.push(...await fetchCanvasApiDeadlines(config.baseUrl, config.token));
  } catch { /* keep the report useful with remaining sources */ }
  const google = byType.get("google_calendar_ics");
  if (google?.encryptedConfig) try { googleItems = await fetchGoogleCalendarItems(await decryptSecret(google.encryptedConfig)); } catch { /* keep the report useful with remaining sources */ }
  const manual = byType.get("manual_academic");
  if (manual?.encryptedConfig) try { academic = JSON.parse(await decryptSecret(manual.encryptedConfig)) as ManualAcademicData; } catch { /* ignore invalid historical data */ }
  const forwardedItems = profile.forwardingEnabled ? await forwardedEmailItems(profile.email, profile.reportLanguage === "zh" ? "zh" : "en") : [];
  const reactions=await db.select().from(feedback).where(eq(feedback.userEmail,profile.email));
  const hiddenIds=reactions.filter(row=>row.reaction==="irrelevant"||row.reaction==="hide_topic").map(row=>row.itemId);
  return buildRadarPreview(profileInput(profile), canvasItems, googleItems, { canvas: Boolean(canvasFeed || canvasUpload || canvasApi), googleCalendar: Boolean(google) }, academic, forwardedItems, hiddenIds);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const now = easternNow();
  await refreshPublicSignals();
  const activeProfiles = await db.select().from(profiles).where(and(eq(profiles.status, "active"), eq(profiles.emailDeliveryEnabled, true)));
  const messages: Array<{ deliveryId: number; to: string; subject: string; html: string; text: string }> = [];
  for (const profile of activeProfiles) {
    if (!profile.deliveryEmail || profile.deliveryTime > now.time || (now.weekend && !profile.weekends)) continue;
    const [existing] = await db.select().from(emailDeliveries).where(and(eq(emailDeliveries.userEmail, profile.email), eq(emailDeliveries.deliveryDate, now.date))).limit(1);
    if (existing?.status === "sent") continue;
    if (existing) {
      const [run] = await db.select().from(radarRuns).where(eq(radarRuns.id, existing.radarRunId)).limit(1);
      if (!run) continue;
      const safe = await verifyRadarPreview({...JSON.parse(run.outputJson),aihotOptIn:parseOpportunityPreferences(JSON.parse(profile.opportunityPreferencesJson)).aiNewsEnabled} as RadarPreview);
      messages.push({ deliveryId: existing.id, to: existing.deliveryEmail, ...renderRadarEmail(safe, profile.fullName, await unsubscribeUrl(existing.id)) });
      continue;
    }
    try {
      let preview = await refreshedPreview(profile);
      if (preview.formatVersion === 2) {
        const previous=await db.select({outputJson:radarRuns.outputJson}).from(radarRuns).where(and(eq(radarRuns.userEmail,profile.email),eq(radarRuns.status,"email_sent"))).orderBy(desc(radarRuns.id)).limit(50);
        const updates=selectBriefUpdates(preview,previous.map(row=>JSON.parse(row.outputJson) as RadarPreview));
        // Keep the full current shortlist in the email and mark only the changed/new
        // entries. A subscribed daily brief should not disappear just because the
        // current recommendations were already included in an earlier send.
        preview={...preview,emailUpdates:{scholarships:updates.scholarships,businessNews:updates.businessNews,aiNews:updates.aiNews,externalEvents:updates.externalEvents,researchLabs:updates.researchLabs,opportunities:updates.opportunities,careerJobs:updates.careerJobs,umichCareerEvents:updates.umichCareerEvents,campusEvents:updates.campusEvents}};
      }
      const [run] = await db.insert(radarRuns).values({ userEmail: profile.email, status: "email_pending", outputJson: JSON.stringify(stripAihotForStorage(preview)), sourceCount: preview.actions.length + preview.opportunities.length }).returning({ id: radarRuns.id });
      const [delivery] = await db.insert(emailDeliveries).values({ userEmail: profile.email, deliveryDate: now.date, radarRunId: run.id, deliveryEmail: profile.deliveryEmail, status: "pending" }).returning({ id: emailDeliveries.id });
      messages.push({ deliveryId: delivery.id, to: profile.deliveryEmail, ...renderRadarEmail(preview, profile.fullName, await unsubscribeUrl(delivery.id)) });
    } catch (error) {
      console.error("Daily Radar generation failed", profile.email, error);
    }
  }
  return Response.json({ generatedAt: new Date().toISOString(), messages });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { deliveryId?: number; success?: boolean; error?: string; heartbeat?: boolean; action?: string; userEmail?: string };
  // Owner-operated maintenance uses the existing private automation credential.
  // This operation only opts out; it cannot subscribe users or delete data.
  if (body.action === "stop_subscription") {
    if (typeof body.userEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.userEmail) || body.userEmail.length > 254) {
      return Response.json({ error: "Invalid user email" }, { status: 400 });
    }
    const [profile] = await getDb().update(profiles).set({ emailDeliveryEnabled: false, updatedAt: new Date().toISOString() })
      .where(eq(profiles.email, body.userEmail))
      .returning({ email: profiles.email, emailDeliveryEnabled: profiles.emailDeliveryEnabled });
    if (!profile) return Response.json({ error: "User not found" }, { status: 404 });
    return Response.json({ ok: true, ...profile });
  }
  if (body.heartbeat === true) {
    const now = new Date().toISOString();
    await getDb().insert(sources).values({ userEmail: "__radar_system__", type: "mailer_health", status: "connected", lastSyncedAt: now }).onConflictDoUpdate({ target: [sources.userEmail, sources.type], set: { status: "connected", lastSyncedAt: now, updatedAt: now } });
    return Response.json({ ok: true });
  }
  if (!Number.isInteger(body.deliveryId)) return Response.json({ error: "Invalid delivery id" }, { status: 400 });
  const db = getDb();
  const [delivery] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, Number(body.deliveryId))).limit(1);
  if (!delivery) return Response.json({ error: "Delivery not found" }, { status: 404 });
  const sentAt = body.success ? new Date().toISOString() : null;
  await db.update(emailDeliveries).set({ status: body.success ? "sent" : "failed", sentAt, lastError: body.success ? null : String(body.error ?? "Gmail send failed").slice(0, 500) }).where(eq(emailDeliveries.id, delivery.id));
  await db.update(radarRuns).set({ status: body.success ? "email_sent" : "email_failed", sentAt }).where(eq(radarRuns.id, delivery.radarRunId));
  return Response.json({ ok: true });
}
