#!/usr/bin/env node
// Stages art masters into public/assets/, applying the naming rules.
//
// Why this exists: public/assets/sprites/ was populated by hand, which was
// already unreproducible at 32 files and would be worse at 98 (ADR-0004,
// "Consequences"). PRD-13 phase 1 makes it a script. Everything under
// public/assets/ that this script writes is generated output that happens to be
// committed, because Vercel builds from a clean clone and Phaser loads these by
// URL at runtime.
//
// The masters in art/ are never modified. That is the whole point of the split:
// art/ holds what the artist sent, including `Jerusalem Seige.png`, whose
// misspelling is corrected here on the way out rather than in the master.
//
// Backdrops and environment elements are re-encoded to **lossless** WebP. The
// two heavy backdrops needed reducing (Temple 2.0 MB, Throne Room 1.9 MB
// against Babylon Palace's 364 KB at identical dimensions) and lossless WebP
// takes roughly two thirds off every file while decoding to bit-identical RGBA
// — verified per file by `--verify`. Nothing is quantised and nothing is
// resampled, so there is no visual diff to judge.
//
// What this script does NOT cover: public/assets/portraits/ (six 24x24 busts
// with no 24x24 master in art/ to derive them from), and the loose files under
// public/assets/{backgrounds,icons,tiles,ui,fonts}. Those remain hand-staged.
// Anything not listed in a rule below is left untouched, so running this script
// can never delete an asset it does not know how to regenerate.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const art = (...parts) => join(repoRoot, "art", ...parts);
const staged = (...parts) => join(repoRoot, "public", "assets", ...parts);

const DELIVERY = art("environments", "Daniel 1 Environments");
const ELEMENTS = join(DELIVERY, "Environment Elements");

/**
 * Master file name -> staged backdrop key. Explicit rather than slugified,
 * because `Jerusalem Seige` must become `jerusalem-siege`: a rule that only
 * lowercased and hyphenated would carry the typo through, and a rule clever
 * enough to spell-check would be a rule nobody could predict. The staged key is
 * also the `backdrop` value in content/backdrops/*.json, so this table is the
 * one place the two vocabularies meet.
 */
const BACKDROPS = new Map([
  ["Jerusalem Seige.png", "jerusalem-siege"],
  ["Temple.png", "temple"],
  ["Babylon Palace.png", "babylon-palace"],
  ["Throne Room.png", "throne-room"],
]);

/** Element subfolder -> the backdrop whose props it holds. */
const ELEMENT_FOLDERS = new Map([
  ["1 - Jerusalem Siege", "jerusalem-siege"],
  ["2 - Temple Plunder", "temple"],
  ["3 - Babylon Palace", "babylon-palace"],
  ["4 - Throne Room", "throne-room"],
]);

const SHEET_SUFFIX = "_sheet_8dir_24x32_";

const verify = process.argv.includes("--verify");
const quiet = process.argv.includes("--quiet");

function log(line) {
  if (!quiet) console.log(line);
}

function requireFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error(
      "ffmpeg is not on PATH. It is the WebP encoder this script uses " +
        "(`ffmpeg -c:v libwebp -lossless 1`). Install it, then re-run.",
    );
  }
}

/** SHA-256 of decoded RGBA pixels, so two encodings of the same image match. */
function pixelHash(file) {
  const raw = execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    { maxBuffer: 1024 * 1024 * 256 },
  );
  return createHash("sha256").update(raw).digest("hex");
}

function toLosslessWebp(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    source,
    "-c:v",
    "libwebp",
    "-lossless",
    "1",
    "-compression_level",
    "6",
    destination,
  ]);

  if (verify) {
    if (pixelHash(source) !== pixelHash(destination)) {
      throw new Error(`lossless re-encode changed pixels: ${source}`);
    }
  }

  return statSync(destination).size;
}

function copyAsIs(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  return statSync(destination).size;
}

function stageBackdrops() {
  let bytes = 0;
  for (const [master, key] of BACKDROPS) {
    const source = join(DELIVERY, master);
    const size = toLosslessWebp(source, staged("maps", `${key}.webp`));
    bytes += size;
    log(`  maps/${key}.webp  ${(size / 1024).toFixed(0)} KB  <- ${master}`);
  }
  return bytes;
}

function stageElements() {
  let bytes = 0;
  let count = 0;
  for (const [folder, key] of ELEMENT_FOLDERS) {
    const source = join(ELEMENTS, folder);
    for (const file of readdirSync(source).sort()) {
      if (!file.endsWith(".png")) continue;
      const prop = file.slice(0, -".png".length);
      bytes += toLosslessWebp(join(source, file), staged("maps", "elements", key, `${prop}.webp`));
      count += 1;
    }
  }
  log(`  maps/elements/**  ${count} props, ${(bytes / 1024).toFixed(0)} KB`);
  return bytes;
}

/**
 * Sprite sheets, driven by content/characters.json rather than by a glob: the
 * cast document already names every sheet the game loads, and 129 sheets exist
 * in art/Characters/ for the 32 the game uses. A key like `ashpenaz-tone2`
 * resolves to art/Characters/ashpenaz/ashpenaz_sheet_8dir_24x32_tone2.png.
 * Copied, not re-encoded: WorldScene.preload loads `assets/sprites/<key>.png`
 * and changing sheet encoding is not this PRD's business.
 */
function stageSprites() {
  const cast = JSON.parse(readFileSync(join(repoRoot, "content", "characters.json"), "utf8"));
  const keys = new Set([
    cast.player.sprite,
    cast.lamplighter.sprite,
    ...Object.values(cast.guidesBySection).map((art) => art.sprite),
    ...Object.values(cast.storyCharactersBySpeaker).map((art) => art.sprite),
  ]);

  let bytes = 0;
  for (const key of [...keys].sort()) {
    const separator = key.lastIndexOf("-");
    if (separator === -1) throw new Error(`sprite key has no tone suffix: ${key}`);
    const folder = key.slice(0, separator);
    const tone = key.slice(separator + 1);
    const source = art("Characters", folder, `${folder}${SHEET_SUFFIX}${tone}.png`);
    bytes += copyAsIs(source, staged("sprites", `${key}.png`));
  }

  log(`  sprites/**  ${keys.size} sheets, ${(bytes / 1024).toFixed(0)} KB`);
  return bytes;
}

function main() {
  requireFfmpeg();
  log("Staging art/ masters into public/assets/");
  const backdrops = stageBackdrops();
  const elements = stageElements();
  stageSprites();
  log(
    `\npublic/assets/maps/ payload: ${((backdrops + elements) / 1024).toFixed(0)} KB ` +
      `(${(backdrops / 1024).toFixed(0)} KB backdrops + ${(elements / 1024).toFixed(0)} KB elements)`,
  );
}

main();
