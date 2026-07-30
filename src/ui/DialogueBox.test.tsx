// The first component test of an existing PRD-08 component, extended by
// PRD-11's {name} substitution. Boots a real runtime (createAppRuntime, in
// memory storage) rather than a hand-rolled double, following the pattern
// already established in src/app/runtime.test.ts.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { DialogueBox } from "./DialogueBox";
import { RuntimeProvider } from "./RuntimeContext";

/**
 * A dialogue document overriding only scene 1's Lamplighter-opening beat
 * with a {name} line. DialogueBox (PRD-12) renders only
 * `lamplighterOpening` now — the Lamplighter's exit and every story
 * character/NPC's lines are separate, walk-to-able world interactions — so
 * the name-substitution fixture has to carry its `{name}` line there rather
 * than under `characters`.
 */
function dialogueDocumentWithName() {
  return {
    status: "placeholder",
    note: "Test fixture for PRD-11 name substitution.",
    scenes: Array.from({ length: 9 }, (_, index) => {
      const id = index + 1;
      return id === 1
        ? {
            id,
            playable: true,
            lamplighterOpening: [{ text: "Hello, {name}! Welcome, {name}." }],
            characters: [],
            lamplighterExit: undefined,
          }
        : {
            id,
            playable: false,
            lamplighterOpening: [],
            characters: [],
            lamplighterExit: undefined,
          };
    }),
  };
}

function boot() {
  const result = createAppRuntime({
    dialogueDocument: dialogueDocumentWithName(),
    storage: createInMemoryStorage(),
    saveKey: "test:dialogue-box",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("the playable gate (PRD-13 phase 5)", () => {
  // The trap PRD-12 flagged and PRD-13 phase 5 fixed: the component used to open
  // with `if (!scene?.playable)` and render an "End of the vertical slice" panel,
  // which only ever fired because completing scene 1 advanced `currentSceneId()`
  // onto an unplayable scene 2. With every scene playable that negation can never
  // fire, so the panel would silently never appear again.
  function bootReal() {
    const result = createAppRuntime({
      storage: createInMemoryStorage(),
      saveKey: "test:dialogue-gate",
      bus: createEventBus(),
    });
    if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
    return result.value;
  }

  function renderBox(runtime: ReturnType<typeof bootReal>) {
    render(
      <RuntimeProvider runtime={runtime}>
        <DialogueBox />
      </RuntimeProvider>,
    );
  }

  it("shows the opening of the room the player is in, not of the store's current scene", () => {
    const runtime = bootReal();
    // Completing scene 1 advances `currentSceneId()` to scene 2 immediately,
    // while the player is still standing in scene 1's room being congratulated.
    runtime.store.getState().completeScene("scene-1");
    runtime.view.getState().enterRoom("scene-2");
    renderBox(runtime);

    expect(screen.getByTestId("dialogue-text")).toHaveTextContent(
      "So the siege ended the way sieges usually do",
    );
  });

  it("never presents an end-of-content panel: that is the end state's job", () => {
    const runtime = bootReal();
    for (const scene of runtime.content.scenes) runtime.store.getState().completeScene(scene.id);
    renderBox(runtime);

    expect(screen.queryByTestId("scene-complete")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dialogue-box")).not.toBeInTheDocument();
  });

  it("plays no forced opening in a revisited scene, since its passage was presented already", () => {
    const runtime = bootReal();
    runtime.store.getState().completeScene("scene-1");
    runtime.view.getState().enterRoom("scene-1");
    renderBox(runtime);

    expect(screen.queryByTestId("dialogue-box")).not.toBeInTheDocument();
  });
});

describe("the Lamplighter portrait", () => {
  function bootReal() {
    const result = createAppRuntime({
      storage: createInMemoryStorage(),
      saveKey: "test:dialogue-portrait",
      bus: createEventBus(),
    });
    if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
    return result.value;
  }

  it("peeks the Lamplighter's own sprite over the opening beats, so he reads as speaking", () => {
    const runtime = bootReal();
    render(
      <RuntimeProvider runtime={runtime}>
        <DialogueBox />
      </RuntimeProvider>,
    );

    const portrait = screen.getByTestId("lamplighter-portrait");
    // The real Lamplighter, cropped from his walk sheet — not an ex_* stand-in
    // bust for a different character.
    expect(portrait).toHaveStyle({
      backgroundImage: `url(assets/sprites/${runtime.cast.lamplighterSpriteKey}.png)`,
    });
  });

  it("is gone once the opening is over and free movement takes the screen", () => {
    const runtime = bootReal();
    // Passing every opening beat leaves DialogueBox rendering nothing at all.
    const openingLength = runtime.content.scenes[0].lamplighterOpening.length;
    for (let i = 0; i < openingLength; i += 1) runtime.view.getState().advanceDialogue();

    render(
      <RuntimeProvider runtime={runtime}>
        <DialogueBox />
      </RuntimeProvider>,
    );

    expect(screen.queryByTestId("lamplighter-portrait")).not.toBeInTheDocument();
  });
});

describe("DialogueBox {name} substitution (PRD-11)", () => {
  it("substitutes every {name} occurrence with the saved player name", () => {
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <DialogueBox />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("dialogue-text")).toHaveTextContent("Hello, Ezra! Welcome, Ezra.");
  });

  it("renders the literal placeholder if somehow no name is set, rather than throwing", () => {
    const runtime = boot();

    render(
      <RuntimeProvider runtime={runtime}>
        <DialogueBox />
      </RuntimeProvider>,
    );

    // Defensive-only path (see nameSubstitution.ts): setup enforces a name
    // before dialogue is ever reachable, so this is not the normal case.
    expect(screen.getByTestId("dialogue-text")).toHaveTextContent("Hello, ! Welcome, .");
  });
});
