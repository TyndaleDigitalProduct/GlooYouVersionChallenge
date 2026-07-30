import type { AppRuntime } from "@/app/runtime";
import { CharacterDialoguePanel } from "./CharacterDialoguePanel";
import { DialogueBox } from "./DialogueBox";
import { EncounterPanel } from "./EncounterPanel";
import { HomeScreen } from "./HomeScreen";
import { HudMenu } from "./HudMenu";
import { IntroOverlay } from "./IntroOverlay";
import { LamplighterExitPanel } from "./LamplighterExitPanel";
import { NoticeStack } from "./NoticeStack";
import { ProximityPrompt } from "./ProximityPrompt";
import { RuntimeProvider, useViewState } from "./RuntimeContext";
import { SetupScreen } from "./SetupScreen";
import { ValeStonesHud } from "./ValeStonesHud";

/**
 * The DOM overlay. Phaser owns the canvas underneath; this layer owns
 * everything readable (ADR-0002). It is transparent to pointer events except
 * on its own controls, so the world stays clickable through the gaps.
 *
 * PRD-11 gates almost everything below on `phase`: the world (Phaser) keeps
 * running underneath regardless of phase, and an opaque full-screen phase
 * component is what actually stops the player reaching it before "playing".
 * `NoticeStack` is the one exception, rendered in every phase, since a
 * recovered-save notice matters just as much on the home screen as in play.
 */
export function App({ runtime }: { runtime: AppRuntime }) {
  return (
    <RuntimeProvider runtime={runtime}>
      <AppShell />
    </RuntimeProvider>
  );
}

function AppShell() {
  const phase = useViewState((state) => state.phase);

  return (
    <div className="vv-overlay">
      <NoticeStack />

      {phase === "home" ? <HomeScreen /> : null}
      {phase === "setup" ? <SetupScreen /> : null}
      {phase === "intro" ? <IntroOverlay /> : null}
      {phase === "playing" ? <PlayingScreen /> : null}
    </div>
  );
}

function PlayingScreen() {
  return (
    <>
      <div className="vv-overlay__top">
        <ValeStonesHud />
        <HudMenu />
        <p className="vv-build-tag">PRD-04 vertical slice · placeholder content</p>
      </div>

      <div className="vv-overlay__bottom">
        <ProximityPrompt />
        <DialogueBox />
      </div>

      <EncounterPanel />
      <LamplighterExitPanel />
      <CharacterDialoguePanel />
    </>
  );
}
