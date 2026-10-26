import type { PublicSignal } from "./types";

/** Bounded public evidence reads keep weekly research runs from loading the whole news pool. */
export function selectPublicStatusItems(
  items: PublicSignal[],
  input: { category?: unknown; limit?: unknown; offset?: unknown } = {},
) {
  const category = input.category ?? "scholarship";
  if (
    !["scholarship", "event", "business_news", "ai_news"].includes(
      String(category),
    )
  )
    throw new Error("Invalid public content category.");
  const limit = input.limit ?? 25,
    offset = input.offset ?? 0;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    typeof offset !== "number" ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 500
  )
    throw new Error("Use limit 1–50 and offset 0–500.");
  const filtered = items.filter((item) => item.category === category);
  return {
    category,
    total: filtered.length,
    items: filtered.slice(offset, offset + limit),
    nextOffset: offset + limit < filtered.length ? offset + limit : null,
  };
}
