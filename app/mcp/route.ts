import { getChatGPTUser } from "../chatgpt-auth";
import { isAdmin } from "../../lib/server/admin";
import { getDb } from "../../db";
import { publicSourceRuns } from "../../db/schema";
import { readPublicSignals } from "../../lib/server/public-signals";
import { importPublicOpportunities } from "../../lib/server/public-intake";
import { selectPublicStatusItems } from "../../lib/public-status";

const tools = [
  {
    name: "radar_public_source_status",
    description:
      "Owner-only: inspect public source health and a bounded page of public opportunities. Defaults to scholarships; use category=event for university events, or business_news/ai_news for news. Contains no student profiles or emails.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["scholarship", "event", "business_news", "ai_news"],
        },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        offset: { type: "integer", minimum: 0, maximum: 500 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "radar_import_public_opportunities",
    description:
      "Owner-only: import source-verified public scholarships and university events. Supply explicit qualifications, dates or null, original HTTPS evidence and a fresh fetchedAt. This never sends email or modifies student accounts.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          maxItems: 25,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              category: { type: "string", enum: ["scholarship", "event"] },
              title: { type: "string" },
              summary: { type: "string" },
              url: { type: "string" },
              sourceName: { type: "string" },
              fetchedAt: { type: "string" },
              publishedAt: { type: ["string", "null"] },
              deadline: { type: ["string", "null"] },
              opensAt: { type: ["string", "null"] },
              amount: { type: ["string", "null"] },
              availability: {
                type: "string",
                enum: [
                  "open",
                  "upcoming",
                  "closed",
                  "directory",
                  "needs_review",
                ],
              },
              eligibility: { type: "object" },
              topics: { type: "array", items: { type: "string" } },
              evidenceText: { type: "string" },
            },
            required: [
              "id",
              "category",
              "title",
              "summary",
              "url",
              "sourceName",
              "fetchedAt",
              "availability",
              "eligibility",
              "evidenceText",
            ],
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
];
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user || !isAdmin(user.email))
    return Response.json(
      { error: "Owner authorization required" },
      { status: 403 },
    );
  const body = (await request.json()) as {
    id?: string | number;
    method?: string;
    params?: {
      name?: string;
      arguments?: {
        items?: unknown;
        category?: unknown;
        limit?: unknown;
        offset?: unknown;
      };
    };
  };
  const reply = (result: unknown) =>
    Response.json({ jsonrpc: "2.0", id: body.id ?? null, result });
  if (body.method === "server/discover")
    return reply({
      supportedVersions: ["2026-07-28"],
      capabilities: { tools: {} },
    });
  if (body.method === "tools/list") return reply({ tools });
  if (body.method !== "tools/call")
    return Response.json({
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: { code: -32601, message: "Method not found" },
    });
  try {
    const result =
      body.params?.name === "radar_public_source_status"
        ? {
            sources: await getDb().select().from(publicSourceRuns),
            ...selectPublicStatusItems(
              await readPublicSignals(),
              body.params.arguments,
            ),
          }
        : body.params?.name === "radar_import_public_opportunities"
          ? await importPublicOpportunities(body.params.arguments?.items)
          : null;
    if (!result) throw new Error("Unknown tool");
    return reply({ content: [{ type: "text", text: JSON.stringify(result) }] });
  } catch (error) {
    return reply({
      isError: true,
      content: [
        {
          type: "text",
          text:
            error instanceof Error
              ? error.message
              : "Public source operation failed",
        },
      ],
    });
  }
}
