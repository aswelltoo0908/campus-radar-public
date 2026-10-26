/** Persistent limits across Worker instances; no plaintext visitor identity is stored. */
export async function withinApiLimit(
  request: Request,
  db: D1Database,
  now = Date.now(),
) {
  const url = new URL(request.url);
  if (
    !url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/api/internal/") ||
    ["GET", "HEAD", "OPTIONS"].includes(request.method)
  )
    return true;
  const identity =
    request.headers.get("oai-authenticated-user-id") ||
    request.headers.get("oai-authenticated-user-email");
  if (!identity) return true; // Routes still reject anonymous callers before accessing private data.
  const bucket =
    url.pathname === "/api/beta/preview"
      ? "preview"
      : url.pathname === "/api/beta/ask"
        ? "ask"
        : "write";
  const limit = bucket === "preview" ? 12 : bucket === "ask" ? 40 : 120;
  const window = Math.floor(now / 300000) * 300000;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${identity}|${bucket}|${window}`),
  );
  const id = [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const row = await db
    .prepare(
      "INSERT INTO api_rate_limits (id,window_start,hits) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET hits=hits+1 RETURNING hits",
    )
    .bind(id, window)
    .first<{ hits: number }>();
  await db
    .prepare("DELETE FROM api_rate_limits WHERE window_start < ?")
    .bind(window - 86400000)
    .run();
  return Boolean(row && row.hits <= limit);
}
