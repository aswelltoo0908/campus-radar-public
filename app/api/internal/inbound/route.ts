import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { inboundEmails, profiles } from "../../../../db/schema";
import { encryptSecret } from "../../../../lib/server/crypto";
import { forwardingConfirmationUrl } from "../../../../lib/server/forwarded-email";

export async function POST(request: Request) {
  const secret = String((env as unknown as Record<string, unknown>).RADAR_EMAIL_AUTOMATION_SECRET ?? "");
  if (secret.length < 24 || request.headers.get("x-radar-secret") !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const data = await request.json() as Record<string, unknown>;
  const alias = String(data.alias ?? "");
  const messageId = String(data.messageId ?? "");
  if (!/^[a-f0-9]{12}$/.test(alias) || !/^[a-zA-Z0-9_-]{5,100}$/.test(messageId)) return Response.json({ error: "Invalid message identity" }, { status: 400 });
  const db = getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.inboundAlias, alias)).limit(1);
  if (!profile?.forwardingEnabled || profile.status !== "active") return Response.json({ accepted: false, reason: "Forwarding is not enabled for this student" });
  const text = String(data.text ?? "").slice(0, 24_000);
  const subject = String(data.subject ?? "").slice(0, 300);
  const sender = String(data.sender ?? "").slice(0, 300);
  const confirmationUrl = /forward|转发/i.test(subject) && /forwarding-noreply@google\.com/i.test(sender) ? forwardingConfirmationUrl(text) : undefined;
  const suppliedDate = new Date(String(data.receivedAt ?? ""));
  const receivedAt = Number.isNaN(suppliedDate.getTime()) ? new Date().toISOString() : suppliedDate.toISOString();
  const encryptedContent = await encryptSecret(JSON.stringify({ subject, sender, text, receivedAt, confirmationUrl }));
  await db.insert(inboundEmails).values({ userEmail: profile.email, messageId, encryptedContent, receivedAt }).onConflictDoNothing();
  return Response.json({ accepted: true });
}
