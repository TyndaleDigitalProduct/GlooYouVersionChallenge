import type { AppRuntime } from "@/app/runtime";
import { findSceneContent } from "@/content/loadContent";
import { ChapterCompleteScreen } from "./ChapterCompleteScreen";
import { ChapterMapScreen } from "./ChapterMapScreen";
import { CharacterDialoguePanel } from "./CharacterDialoguePanel";
import { DialogueBox } from "./DialogueBox";
import { EncounterPanel } from "./EncounterPanel";
import { HomeScreen } from "./HomeScreen";
import { HudMenu } from "./HudMenu";
import { IntroOverlay } from "./IntroOverlay";
import { LamplighterExitPanel } from "./LamplighterExitPanel";
import { NoticeStack } from "./NoticeStack";
import { ProximityPrompt } from "./ProximityPrompt";
import { RuntimeProvider, useRuntime, useViewState } from "./RuntimeContext";
import { SceneTransition } from "./SceneTransition";
import { SetupScreen } from "./SetupScreen";
import { displayReference } from "./scriptureReference";
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
 *
 * PRD-13 phase 5 adds two more phase-independent layers and one phase.
 * `ChapterMapScreen` and `SceneTransition` are rendered outside the phase switch
 * because neither belongs to a phase: the chapter map opens over the home screen
 * and over play alike, and the fade has to cover the HUD and any open panel as
 * well as the canvas, which is the whole reason it is a DOM overlay rather than a
 * Phaser camera fade. The new "complete" phase is the end state, reached once
 * every scene of the chapter is closed.
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
      {phase === "complete" ? <ChapterCompleteScreen /> : null}

      <ChapterMapScreen />
      {/* Last, so the fade covers every layer above: the HUD, the phase overlays,
          and the canvas underneath all of them. */}
      <SceneTransition />
    </div>
  );
}

function PlayingScreen() {
  return (
    <>
      <div className="vv-overlay__top">
        <ValeStonesHud />
        <HudMenu />
        <SceneTag />
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

/**
 * Which room the player is standing in, top right.
 *
 * This slot used to read "PRD-04 vertical slice · placeholder content", which was
 * true while the world was nine coloured rectangles and the dialogue was filler.
 * Both are gone: the dialogue document has been authored copy since 2026-07-29 and
 * PRD-13 replaced the placeholder world, so leaving the tag would have put a false
 * disclaimer in every screenshot of the finished game. It says where you are
 * instead, which is worth something now that there are nine places to be and five
 * of them share a backdrop.
 */
function SceneTag() {
  const runtime = useRuntime();
  const roomSceneId = useViewState((state) => state.roomSceneId);
  const scene = roomSceneId ? findSceneContent(runtime.content, roomSceneId) : undefined;
  if (!scene) return null;

  return (
    <p className="vv-build-tag" data-testid="scene-tag">
      Scene {scene.ordinal} of {runtime.content.scenes.length} · {displayReference(scene.verses)}
    </p>
  );
}
