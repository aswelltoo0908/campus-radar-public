import { sql } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { userActivity } from "../../../../db/schema";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const body = await request.json() as { step?: number };
  if (!Number.isInteger(body.step) || body.step! < 0 || body.step! > 4) return Response.json({ error: "Invalid step" }, { status: 400 });
  const now = new Date().toISOString();
  await getDb().insert(userActivity).values({ email: user.email, fullName: user.fullName, firstSeenAt: now, lastSeenAt: now, lastStep: body.step!, furthestStep: body.step! })
    .onConflictDoUpdate({ target: userActivity.email, set: { fullName: user.fullName, lastSeenAt: now, lastStep: body.step!, furthestStep: sql`max(${userActivity.furthestStep}, ${body.step!})` } });
  return Response.json({ ok: true });
}
