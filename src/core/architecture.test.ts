import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DIR = path.resolve(__dirname);
const FORBIDDEN_SPECIFIERS = ["phaser", "react", "react-dom"];

// Matches the module specifier of static imports/exports and of dynamic
// import()/require() calls, e.g.:
//   import x from "phaser"
//   import "phaser"
//   export * from 'react-dom'
//   await import("react")
//   require("phaser")
// Comments must be stripped before this runs (see stripComments), otherwise
// prose that merely *mentions* a forbidden specifier — like this file's own
// doc comments — would be indistinguishable from a real import.
const SPECIFIER_PATTERN =
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)|\bfrom\s+["']([^"']+)["']|\bimport\s+["']([^"']+)["']/g;

function stripComments(source: string): string {
  // Strips /* block */ and // line comments. Not a full parser, but the
  // codebase this guards contains no string literals that embed comment
  // delimiters, so this is safe in practice.
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function importedSpecifiers(fileContents: string): string[] {
  const specifiers: string[] = [];
  for (const match of stripComments(fileContents).matchAll(SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

describe("src/core architectural boundary", () => {
  const sourceFiles = listSourceFiles(CORE_DIR);

  it("scans at least one source file (sanity check that the walk itself works)", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it.each(sourceFiles)("%s imports neither phaser, react, nor react-dom", (file) => {
    const contents = readFileSync(file, "utf-8");
    const specifiers = importedSpecifiers(contents);

    const forbiddenHits = specifiers.filter((specifier) =>
      FORBIDDEN_SPECIFIERS.some(
        (forbidden) => specifier === forbidden || specifier.startsWith(`${forbidden}/`),
      ),
    );

    expect(forbiddenHits).toEqual([]);
  });
});

describe("encounters.ts and progression.ts do not import each other (ADR-0003)", () => {
  // ADR-0003 "Consequences": the all-references bonus needs encounter state
  // and progression together, but that must not be satisfied by either
  // module reaching into the other. It belongs in the orchestrator above
  // both (src/core/rewards.ts). The lazy alternative — importing progression
  // from encounters.ts, or vice versa, to compute the bonus inline — is
  // exactly what this test exists to catch.
  const encountersContents = readFileSync(path.join(CORE_DIR, "encounters.ts"), "utf-8");
  const progressionContents = readFileSync(path.join(CORE_DIR, "progression.ts"), "utf-8");

  it("encounters.ts does not import progression.ts", () => {
    const specifiers = importedSpecifiers(encountersContents);
    expect(specifiers.some((specifier) => specifier.includes("progression"))).toBe(false);
  });

  it("progression.ts does not import encounters.ts", () => {
    const specifiers = importedSpecifiers(progressionContents);
    expect(specifiers.some((specifier) => specifier.includes("encounters"))).toBe(false);
  });

  it("rewards.ts is the module allowed to import both, sitting above them", () => {
    const rewardsContents = readFileSync(path.join(CORE_DIR, "rewards.ts"), "utf-8");
    const specifiers = importedSpecifiers(rewardsContents);
    expect(specifiers.some((specifier) => specifier.includes("encounters"))).toBe(true);
    expect(specifiers.some((specifier) => specifier.includes("progression"))).toBe(true);
  });
});
