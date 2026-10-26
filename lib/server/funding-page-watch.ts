import type { PublicSignal } from "../types";

/** A page watcher detects changes; only a reviewed intake can replace sourced facts. */
export function reconcileFundingPage(
  seed: Omit<PublicSignal, "contentHash" | "fetchedAt">,
  previous: PublicSignal | undefined,
  pageHash: string,
  checkedAt: string,
): PublicSignal {
  const base = previous || seed;
  // v22 watcher hashes were raw page hashes; reviewed intake hashes were not.
  const priorPageHash =
    previous?.sourcePageHash ||
    (previous && previous.sourceMode !== "live"
      ? previous.contentHash
      : undefined);
  const changed = Boolean(priorPageHash && priorPageHash !== pageHash);
  const availability =
    changed || base.availability === "needs_review"
      ? "needs_review"
      : base.availability === "upcoming" &&
          base.opensAt &&
          Date.parse(base.opensAt) <= Date.parse(checkedAt)
        ? "open"
        : base.availability;
  return {
    ...base,
    availability,
    fetchedAt: checkedAt,
    sourcePageHash: pageHash,
    contentHash: "",
  };
}
