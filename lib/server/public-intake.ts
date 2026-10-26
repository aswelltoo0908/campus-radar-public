import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { publicSignals, publicSourceRuns } from "../../db/schema";
import { canonicalPublicUrl } from "../opportunity-matching";
import type { PublicSignal } from "../types";
import { plainSourceText } from "./public-signals";
import { SCHOLARSHIP_SEEDS } from "./public-source-registry";
import { publicSignalVersionKey } from "../public-signal-version";

/** Only owner-authenticated MCP calls may submit verified public opportunities. */
export function validatePublicIntake(
  value: unknown,
  now = new Date(),
): PublicSignal[] {
  if (!Array.isArray(value) || value.length > 25)
    throw new Error("Supply at most 25 public opportunities.");
  return value.map((input) => {
    if (!input || typeof input !== "object")
      throw new Error("Invalid opportunity record.");
    const record = input as Record<string, unknown>;
    if (!["scholarship", "event"].includes(String(record.category)))
      throw new Error(
        "Only public funding and university events can be imported.",
      );
    const url = canonicalPublicUrl(String(record.url || ""));
    if (!url) throw new Error("An original public HTTPS source is required.");
    const host = new URL(url).hostname;
    if (
      !/\.edu$|\.gov$|\.org$/.test(host) &&
      host !== "www.mpowerfinancing.com" &&
      host !== "mpowerfinancing.com"
    )
      throw new Error(
        "Use an official university, government, foundation or registered scholarship source.",
      );
    if (
      /\/login|\/account|\/dashboard|\/callback|\/student-record/i.test(
        new URL(url).pathname,
      ) ||
      [...new URL(url).searchParams.keys()].some((key) =>
        /token|secret|password|api.?key/i.test(key),
      )
    )
      throw new Error(
        "Do not import private account or credential-bearing URLs.",
      );
    const clean = (value: unknown, limit: number) =>
      plainSourceText(String(value || "")).slice(0, limit);
    const title = clean(record.title, 350),
      summary = clean(record.summary, 700),
      evidenceText = clean(record.evidenceText, 160);
    if (!title || !evidenceText)
      throw new Error(
        "Provide a title and a short original-source evidence excerpt.",
      );
    const date = (value: unknown) => {
      if (value === null || value === undefined || value === "") return null;
      const text = String(value);
      if (
        !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(text) ||
        !Number.isFinite(Date.parse(text))
      )
        throw new Error("Dates must be explicitly sourced ISO dates, or null.");
      return text;
    };
    const collectedAt = date(record.fetchedAt);
    if (
      !collectedAt ||
      Math.abs(now.getTime() - Date.parse(collectedAt)) > 2 * 86400000
    )
      throw new Error("Use a fresh source check within the last two days.");
    const e = (
      record.eligibility && typeof record.eligibility === "object"
        ? record.eligibility
        : {}
    ) as PublicSignal["eligibility"];
    const visas = ["f1", "j1", "us_citizen_or_pr", "other", "unknown"],
      regions = ["asia", "africa", "other", "unknown"];
    if (
      e.visas &&
      (!Array.isArray(e.visas) ||
        e.visas.some((value) => !visas.includes(value)))
    )
      throw new Error("Invalid visa conditions.");
    if (
      e.citizenshipRegions &&
      (!Array.isArray(e.citizenshipRegions) ||
        e.citizenshipRegions.some((value) => !regions.includes(value)))
    )
      throw new Error("Invalid region conditions.");
    const known = SCHOLARSHIP_SEEDS.find((seed) => seed.url === url);
    if (known && record.category !== "scholarship")
      throw new Error(
        "The registered funding source cannot be overwritten with another category.",
      );
    const sourceId = known?.sourceId || `public-${host}`;
    const suppliedId = clean(record.id, 120);
    if (!/^[a-z0-9_-]{3,120}$/i.test(suppliedId))
      throw new Error("Use a stable opportunity ID.");
    const id = known?.id || `${sourceId}-${suppliedId}`;
    const availability = String(record.availability);
    if (
      !["open", "upcoming", "closed", "directory", "needs_review"].includes(
        availability,
      )
    )
      throw new Error("Specify opportunity availability.");
    return {
      id,
      category: record.category as PublicSignal["category"],
      channel: null,
      title,
      summary,
      url,
      sourceId,
      sourceName: clean(record.sourceName || host, 100),
      publishedAt: date(record.publishedAt),
      fetchedAt: collectedAt,
      verifiedAt: null,
      deadline: date(record.deadline),
      opensAt: date(record.opensAt),
      amount: record.amount ? clean(record.amount, 100) : null,
      availability: availability as PublicSignal["availability"],
      eligibility: {
        umichOnly: e.umichOnly === true,
        academicLevel: ["undergraduate", "graduate"].includes(
          String(e.academicLevel),
        )
          ? e.academicLevel
          : undefined,
        visas: e.visas,
        citizenshipRegions: e.citizenshipRegions,
        transferOnly: e.transferOnly === true,
        stemPreferred: e.stemPreferred === true,
        school: e.school ? clean(e.school, 80) : undefined,
        otherRequirements: Array.isArray(e.otherRequirements)
          ? e.otherRequirements.slice(0, 10).map((value) => clean(value, 220))
          : ["Confirm all eligibility requirements on the source page"],
      },
      topics: Array.isArray(record.topics)
        ? record.topics.slice(0, 12).map((value) => clean(value, 60))
        : [],
      contentHash: "",
      sourceMode: "live",
      evidenceText,
    };
  });
}
export async function importPublicOpportunities(value: unknown) {
  const items = validatePublicIntake(value),
    db = getDb(),
    now = new Date().toISOString();
  for (const item of items) {
    const [existing] = await db
      .select()
      .from(publicSignals)
      .where(eq(publicSignals.canonicalUrl, item.url))
      .limit(1);
    const id = existing?.id || item.id;
    item.id = id;
    if (existing) {
      const old = JSON.parse(existing.payloadJson) as PublicSignal;
      item.sourcePageHash =
        old.sourcePageHash ||
        (old.sourceMode !== "live" ? old.contentHash : undefined);
    }
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(publicSignalVersionKey(item)),
    );
    item.contentHash = [...new Uint8Array(bytes)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    await db
      .insert(publicSignals)
      .values({
        id,
        category: item.category,
        sourceId: item.sourceId,
        canonicalUrl: item.url,
        contentHash: item.contentHash,
        payloadJson: JSON.stringify({ ...item, id }),
        firstSeenAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: publicSignals.id,
        set: {
          contentHash: item.contentHash,
          payloadJson: JSON.stringify({ ...item, id }),
          updatedAt: now,
        },
      });
    await db
      .insert(publicSourceRuns)
      .values({
        id: item.sourceId,
        status: "connected_via_public_research",
        lastAttemptAt: now,
        lastSuccessAt: now,
        itemCount: 1,
      })
      .onConflictDoUpdate({
        target: publicSourceRuns.id,
        set: {
          status: "connected_via_public_research",
          lastAttemptAt: now,
          lastSuccessAt: now,
          lastError: null,
        },
      });
  }
  return { accepted: items.length, checkedAt: now };
}
