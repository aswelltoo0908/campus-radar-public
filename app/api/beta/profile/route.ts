import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { feedback, inboundEmails, profiles, radarRuns, sources, userActivity, emailDeliveries } from "../../../../db/schema";
import { radarInboxAddress, radarInboxConfigured } from "../../../../lib/server/email";
import { pendingForwardingConfirmation } from "../../../../lib/server/forwarded-email";
import { parseOpportunityPreferences } from "../../../../lib/opportunity-matching";
import { verifyRadarPreview } from "../../../../lib/server/verify-preview";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.email, user.email)).limit(1);
  const [mailer] = await db.select().from(sources).where(and(eq(sources.userEmail, "__radar_system__"), eq(sources.type, "mailer_health"))).limit(1);
  const sourceRows = await db.select({ type: sources.type, displayLabel: sources.displayLabel, status: sources.status, eventCount: sources.eventCount, lastSyncedAt: sources.lastSyncedAt }).from(sources).where(eq(sources.userEmail, user.email));
  const [latest] = await db.select().from(radarRuns).where(eq(radarRuns.userEmail, user.email)).orderBy(desc(radarRuns.createdAt), desc(radarRuns.id)).limit(1);
  return Response.json({
    user,
    profile: profile ? { ...profile, opportunityPreferences: parseOpportunityPreferences(JSON.parse(profile.opportunityPreferencesJson)), opportunityPreferencesJson: undefined, goals: JSON.parse(profile.goalsJson), interests: JSON.parse(profile.interestsJson), roleTracks: JSON.parse(profile.roleTracksJson), goalsJson: undefined, interestsJson: undefined, roleTracksJson: undefined } : null,
    radarInboxAddress: profile ? radarInboxAddress(profile.inboundAlias) : null,
    radarInboxConfigured: radarInboxConfigured(),
    mailerReady: Boolean(mailer?.lastSyncedAt && Date.now() - new Date(mailer.lastSyncedAt).getTime() < 60 * 60 * 1000),
    forwardingConfirmationUrl: profile?.forwardingEnabled ? await pendingForwardingConfirmation(user.email) : null,
    sources: sourceRows,
    latestPreview: latest ? { id: latest.id, createdAt: latest.createdAt, preview: await verifyRadarPreview({...JSON.parse(latest.outputJson),aihotOptIn:profile ? parseOpportunityPreferences(JSON.parse(profile.opportunityPreferencesJson)).aiNewsEnabled : false}) } : null,
  });
}

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const db = getDb();
  await db.batch([
    db.delete(userActivity).where(eq(userActivity.email, user.email)),
    db.delete(emailDeliveries).where(eq(emailDeliveries.userEmail, user.email)),
    db.delete(feedback).where(eq(feedback.userEmail, user.email)),
    db.delete(inboundEmails).where(eq(inboundEmails.userEmail, user.email)),
    db.delete(radarRuns).where(eq(radarRuns.userEmail, user.email)),
    db.delete(sources).where(eq(sources.userEmail, user.email)),
    db.delete(profiles).where(eq(profiles.email, user.email)),
  ]);
  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const data = await request.json() as { forwardingEnabled?: boolean };
  if (typeof data.forwardingEnabled !== "boolean") return Response.json({ error: "Invalid preference" }, { status: 400 });
  const [profile] = await getDb().update(profiles).set({ forwardingEnabled: data.forwardingEnabled, updatedAt: new Date().toISOString() }).where(eq(profiles.email, user.email)).returning();
  if (!profile) return Response.json({ error: "Save your first Radar before enabling forwarding." }, { status: 400 });
  return Response.json({ forwardingEnabled: profile.forwardingEnabled, radarInboxAddress: radarInboxAddress(profile.inboundAlias) });
}
