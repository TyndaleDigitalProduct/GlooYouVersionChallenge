// Test-only. Builds the real `GameManifest` directly from the curated
// content under content/, so src/core specs can assert against the actual
// nine-scene, twenty-four-cross-reference dataset (PRD-08 phase 1) rather
// than only the three-scene fixture in fixtures.ts. Deliberately a plain
// data mapping — no zod, no src/content — so src/core specs stay independent
// of the content-validation layer above them; that layer has its own tests
// in src/content.
//
// Not exported from ./index — this is test-only scaffolding, same as
// fixtures.ts.
import rawRefsDocument from "../../content/daniel-1.refs.json";
import type { GameManifest } from "./manifest";

interface RawCrossReference {
  ref: string;
}

interface RawScene {
  id: number;
  cross_references: RawCrossReference[];
}

interface RawRefsDocument {
  scenes: RawScene[];
}

const refsDocument = rawRefsDocument as RawRefsDocument;

export const realManifest: GameManifest = {
  scenes: refsDocument.scenes.map((scene) => ({
    id: `scene-${scene.id}`,
    regionId: `region-${scene.id}`,
  })),
  crossReferences: refsDocument.scenes.flatMap((scene) =>
    scene.cross_references.map((crossRef) => ({
      reference: crossRef.ref,
      sceneId: `scene-${scene.id}`,
    })),
  ),
};
