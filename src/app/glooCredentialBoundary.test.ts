// PRD-09 / AGENTS.md §6: the Gloo API key, base URL, and model id are
// server-side only and must never reach the browser bundle. This test proves
// the boundary by construction — it walks every client source file Vite
// bundles and asserts none of them so much as name the Gloo environment
// variables or import the Gloo SDK — and, when a build has produced dist/, it
// scans the built output too. Because dist/ is built from src/, absence in src/
// is absence in dist/; the optional dist/ scan is the belt to that braces.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The Gloo credential material. None of this may appear in bundled client code. */
const FORBIDDEN_TOKENS = ["GLOO_API_KEY", "GLOO_BASE_URL", "GLOO_MODEL_ID", "process.env.GLOO"];

/** The Gloo SDK. It runs only inside the server route, never in the bundle. */
const FORBIDDEN_IMPORTS = [/from\s+["']@ai-sdk\/openai-compatible["']/, /from\s+["']ai["']/];

const SRC_DIR = join(process.cwd(), "src");
const DIST_DIR = join(process.cwd(), "dist");

function walk(dir: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

const CLIENT_SOURCE_FILES = walk(SRC_DIR).filter(
  (file) =>
    (file.endsWith(".ts") || file.endsWith(".tsx")) &&
    !file.endsWith(".test.ts") &&
    !file.endsWith(".test.tsx"),
);

describe("the Gloo credential boundary (AGENTS.md §6)", () => {
  it("finds client source to check, so an empty walk cannot pass vacuously", () => {
    expect(CLIENT_SOURCE_FILES.length).toBeGreaterThan(0);
  });

  it("names no Gloo environment variable anywhere in bundled client source", () => {
    for (const file of CLIENT_SOURCE_FILES) {
      const contents = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_TOKENS) {
        expect(contents.includes(token), `${file} references ${token}`).toBe(false);
      }
    }
  });

  it("imports the Gloo SDK in no bundled client source", () => {
    for (const file of CLIENT_SOURCE_FILES) {
      const contents = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORTS) {
        expect(pattern.test(contents), `${file} imports the Gloo SDK`).toBe(false);
      }
    }
  });

  it("keeps the credential read on the server side, inside the /api route", () => {
    const route = readFileSync(join(process.cwd(), "api", "generate-cards.ts"), "utf8");
    // The one place the key is read, confirming the boundary has a server side
    // and the test above is not passing because nothing reads the key at all.
    expect(route.includes("process.env.GLOO_API_KEY")).toBe(true);
  });

  it("has no Gloo credential in the built bundle, when dist/ has been produced", () => {
    let distFiles: string[] = [];
    try {
      distFiles = walk(DIST_DIR);
    } catch {
      // No build in this run; the src-level proof above stands on its own.
      return;
    }

    for (const file of distFiles) {
      const contents = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_TOKENS) {
        expect(contents.includes(token), `${file} contains ${token}`).toBe(false);
      }
    }
  });
});
