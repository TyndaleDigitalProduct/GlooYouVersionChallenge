// PRD-15: every relative import in an api/ route must name its file
// extension.
//
// Vercel compiles the api/ TypeScript per-file and deploys it as strict ESM
// (package.json sets `"type": "module"`) WITHOUT rewriting import
// specifiers: `from "../src/core/encounters"` ships verbatim, Node looks for
// a file literally named `encounters` next to the compiled `encounters.js`,
// and the function dies at import time with ERR_MODULE_NOT_FOUND. The
// client turns the resulting 500 into `unavailable`, so the outage is
// silent: every production encounter quietly degrades to the fallback card
// set, which is exactly how this shipped unnoticed (found 2026-07-31, the
// deployed /api/generate-cards had never generated once).
//
// Vite rewrites specifiers when it bundles the app, and vitest does the
// same for the suite, which is why neither ever catches this. A static
// check over the route sources is the one place it can fail loudly.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const API_DIR = join(ROOT, "api");

/**
 * Relative specifiers of *runtime* imports: static value imports, dynamic
 * imports, and re-exports. `import type` lines are excluded because tsc
 * erases them — they never reach the deployed JavaScript.
 */
function runtimeRelativeSpecifiers(source: string): string[] {
  const pattern =
    /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;'"]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
  return [...source.matchAll(pattern)]
    .map((match) => match[1] ?? match[2])
    .filter((specifier): specifier is string => specifier !== undefined);
}

/** The .ts source a `.js`-style ESM specifier compiles from. */
function sourceFor(fromFile: string, specifier: string): string {
  return normalize(join(dirname(fromFile), specifier.replace(/\.js$/, ".ts")));
}

/**
 * Every file reachable from the entry through runtime relative imports,
 * with any specifier that omits its extension recorded as a violation.
 */
function walk(entry: string, violations: string[], seen = new Set<string>()): void {
  if (seen.has(entry)) return;
  seen.add(entry);
  const source = readFileSync(entry, "utf-8");
  for (const specifier of runtimeRelativeSpecifiers(source)) {
    if (!/\.(js|mjs|cjs|json)$/.test(specifier)) {
      violations.push(`${relative(ROOT, entry)} imports "${specifier}"`);
      continue;
    }
    if (specifier.endsWith(".js")) walk(sourceFor(entry, specifier), violations, seen);
  }
}

describe("api/ route imports (PRD-15)", () => {
  const routeFiles = readdirSync(API_DIR).filter((name) => name.endsWith(".ts"));

  it("finds the routes it is guarding", () => {
    expect(routeFiles).toContain("generate-cards.ts");
  });

  for (const file of routeFiles) {
    it(`${file}: every runtime import in its transitive chain names its extension`, () => {
      const violations: string[] = [];
      walk(join(API_DIR, file), violations);

      expect(
        violations,
        "Vercel deploys api/ functions as strict ESM without rewriting import " +
          "specifiers, so an extensionless relative import anywhere in the chain " +
          "kills the function at load time (ERR_MODULE_NOT_FOUND) and every " +
          "encounter silently degrades to the fallback cards",
      ).toEqual([]);
    });
  }
});
