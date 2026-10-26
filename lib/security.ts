/** Shared HTTP checks run before route parsing. Platform owns visitor identity. */
export function wantsMarkdown(request: Request) {
  const accepted = (request.headers.get("accept") || "")
    .split(",")
    .map((value) => {
      const [type, ...parameters] = value.trim().toLowerCase().split(";");
      const parameter = parameters
        .map((x) => x.trim())
        .find((x) => x.startsWith("q="));
      const quality = parameter ? Number(parameter.slice(2)) : 1;
      return {
        type,
        quality:
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
      };
    });
  const md = accepted.find((x) => x.type === "text/markdown")?.quality ?? 0;
  const html =
    (
      accepted.find((x) => x.type === "text/html") ||
      accepted.find((x) => x.type === "text/*") ||
      accepted.find((x) => x.type === "*/*")
    )?.quality ?? 0;
  return md > 0 && md >= html;
}

export function errorRepresentation(
  request: Request,
  response: Response,
): Response {
  if (response.status !== 404) return response;
  const path = new URL(request.url).pathname;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  if (path.startsWith("/api/")) {
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({
            error: "Not found",
            code: "NOT_FOUND",
            docs: "/docs",
          }),
      { status: 404, headers },
    );
  }
  if (["GET", "HEAD"].includes(request.method) && wantsMarkdown(request)) {
    headers.set("content-type", "text/markdown; charset=utf-8");
    headers.set(
      "vary",
      [
        ...new Set(
          (headers.get("vary") || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .concat("Accept"),
        ),
      ].join(", "),
    );
    return new Response(
      request.method === "HEAD"
        ? null
        : "# Page not found\n\nThis Campus Radar page does not exist. Return to the [homepage](/), read the [product guide](/docs), or check the [sitemap](/sitemap.xml).\n",
      { status: 404, headers },
    );
  }
  return response;
}

export function requestViolation(
  request: Request,
): { status: number; error: string } | null {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/mcp") return null;
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (unsafe && url.pathname === "/mcp") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin)
      return { status: 403, error: "Invalid MCP request origin." };
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return { status: 415, error: "JSON content is required." };
  }
  if (
    unsafe &&
    !url.pathname.startsWith("/api/internal/") &&
    url.pathname !== "/mcp" &&
    url.pathname !== "/api/unsubscribe"
  ) {
    const origin = request.headers.get("origin");
    if (
      !origin ||
      origin !== url.origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return {
        status: 403,
        error: "This action must originate from Campus Radar.",
      };
    }
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    ) {
      return { status: 415, error: "JSON content is required." };
    }
  }
  const limit = url.pathname === "/api/beta/preview" ? 2_200_000 : 64_000;
  const declared = request.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || Number(declared) > limit)
  ) {
    return { status: 413, error: "Request is too large." };
  }
  return null;
}

export function requestBodyLimit(path: string) {
  return path === "/api/beta/preview" ? 2_200_000 : 64_000;
}

export function secureResponse(response: Response, path: string) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000");
  // Sites renders previews in its UI; preserve embedding while limiting script origins.
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  if (
    path.startsWith("/api/") ||
    path === "/mcp" ||
    path === "/beta" ||
    path.startsWith("/beta/") ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/unsubscribe"
  )
    headers.set("Cache-Control", "private, no-store");
  if (["/", "/docs"].includes(path))
    headers.set(
      "Vary",
      [
        ...new Set(
          (headers.get("Vary") || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
            .concat("Accept"),
        ),
      ].join(", "),
    );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
