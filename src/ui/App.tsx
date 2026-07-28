import type { AppRuntime } from "@/app/runtime";
import { DialogueBox } from "./DialogueBox";
import { EncounterPanel } from "./EncounterPanel";
import { NoticeStack } from "./NoticeStack";
import { ProximityPrompt } from "./ProximityPrompt";
import { RuntimeProvider } from "./RuntimeContext";
import { ValeStonesHud } from "./ValeStonesHud";

/**
 * The DOM overlay. Phaser owns the canvas underneath; this layer owns
 * everything readable (ADR-0002). It is transparent to pointer events except
 * on its own controls, so the world stays clickable through the gaps.
 */
export function App({ runtime }: { runtime: AppRuntime }) {
  return (
    <RuntimeProvider runtime={runtime}>
      <div className="vv-overlay">
        <div className="vv-overlay__top">
          <ValeStonesHud />
          <p className="vv-build-tag">PRD-04 vertical slice · placeholder content</p>
        </div>

        <NoticeStack />

        <div className="vv-overlay__bottom">
          <ProximityPrompt />
          <DialogueBox />
        </div>

        <EncounterPanel />
      </div>
    </RuntimeProvider>
  );
}
