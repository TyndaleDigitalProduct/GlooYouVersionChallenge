import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { openEncounter } from "@/app/encounterController";
import { type AppRuntime, type CreateAppRuntimeOptions, createAppRuntime } from "@/app/runtime";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { EncounterPanel } from "./EncounterPanel";
import { RuntimeProvider } from "./RuntimeContext";

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

async function renderOpenEncounter(runtime: AppRuntime, reference = "2KI.24.1-4") {
  await openEncounter(runtime, reference);
  render(
    <RuntimeProvider runtime={runtime}>
      <EncounterPanel />
    </RuntimeProvider>,
  );
}

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
