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

/** A dialogue document overriding only scene 1's beats with a {name} line. */
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
            beats: [{ speaker: "Guide", text: "Hello, {name}! Welcome, {name}." }],
          }
        : { id, playable: false, beats: [] };
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
