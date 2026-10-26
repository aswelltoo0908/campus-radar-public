import { env } from "cloudflare:workers";

function configuredInbox() {
  return String((env as unknown as Record<string, unknown>).RADAR_INBOX_EMAIL ?? "").trim().toLowerCase();
}

export function radarInboxAddress(alias: string | null | undefined) {
  const inbox = configuredInbox();
  if (!alias || !/^[^\s@]+@[^\s@]+$/.test(inbox)) return null;
  const [local, domain] = inbox.split("@");
  return `${local}+radar-${alias}@${domain}`;
}

export function radarInboxConfigured() {
  return Boolean(configuredInbox());
}
