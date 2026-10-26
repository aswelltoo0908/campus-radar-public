import { getChatGPTUser } from "../../../chatgpt-auth";
import { isAdmin } from "../../../../lib/server/admin";
import { getDb } from "../../../../db";
import { publicSourceRuns } from "../../../../db/schema";
import { readPublicSignals, refreshPublicSignals } from "../../../../lib/server/public-signals";
export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !isAdmin(user.email)) return Response.json({ error: "Admin required" }, { status: 403 });
  return Response.json({ sources: await getDb().select().from(publicSourceRuns), items: await readPublicSignals() });
}
export async function POST() {
  const user = await getChatGPTUser();
  if (!user || !isAdmin(user.email)) return Response.json({ error: "Admin required" }, { status: 403 });
  await refreshPublicSignals();
  return Response.json({ ok: true, sources: await getDb().select().from(publicSourceRuns) });
}
