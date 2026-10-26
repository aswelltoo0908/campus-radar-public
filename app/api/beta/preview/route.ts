import { eq, and, count } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { profiles, radarRuns, sources, feedback } from "../../../../db/schema";
import { decryptSecret, encryptSecret } from "../../../../lib/server/crypto";
import { buildRadarPreview, fetchCanvasApiDeadlines, fetchCanvasDeadlines, fetchGoogleCalendarItems, parseCanvasIcs, parseManualAcademicData, validateCanvasBaseUrl, validateCanvasFeedUrl, validateGoogleCalendarFeedUrl, type ManualAcademicData } from "../../../../lib/server/radar";
import type { BetaProfileInput } from "../../../../lib/types";
import { forwardedEmailItems } from "../../../../lib/server/forwarded-email";
import { radarInboxAddress } from "../../../../lib/server/email";
import { isUmichUniversity, parseOpportunityPreferences } from "../../../../lib/opportunity-matching";
import { stripAihotForStorage } from "../../../../lib/aihot-content";

const ALLOWED_GOALS = new Set(["internship", "events", "full_time", "research", "scholarship", "startup", "leadership", "networking", "graduate_school"]);
const ALLOWED_ROLE_TRACKS = new Set(["software_engineering", "ai_ml", "data_analytics", "product_management", "ux_design", "hardware_robotics", "academic_research", "consulting", "finance", "biotech_health", "climate_energy", "policy_social_impact", "entrepreneurship"]);
const ALLOWED_CAREER_STAGES = new Set(["exploring", "preparing", "applying", "interviewing", "deciding"]);
const ALLOWED_BOTTLENECKS = new Set(["direction", "finding", "resume", "networking", "applications", "interviews", "time"]);

