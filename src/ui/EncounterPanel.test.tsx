import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openEncounter } from "@/app/encounterController";
import { type AppRuntime, type CreateAppRuntimeOptions, createAppRuntime } from "@/app/runtime";
import type { EncounterCard } from "@/core/encounters";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { shuffledCards } from "./cardOrder";
import { EncounterPanel } from "./EncounterPanel";
import { RuntimeProvider } from "./RuntimeContext";

const REFERENCE = "2KI.24.1-4";
const SCENE = "scene-1";

function boot(overrides: CreateAppRuntimeOptions = {}) {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:encounter-panel",
    bus: createEventBus(),
    ...overrides,
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

async function renderOpenEncounter(runtime: AppRuntime, reference = REFERENCE) {
  await openEncounter(runtime, reference);
  render(
    <RuntimeProvider runtime={runtime}>
      <EncounterPanel />
    </RuntimeProvider>,
  );
  await passGuideIntro();
}

/**
 * Steps through the persona intro (PRD-16) when one is showing, landing on
 * the encounter panel the assertions below are about. A resolved encounter
 * shows no intro, so this is a no-op for those.
 */
async function passGuideIntro() {
  const advance = screen.queryByTestId("guide-stage-advance");
  if (advance) await userEvent.click(advance);
}

function orderedCards(): EncounterCard[] {
  return [
    { id: "c1", text: "Five.", value: 5 },
    { id: "c2", text: "Four.", value: 4 },
    { id: "c3", text: "Three.", value: 3 },
    { id: "c4", text: "Zero a.", value: 0 },
    { id: "c5", text: "Zero b.", value: 0 },
    { id: "c6", text: "Zero c.", value: 0 },
  ];
}

/**
 * A runtime whose encounter is already engaged with a known, value-descending
 * card set and opened on the panel — the state the PRD-14 suites assert
 * against, without going through the passage read gate.
 */
function bootWithCards() {
  const runtime = boot();

  const engaged = runtime.store.getState().engageEncounter(SCENE, REFERENCE);
  if (!engaged.ok) throw new Error(`engage failed: ${engaged.reason}`);
  const generated = runtime.store
    .getState()
    .generateEncounterCards(SCENE, REFERENCE, orderedCards());
  if (!generated.ok) throw new Error(`generate failed: ${generated.reason}`);
  runtime.view.getState().openEncounter(REFERENCE);

  return runtime;
}

function renderedCardTexts(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const card = screen.getByTestId(`insight-card-${index}`);
    return card.textContent ?? "";
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EncounterPanel — the 'Highlight verse' button (PRD-10)", () => {
  it("shows no highlight control until the passage has been opened", async () => {
    const runtime = boot();
    await renderOpenEncounter(runtime);

    expect(screen.queryByTestId("passage-card-anchor-highlight")).not.toBeInTheDocument();
    expect(screen.queryByTestId("passage-card-anchor-highlighted")).not.toBeInTheDocument();
  });

  it("records a highlight locally when tapped, with no session required", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    await renderOpenEncounter(runtime);
    expect(runtime.store.getState().session).toBeNull();

    await user.click(screen.getByTestId("passage-card-anchor-open"));
    await user.click(screen.getByTestId("passage-card-anchor-highlight"));

    expect(runtime.store.getState().highlights).toMatchObject({ "DAN.1.1": expect.any(String) });
    expect(screen.getByTestId("passage-card-anchor-highlighted")).toBeInTheDocument();
    // The button is replaced by the tag, not left sitting alongside it.
    expect(screen.queryByTestId("passage-card-anchor-highlight")).not.toBeInTheDocument();
  });

  it("highlighting the anchor passage does not highlight the cross-reference passage", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    await renderOpenEncounter(runtime);

    await user.click(screen.getByTestId("passage-card-anchor-open"));
    await user.click(screen.getByTestId("passage-card-anchor-highlight"));
    await user.click(screen.getByTestId("passage-card-reference-open"));

    expect(screen.getByTestId("passage-card-reference-highlight")).toBeInTheDocument();
    expect(screen.queryByTestId("passage-card-reference-highlighted")).not.toBeInTheDocument();
  });

  it("does not gate highlighting on the read-gate that unlocks the insight cards", async () => {
    // storyboard-v2.md item 7 / §4 step 7 revised by this PRD: the read gate
    // still unlocks the card grid, but no longer implies a highlight.
    const user = userEvent.setup();
    const runtime = boot();
    await renderOpenEncounter(runtime);

    await user.click(screen.getByTestId("passage-card-anchor-open"));
    // Only one of the two passages is read; the card grid stays locked...
    expect(screen.getByTestId("cards-locked-notice")).toBeInTheDocument();
    // ...but the highlight button for the one passage that IS open works
    // independently of that gate.
    await user.click(screen.getByTestId("passage-card-anchor-highlight"));
    expect(runtime.store.getState().highlights).toMatchObject({ "DAN.1.1": expect.any(String) });
  });

  it("syncs the highlight when a session already exists, and reports a recoverable failure without losing it", async () => {
    const user = userEvent.setup();
    const syncOne = vi.fn(async () => ({ ok: false as const, reason: "highlight-sync-failed" }));
    const runtime = boot({
      session: {
        isStub: false,
        current: () => ({ yvpId: "yvp-1" }),
        signOut: () => undefined,
        signIn: vi.fn(),
      },
      highlightSync: { isStub: false, syncOne, syncAll: vi.fn() },
    });
    await renderOpenEncounter(runtime);

    await user.click(screen.getByTestId("passage-card-anchor-open"));
    await user.click(screen.getByTestId("passage-card-anchor-highlight"));

    expect(syncOne).toHaveBeenCalled();
    expect(runtime.store.getState().highlights).toMatchObject({ "DAN.1.1": expect.any(String) });

    // The failure notice is pushed to view state (NoticeStack renders it at
    // the App level, not inside this isolated render tree); asserting the
    // state directly is what proves the local highlight survives the
    // failure without depending on where the notice is displayed.
    await vi.waitFor(() => {
      expect(runtime.view.getState().notices).toContainEqual(
        expect.objectContaining({ tone: "warning" }),
      );
    });
  });
});

