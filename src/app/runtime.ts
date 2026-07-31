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
//   4. seed the room the world will draw, because PRD-13 phase 5 made that
//      explicit view state and Phaser reads it on its first frame;
//   5. attach persistence, so every subsequent change is written.
//
// PRD-13 adds the scene maps to step 1's "validate content": they are validated
// against the manifest built from the refs document, so a scene map that names a
// backdrop nobody staged, or places a character who has no dialogue, is a boot
// failure and not a surprise mid-game.

import { buildCardSets, type CardSets } from "@/content/cardSets";
import { buildCast, type Cast } from "@/content/cast";
import {
  buildGameContent,
  buildSceneMaps,
  type GameContent,
  type SceneMaps,
} from "@/content/loadContent";
import { RAW_BACKDROP_DOCUMENTS, RAW_SCENE_MAP_DOCUMENTS } from "@/content/rawMaps";
import type { EventBus } from "@/core/eventBus";
import { eventBus } from "@/core/eventBus";
import type { Highlights } from "@/core/highlights";
import { ok, type Result } from "@/core/result";
import { loadGame } from "@/core/save";
import type { Storage as CoreStorage } from "@/core/storage";
import { createGameStore, type GameStoreApi } from "@/core/store";
import rawCastDocument from "../../content/characters.json";
import rawCardsDocument from "../../content/daniel-1.cards.json";
import rawDialogueDocument from "../../content/daniel-1.dialogue.json";
import rawRefsDocument from "../../content/daniel-1.refs.json";
import { createBrowserStorage, SAVE_KEY } from "./browserStorage";
import { createCardProvider } from "./cardProvider";
import { createHighlightSyncProvider } from "./highlightSyncProvider";
import { attachPersistence } from "./persistence";
import type {
  CardProvider,
  HighlightSyncProvider,
  ScriptureProvider,
  SessionProvider,
} from "./providers";
import { createDefaultScriptureProvider } from "./scriptureProvider";
import { createSessionProvider } from "./sessionProvider";
import { createViewStore, type ViewStoreApi } from "./viewStore";

/**
 * PRD-10: "sign-in controls sync, not capture" (Design constraint 4) means
 * signing in mid-game has to push everything already accumulated, not only
 * capture from that point on. `SessionProvider` itself cannot do that — it
 * has no reference to the game store — so this wraps the seam at the one
 * place both exist together: this composition point. `isStub`, `current`,
 * and `signOut` all pass straight through; only `signIn`'s success path gains
 * the extra step, and a failed or cancelled sign-in triggers no sync at all.
 */
function withHighlightSyncOnSignIn(
  session: SessionProvider,
  highlightSync: HighlightSyncProvider,
  getHighlights: () => Highlights,
): SessionProvider {
  return {
    isStub: session.isStub,
    current: () => session.current(),
    signOut: () => session.signOut(),
    async signIn() {
      const result = await session.signIn();
      if (result.ok) {
        // Fire-and-forget: a sync failure here is exactly what
        // HighlightSyncProvider already models as a recoverable Result, and
        // the local highlights it is syncing are unaffected either way.
        void highlightSync.syncAll(getHighlights());
      }
      return result;
    },
  };
}

export interface AppRuntime {
  store: GameStoreApi;
  view: ViewStoreApi;
  bus: EventBus;
  content: GameContent;
  cast: Cast;
  /** The four backdrop files and nine scene files, joined and validated (PRD-13). */
  maps: SceneMaps;
  /** The reviewed fallback card sets (ADR-0003), keyed by reference. */
  cardSets: CardSets;
  /** PRD-10: real YouVersion fetch, degrading to bundled WEB; see scriptureProvider.ts. */
  scripture: ScriptureProvider;
  /** PRD-10: real PKCE sign-in, or the stub with no `app_key` configured. */
  session: SessionProvider;
  /** The card-generation seam (PRD-09): real Gloo route, or the fallback stub. */
  cards: CardProvider;
  /** PRD-10: opt-in sync of local highlights to a signed-in YouVersion account. */
  highlightSync: HighlightSyncProvider;
}

