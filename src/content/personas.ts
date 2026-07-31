// The guide personas (PRD-16): the authored intro and closing every guide
// speaks around its encounter, loaded from content/personas.json.
//
// Validated against the built content at boot, following buildCast's
// precedent: a curated section with no persona, or a guide persona whose
// intro or closing is empty, is a boot failure rather than an empty dialogue
// box mid-game. The Lamplighter's entry carries empty copy by design (its
// per-scene lines live in the dialogue document), which is why only the
// sections the cross-references actually use are held to the non-empty rule.
import { err, ok, type Result } from "@/core/result";
import type { GameContent } from "./loadContent";
import { describeIssue, type Persona, personasDocumentSchema } from "./schema";

export interface Personas {
  /** Guide personas keyed by biblical section, e.g. "OT History". */
  bySection: ReadonlyMap<string, Persona>;
}

export function buildPersonas(raw: unknown, content: GameContent): Result<Personas> {
  const parsed = personasDocumentSchema.safeParse(raw);
  if (!parsed.success) return err(`personas-document-invalid (${describeIssue(parsed.error)})`);

  const bySection = new Map<string, Persona>();
  for (const persona of parsed.data.personas) {
    if (persona.section === "") continue; // the Lamplighter
    if (bySection.has(persona.section)) {
      return err(`persona-duplicate-section (${persona.section})`);
    }
    bySection.set(persona.section, persona);
  }

  const sections = new Set(
    content.scenes.flatMap((scene) => scene.crossReferences.map((ref) => ref.section)),
  );
  for (const section of sections) {
    const persona = bySection.get(section);
    if (!persona) return err(`persona-missing (${section})`);
    if (persona.intro === "" || persona.closing === "") {
      return err(`persona-copy-empty (${section})`);
    }
  }

  return ok({ bySection });
}

export function personaForSection(personas: Personas, section: string): Persona | undefined {
  return personas.bySection.get(section);
}
