import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { feedback, radarRuns } from "../../../../db/schema";
import { and, eq } from "drizzle-orm";

const REACTIONS = new Set(["useful", "irrelevant", "acted", "hide_topic"]);

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json() as { runId?: number; itemId?: string; reaction?: string };
  const itemId = String(body.itemId ?? "").slice(0, 240);
  const reaction = String(body.reaction ?? "");
  if (!itemId || !REACTIONS.has(reaction)) return Response.json({ error: "反馈无效" }, { status: 400 });
  const db = getDb();
  if (!Number.isInteger(body.runId)) return Response.json({ error: "A saved report is required." }, { status: 400 });
  const [run] = await db.select({ id: radarRuns.id, outputJson: radarRuns.outputJson }).from(radarRuns)
    .where(and(eq(radarRuns.id, body.runId!), eq(radarRuns.userEmail, user.email))).limit(1);
  if (!run) return Response.json({ error: "Report not found." }, { status: 404 });
  const saved = JSON.parse(run.outputJson);
  const knownIds = [saved.actions, saved.opportunities, saved.forwardedEmails, saved.researchLabs?.matches, saved.scholarships, saved.businessNews, saved.aiNews, saved.campusEvents, saved.careerJobs, saved.umichCareerEvents]
    .flatMap((rows) => Array.isArray(rows) ? rows.map((row: { id: string }) => row.id) : []);
  if (!knownIds.includes(itemId)) return Response.json({ error: "Item not found in this report." }, { status: 400 });
  await db.insert(feedback).values({
    userEmail: user.email,
    radarRunId: Number.isInteger(body.runId) ? body.runId : null,
    itemId,
    reaction,
  });
  return Response.json({ ok: true });
}