describe("the insight card display order (PRD-14)", () => {
  // The authored fallback sets (and the Gloo generation) list cards
  // value-descending, so rendering them as stored let a player pick the top
  // three without reading anything — which defeats the encounter.
  it("deals the grid in shuffled order, not the stored value-descending order", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const runtime = bootWithCards();
    const expected = shuffledCards(orderedCards(), () => 0).map((card) => card.text);

    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );
    await passGuideIntro();

    const texts = renderedCardTexts(6);
    expect(texts.map((text) => text.trim())).toEqual(expected);
    expect(texts.map((text) => text.trim())).not.toEqual(orderedCards().map((card) => card.text));
  });

  it("reveals the resolved summary in the same shuffled order, never value-first", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const runtime = bootWithCards();
    const locked = runtime.store
      .getState()
      .lockEncounterSelections(SCENE, REFERENCE, ["c1", "c2", "c3"]);
    if (!locked.ok) throw new Error(`lock failed: ${locked.reason}`);
    const expected = shuffledCards(orderedCards(), () => 0).map((card) => card.text);

    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("encounter-summary")).toBeInTheDocument();
    const texts = renderedCardTexts(6);
    for (const [index, text] of texts.entries()) {
      expect(text).toContain(expected[index]);
    }
  });
});

describe("the guide intro and closing (PRD-16)", () => {
  it("greets the player with the persona intro before the encounter panel", () => {
    const runtime = bootWithCards();
    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );

    // The intro stage, not the panel: gold-framed box, persona name, the
    // authored line, and the guide's own sprite hung behind the box.
    expect(screen.queryByTestId("encounter-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("guide-stage")).toBeInTheDocument();
    expect(screen.getByTestId("guide-stage-speaker")).toHaveTextContent("the Chronicler");
    expect(screen.getByTestId("guide-stage-text")).toHaveTextContent(
      "Nothing ever happens without a backstory",
    );
    expect(screen.getByTestId("guide-stage-portrait")).toHaveStyle({
      backgroundImage: "url(assets/sprites/chronicler-tone1.png)",
    });
  });

  it("advances from the intro into the encounter panel on 'Open the scrolls'", async () => {
    const runtime = bootWithCards();
    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("guide-stage-advance")).toHaveTextContent("Open the scrolls");
    await userEvent.click(screen.getByTestId("guide-stage-advance"));

    expect(screen.queryByTestId("guide-stage")).not.toBeInTheDocument();
    expect(screen.getByTestId("encounter-panel")).toBeInTheDocument();
  });

  it("plays the closing after a lock in the same open, then returns to the world", async () => {
    const runtime = bootWithCards();
    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );
    await userEvent.click(screen.getByTestId("guide-stage-advance"));

    runtime.view.getState().markPassageRead(REFERENCE, "DAN.1.1");
    runtime.view.getState().markPassageRead(REFERENCE, REFERENCE);
    await userEvent.click(screen.getByTestId("insight-card-0"));
    await userEvent.click(screen.getByTestId("lock-selections"));
    expect(screen.getByTestId("encounter-summary")).toBeInTheDocument();

    // Close after the reveal hands off to the farewell rather than straight out.
    await userEvent.click(screen.getByTestId("encounter-close"));
    expect(screen.getByTestId("guide-stage-text")).toHaveTextContent(
      "It is written, and it is remembered",
    );

    expect(screen.getByTestId("guide-stage-advance")).toHaveTextContent("Go well");
    await userEvent.click(screen.getByTestId("guide-stage-advance"));
    expect(screen.queryByTestId("guide-stage")).not.toBeInTheDocument();
    expect(runtime.view.getState().openEncounterReference).toBeNull();
  });

  it("shows the guide's own sprite in the panel header, matching the intro and closing", async () => {
    // The 24x24 dialogue busts only exist for the generic ex_* stand-ins
    // (characters.json's note), so the panel used to show a different
    // character than the sprite greeting the player. The header bust is now a
    // crop of the same walk sheet the stage uses, so the guide is one
    // character throughout the encounter.
    const runtime = bootWithCards();
    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );
    await passGuideIntro();

    expect(screen.getByTestId("encounter-portrait")).toHaveStyle({
      backgroundImage: "url(assets/sprites/chronicler-tone1.png)",
    });
  });

  it("opens a resolved encounter straight to the summary, with no intro and no closing", async () => {
    const runtime = bootWithCards();
    const locked = runtime.store
      .getState()
      .lockEncounterSelections(SCENE, REFERENCE, ["c1", "c2", "c3"]);
    if (!locked.ok) throw new Error(`lock failed: ${locked.reason}`);

    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );

    expect(screen.queryByTestId("guide-stage")).not.toBeInTheDocument();
    expect(screen.getByTestId("encounter-summary")).toBeInTheDocument();

    // The revisit's Close returns to the world directly: the farewell was said
    // when the encounter resolved, and the guide has gone inactive since.
    await userEvent.click(screen.getByTestId("encounter-close"));
    expect(screen.queryByTestId("guide-stage")).not.toBeInTheDocument();
    expect(runtime.view.getState().openEncounterReference).toBeNull();
  });
});

