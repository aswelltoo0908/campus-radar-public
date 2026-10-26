import { env } from "cloudflare:workers";

export function isAdmin(email: string): boolean {
  const allowed = String((env as unknown as Record<string, unknown>).RADAR_ADMIN_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