export interface CreateAppRuntimeOptions {
  refsDocument?: unknown;
  dialogueDocument?: unknown;
  castDocument?: unknown;
  cardsDocument?: unknown;
  backdropDocuments?: readonly unknown[];
  sceneMapDocuments?: readonly unknown[];
  storage?: CoreStorage;
  bus?: EventBus;
  saveKey?: string;
  scripture?: ScriptureProvider;
  session?: SessionProvider;
  cards?: CardProvider;
  highlightSync?: HighlightSyncProvider;
}

export function createAppRuntime(options: CreateAppRuntimeOptions = {}): Result<AppRuntime> {
  const {
    refsDocument = rawRefsDocument,
    dialogueDocument = rawDialogueDocument,
    castDocument = rawCastDocument,
    cardsDocument = rawCardsDocument,
    backdropDocuments = RAW_BACKDROP_DOCUMENTS,
    sceneMapDocuments = RAW_SCENE_MAP_DOCUMENTS,
    // Evaluated lazily by destructuring, so a caller that injects storage
    // never touches `window` at all.
    storage = createBrowserStorage(),
    bus = eventBus,
    saveKey = SAVE_KEY,
    // PRD-10: the real fetch, degrading to the bundled WEB text with no
    // app_key configured — see scriptureProvider.ts's createDefaultScriptureProvider.
    scripture = createDefaultScriptureProvider(),
    // The real, Gloo-backed provider is the honest default: the browser cannot
    // see the server-only Gloo credential (AGENTS.md §6), so it can never
    // decide whether one is configured — it always calls the route, and the
    // route returns unavailable when it is not. That degradation is the same
    // one a Gloo outage takes, and the encounter controller turns it into the
    // reviewed fallback. A test that wants determinism injects the stub.
    cards = createCardProvider(),
    // PRD-10: unlike Gloo's credential, `app_key` is a *browser* credential
    // (AGENTS.md §6), so the browser can and does decide whether one is
    // configured. With none set, both of these default to their honest
    // stubs, exactly the no-credentials path ADR-0002 "Consequences" requires.
    session: rawSession = createSessionProvider(),
    highlightSync = createHighlightSyncProvider(),
  } = options;

  const content = buildGameContent(refsDocument, dialogueDocument);
  if (!content.ok) return content;

  // Validated against the content above, so a curated section with no
  // character art fails here rather than as a missing sprite mid-game.
  const cast = buildCast(castDocument, content.value);
  if (!cast.ok) return cast;

  const cardSets = buildCardSets(cardsDocument);
  if (!cardSets.ok) return cardSets;

  // Validated against the content above for the same reason `buildCast` is: a
  // scene naming a backdrop that does not exist, or an authored scene whose cast
  // is standing inside a wall, must fail here rather than turn into a grey
  // rectangle or an uncompletable scene once the game is running (ADR-0004,
  // PRD-13 phase 2 and phase 4).
  const maps = buildSceneMaps(backdropDocuments, sceneMapDocuments, content.value);
  if (!maps.ok) return maps;

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

  // PRD-10: signing in mid-game has to push everything already accumulated,
  // not only capture from that point on. `store` is the first thing above
  // that both the raw session provider and the highlight-sync seam need
  // access to at once, which is why the wrap happens here rather than inside
  // either provider.
  const session = withHighlightSyncOnSignIn(
    rawSession,
    highlightSync,
    () => store.getState().highlights,
  );

  // PRD-13 phase 5: which room the world draws is explicit view state, so it has
  // to be seeded before Phaser boots. The first unfinished scene on a fresh or
  // resumed save; the last playable scene once the chapter is finished, since
  // `currentSceneId()` is null then and the world still has to draw somewhere.
  const initialRoom =
    store.getState().currentSceneId() ??
    [...content.value.scenes].reverse().find((scene) => scene.playable)?.id;
  if (initialRoom) view.getState().enterRoom(initialRoom);

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
    maps: maps.value,
    cardSets: cardSets.value,
    scripture,
    session,
    cards,
    highlightSync,
  });
}