describe("the Close button (PRD-14)", () => {
  // Operator request: no persistent top-right Close. The one Close lives in a
  // footer at the panel's bottom-right, clickable in every state — quiet
  // (white) during selection so "Lock in your picks" stays the primary
  // action, yellow once the encounter is resolved and Close is all there is.
  it("lives in the footer, quiet during selection, and still closes the panel", async () => {
    const runtime = bootWithCards();
    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );
    await passGuideIntro();

    const close = screen.getByTestId("encounter-close");
    expect(close.className).toContain("vv-button--quiet");
    expect(close.closest("footer")).not.toBeNull();

    await userEvent.click(close);
    expect(screen.queryByTestId("encounter-panel")).not.toBeInTheDocument();
  });

  it("turns yellow once the encounter is resolved", () => {
    const runtime = bootWithCards();
    const locked = runtime.store
      .getState()
      .lockEncounterSelections(SCENE, REFERENCE, ["c1", "c2", "c3"]);
    if (!locked.ok) throw new Error(`lock failed: ${locked.reason}`);

    render(
      <RuntimeProvider runtime={runtime}>
        <EncounterPanel />
      </RuntimeProvider>,
    );

    const close = screen.getByTestId("encounter-close");
    expect(close.className).not.toContain("vv-button--quiet");
    expect(close.closest("footer")).not.toBeNull();
  });
});