function parseInput(payload: unknown): BetaProfileInput {
  const data = (payload ?? {}) as Record<string, unknown>;
  const school = String(data.school ?? "").trim().slice(0, 80);
  const preferences = parseOpportunityPreferences(data.opportunityPreferences);
  const universityName = String(data.universityName ?? preferences.universityName ?? (data.isUmichStudent !== false ? "University of Michigan" : school)).replace(/\s+/g, " ").trim().slice(0, 160);
  const isUmichStudent = isUmichUniversity(universityName);
  const reportLanguage = data.reportLanguage === "zh" ? "zh" : "en";
  const deliveryEmail = String(data.deliveryEmail ?? "").trim().toLowerCase().slice(0, 254);
  const emailDeliveryEnabled = Boolean(data.emailDeliveryEnabled);
  const forwardingEnabled = Boolean(data.forwardingEnabled);
  const major = String(data.major ?? "").trim().slice(0, 100);
  const graduationYear = String(data.graduationYear ?? "").trim();
  const goals = Array.isArray(data.goals) ? data.goals.map(String).filter((x) => ALLOWED_GOALS.has(x)).slice(0, 5) : [];
  const interests = Array.isArray(data.interests) ? data.interests.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 8) : [];
  const roleTracks = Array.isArray(data.roleTracks) ? data.roleTracks.map(String).filter((x) => ALLOWED_ROLE_TRACKS.has(x)).slice(0, 3) : [];
  const careerStage = ALLOWED_CAREER_STAGES.has(String(data.careerStage)) ? String(data.careerStage) as BetaProfileInput["careerStage"] : "exploring";
  const bottleneck = ALLOWED_BOTTLENECKS.has(String(data.bottleneck)) ? String(data.bottleneck) as BetaProfileInput["bottleneck"] : "finding";
  const customGoal = String(data.customGoal ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  const customInterest = String(data.customInterest ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (customGoal) goals.push(`other:${customGoal}`);
  if (customInterest) interests.push(`other:${customInterest.toLowerCase()}`);
  const deliveryTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(data.deliveryTime)) ? String(data.deliveryTime) : "07:30";
  const academicLevel = data.academicLevel === "graduate" ? "graduate" : "undergraduate";
  const sponsorship = ["needed", "not_needed", "unsure"].includes(String(data.sponsorship))
    ? data.sponsorship as BetaProfileInput["sponsorship"] : "unsure";
  if (!universityName || !major || !/^20\d{2}$/.test(graduationYear) || goals.length === 0) {
    throw new Error("Complete your university, major, graduation year, and at least one goal.");
  }
  if (emailDeliveryEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail)) throw new Error("Enter a valid report delivery email.");
  const canvasFeedUrl = String(data.canvasFeedUrl ?? "").trim();
  if (canvasFeedUrl) validateCanvasFeedUrl(canvasFeedUrl);
  const canvasIcsText = String(data.canvasIcsText ?? "").trim();
  if (canvasIcsText && (canvasIcsText.length > 2_000_000 || !canvasIcsText.includes("BEGIN:VCALENDAR"))) {
    throw new Error("Upload a valid Canvas .ics calendar file smaller than 2 MB.");
  }
  const canvasBaseUrl = String(data.canvasBaseUrl ?? "").trim();
  const canvasApiToken = String(data.canvasApiToken ?? "").trim();
  if (canvasApiToken && !canvasBaseUrl) throw new Error("A Canvas instance address is required for API access.");
  if (canvasBaseUrl) validateCanvasBaseUrl(canvasBaseUrl);
  if (canvasApiToken && (canvasApiToken.length < 20 || canvasApiToken.length > 500)) throw new Error("The Canvas API token format is invalid.");
  const googleCalendarFeedUrl = String(data.googleCalendarFeedUrl ?? "").trim();
  if (googleCalendarFeedUrl) validateGoogleCalendarFeedUrl(googleCalendarFeedUrl);
  const courseScheduleText = String(data.courseScheduleText ?? "").trim().slice(0, 12_000);
  const assignmentDeadlinesText = String(data.assignmentDeadlinesText ?? "").trim().slice(0, 20_000);
  return {
    reportLanguage, deliveryEmail, emailDeliveryEnabled, forwardingEnabled, isUmichStudent, school, major, graduationYear, goals, interests, roleTracks, careerStage, bottleneck, customGoal, customInterest, deliveryTime, academicLevel, sponsorship,
    universityName, opportunityPreferences: {...preferences,universityName},
    paidOnly: Boolean(data.paidOnly), weekends: Boolean(data.weekends), canvasFeedUrl: canvasFeedUrl || undefined, canvasIcsText: canvasIcsText || undefined,
    canvasBaseUrl: canvasBaseUrl || undefined, canvasApiToken: canvasApiToken || undefined,
    googleCalendarFeedUrl: googleCalendarFeedUrl || undefined,
    courseScheduleText, assignmentDeadlinesText, keepManualAcademicData: Boolean(data.keepManualAcademicData),
  };
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    const profile = parseInput(payload);
    const keepCanvasConnection = Boolean(payload.keepCanvasConnection);
    const keepCanvasApiConnection = Boolean(payload.keepCanvasApiConnection);
    const keepGoogleCalendarConnection = Boolean(payload.keepGoogleCalendarConnection);
    const keepManualAcademicData = Boolean(payload.keepManualAcademicData);
    const db = getDb();
    const [existingProfile] = await db.select({ email: profiles.email, inboundAlias: profiles.inboundAlias }).from(profiles).where(eq(profiles.email, user.email)).limit(1);
    if (!existingProfile) {
      const [pilot] = await db.select({ total: count() }).from(profiles);
      if ((pilot?.total ?? 0) >= 10) {
        return Response.json({ error: "The first 10 Beta spots are full. Contact the creator to join the next cohort." }, { status: 403 });
      }
    }
    const storedSources = await db.select().from(sources).where(eq(sources.userEmail, user.email));
    const storedByType = new Map(storedSources.map((source) => [source.type, source]));
    let canvasItems = profile.canvasIcsText ? parseCanvasIcs(profile.canvasIcsText) : profile.canvasFeedUrl ? await fetchCanvasDeadlines(profile.canvasFeedUrl) : [];
    let canvasConnected = Boolean(profile.canvasFeedUrl || profile.canvasIcsText);
    if (!profile.canvasFeedUrl && !profile.canvasIcsText && keepCanvasConnection) {
      const storedFeed = storedByType.get("canvas_ics");
      const storedUpload = storedByType.get("canvas_ics_upload");
      canvasConnected = Boolean(storedFeed || storedUpload);
      if (storedFeed?.encryptedConfig) {
        try { canvasItems = await fetchCanvasDeadlines(await decryptSecret(storedFeed.encryptedConfig)); } catch {
          if (storedUpload?.encryptedConfig) try { canvasItems = parseCanvasIcs(await decryptSecret(storedUpload.encryptedConfig)); } catch { canvasItems = []; }
        }
      } else if (storedUpload?.encryptedConfig) {
        try { canvasItems = parseCanvasIcs(await decryptSecret(storedUpload.encryptedConfig)); } catch { canvasItems = []; }
      }
    }
    let canvasApiItems = profile.canvasApiToken && profile.canvasBaseUrl ? await fetchCanvasApiDeadlines(profile.canvasBaseUrl, profile.canvasApiToken) : [];
    let canvasApiConnected = Boolean(profile.canvasApiToken && profile.canvasBaseUrl);
    if (!profile.canvasApiToken && keepCanvasApiConnection) {
      const stored = storedByType.get("canvas_api");
      if (stored?.encryptedConfig) {
        canvasApiConnected = true;
        try {
          const config = JSON.parse(await decryptSecret(stored.encryptedConfig)) as { baseUrl: string; token: string };
          canvasApiItems = await fetchCanvasApiDeadlines(config.baseUrl, config.token);
        } catch { canvasApiItems = []; }
      }
    }
    const canvasByIdentity = new Map<string, (typeof canvasItems)[number]>();
    for (const item of [...canvasApiItems, ...canvasItems]) canvasByIdentity.set(`${item.title.toLowerCase()}|${item.when}`, item);
    canvasItems = [...canvasByIdentity.values()].sort((a, b) => new Date(a.when!).getTime() - new Date(b.when!).getTime());
    canvasConnected = canvasConnected || canvasApiConnected;
    let googleCalendarItems = profile.googleCalendarFeedUrl ? await fetchGoogleCalendarItems(profile.googleCalendarFeedUrl) : [];
    let googleCalendarConnected = Boolean(profile.googleCalendarFeedUrl);
    if (!profile.googleCalendarFeedUrl && keepGoogleCalendarConnection) {
      const stored = storedByType.get("google_calendar_ics");
      if (stored?.encryptedConfig) {
        googleCalendarConnected = true;
        try { googleCalendarItems = await fetchGoogleCalendarItems(await decryptSecret(stored.encryptedConfig)); } catch { googleCalendarItems = []; }
      }
    }
    let academicData: ManualAcademicData = parseManualAcademicData(profile.courseScheduleText, profile.assignmentDeadlinesText);
    const hasNewAcademicText = Boolean(profile.courseScheduleText || profile.assignmentDeadlinesText);
    if (!hasNewAcademicText && keepManualAcademicData) {
      const stored = storedByType.get("manual_academic");
      if (stored?.encryptedConfig) {
        try { academicData = JSON.parse(await decryptSecret(stored.encryptedConfig)) as ManualAcademicData; } catch { academicData = { courses: [], deadlines: [] }; }
      }
    }
    const forwardedItems = profile.forwardingEnabled ? await forwardedEmailItems(user.email, profile.reportLanguage) : [];
    const reactions=await db.select().from(feedback).where(eq(feedback.userEmail,user.email));
    const hiddenIds=reactions.filter(row=>row.reaction==="irrelevant"||row.reaction==="hide_topic").map(row=>row.itemId);
    const preview = await buildRadarPreview(profile, canvasItems, googleCalendarItems, { canvas: canvasConnected, googleCalendar: googleCalendarConnected }, academicData, forwardedItems, hiddenIds);
    const inboundAlias = existingProfile?.inboundAlias ?? crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    await db.insert(profiles).values({
      email: user.email,
      fullName: user.fullName,
      school: profile.school,
      major: profile.major,
      graduationYear: profile.graduationYear,
      academicLevel: profile.academicLevel,
      isUmichStudent: profile.isUmichStudent,
      reportLanguage: profile.reportLanguage,
      deliveryEmail: profile.deliveryEmail,
      emailDeliveryEnabled: profile.emailDeliveryEnabled,
      inboundAlias,
      forwardingEnabled: profile.forwardingEnabled,
      goalsJson: JSON.stringify(profile.goals),
      interestsJson: JSON.stringify(profile.interests),
      roleTracksJson: JSON.stringify(profile.roleTracks),
      opportunityPreferencesJson: JSON.stringify(profile.opportunityPreferences),
      careerStage: profile.careerStage,
      bottleneck: profile.bottleneck,
      sponsorship: profile.sponsorship,
      paidOnly: profile.paidOnly,
      deliveryTime: profile.deliveryTime,
      weekends: profile.weekends,
      status: "active",
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: profiles.email,
      set: {
        fullName: user.fullName,
        school: profile.school,
        major: profile.major,
        graduationYear: profile.graduationYear,
        academicLevel: profile.academicLevel,
        isUmichStudent: profile.isUmichStudent,
        reportLanguage: profile.reportLanguage,
        deliveryEmail: profile.deliveryEmail,
        emailDeliveryEnabled: profile.emailDeliveryEnabled,
        forwardingEnabled: profile.forwardingEnabled,
        goalsJson: JSON.stringify(profile.goals),
        interestsJson: JSON.stringify(profile.interests),
        roleTracksJson: JSON.stringify(profile.roleTracks),
        opportunityPreferencesJson: JSON.stringify(profile.opportunityPreferences),
        careerStage: profile.careerStage,
        bottleneck: profile.bottleneck,
        sponsorship: profile.sponsorship,
        paidOnly: profile.paidOnly,
        deliveryTime: profile.deliveryTime,
        weekends: profile.weekends,
        status: "active",
        updatedAt: new Date().toISOString(),
      },
    });

    if (profile.canvasFeedUrl) {
      const encrypted = await encryptSecret(profile.canvasFeedUrl);
      const host = new URL(profile.canvasFeedUrl).hostname;
      await db.insert(sources).values({
        userEmail: user.email,
        type: "canvas_ics",
        encryptedConfig: encrypted,
        displayLabel: host,
        status: "connected",
        eventCount: canvasItems.length,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: [sources.userEmail, sources.type],
        set: {
          encryptedConfig: encrypted,
          displayLabel: host,
          status: "connected",
          eventCount: canvasItems.length,
          lastError: null,
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      await db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, "canvas_ics_upload")));
    } else if (profile.canvasIcsText) {
      const encrypted = await encryptSecret(profile.canvasIcsText);
      await db.insert(sources).values({
        userEmail: user.email,
        type: "canvas_ics_upload",
        encryptedConfig: encrypted,
        displayLabel: "Uploaded Canvas calendar (.ics)",
        status: "connected",
        eventCount: canvasItems.length,
        lastSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: [sources.userEmail, sources.type],
        set: {
          encryptedConfig: encrypted,
          displayLabel: "Uploaded Canvas calendar (.ics)",
          status: "connected",
          eventCount: canvasItems.length,
          lastError: null,
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      await db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, "canvas_ics")));
    } else if (!keepCanvasConnection) {
      await db.batch([
        db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, "canvas_ics"))),
        db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, "canvas_ics_upload"))),
      ]);
    }

    if (profile.canvasApiToken && profile.canvasBaseUrl) {
      const encrypted = await encryptSecret(JSON.stringify({ baseUrl: profile.canvasBaseUrl, token: profile.canvasApiToken }));
      await db.insert(sources).values({
        userEmail: user.email, type: "canvas_api", encryptedConfig: encrypted,
        displayLabel: new URL(profile.canvasBaseUrl).hostname, status: "connected", eventCount: canvasApiItems.length,
        lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: [sources.userEmail, sources.type],
        set: { encryptedConfig: encrypted, displayLabel: new URL(profile.canvasBaseUrl).hostname, status: "connected", eventCount: canvasApiItems.length, lastError: null, lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
    } else if (!keepCanvasApiConnection) {
      await db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, "canvas_api")));
    }

    if (profile.googleCalendarFeedUrl) {
      const encrypted = await encryptSecret(profile.googleCalendarFeedUrl);
      await db.insert(sources).values({
        userEmail: user.email, type: "google_calendar_ics", encryptedConfig: encrypted,
        displayLabel: "Google Calendar", status: "connected", eventCount: googleCalendarItems.length,
        lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: [sources.userEmail, sources.type],
        set: { encryptedConfig: encrypted, displayLabel: "Google Calendar", status: "connected", eventCount: googleCalendarItems.length, lastError: null, lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
    } else if (!keepGoogleCalendarConnection) {
      await db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, "google_calendar_ics")));
    }

    if (hasNewAcademicText) {
      const encrypted = await encryptSecret(JSON.stringify(academicData));
      await db.insert(sources).values({
        userEmail: user.email, type: "manual_academic", encryptedConfig: encrypted,
        displayLabel: `${academicData.courses.length} courses · ${academicData.deadlines.length} deadlines`, status: "connected",
        eventCount: academicData.deadlines.length, lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: [sources.userEmail, sources.type],
        set: { encryptedConfig: encrypted, displayLabel: `${academicData.courses.length} courses · ${academicData.deadlines.length} deadlines`, status: "connected", eventCount: academicData.deadlines.length, lastError: null, lastSyncedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
    } else if (!keepManualAcademicData) {
      await db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, "manual_academic")));
    }

    for (const obsoleteType of ["gmail_interest", "handshake_interest", "job_source_interest:interstride", "job_source_interest:linkedin", "job_source_interest:indeed", "job_source_interest:simplify", "job_source_interest:wellfound"]) {
      await db.delete(sources).where(and(eq(sources.userEmail, user.email), eq(sources.type, obsoleteType)));
    }

    const [run] = await db.insert(radarRuns).values({
      userEmail: user.email,
      status: "preview",
      outputJson: JSON.stringify(stripAihotForStorage(preview)),
      sourceCount: preview.opportunities.length + canvasItems.length + googleCalendarItems.length + academicData.deadlines.length,
    }).returning({ id: radarRuns.id });
    const sourceSummaries = await db.select({ type: sources.type, displayLabel: sources.displayLabel, status: sources.status, eventCount: sources.eventCount, lastSyncedAt: sources.lastSyncedAt }).from(sources).where(eq(sources.userEmail, user.email));
    return Response.json({ preview, runId: run.id, radarInboxAddress: radarInboxAddress(inboundAlias), sources: sourceSummaries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate your preview.";
    return Response.json({ error: message }, { status: 400 });
  }
}
