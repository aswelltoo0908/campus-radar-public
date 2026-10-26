import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isAdmin } from "../../../../lib/server/admin";
import { getDb } from "../../../../db";
import { profiles } from "../../../../db/schema";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!isAdmin(user.email)) return Response.json({ error: "Admin required" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const body = await request.json() as { email?: string };
  if (typeof body.email !== "string" || body.email.length > 254) return Response.json({ error: "Invalid email" }, { status: 400 });
  const [profile] = await getDb().update(profiles).set({ emailDeliveryEnabled: false, updatedAt: new Date().toISOString() }).where(eq(profiles.email, body.email)).returning({ enabled: profiles.emailDeliveryEnabled });
  if (!profile) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json({ ok: true, emailDeliveryEnabled: false });
}
