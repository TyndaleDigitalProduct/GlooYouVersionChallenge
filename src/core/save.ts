// The save format. An explicit integer `version` has existed from the first
// commit of this module. Loading is total: malformed JSON, a missing
// version, a wrong-typed field, and an unknown future version each produce a
// defined outcome (never a throw that reaches the UI), and a corrupt or
// unreadable save falls back to a fresh state with a recoverable error
// rather than white-screening or silently discarding a valid save.
//
// PRD-03 surfaces rather than decides: a YouVersion session here is only
// ever "present" (storing `yvp_id`) or "absent". No refresh token is modeled
// or persisted in this blob — where that lives is PRD-09's call.
//
// v3 (PRD-08 phase 1) does two things: it carries `EncountersState` as
// records (state, generated cards, locked selections) rather than bare
// strings, renaming the terminal state from "insight-recognised" to
// "resolved"; and it adds an optional `playerName` this PRD neither reads
// nor writes, reserved so PRD-10's home-screen work can fill it without a
// second migration (a v2 save being migrated has no name to supply, so
// `migrateV2ToV3` leaves it absent, and that is a legal v3 state).
import { z } from "zod";
import type { EncounterCard, EncounterStateValue, EncountersState } from "./encounters";
import type { Highlights } from "./highlights";
import type { LedgerCause, LedgerEntry } from "./ledger";
import type { Storage } from "./storage";

export interface YouVersionSession {
  yvpId: string;
}

export interface GameState {
  version: number;
  completedSceneIds: string[];
  encounters: EncountersState;
  ledger: LedgerEntry[];
  highlights: Highlights;
  session: YouVersionSession | null;
  /** Reserved for PRD-10. This PRD neither reads nor writes it. */
  playerName?: string;
}

export const CURRENT_SAVE_VERSION = 3 as const;

export function createFreshState(): GameState {
  return {
    version: CURRENT_SAVE_VERSION,
    completedSceneIds: [],
    encounters: {},
    ledger: [],
    highlights: {},
    session: null,
  };
}

const sessionSchema = z.object({ yvpId: z.string() }).nullable();

// --- v1 / v2: pre-PRD-08 shapes, kept only so the migration chain has
// something faithful to migrate from. ------------------------------------

const encounterStateValueSchemaV1V2 = z.enum(["unvisited", "engaged", "insight-recognised"]);
type EncounterStateValueV1V2 = z.infer<typeof encounterStateValueSchemaV1V2>;

const ledgerEntrySchemaV1V2 = z.object({
  id: z.string(),
  sceneId: z.string(),
  reference: z.string(),
  cause: z.enum(["engagement", "insight"]),
  amount: z.number(),
  createdAt: z.string(),
});
type LedgerEntryV1V2 = z.infer<typeof ledgerEntrySchemaV1V2>;

const saveV1Schema = z.object({
  version: z.literal(1),
  completedSceneIds: z.array(z.string()),
  encounters: z.record(z.string(), encounterStateValueSchemaV1V2),
  ledger: z.array(ledgerEntrySchemaV1V2),
  session: sessionSchema,
});
type SaveV1 = z.infer<typeof saveV1Schema>;

const saveV2Schema = z.object({
  version: z.literal(2),
  completedSceneIds: z.array(z.string()),
  encounters: z.record(z.string(), encounterStateValueSchemaV1V2),
  ledger: z.array(ledgerEntrySchemaV1V2),
  highlights: z.record(z.string(), z.string()),
  session: sessionSchema,
});
type SaveV2 = z.infer<typeof saveV2Schema>;

/**
 * The only migration this PRD proves before v3: v1 (pre-highlights) to v2
 * (which added highlights). Trivial by design, so the mechanism is exercised
 * before a real migration is ever load-bearing.
 */
function migrateV1ToV2(save: SaveV1): SaveV2 {
  return {
    version: 2,
    completedSceneIds: save.completedSceneIds,
    encounters: save.encounters,
    ledger: save.ledger,
    highlights: {},
    session: save.session,
  };
}

const RESOLVED_ALIAS: Record<EncounterStateValueV1V2, EncounterStateValue> = {
  unvisited: "unvisited",
  engaged: "engaged",
  "insight-recognised": "resolved",
};

function migrateEncounterV2ToV3(state: EncounterStateValueV1V2): EncountersState[string] {
  return { state: RESOLVED_ALIAS[state] };
}

