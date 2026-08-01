// The first component test of an existing PRD-08 component, extended by
// PRD-11's {name} substitution. Boots a real runtime (createAppRuntime, in
// memory storage) rather than a hand-rolled double, following the pattern
// already established in src/app/runtime.test.ts.
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("the scene passage card (PRD-14)", () => {
  function bootReal() {
    const result = createAppRuntime({
      storage: createInMemoryStorage(),
      saveKey: "test:dialogue-passage",
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

  /** Scene 1 authors the card after its second line (docs/notes/authoring/scene-01.md). */
  function advanceToCard(runtime: ReturnType<typeof bootReal>) {
    runtime.view.getState().advanceDialogue();
    runtime.view.getState().advanceDialogue();
  }

  it("presents the scene passage at its authored position in the opening", () => {
    const runtime = bootReal();
    advanceToCard(runtime);
    renderBox(runtime);

    // Human-readable reference, never the machine code (PRD-17).
    expect(screen.getByTestId("scene-passage-card")).toHaveTextContent("Daniel 1:1");
    expect(screen.getByTestId("scene-passage-card")).not.toHaveTextContent("DAN.1.1");
  });

  it("keeps the passage behind a deliberate Read action and gates Continue on it", async () => {
    const runtime = bootReal();
    advanceToCard(runtime);
    renderBox(runtime);

    // The same read discipline as the encounter passages: Continue is not
    // available until the passage has actually been opened.
    expect(screen.getByTestId("dialogue-advance")).toBeDisabled();

    await userEvent.click(screen.getByTestId("scene-passage-open"));

    expect(await screen.findByTestId("scene-passage-text")).toHaveTextContent(/Jehoiakim/);
    expect(screen.getByTestId("dialogue-advance")).toBeEnabled();
  });

  it("counts the card as a step of the opening and continues past it to the next line", async () => {
    const runtime = bootReal();
    advanceToCard(runtime);
    renderBox(runtime);

    // No "Beat N of M" progress counter anywhere (PRD-17, operator request).
    expect(screen.queryByText(/Beat \d+ of \d+/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("scene-passage-open"));
    await screen.findByTestId("scene-passage-text");
    await userEvent.click(screen.getByTestId("dialogue-advance"));

    expect(screen.getByTestId("dialogue-text")).toHaveTextContent("Walk around, talk to people");
  });

  it("offers 'Highlight verse' on the opened passage and records the highlight (PRD-16)", async () => {
    // The same deliberate-action capture the encounter passages carry
    // (PRD-10): local always, session only controls sync. Added to the scene
    // passage card by operator request, 2026-07-31.
    const runtime = bootReal();
    advanceToCard(runtime);
    renderBox(runtime);

    await userEvent.click(screen.getByTestId("scene-passage-open"));
    await screen.findByTestId("scene-passage-text");

    await userEvent.click(screen.getByTestId("scene-passage-highlight"));

    expect(runtime.store.getState().highlights).toHaveProperty("DAN.1.1");
    expect(screen.getByTestId("scene-passage-highlighted")).toHaveTextContent("Highlighted");
    expect(screen.queryByTestId("scene-passage-highlight")).not.toBeInTheDocument();
  });

  it("gates the next scene's card even when it lands on the same step index as the last one", async () => {
    // Scene 1 and scene 2 both author their card after the second line, so
    // both sit at step index 2. Keying the "opened" state by index alone let
    // scene 2's card arrive already open, inheriting scene 1's read — the
    // component stays mounted across the room change, so nothing reset it.
    const runtime = bootReal();
    advanceToCard(runtime);
    renderBox(runtime);

    await userEvent.click(screen.getByTestId("scene-passage-open"));
    await screen.findByTestId("scene-passage-text");
    // Finish scene 1's opening, close the scene, and enter scene 2. Wrapped
    // in act(): these land after the initial render, unlike the store setup
    // every other test does beforehand.
    act(() => {
      runtime.view.getState().advanceDialogue();
      runtime.view.getState().advanceDialogue();
      runtime.store.getState().completeScene("scene-1");
      runtime.view.getState().enterRoom("scene-2");
      advanceToCard(runtime);
    });

    expect(screen.getByTestId("scene-passage-card")).toHaveTextContent("Daniel 1:2");
    expect(screen.getByTestId("scene-passage-open")).toBeInTheDocument();
    expect(screen.getByTestId("dialogue-advance")).toBeDisabled();
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
