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
import { z } from "zod";
import type { EncounterStateValue, EncountersState } from "./encounters";
import type { Highlights } from "./highlights";
import type { LedgerEntry } from "./ledger";
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
}

export const CURRENT_SAVE_VERSION = 2 as const;

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

const encounterStateValueSchema: z.ZodType<EncounterStateValue> = z.enum([
  "unvisited",
  "engaged",
  "insight-recognised",
]);

const ledgerEntrySchema: z.ZodType<LedgerEntry> = z.object({
  id: z.string(),
  sceneId: z.string(),
  reference: z.string(),
  cause: z.enum(["engagement", "insight"]),
  amount: z.number(),
  createdAt: z.string(),
});

const sessionSchema: z.ZodType<YouVersionSession | null> = z
  .object({ yvpId: z.string() })
  .nullable();

const saveV1Schema = z.object({
  version: z.literal(1),
  completedSceneIds: z.array(z.string()),
  encounters: z.record(z.string(), encounterStateValueSchema),
  ledger: z.array(ledgerEntrySchema),
  session: sessionSchema,
});
type SaveV1 = z.infer<typeof saveV1Schema>;

const saveV2Schema = z.object({
  version: z.literal(2),
  completedSceneIds: z.array(z.string()),
  encounters: z.record(z.string(), encounterStateValueSchema),
  ledger: z.array(ledgerEntrySchema),
  highlights: z.record(z.string(), z.string()),
  session: sessionSchema,
});

/**
 * The only migration path this PRD proves: v1 (pre-highlights) to v2 (the
 * current version, which added highlights). Trivial by design, so the
 * mechanism is exercised before a real migration is ever load-bearing.
 */
function migrateV1ToV2(save: SaveV1): GameState {
  return {
    version: 2,
    completedSceneIds: save.completedSceneIds,
    encounters: save.encounters,
    ledger: save.ledger,
    highlights: {},
    session: save.session,
  };
}

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
    return { status: "migrated", state: migrateV1ToV2(parsed.data), fromVersion: 1 };
  }

  if (versionValue === CURRENT_SAVE_VERSION) {
    const parsed = saveV2Schema.safeParse(json);
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
