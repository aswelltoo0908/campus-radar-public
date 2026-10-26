/** Cloudflare Worker entry point for the vinext-starter template. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  requestViolation,
  requestBodyLimit,
  secureResponse,
  wantsMarkdown,
  errorRepresentation,
} from "../lib/security";
import { withinApiLimit } from "../lib/server/rate-limit";
import { publicGuide } from "../lib/public-guide";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (
      ["GET", "HEAD"].includes(request.method) &&
      (url.pathname === "/index.md" ||
        (["/", "/docs"].includes(url.pathname) && wantsMarkdown(request)))
    ) {
      return secureResponse(
        new Response(request.method === "HEAD" ? null : publicGuide, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            Vary: "Accept",
          },
        }),
        url.pathname,
      );
    }
    const violation = requestViolation(request);
    if (violation)
      return secureResponse(
        Response.json({ error: violation.error }, { status: violation.status }),
        url.pathname,
      );
    if (
      (url.pathname.startsWith("/api/") || url.pathname === "/mcp") &&
      request.body
    ) {
      const reader = request.clone().body!.getReader();
      let total = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          total += chunk.value.byteLength;
          if (total > requestBodyLimit(url.pathname)) {
            void reader.cancel();
            return secureResponse(
              Response.json(
                { error: "Request is too large." },
                { status: 413 },
              ),
              url.pathname,
            );
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    try {
      if (!(await withinApiLimit(request, env.DB)))
        return secureResponse(
          Response.json(
            { error: "Please wait a few minutes before trying again." },
            { status: 429, headers: { "Retry-After": "300" } },
          ),
          url.pathname,
        );
    } catch {
      return secureResponse(
        Response.json(
          { error: "Request limits could not be checked. Please retry." },
          { status: 503 },
        ),
        url.pathname,
      );
    }
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    try {
      return secureResponse(
        errorRepresentation(request, await handler.fetch(request, env, ctx)),
        url.pathname,
      );
    } catch {
      return secureResponse(
        Response.json(
          { error: "Campus Radar could not complete this request." },
          { status: 500 },
        ),
        url.pathname,
      );
    }
  },
};

export default worker;
