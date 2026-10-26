import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles, emailDeliveries } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { verifyUnsubscribeToken } from "../../../lib/server/unsubscribe";

export async function POST(request: Request) {
  const body = await request.formData();
  const token = body.get("token");
  let email: string | null = null;
  if (typeof token === "string" && token) {
    const id = await verifyUnsubscribeToken(token);
    if (!id) return Response.json({ error: "Invalid unsubscribe link" }, { status: 400 });
    const [delivery] = await getDb().select({ userEmail: emailDeliveries.userEmail }).from(emailDeliveries).where(eq(emailDeliveries.id, id)).limit(1);
    email = delivery?.userEmail ?? null;
  } else {
    if (request.headers.get("origin") !== "https://campus-radar-umich.aswelltoo.chatgpt.site") return Response.json({ error: "Invalid origin" }, { status: 403 });
    email = (await getChatGPTUser())?.email ?? null;
  }
  if (!email) return Response.json({ error: "Use your Radar email link or sign in." }, { status: 401 });
  const [updated] = await getDb().update(profiles).set({ emailDeliveryEnabled: false, updatedAt: new Date().toISOString() }).where(eq(profiles.email, email)).returning({ email: profiles.email });
  if (!updated) return Response.json({ error: "Subscription not found" }, { status: 404 });
  return new Response(null, { status: 303, headers: { Location: "/unsubscribe?done=1", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