function migrateLedgerEntryV2ToV3(entry: LedgerEntryV1V2): LedgerEntry {
  // v1/v2 causes are a strict subset of v3's LedgerCause, and every v1/v2
  // entry already carries a reference (both of its causes required one), so
  // no shape transformation is needed here beyond the type widening itself.
  return { ...entry, cause: entry.cause as LedgerCause };
}

/**
 * v2 -> v3: bare encounter strings become records (no cards, no selections —
 * a v2 encounter resolved under the old model has no cards, so its migrated
 * record renders as resolved with the curated note only, which is a legal
 * v3 state), and "insight-recognised" is renamed to "resolved". No
 * `playerName` is supplied: a v2 save has none, and its absence is legal at
 * the schema level.
 */
function migrateV2ToV3(save: SaveV2): GameState {
  const encounters: EncountersState = {};
  for (const [key, value] of Object.entries(save.encounters)) {
    encounters[key] = migrateEncounterV2ToV3(value);
  }

  return {
    version: 3,
    completedSceneIds: save.completedSceneIds,
    encounters,
    ledger: save.ledger.map(migrateLedgerEntryV2ToV3),
    highlights: save.highlights,
    session: save.session,
  };
}

// --- v3: the current shape --------------------------------------------------

const encounterStateValueSchema = z.enum(["unvisited", "engaged", "resolved"]);

const encounterCardSchema: z.ZodType<EncounterCard> = z.object({
  id: z.string(),
  text: z.string(),
  value: z.number().int().min(0).max(5),
});

const encounterRecordSchema = z.object({
  state: encounterStateValueSchema,
  cards: z.array(encounterCardSchema).optional(),
  selections: z.array(z.string()).optional(),
});

const ledgerEntrySchema: z.ZodType<LedgerEntry> = z.object({
  id: z.string(),
  sceneId: z.string(),
  reference: z.string().optional(),
  cause: z.enum(["engagement", "insight", "scene-complete", "all-references"]),
  amount: z.number(),
  createdAt: z.string(),
});

const saveV3Schema: z.ZodType<GameState> = z.object({
  version: z.literal(3),
  completedSceneIds: z.array(z.string()),
  encounters: z.record(z.string(), encounterRecordSchema),
  ledger: z.array(ledgerEntrySchema),
  highlights: z.record(z.string(), z.string()),
  session: sessionSchema,
  playerName: z.string().optional(),
});

export type SaveLoadOutcome =
  | { status: "ok"; state: GameState }
  | { status: "migrated"; state: GameState; fromVersion: number }
  | { status: "recovered"; state: GameState; reason: string };

function recovered(reason: string): SaveLoadOutcome {
  return { status: "recovered", state: createFreshState(), reason };
}

function parseSave(raw: string): SaveLoadOutcome {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return recovered("malformed-json");
  }

  if (typeof json !== "object" || json === null || !("version" in json)) {
    return recovered("missing-version");
  }

  const versionValue = (json as { version: unknown }).version;
  if (typeof versionValue !== "number" || !Number.isInteger(versionValue)) {
    return recovered("invalid-version");
  }

  if (versionValue > CURRENT_SAVE_VERSION) {
    return recovered("future-version");
  }

  if (versionValue === 1) {
    const parsed = saveV1Schema.safeParse(json);
    if (!parsed.success) return recovered("invalid-schema");
    return {
      status: "migrated",
      state: migrateV2ToV3(migrateV1ToV2(parsed.data)),
      fromVersion: 1,
    };
  }

  if (versionValue === 2) {
    const parsed = saveV2Schema.safeParse(json);
    if (!parsed.success) return recovered("invalid-schema");
    return { status: "migrated", state: migrateV2ToV3(parsed.data), fromVersion: 2 };
  }

  if (versionValue === CURRENT_SAVE_VERSION) {
    const parsed = saveV3Schema.safeParse(json);
    if (!parsed.success) return recovered("invalid-schema");
    return { status: "ok", state: parsed.data };
  }

  return recovered("unknown-version");
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function loadGame(storage: Storage, key: string): SaveLoadOutcome {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return recovered("storage-unavailable");
  }

  if (raw === null) {
    return { status: "ok", state: createFreshState() };
  }

  return parseSave(raw);
}

export interface SaveWriteResult {
  ok: boolean;
  retryable?: boolean;
  error?: string;
}

export function saveGame(storage: Storage, key: string, state: GameState): SaveWriteResult {
  try {
    storage.setItem(key, serializeState(state));
    return { ok: true };
  } catch (caught) {
    return {
      ok: false,
      retryable: true,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}
