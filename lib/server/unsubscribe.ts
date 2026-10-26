import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
async function key() {
  const secret = String((env as unknown as Record<string, unknown>).RADAR_EMAIL_AUTOMATION_SECRET ?? "");
  if (secret.length < 24) throw new Error("Email unsubscribe signing unavailable");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function unsubscribeToken(deliveryId: number) {
  if (!Number.isSafeInteger(deliveryId) || deliveryId < 1) throw new Error("Invalid delivery ID");
  const signature = await crypto.subtle.sign("HMAC", await key(), encoder.encode(`radar-unsubscribe-v1:${deliveryId}`));
  return `${deliveryId}.${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
export async function verifyUnsubscribeToken(token: string): Promise<number | null> {
  const match = /^(\d{1,15})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return null;
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const signature = Uint8Array.from(match[2].match(/../g)!, value => parseInt(value, 16));
  return await crypto.subtle.verify("HMAC", await key(), signature, encoder.encode(`radar-unsubscribe-v1:${id}`)) ? id : null;
}
export async function unsubscribeUrl(deliveryId: number) {
  return `https://campus-radar-umich.aswelltoo.chatgpt.site/unsubscribe?token=${await unsubscribeToken(deliveryId)}`;
}
