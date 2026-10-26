import { access, cp, mkdir, rm } from "node:fs/promises";
import { posix, resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    generateBundle(_options, bundle) {
      // Vinext 1.2 emits these runtime assets at the environment root, while
      // Cloudflare places the importing chunks inside _next/static. Preserve
      // the generated manifests, correcting only their relative references.
      for (const entry of Object.values(bundle)) {
        if (entry.type !== "chunk") continue;
        entry.code = entry.code.replace(
          /(["'])\.\/(__vinext_(?:cacheability_manifest|cacheability_request_projection|pregenerated_concrete_paths)\.js|vinext-client-assets\.js)\1/g,
          (_match, quote, name) => {
            const relative = posix.relative(posix.dirname(entry.fileName), name);
            return `${quote}${relative.startsWith(".") ? relative : `./${relative}`}${quote}`;
          },
        );
      }
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}
