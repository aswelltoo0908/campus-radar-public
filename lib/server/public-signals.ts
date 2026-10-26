import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { publicSignals, publicSourceRuns } from "../../db/schema";
import { canonicalPublicUrl } from "../opportunity-matching";
import type { PublicSignal } from "../types";
import { publicSignalVersionKey } from "../public-signal-version";
import { reconcileFundingPage } from "./funding-page-watch";
import { aihotPolicy } from "../aihot-policy";
import {
  PUBLIC_NEWS_SOURCES,
  SCHOLARSHIP_SEEDS,
} from "./public-source-registry";

export function plainSourceText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) =>
      Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : "",
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
async function fingerprint(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function fetchPublic(url: string) {
  // All input URLs come from the checked registry, never from a visitor's request.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    redirect: "manual",
    headers: {
      Accept:
        "application/xml,text/xml,application/rss+xml,application/atom+xml,application/json,text/html;q=0.8,*/*;q=0.1",
      "User-Agent":
        "CampusRadar/2.0 (+https://campus-radar-umich.aswelltoo.chatgpt.site)",
    },
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Source body unavailable");
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 2000000) {
      void reader.cancel();
      throw new Error("Source exceeded 2 MB limit");
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(combined);
}
export async function parseNewsFeed(
  xml: string,
  source: (typeof PUBLIC_NEWS_SOURCES)[number],
  fetchedAt: string,
): Promise<PublicSignal[]> {
  if (!/<(?:rss|feed)\b/i.test(xml))
    throw new Error("Source did not return an RSS/Atom feed");
  const blocks = [
    ...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi),
  ].slice(0, 25);
  const records: PublicSignal[] = [];
  for (const [, body] of blocks) {
    const field = (tag: string) =>
      body.match(
        new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
      )?.[1] ?? "";
    const rawUrl =
      plainSourceText(field("link")) ||
      body.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ||
      "";
    const url = canonicalPublicUrl(rawUrl),
      title = plainSourceText(field("title")).slice(0, 350);
    const date = plainSourceText(
      field("pubDate") ||
        field("published") ||
        field("dc:date") ||
        field("updated"),
    );
    if (!url || !title || !date || !Number.isFinite(Date.parse(date))) continue;
    const summary = plainSourceText(
      field("description") || field("summary"),
    ).slice(0, 700);
    const hash = await fingerprint(`${title}|${summary}`);
    records.push({
      id: `${source.id}-${(await fingerprint(url)).slice(0, 20)}`,
      category: source.category || "business_news",
      channel: source.channel,
      title,
      summary,
      url,
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: new Date(date).toISOString(),
      fetchedAt,
      verifiedAt: null,
      deadline: null,
      opensAt: null,
      amount: null,
      availability: "open",
      eligibility: { otherRequirements: [] },
      topics: [source.channel || "ai"],
      contentHash: hash,
    });
  }
  return records;
}
export async function parsePublicEvents(
  html: string,
  sourceId: string,
  sourceName: string,
  fetchedAt: string,
): Promise<PublicSignal[]> {
  const objects: Record<string, unknown>[] = [];
  for (const [, json] of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const value = JSON.parse(json);
      objects.push(
        ...(Array.isArray(value) ? value : value["@graph"] || [value]),
      );
    } catch {
      /* malformed publisher metadata is not guessed */
    }
  }
  const records: PublicSignal[] = [];
  for (const event of objects) {
    if (event["@type"] !== "Event" || !event.startDate || !event.name) continue;
    const url = canonicalPublicUrl(String(event.url || ""));
    if (!url) continue;
    const starts = String(event.startDate);
    if (!Number.isFinite(Date.parse(starts))) continue;
    const title = plainSourceText(String(event.name)).slice(0, 350),
      summary = plainSourceText(String(event.description || "")).slice(0, 700);
    const hash = await fingerprint(`${title}|${summary}|${starts}`);
    records.push({
      id: `${sourceId}-${(await fingerprint(url)).slice(0, 20)}`,
      category: "event",
      channel: null,
      title,
      summary,
      url,
      sourceId,
      sourceName,
      publishedAt: null,
      fetchedAt,
      verifiedAt: null,
      deadline: null,
      opensAt: starts,
      amount: null,
      availability: /cancel/i.test(String(event.eventStatus))
        ? "closed"
        : "open",
      eligibility: {
        otherRequirements: [
          `Hosted by ${sourceName}; confirm visitor eligibility, registration and travel/online access`,
        ],
      },
      topics:
        [title, summary]
          .join(" ")
          .toLowerCase()
          .match(
            /research|policy|politic|business|finance|math|data|climate|education|health|ai|intern/g,
          ) || [],
      contentHash: hash,
    });
  }
  return records;
}
/** Public Localist API. Private and explicitly campus-only listings are excluded. */
export async function parseLocalistEvents(
  json: string,
  fetchedAt: string,
): Promise<PublicSignal[]> {
  const data = JSON.parse(json);
  if (!Array.isArray(data.events))
    throw new Error("Public events schema changed");
  const records: PublicSignal[] = [];
  for (const wrapper of data.events.slice(0, 100)) {
    const event = wrapper.event;
    if (!event || event.private || event.rejected || event.status !== "live")
      continue;
    const fullText = plainSourceText(
      String(event.description_text || event.description || ""),
    );
    if (
      /MIT (?:community|students?|affiliates?) only|only (?:open|available) to (?:the )?MIT/i.test(
        fullText,
      )
    )
      continue;
    const url = canonicalPublicUrl(String(event.localist_url || ""));
    if (!url || new URL(url).hostname !== "calendar.mit.edu") continue;
    const title = plainSourceText(String(event.title || "")).slice(0, 350);
    if (!title) continue;
    const instances = (
      Array.isArray(event.event_instances) ? event.event_instances : []
    )
      .map(
        (x: { event_instance?: { start?: string } }) => x.event_instance?.start,
      )
      .filter(
        (start: unknown): start is string =>
          typeof start === "string" &&
          Number.isFinite(Date.parse(start)) &&
          Date.parse(start) > Date.parse(fetchedAt),
      )
      .sort((a: string, b: string) => Date.parse(a) - Date.parse(b));
    if (!instances.length) continue;
    const starts = instances[0],
      summary = fullText.slice(0, 700);
    records.push({
      id: `mit-events-${(await fingerprint(url)).slice(0, 20)}`,
      category: "event",
      channel: null,
      title,
      summary,
      url,
      sourceId: "mit-events",
      sourceName: "MIT Events",
      publishedAt:
        event.created_at && Number.isFinite(Date.parse(event.created_at))
          ? new Date(event.created_at).toISOString()
          : null,
      fetchedAt,
      verifiedAt: null,
      deadline: null,
      opensAt: starts,
      amount: null,
      availability: "open",
      eligibility: {
        otherRequirements: [
          `MIT-hosted ${event.experience === "virtual" ? "online" : "in-person/hybrid"} event; confirm visitor eligibility and registration on the original page`,
        ],
      },
      topics:
        `${title} ${summary}`
          .toLowerCase()
          .match(
            /research|policy|politic|business|finance|math|data|climate|education|health|ai|intern/g,
          ) || [],
      contentHash: await fingerprint(`${title}|${summary}|${starts}`),
    });
  }
  return records;
}
async function persist(records: PublicSignal[]) {
  const db = getDb();
  for (const signal of records)
    await db
      .insert(publicSignals)
      .values({
        id: signal.id,
        category: signal.category,
        sourceId: signal.sourceId,
        canonicalUrl: signal.url,
        contentHash: signal.contentHash,
        payloadJson: JSON.stringify(signal),
        firstSeenAt: signal.fetchedAt,
        updatedAt: signal.fetchedAt,
      })
      .onConflictDoUpdate({
        target: publicSignals.id,
        set: {
          contentHash: signal.contentHash,
          payloadJson: JSON.stringify(signal),
          updatedAt: signal.fetchedAt,
        },
      });
}
async function runSource(
  id: string,
  task: () => Promise<PublicSignal[]>,
  force: boolean,
  weekly = false,
) {
  const db = getDb(),
    now = new Date(),
    timestamp = now.toISOString();
  const [previous] = await db
    .select()
    .from(publicSourceRuns)
    .where(eq(publicSourceRuns.id, id))
    .limit(1);
  const eastern = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  if (!force && previous) {
    const age = now.getTime() - Date.parse(previous.lastAttemptAt);
    const retryInterval =
      previous.status === "failed" ? 15 * 60000 : 6 * 3600000;
    if (
      weekly && previous.lastSuccessAt
        ? !(
            eastern.weekday === "Mon" &&
            Number(eastern.hour) >= 7 &&
            age >= 86400000
          )
        : age < retryInterval
    )
      return;
  }
  await db
    .insert(publicSourceRuns)
    .values({ id, status: "refreshing", lastAttemptAt: timestamp })
    .onConflictDoUpdate({
      target: publicSourceRuns.id,
      set: { status: "refreshing", lastAttemptAt: timestamp },
    });
  try {
    const records = await task();
    await persist(records);
    await db
      .update(publicSourceRuns)
      .set({
        status: "connected",
        itemCount: records.length,
        lastSuccessAt: timestamp,
        lastError: null,
      })
      .where(eq(publicSourceRuns.id, id));
  } catch (error) {
    await db
      .update(publicSourceRuns)
      .set({
        status: "failed",
        lastError:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Source could not be read",
      })
      .where(eq(publicSourceRuns.id, id));
  }
}
export async function refreshPublicSignals(force = false) {
  const now = new Date().toISOString();
  const tasks = PUBLIC_NEWS_SOURCES.map((source) =>
    runSource(
      source.id,
      async () => parseNewsFeed(await fetchPublic(source.url), source, now),
      force,
    ),
  );
  tasks.push(
    runSource(
      "mit-events",
      async () =>
        parseLocalistEvents(
          await fetchPublic(
            "https://calendar.mit.edu/api/2/events?days=14&pp=100",
          ),
          now,
        ),
      force,
    ),
    runSource(
      "cornell-events",
      async () =>
        parsePublicEvents(
          await fetchPublic("https://events.cornell.edu/"),
          "cornell-events",
          "Cornell University",
          now,
        ),
      force,
    ),
  );
  for (const seed of SCHOLARSHIP_SEEDS)
    tasks.push(
      runSource(
        seed.sourceId,
        async () => {
          const text = plainSourceText(await fetchPublic(seed.url));
          if (
            !text
              .toLowerCase()
              .includes(seed.title.split(" · ")[0].toLowerCase())
          )
            throw new Error(
              "Scholarship page identity changed; manual review needed",
            );
          const hash = await fingerprint(text);
          const [old] = await getDb()
            .select()
            .from(publicSignals)
            .where(eq(publicSignals.id, seed.id))
            .limit(1);
          const record = reconcileFundingPage(
            seed,
            old ? (JSON.parse(old.payloadJson) as PublicSignal) : undefined,
            hash,
            now,
          );
          record.contentHash = await fingerprint(
            publicSignalVersionKey(record),
          );
          return [record];
        },
        force,
        true,
      ),
    );
  const policy = aihotPolicy(env as unknown as Record<string, unknown>);
  // AIHOT is fetched by the consent-gated short-lived reader, never by global jobs.
  await getDb()
      .insert(publicSourceRuns)
      .values({
        id: "aihot",
        status: policy.status,
        lastAttemptAt: now,
        lastError: policy.note,
      })
      .onConflictDoUpdate({
        target: publicSourceRuns.id,
        set: {
          status: policy.status,
          lastError: policy.note,
        },
      });
  await Promise.allSettled(tasks);
}
export async function readPublicSignals() {
  const records = await getDb()
    .select()
    .from(publicSignals)
    .orderBy(desc(publicSignals.updatedAt))
    .limit(500);
  const signals = records.flatMap((row) => {
    try {
      const item=JSON.parse(row.payloadJson) as PublicSignal;
      return item.sourceId === "aihot" ? [] : [item];
    } catch {
      return [];
    }
  });
  for (const seed of SCHOLARSHIP_SEEDS)
    if (
      !signals.some((item) => item.id === seed.id) &&
      seed.verifiedAt &&
      Date.now() - Date.parse(seed.verifiedAt) < 14 * 86400000
    ) {
      signals.push({
        ...seed,
        fetchedAt: seed.verifiedAt,
        contentHash: await fingerprint(JSON.stringify(seed)),
        sourceMode: "verified_snapshot",
      });
    }
  return signals;
}
