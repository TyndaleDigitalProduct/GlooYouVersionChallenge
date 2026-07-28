// The single composition point. Every stub, every adapter, and every store is
// constructed here and nowhere else, so replacing a stub in a later PRD is a
// one-line change in this file plus the new implementation.
//
// Boot order matters and is deliberate:
//   1. validate content, because a bad content pair must fail visibly rather
//      than half-boot a game with a wrong manifest;
//   2. load the save, because the store needs its initial state at
//      construction (src/core exposes no rehydrate action, by design);
//   3. construct the store on the *real* manifest built from content, never
//      the test fixture;
//   4. attach persistence, so every subsequent change is written.

import { buildCast, type Cast } from "@/content/cast";
import { buildGameContent, type GameContent } from "@/content/loadContent";
import type { EventBus } from "@/core/eventBus";
import { eventBus } from "@/core/eventBus";
import { ok, type Result } from "@/core/result";
import { loadGame } from "@/core/save";
import type { Storage as CoreStorage } from "@/core/storage";
import { createGameStore, type GameStoreApi } from "@/core/store";
import rawCastDocument from "../../content/characters.json";
import rawDialogueDocument from "../../content/daniel-1.dialogue.json";
import rawRefsDocument from "../../content/daniel-1.refs.json";
import { createBrowserStorage, SAVE_KEY } from "./browserStorage";
import { attachPersistence } from "./persistence";
import {
  createStubScriptureProvider,
  createStubSessionProvider,
  createStubVerdictProvider,
  type ScriptureProvider,
  type SessionProvider,
  type VerdictProvider,
} from "./providers";
import { createViewStore, type ViewStoreApi } from "./viewStore";

export interface AppRuntime {
  store: GameStoreApi;
  view: ViewStoreApi;
  bus: EventBus;
  content: GameContent;
  cast: Cast;
  scripture: ScriptureProvider;
  verdicts: VerdictProvider;
  session: SessionProvider;
}

export interface CreateAppRuntimeOptions {
  refsDocument?: unknown;
  dialogueDocument?: unknown;
  castDocument?: unknown;
  storage?: CoreStorage;
  bus?: EventBus;
  saveKey?: string;
  scripture?: ScriptureProvider;
  verdicts?: VerdictProvider;
  session?: SessionProvider;
}

export function createAppRuntime(options: CreateAppRuntimeOptions = {}): Result<AppRuntime> {
  const {
    refsDocument = rawRefsDocument,
    dialogueDocument = rawDialogueDocument,
    castDocument = rawCastDocument,
    // Evaluated lazily by destructuring, so a caller that injects storage
    // never touches `window` at all.
    storage = createBrowserStorage(),
    bus = eventBus,
    saveKey = SAVE_KEY,
    scripture = createStubScriptureProvider(),
    verdicts = createStubVerdictProvider(),
    session = createStubSessionProvider(),
  } = options;

  const content = buildGameContent(refsDocument, dialogueDocument);
  if (!content.ok) return content;

  // Validated against the content above, so a curated section with no
  // character art fails here rather than as a missing sprite mid-game.
  const cast = buildCast(castDocument, content.value);
  if (!cast.ok) return cast;

  const view = createViewStore();
  const loaded = loadGame(storage, saveKey);

  if (loaded.status === "recovered") {
    view.getState().pushNotice({
      id: "save-recovered",
      tone: "warning",
      message: `Your saved progress could not be read (${loaded.reason}), so this is a fresh game. Nothing valid was overwritten.`,
    });
  }

  const store = createGameStore({
    manifest: content.value.manifest,
    bus,
    initialState: loaded.state,
  });

  attachPersistence(store, storage, saveKey, (failure) => {
    view.getState().pushNotice({
      id: "save-write-failed",
      tone: "error",
      message: `Progress could not be saved (${failure.error ?? "unknown error"}). Your game is still playable and saving will be retried on the next change.`,
    });
  });

  return ok({
    store,
    view,
    bus,
    content: content.value,
    cast: cast.value,
    scripture,
    verdicts,
    session,
  });
}
