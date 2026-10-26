import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { inboundEmails } from "../../db/schema";
import { decryptSecret } from "./crypto";
import type { RadarItem } from "../types";

export type ForwardedEmail = { subject: string; sender: string; text: string; receivedAt: string; confirmationUrl?: string };

export function forwardingConfirmationUrl(text: string): string | undefined {
  for (const match of text.matchAll(/https:\/\/mail\.google\.com\/mail\/vf-[^\s<>"']+/g)) {
    try { const url = new URL(match[0]); if (url.hostname === "mail.google.com" && url.pathname.startsWith("/mail/vf-")) return url.href; } catch { /* ignore malformed links */ }
  }
}

export async function forwardedEmailItems(email: string, language: "en" | "zh"): Promise<RadarItem[]> {
  const rows = await getDb().select().from(inboundEmails).where(eq(inboundEmails.userEmail, email)).orderBy(desc(inboundEmails.receivedAt)).limit(20);
  const items: RadarItem[] = [];
  for (const row of rows) {
    if (new Date(row.receivedAt).getTime() < Date.now() - 14 * 86_400_000) continue;
    try {
      const mail = JSON.parse(await decryptSecret(row.encryptedContent)) as ForwardedEmail;
      if (mail.confirmationUrl) continue;
      const url = mail.text.match(/https?:\/\/[^\s<>"']+/)?.[0] ?? null;
      items.push({ id: `forwarded-${row.id}`, title: mail.subject || "Forwarded opportunity", source: "Forwarded email", when: null, location: null, url,
        why: language === "zh" ? `来自你主动转发的邮件：${mail.text.replace(/\s+/g, " ").slice(0, 240)}` : `From an email you forwarded: ${mail.text.replace(/\s+/g, " ").slice(0, 240)}`,
        nextAction: language === "zh" ? "打开邮件或来源，确认资格、时间与截止日期。邮件里的日期尚未自动核验。" : "Open the email or source and confirm eligibility, timing, and deadlines. Dates have not been automatically verified.", confidence: "needs_verification", score: 65 });
    } catch { /* one invalid record must not prevent a report */ }
  }
  return items;
}

export async function pendingForwardingConfirmation(email: string) {
  const rows = await getDb().select().from(inboundEmails).where(eq(inboundEmails.userEmail, email)).orderBy(desc(inboundEmails.receivedAt)).limit(20);
  for (const row of rows) {
    if (new Date(row.receivedAt).getTime() < Date.now() - 24 * 60 * 60 * 1000) continue;
    try { const mail = JSON.parse(await decryptSecret(row.encryptedContent)) as ForwardedEmail; if (mail.confirmationUrl) return mail.confirmationUrl; } catch { /* ignore invalid records */ }
  }
  return null;
}
